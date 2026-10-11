"""Tools Aysu can call. Every order/return tool is scoped to the session's verified customer."""
from __future__ import annotations

import json
import uuid
from dataclasses import dataclass
from datetime import datetime, timezone

from app import db, rag

RETURN_WINDOW_DAYS = 14
TEAMS = ["delivery", "payments", "returns", "technical", "management"]


@dataclass
class Session:
    conversation_id: str
    channel: str = "web"            # web | voice
    customer_id: str | None = None


def _fn(name: str, description: str, props: dict, required: list[str]) -> dict:
    return {"name": name, "description": description,
            "parameters": {"type": "object", "properties": props, "required": required}}


TOOLS = [
    _fn("find_customer", "Müştərini telefon nömrəsi ilə tap və sessiyaya bağla. Sifarişlərə baxmazdan əvvəl lazımdır, "
        "əgər müştəri artıq tanınmırsa.",
        {"phone": {"type": "string", "description": "Telefon nömrəsi, məs. 0501234567 və ya +994501234567"}}, ["phone"]),
    _fn("list_orders", "Tanınmış müştərinin bütün sifarişləri (status, məbləğ, tarix).", {}, []),
    _fn("get_order", "Bir sifarişin tam detalları: məhsullar, kuryer, izləmə nömrəsi, çatdırılma tarixçəsi.",
        {"order_id": {"type": "string", "description": "məs. SB-1042"}}, ["order_id"]),
    _fn("search_knowledge", "Səbət-in qaydaları və FAQ-da axtarış (çatdırılma, qaytarma, zəmanət, ödəniş). "
        "Qayda haqqında danışmazdan əvvəl HƏMİŞƏ istifadə et.",
        {"query": {"type": "string"}}, ["query"]),
    _fn("search_products", "Kataloqda məhsul axtar (ad və ya kateqoriya üzrə), qiymət və stokla.",
        {"query": {"type": "string"}, "max_price": {"type": "number"}}, ["query"]),
    _fn("create_return", "Qaytarma/dəyişdirmə müraciəti aç. Əgər müştəri şəkil göndəribsə, şəkildə gördüyünü "
        "photo_assessment-də obyektiv yaz (zədə növü, yeri, ciddiliyi).",
        {"order_id": {"type": "string"}, "product_id": {"type": "string"},
         "reason": {"type": "string", "enum": ["damaged", "defective", "wrong_item", "not_as_described", "changed_mind"]},
         "photo_assessment": {"type": "string"}}, ["order_id", "product_id", "reason"]),
    _fn("create_ticket", "İnsan əməkdaşa bilet aç (həll edə bilmədiyin və ya səlahiyyətindən kənar məsələ).",
        {"team": {"type": "string", "enum": TEAMS}, "priority": {"type": "string", "enum": ["P1", "P2", "P3"]},
         "summary": {"type": "string"}, "order_id": {"type": "string"}}, ["team", "priority", "summary"]),
]

STATUS_LABELS = {
    "find_customer": "Müştəri axtarılır…", "list_orders": "Sifarişlərə baxılır…", "get_order": "Sifariş yoxlanılır…",
    "search_knowledge": "Qaydalar yoxlanılır…", "search_products": "Kataloqda axtarılır…",
    "create_return": "Qaytarma müraciəti açılır…", "create_ticket": "Əməkdaşa bilet açılır…",
}


def _norm_phone(p: str) -> str:
    digits = "".join(c for c in p if c.isdigit())
    if digits.startswith("994"):
        digits = digits[3:]
    return digits.lstrip("0")[-9:]


def _jsonable(v):
    if isinstance(v, datetime):
        return v.isoformat(timespec="minutes")
    return str(v) if not isinstance(v, (str, int, float, bool, list, dict, type(None))) else v


def _clean(row: dict) -> dict:
    return {k: _jsonable(v) for k, v in row.items()}


def _need_customer(s: Session) -> dict | None:
    if not s.customer_id:
        return {"error": "Müştəri tanınmayıb. Əvvəl telefon nömrəsini soruş və find_customer çağır."}
    return None


def _own_order(s: Session, order_id: str) -> dict | None:
    return db.one("SELECT * FROM orders WHERE upper(id) = upper(%s) AND customer_id = %s", (order_id.strip(), s.customer_id))


def run(s: Session, name: str, args: dict) -> dict:
    try:
        return _run(s, name, args)
    except Exception as e:  # noqa: BLE001 - the model gets the error and can recover
        return {"error": f"{type(e).__name__}: {e}"}


