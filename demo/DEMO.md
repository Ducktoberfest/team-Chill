# Demo ssenarisi — Ali Hasanov (070 761 62 88)

Hazırlıq: `localhost:8000` aç → **Ctrl+Shift+R** → yuxarıda hesab menyusundan **Ali Hasanov** seç → **Aysu ilə danış**.
Yan tabda `localhost:8000/dashboard` açıq qalsın.

| Sifariş | Məhsul | Vəziyyət |
|---|---|---|
| ML-2001 | FitPulse 3 smart saat | 2 gün əvvəl çatdırılıb |
| ML-2002 | AeroBook 14 noutbuk | gecikir (anbarda keyfiyyət yoxlaması) |
| ML-2003 | Qış gödəkçəsi | 5 gün əvvəl çatdırılıb |

---

## 1 · Çatlı smart saat → şəkil → pulsuz dəyişmə  (≈15 s)
Sancaq (attach) düyməsi ilə bu şəkli yüklə: **`demo/cracked-watch.jpg`**, sonra yaz:

> Salam, smart saatım gəlib amma ekranı çatlıdır, şəkli göndərirəm. Dəyişmək istəyirəm.

Gözlənilən: `list_orders → get_order → create_return` addımları görünür, Aysu çatı təsvir edir, **RT-…** nömrəli **pulsuz dəyişmə** açır.
Deyəcəyin: *"Gemma 4 şəkli özü gördü, sifarişi tapdı, qayda mühərriki ilə qərar verdi — operator yoxdur."*

## 2 · Gecikən noutbuk → əsəbi müştəri → bilet + kompensasiya
> Noutbukum 3 gündür gecikir, artıq bezmişəm! Nə vaxt gələcək?

Gözlənilən: `get_order → create_ticket` — çatdırılma komandasına bilet, SLA 24 saat. Sonra soruş:

> Gecikməyə görə mənə kompensasiya düşür?

Gözlənilən: `search_knowledge` → "2 gündən çox gecikmədə **10% endirim kodu**" qaydası.

## 3 · Fikrini dəyişdi → 14 günlük qaytarma → pul geri
> Gödəkçəni almışdım, amma fikrimi dəyişdim, qaytarmaq istəyirəm. Pulum nə vaxt qayıdır?

Aysu şərtləri deyib təsdiq istəyir. Cavab ver:

> Bəli, istifadə etməmişəm, qablaşdırması da var.

Gözlənilən: `create_return` → **refund**, kartla ödəniş üçün **3–5 iş günü**.

## Final · Dashboard (≈10 s sonra)
Söhbəti ✓ ilə bağla (və ya 10 saniyə gözlə) → dashboard: xülasə, kateqoriya, təcililik, emosiya, avto-bilet, hazır **follow-up email**.

## Bonus · Səsli zəng
Zəng düyməsi → "duut… duut" → Aysu qoşulur. De: *"Salam, mənim nömrəm sıfır yetmiş, yeddi yüz altmış bir, altmış iki, səksən səkkiz. Noutbukum nə vaxt gələcək?"*
(Səs STT-si zalda səs-küydən təsirlənə bilər — əsas demo chat-dir.)
