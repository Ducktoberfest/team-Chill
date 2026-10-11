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
      ${a.auto_ticket ? tag("avto-bilet " + a.auto_ticket, "P2") : ""}</div>
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
