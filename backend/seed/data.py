"""Synthetic demo data for the fictional store "Səbət". Dates are relative to load time."""
from __future__ import annotations

from datetime import datetime, timedelta, timezone

NOW = datetime.now(timezone(timedelta(hours=4))).replace(second=0, microsecond=0)


def ago(days: float, hour: int | None = None) -> datetime:
    t = NOW - timedelta(days=days)
    return t.replace(hour=hour, minute=0) if hour is not None else t


CUSTOMERS = [
    ("C001", "Leyla Məmmədova", "+994501112233", "leyla.m@example.com", "Bakı"),
    ("C002", "Rəşad Əliyev", "+994552223344", "rashad.a@example.com", "Sumqayıt"),
    ("C003", "Nigar Həsənova", "+994703334455", "nigar.h@example.com", "Bakı"),
    ("C004", "Tural Quliyev", "+994514445566", "tural.q@example.com", "Gəncə"),
    ("C005", "Günel İsmayılova", "+994775556677", "gunel.i@example.com", "Bakı"),
]

# id, name, category, price, stock, warranty_months
PRODUCTS = [
    ("P101", "SoundWave Pro simsiz qulaqlıq", "Elektronika", 189.00, 34, 12),
    ("P102", "Nova X12 smartfon 256GB", "Elektronika", 1149.00, 12, 24),
    ("P103", "Nova X12 silikon örtük", "Aksesuar", 29.00, 120, 0),
    ("P104", "AeroBook 14 noutbuk", "Elektronika", 1899.00, 6, 24),
    ("P105", "FrostLine 300L soyuducu", "Məişət texnikası", 1349.00, 4, 36),
    ("P106", "BrewMate espresso maşını", "Məişət texnikası", 459.00, 9, 24),
    ("P107", "Kətan yataq dəsti (2 nəfərlik)", "Ev və tekstil", 119.00, 40, 0),
    ("P108", "Keramik qab dəsti, 18 hissə", "Ev və tekstil", 89.00, 25, 0),
    ("P109", "Qış gödəkçəsi, unisex", "Geyim", 159.00, 30, 0),
    ("P110", "Smart saat FitPulse 3", "Elektronika", 249.00, 18, 12),
    ("P111", "Robot tozsoran CleanBot S", "Məişət texnikası", 699.00, 7, 24),
    ("P112", "Oyun konsolu siçanı RGB", "Aksesuar", 49.00, 60, 6),
]

# id, customer, status, payment, courier, tracking, address, created, eta, delivered, items[(pid, qty)], timeline
ORDERS = [
    ("SB-1042", "C001", "delivered", "Kart (Visa •• 4821)", "Səbət Express", "SE-77120458", "Bakı, Nərimanov r., Ə. Rəcəbli 12, m. 34",
     ago(6, 11), ago(3).date(), ago(3, 15), [("P101", 1), ("P103", 1)],
     [("sifariş qəbul edildi", ago(6, 11)), ("anbardan çıxdı", ago(5, 9)), ("kuryerdə", ago(3, 10)), ("çatdırıldı", ago(3, 15))]),
    ("SB-1051", "C002", "delayed", "Kart (Mastercard •• 1190)", "AzKargo", "AK-5530217", "Sumqayıt, 9-cu mkr., ev 21, m. 8",
     ago(9, 14), ago(2).date(), None, [("P105", 1)],
     [("sifariş qəbul edildi", ago(9, 14)), ("anbardan çıxdı", ago(7, 10)),
      ("gecikmə: kuryer anbarında yüklənmə növbəsi", ago(2, 18))]),
    ("SB-1057", "C003", "out_for_delivery", "Qapıda nağd", "Səbət Express", "SE-77131902", "Bakı, Yasamal r., Ş. Mehdiyev 45, m. 17",
     ago(2, 16), NOW.date(), None, [("P106", 1), ("P108", 1)],
     [("sifariş qəbul edildi", ago(2, 16)), ("anbardan çıxdı", ago(1, 9)), ("kuryerdə, bu gün 14:00–18:00", ago(0, 9))]),
    ("SB-1033", "C003", "delivered", "Kart (Visa •• 7702)", "Səbət Express", "SE-77098311", "Bakı, Yasamal r., Ş. Mehdiyev 45, m. 17",
     ago(24, 10), ago(20).date(), ago(20, 13), [("P109", 1)],
     [("sifariş qəbul edildi", ago(24, 10)), ("çatdırıldı", ago(20, 13))]),
    ("SB-1060", "C004", "processing", "Kart (Visa •• 3345)", None, None, "Gəncə, Atatürk pr. 88, m. 3",
     ago(1, 20), (NOW + timedelta(days=3)).date(), None, [("P110", 1), ("P112", 1)],
     [("sifariş qəbul edildi", ago(1, 20)), ("ödəniş təsdiqləndi", ago(1, 20))]),
    ("SB-1048", "C005", "delivered", "Hissə-hissə (BirKart, 6 ay)", "AzKargo", "AK-5521876", "Bakı, Xətai r., Babək pr. 30, m. 61",
     ago(44, 12), ago(40).date(), ago(40, 16), [("P104", 1)],
     [("sifariş qəbul edildi", ago(44, 12)), ("çatdırıldı", ago(40, 16))]),
    ("SB-1055", "C001", "shipped", "Kart (Visa •• 4821)", "AzKargo", "AK-5537764", "Bakı, Nərimanov r., Ə. Rəcəbli 12, m. 34",
     ago(2, 9), (NOW + timedelta(days=1)).date(), None, [("P107", 2)],
     [("sifariş qəbul edildi", ago(2, 9)), ("anbardan çıxdı", ago(1, 12))]),
]
