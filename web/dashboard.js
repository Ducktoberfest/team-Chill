// ChillDesk ops dashboard: KPIs, Gemma's post-conversation analysis, tickets, returns, KB gaps.
const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const time = (t) => new Date(t).toLocaleString("az-AZ", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "short" });
const tag = (v, cls = v) => v ? `<span class="tag ${esc(cls)}">${esc(v)}</span>` : "";

async function analyze(id, btn) {
  btn.disabled = true; btn.textContent = "Gemma analiz edir";
  await fetch(`/api/conversations/${id}/end`, { method: "POST" });
  load();
}
window.analyze = analyze;

function conv(c) {
  const a = c.analysis;
  const head = `<div class="conv-head"><span class="id">${esc(c.customer || "Qonaq")}</span>
    ${tag(c.channel === "voice" ? "səs" : "chat", c.channel)} <span class="muted">${esc(c.id)} · ${c.n_messages} mesaj</span>
    <span class="time">${time(c.updated_at)}</span></div>`;
  if (!a) {
    return `<div class="conv">${head}<div><button class="btn ghost" onclick="analyze('${esc(c.id)}', this)"><i data-lucide="zap"></i> İndi analiz et</button>
      <span class="muted">Boş qalan söhbətlər 10 saniyədən sonra avtomatik analiz olunur.</span></div></div>`;
  }
  return `<div class="conv">${head}
    <div>${tag(a.category, "")} ${tag(a.urgency)} ${tag(a.sentiment)} ${a.resolved ? tag("həll olundu", "ok") : tag("açıq", "medium")}
      ${a.auto_ticket ? tag("avto-bilet " + a.auto_ticket, "P2") : ""}
      ${a.analyst ? `<span class="tag analyst" title="Təsnifat: fine-tune etdiyimiz model, noutbukda">${esc("1B LoRA · lokal")}</span>` : ""}</div>
    <div>${esc(a.summary)}</div>
    ${a.action_items?.filter(Boolean).length ? `<ul class="actions">${a.action_items.filter(Boolean).map((x) => `<li>${esc(x)}</li>`).join("")}</ul>` : ""}
    <details><summary class="muted"><i data-lucide="mail"></i> Follow-up email: <b>${esc(a.follow_up_email?.subject)}</b></summary>
      <div class="email">${esc(a.follow_up_email?.body)}</div></details>
  </div>`;
}

async function load() {
  const d = await fetch("/api/dashboard").then((r) => r.json());
  const k = d.kpis;
  const items = [
    [k.conversations, "söhbət"], [k.analyzed, "Gemma tərəfindən analiz"], [k.auto_resolved, "agent özü həll etdi"],
    [k.open_tickets, "açıq bilet"], [k.returns, "qaytarma müraciəti"], [k.negative, "narazı müştəri"],
  ];
  const first = !$("#kpis").children.length;
  $("#kpis").innerHTML = items.map(([v, l], i) => `<div class="kpi" style="animation-delay:${i * 70}ms"><div class="v" data-to="${v}">${first ? 0 : v}</div><div class="l">${l}</div></div>`).join("");
  if (first) countUp();
  $("#convs").innerHTML = d.conversations.map(conv).join("") || `<div class="empty">Hələ söhbət yoxdur.</div>`;
  $("#tickets").innerHTML = d.tickets.length ? `<table><tr><th>Bilet</th><th>Komanda</th><th>Xülasə</th></tr>${d.tickets.map((t) => `
    <tr><td><b>${esc(t.id)}</b><br>${tag(t.priority)} ${tag(t.source === "automation" ? "avto" : "agent", t.source === "automation" ? "voice" : "")}</td>
    <td>${esc(t.team)}<br><span class="muted">${esc(t.customer || "")}</span></td><td>${esc(t.summary)}</td></tr>`).join("")}</table>`
    : `<div class="empty">Bilet yoxdur.</div>`;
  $("#returns").innerHTML = d.returns.length ? `<table><tr><th>Müraciət</th><th>Məhsul</th><th>Qərar</th></tr>${d.returns.map((r) => `
    <tr><td><b>${esc(r.id)}</b><br><span class="muted">${esc(r.order_id)}</span></td>
    <td>${esc(r.product)}<br><span class="muted">${esc(r.reason)}${r.photo_assessment ? " · Şəkil: " + esc(r.photo_assessment) : ""}</span></td>
    <td>${tag(r.resolution, r.resolution === "review" ? "medium" : "ok")}</td></tr>`).join("")}</table>`
    : `<div class="empty">Qaytarma yoxdur.</div>`;
  $("#gaps").innerHTML = d.kb_gaps.length ? `<ul class="actions">${d.kb_gaps.map((g) => `<li>${esc(g)}</li>`).join("")}</ul>`
    : `<div class="empty">Boşluq tapılmadı.</div>`;
  window.lucide && window.lucide.createIcons();
}