def _run(s: Session, name: str, a: dict) -> dict:
    if name == "find_customer":
        want = _norm_phone(a.get("phone", ""))
        for c in db.query("SELECT id, name, phone, city FROM customers"):
            if _norm_phone(c["phone"]) == want:
                s.customer_id = c["id"]
                db.execute("UPDATE conversations SET customer_id = %s WHERE id = %s", (c["id"], s.conversation_id))
                return {"found": True, "customer": c}
        return {"found": False}

    if name == "search_knowledge":
        return {"results": rag.search(a["query"])}

    if name == "search_products":
        rows = db.query("SELECT id, name, category, price, stock, warranty_months FROM products "
                        "WHERE (name ILIKE %s OR category ILIKE %s) AND (%s::numeric IS NULL OR price <= %s) "
                        "ORDER BY price LIMIT 8",
                        (f"%{a['query']}%", f"%{a['query']}%", a.get("max_price"), a.get("max_price")))
        return {"products": [_clean(r) for r in rows]}

    if name == "create_ticket":
        tid = "TK-" + uuid.uuid4().hex[:6].upper()
        db.execute("INSERT INTO tickets (id, conversation_id, customer_id, order_id, team, priority, summary, source) "
                   "VALUES (%s,%s,%s,%s,%s,%s,%s,'agent')",
                   (tid, s.conversation_id, s.customer_id, a.get("order_id"), a["team"], a["priority"], a["summary"]))
        sla = {"P1": "2 saat", "P2": "24 saat", "P3": "3 iş günü"}[a["priority"]]
        return {"ticket_id": tid, "team": a["team"], "sla": sla}

    if err := _need_customer(s):
        return err

    if name == "list_orders":
        rows = db.query("SELECT id, status, total, created_at, eta FROM orders WHERE customer_id = %s ORDER BY created_at DESC",
                        (s.customer_id,))
        return {"orders": [_clean(r) for r in rows]}

    if name == "get_order":
        o = _own_order(s, a["order_id"])
        if not o:
            return {"error": "Bu müştəridə belə sifariş yoxdur."}
        items = db.query("SELECT p.id AS product_id, p.name, i.qty, i.price, p.warranty_months FROM order_items i "
                         "JOIN products p ON p.id = i.product_id WHERE i.order_id = %s", (o["id"],))
        rets = db.query("SELECT id, product_id, resolution, status FROM returns WHERE order_id = %s", (o["id"],))
        return {"order": _clean(o), "items": [_clean(i) for i in items], "returns": [_clean(r) for r in rets]}

    if name == "create_return":
        o = _own_order(s, a["order_id"])
        if not o:
            return {"error": "Bu müştəridə belə sifariş yoxdur."}
        item = db.one("SELECT p.id, p.name, p.warranty_months FROM order_items i JOIN products p ON p.id = i.product_id "
                      "WHERE i.order_id = %s AND (p.id = %s OR p.name ILIKE %s)",
                      (o["id"], a["product_id"], f"%{a['product_id']}%"))
        if not item:
            return {"error": "Bu məhsul həmin sifarişdə yoxdur."}
        if o["status"] != "delivered" or not o["delivered_at"]:
            return {"decision": "not_eligible", "why": "Sifariş hələ çatdırılmayıb; qaytarma çatdırılmadan sonra mümkündür."}
        days = (datetime.now(timezone.utc) - o["delivered_at"]).days
        reason = a["reason"]
        if reason in ("damaged", "wrong_item"):
            resolution, why = "replacement", "Zədəli/səhv məhsul: pulsuz dəyişdirmə, kuryer məhsulu ünvandan götürür."
            if days > RETURN_WINDOW_DAYS:
                resolution, why = "review", f"Çatdırılmadan {days} gün keçib; mütəxəssis yoxlaması lazımdır."
        elif reason == "defective":
            if days <= RETURN_WINDOW_DAYS:
                resolution, why = "refund", "14 gün ərzində qüsurlu məhsul: tam pul qaytarılması."
            elif days <= item["warranty_months"] * 30:
                resolution, why = "review", "Zəmanət müddətindədir: servis mərkəzinə göndərilir."
            else:
                return {"decision": "not_eligible", "why": "Zəmanət müddəti bitib."}
        else:
            if days > RETURN_WINDOW_DAYS:
                return {"decision": "not_eligible", "why": f"Çatdırılmadan {days} gün keçib; qaytarma müddəti 14 gündür."}
            resolution, why = "refund", "14 gün ərzində qaytarma: məhsul istifadə olunmamış və qablaşdırmada olmalıdır."
        rid = "RT-" + uuid.uuid4().hex[:6].upper()
        db.execute("INSERT INTO returns (id, order_id, product_id, reason, photo_assessment, resolution) "
                   "VALUES (%s,%s,%s,%s,%s,%s)", (rid, o["id"], item["id"], reason, a.get("photo_assessment"), resolution))
        return {"return_id": rid, "product": item["name"], "decision": resolution, "why": why, "days_since_delivery": days}

    return {"error": f"Naməlum tool: {name}"}


def result_text(result: dict) -> str:
    return json.dumps(result, ensure_ascii=False, default=str)