// KPI numbers count up on first load
function countUp() {
  document.querySelectorAll(".kpi .v").forEach((el) => {
    const to = +el.dataset.to, t0 = performance.now();
    const step = (t) => {
      const k = Math.min(1, (t - t0) / 1100), e = 1 - Math.pow(1 - k, 3);
      el.textContent = Math.round(to * e);
      if (k < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  });
}

fetch("/api/config").then((r) => r.json()).then((c) => { $("#model").textContent = `${c.model} · ${c.embed_model} · Neon`; });
load();
setInterval(load, 5000);

// ---------------------------------------------------------------- analytics overlay (SVG donuts + bars, animated)
const PALETTE = ["#0b7a5c", "#14b8a6", "#f97316", "#5eead4", "#fdba4d", "#0f2a33", "#16a34a"];
const TONE = { high: "#e5484d", medium: "#f59e0b", low: "#16a34a", negative: "#e5484d", neutral: "#f59e0b", positive: "#16a34a",
  "agent özü həll etdi": "#16a34a", "insana ötürüldü": "#f97316", "açıq": "#f59e0b", replacement: "#14b8a6", refund: "#0b7a5c", review: "#f59e0b",
  delivered: "#16a34a", delayed: "#e5484d", shipped: "#14b8a6", out_for_delivery: "#0b7a5c", processing: "#94a3b8", web: "#0b7a5c", voice: "#f97316" };
const LABEL = { web: "chat", voice: "səs", high: "yüksək", medium: "orta", low: "aşağı", negative: "narazı", neutral: "neytral", positive: "razı",
  replacement: "dəyişmə", refund: "pul qaytarma", review: "yoxlama", delivered: "çatdırılıb", delayed: "gecikir", shipped: "yolda",
  out_for_delivery: "bu gün kuryerdə", processing: "hazırlanır", delivery: "çatdırılma", returns: "qaytarma", payment: "ödəniş",
  product_question: "məhsul sualı", technical: "texniki", complaint: "şikayət", other: "digər", payments: "ödəniş", management: "rəhbərlik" };
const color = (l, i) => TONE[l] || PALETTE[i % PALETTE.length];
const nice = (l) => LABEL[l] || l;

function donut(title, rows, sub) {
  const total = rows.reduce((a, r) => a + r.value, 0) || 1;
  const R = 52, C = 2 * Math.PI * R;
  let off = 0;
  const arcs = rows.map((r, i) => {
    const len = (r.value / total) * C;
    const a = `<circle r="${R}" cx="70" cy="70" fill="none" stroke="${color(r.label, i)}" stroke-width="16" stroke-linecap="butt"
      stroke-dasharray="0 ${C}" data-len="${len}" data-c="${C}" stroke-dashoffset="${-off}" transform="rotate(-90 70 70)" style="transition-delay:${i * 120}ms"/>`;
    off += len;
    return a;
  }).join("");
  const legend = rows.map((r, i) => `<li><i style="background:${color(r.label, i)}"></i>${esc(nice(r.label))}<b>${r.value}</b></li>`).join("");
  return `<div class="an-card"><h3>${title}</h3><div class="an-donut"><svg viewBox="0 0 140 140"><circle r="${R}" cx="70" cy="70" fill="none" stroke="rgba(16,36,43,.07)" stroke-width="16"/>${arcs}
    <text x="70" y="68" text-anchor="middle" class="an-total" data-to="${total === 1 && !rows.length ? 0 : rows.reduce((a, r) => a + r.value, 0)}">0</text><text x="70" y="88" text-anchor="middle" class="an-sub">${sub}</text></svg>
    <ul class="an-legend">${legend || "<li class='muted'>data yoxdur</li>"}</ul></div></div>`;
}

function bars(title, rows) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return `<div class="an-card"><h3>${title}</h3><div class="an-bars">${rows.map((r, i) => `
    <div class="an-bar"><span class="an-l">${esc(nice(r.label))}</span>
      <span class="an-track"><span class="an-fill" style="--w:${(r.value / max) * 100}%;background:${color(r.label, i)};transition-delay:${i * 90}ms"></span></span>
      <b class="an-v" data-to="${r.value}">0</b></div>`).join("") || "<p class='muted'>data yoxdur</p>"}</div></div>`;
}

async function openAnalytics() {
  const d = await fetch("/api/analytics").then((r) => r.json());
  const conv = d.channel.reduce((a, r) => a + r.value, 0);
  const resolved = (d.resolved.find((r) => r.label === "agent özü həll etdi") || { value: 0 }).value;
  const analyzed = d.resolved.reduce((a, r) => a + r.value, 0) || 1;
  $("#an-grid").innerHTML = `
    <div class="an-card an-stats">
      <div><span class="an-big" data-to="${conv}">0</span><span>söhbət</span></div>
      <div><span class="an-big" data-to="${Math.round((resolved / analyzed) * 100)}">0</span><span>% agent özü həll etdi</span></div>
      <div><span class="an-big" data-to="${d.ticket_team.reduce((a, r) => a + r.value, 0)}">0</span><span>bilet</span></div>
      <div><span class="an-big" data-to="${Math.round(d.revenue)}">0</span><span>₼ sifariş dövriyyəsi</span></div>
    </div>
    ${donut("Nəticə", d.resolved, "analiz")}
    ${donut("Emosiya", d.sentiment, "söhbət")}
    ${donut("Kanal", d.channel, "söhbət")}
    ${bars("Kateqoriya", d.category)}
    ${bars("Təcililik", d.urgency)}
    ${bars("Biletlər · komanda", d.ticket_team)}
    ${donut("Biletləri kim açdı", d.ticket_source, "bilet")}
    ${donut("Qaytarma qərarları", d.returns, "müraciət")}
    ${bars("Sifariş statusu", d.orders)}`;
  const el = $("#analytics");
  el.hidden = false;
  window.lucide && window.lucide.createIcons();
  requestAnimationFrame(() => requestAnimationFrame(() => {
    el.classList.add("open");
    el.querySelectorAll(".an-card").forEach((c, i) => { c.style.transitionDelay = `${i * 60}ms`; });
    el.querySelectorAll("circle[data-len]").forEach((c) => { c.setAttribute("stroke-dasharray", `${c.dataset.len} ${c.dataset.c}`); });
    el.querySelectorAll(".an-fill").forEach((f) => f.classList.add("go"));
    el.querySelectorAll("[data-to]").forEach((n) => {
      const to = +n.dataset.to, t0 = performance.now() + 250;
      const step = (t) => { const k = Math.max(0, Math.min(1, (t - t0) / 1100)), e = 1 - Math.pow(1 - k, 3);
        n.textContent = Math.round(to * e).toLocaleString("az-AZ"); if (k < 1) requestAnimationFrame(step); };
      requestAnimationFrame(step);
    });
  }));
}
function closeAnalytics() { const el = $("#analytics"); el.classList.remove("open"); setTimeout(() => { el.hidden = true; }, 350); }
$("#open-analytics").onclick = openAnalytics;
$("#close-analytics").onclick = closeAnalytics;
document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeAnalytics(); });
