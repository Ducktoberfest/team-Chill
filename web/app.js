// Mallard demo store + Aysu support widget (web chat over SSE, voice via ElevenLabs).
import { AysuAvatar, TAG_EMOTION } from "./aysu-avatar.js?v=8";

const $ = (s) => document.querySelector(s);
let aysu = null;        // avatar in the support panel
const avatarSrc = "/static/avatar/aysu.glb";
const ICON = { P101: "headphones", P102: "smartphone", P103: "shield", P104: "laptop", P105: "refrigerator", P106: "coffee",
  P107: "bed-double", P108: "utensils", P109: "shirt", P110: "watch", P111: "bot", P112: "mouse" };
const icon = (name) => `<i data-lucide="${name}"></i>`;
const paintIcons = () => window.lucide && window.lucide.createIcons();
let products = [];
let cart = 0;

let config = null;
let conversationId = null;
let pendingImages = [];
let busy = false;
let voice = null;

// ---------------------------------------------------------------- helpers
const esc = (s) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

function md(text) {
  // tiny, safe markdown: **bold**, bullet lists, paragraphs
  const blocks = esc(text).replace(/\*\*(.+?)\*\*/g, "<b>$1</b>").split(/\n{2,}/);
  return blocks.map((b) => {
    const lines = b.split("\n");
    if (lines.every((l) => /^\s*([-*•]|\d+\.)\s+/.test(l))) {
      return "<ul>" + lines.map((l) => "<li>" + l.replace(/^\s*([-*•]|\d+\.)\s+/, "") + "</li>").join("") + "</ul>";
    }
    return "<p>" + lines.join("<br>") + "</p>";
  }).join("");
}

function scroll() { const m = $("#messages"); m.scrollTop = m.scrollHeight; }

function addMsg(role, text, images = []) {
  const el = document.createElement("div");
  el.className = `msg ${role}`;
  el.innerHTML = images.map((i) => `<img src="data:${i.mime};base64,${i.data}" alt="">`).join("") + (text ? md(text) : "");
  $("#messages").append(el);
  scroll();
  return el;
}

function addStep(ev) {
  const el = document.createElement("div");
  el.className = "step";
  const detail = esc(JSON.stringify({ args: ev.args, result: ev.result }, null, 2));
  el.innerHTML = `<details><summary>${icon("cpu")} <b>${esc(ev.name)}</b> · ${esc(ev.label)}</summary><pre>${detail}</pre></details>`;
  $("#messages").append(el);
  paintIcons();
  scroll();
}

function addNote(text) {
  const el = document.createElement("div");
  el.className = "typing";
  el.textContent = text;
  $("#messages").append(el);
  scroll();
  return el;
}

async function downscale(file, max = 1280) {
  const img = await createImageBitmap(file);
  const k = Math.min(1, max / Math.max(img.width, img.height));
  const c = document.createElement("canvas");
  c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
  c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
  const url = c.toDataURL("image/jpeg", 0.85);
  return { mime: "image/jpeg", data: url.split(",")[1] };
}

// ---------------------------------------------------------------- chat
async function send(text) {
  if (busy || (!text.trim() && !pendingImages.length)) return;
  busy = true; $("#send").disabled = true;
  const images = pendingImages; pendingImages = []; $("#preview").innerHTML = "";
  addMsg("user", text, images);
  $("#input").value = "";
  aysu?.setState("thinking");
  const typing = addNote("Aysu yazır");
  try {
    const res = await fetch("/api/chat", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ conversation_id: conversationId, customer_id: $("#customer").value || null, message: text, images }),
    });
    const reader = res.body.getReader();
    const dec = new TextDecoder();
    let buf = "";
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      let i;
      while ((i = buf.indexOf("\n\n")) >= 0) {
        const line = buf.slice(0, i).trim(); buf = buf.slice(i + 2);
        if (!line.startsWith("data:")) continue;
        const data = line.slice(5).trim();
        if (data === "[DONE]") continue;
        const ev = JSON.parse(data);
        if (ev.type === "conversation") conversationId = ev.id;
        else if (ev.type === "tool") { addStep(ev); $("#messages").append(typing); reactToTool(ev); }
        else if (ev.type === "text") addMsg("bot", ev.text);
        else if (ev.type === "error") { addMsg("bot", "Xəta: " + ev.error); aysu?.setEmotion("concerned"); aysu?.setState("idle"); }
      }
    }
  } catch (e) {
    addMsg("bot", "Bağlantı xətası: " + e.message);
    aysu?.setEmotion("concerned"); aysu?.setState("idle");
  } finally {
    typing.remove();
    busy = false; $("#send").disabled = false;
  }
}

// Aysu's face follows the tone of the call: the agent's expressive tag, or the customer's words
const stripTags = (t) => t.replace(/\[[a-zA-Z ]{2,24}\]\s*/g, "").trim();
const ANGRY = /(əsəb|bezdim|rəzalət|biabır|dəhşət|yenə|hələ də|niyə hələ|şikayət|pulumu|aldat|!!)/i;
const THANKS = /(təşəkkür|sağ ol|çox sağ|əla|super|minnətdar|çox gözəl)/i;
function reactToTone(source, text) {
  if (!aysu) return;
  if (source === "user") {
    if (ANGRY.test(text)) aysu.setEmotion("empathetic", { durationMs: 6000 });
    else if (THANKS.test(text)) aysu.setEmotion("happy", { durationMs: 4000 });
    return;
  }
  const tag = (text.match(/\[([a-zA-Z]+)\]/) || [])[1];
  const emo = tag && TAG_EMOTION[tag.toLowerCase()];
  if (emo) aysu.setEmotion(emo, { durationMs: 7000 });
}

function reactToTool(ev) {
  const r = ev.result || {};
  if (ev.name === "create_return" && ["replacement", "refund"].includes(r.decision)) aysu?.setEmotion("happy", { durationMs: 4000 });
  else if (ev.name === "create_return" && r.decision === "not_eligible") aysu?.setEmotion("empathetic", { durationMs: 4000 });
  else if (ev.name === "create_ticket") aysu?.setEmotion("empathetic", { durationMs: 4000 });
}

async function endConversation(id) {
  if (!id) return;
  const note = addNote("Söhbət bağlanır, Gemma analiz edir…");
  const r = await fetch(`/api/conversations/${id}/end`, { method: "POST" }).then((r) => r.json()).catch(() => null);
  note.remove();
  const a = r && r.analysis;
  if (a) {
    const el = document.createElement("div");
    el.className = "notice";
    el.innerHTML = `${icon("check")} Analiz: ${esc(a.category)} · ${esc(a.urgency)} · ${esc(a.sentiment)}${a.auto_ticket ? " · bilet " + esc(a.auto_ticket) : ""}`;
    $("#messages").append(el); paintIcons(); scroll();
  }
}

// ---------------------------------------------------------------- voice (ElevenLabs Conversational AI)
// Ringback tone like a real phone line: 425 Hz, 1 s on / 3 s off.
function startRingback() {
  const ctx = new (window.AudioContext || window.webkitAudioContext)();
  const gain = ctx.createGain(); gain.gain.value = 0; gain.connect(ctx.destination);
  const osc = ctx.createOscillator(); osc.frequency.value = 425; osc.connect(gain); osc.start();
  const beep = (t) => {
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(0.18, t + 0.03);
    gain.gain.setValueAtTime(0.18, t + 1.0);
    gain.gain.linearRampToValueAtTime(0, t + 1.05);
  };
  let next = ctx.currentTime + 0.25;
  beep(next);
  const timer = setInterval(() => { next += 4; beep(next); }, 4000);
  return () => { clearInterval(timer); gain.gain.cancelScheduledValues(ctx.currentTime); gain.gain.value = 0; setTimeout(() => ctx.close(), 100); };
}

let callTimer = null;
function setCallStatus(t) { $("#voice-status").textContent = t; }

function closeCallScreen() {
  const cs = $("#call-screen");
  clearInterval(callTimer); callTimer = null;
  cs.classList.add("closing");
  setTimeout(() => { cs.hidden = true; cs.classList.remove("closing", "connected"); $("#call-timer").textContent = ""; }, 350);
}

let calling = false;
let cancelCall = null;   // set while ringing; hanging up before Aysu answers cancels the call
async function toggleCall() {
  if (voice) { await voice.endSession(); return; }
  if (calling) return;
  if (!config.agent_id) { addMsg("bot", "Səsli agent qurulmayıb."); return; }
  calling = true;
  const cs = $("#call-screen");
  cs.hidden = false; setCallStatus("Zəng edilir");
  const stopRing = startRingback();
  const ringStarted = performance.now();
  let stopped = false;
  const stopRingOnce = () => { if (!stopped) { stopped = true; stopRing(); } };
  let cancelled = false;
  cancelCall = () => { cancelled = true; stopRingOnce(); calling = false; closeCallScreen(); };
  try {
    // load Aysu, the SDK and a conversation id while the line rings
    if (!aysu) {
      aysu = new AysuAvatar($("#aysu-stage"), { src: avatarSrc, framing: "bust" });
      aysu.load().catch((e) => console.warn("avatar", e));
    }
    const [{ Conversation }, start] = await Promise.all([
      import("https://cdn.jsdelivr.net/npm/@elevenlabs/client@1.27.0/+esm"),
      fetch("/api/voice/start", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customer_id: $("#customer").value || null }) }).then((r) => r.json()),
    ]);
    const voiceId = start.conversation_id;
    // let at least one full "duut" play before Aysu picks up
    await new Promise((r) => setTimeout(r, Math.max(0, 2600 - (performance.now() - ringStarted))));
    if (cancelled) return;
    const session = await Conversation.startSession({
      agentId: config.agent_id,
      connectionType: "websocket",   // websocket delivers per-character alignment for lip sync
      textOnly: false,
      customLlmExtraBody: { conversation_id: voiceId, customer_id: $("#customer").value || null },
      onConnect: () => {
        stopRingOnce();
        cs.classList.add("connected");
        setCallStatus("Qoşuldu");
        const t0 = Date.now();
        callTimer = setInterval(() => {
          const s = Math.floor((Date.now() - t0) / 1000);
          $("#call-timer").textContent = `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
        }, 1000);
        aysu?.useFrequencySource(() => voice && voice.getOutputByteFrequencyData());
        aysu?.setState("listening");
      },
      onModeChange: ({ mode }) => {
        setCallStatus(mode === "speaking" ? "Aysu danışır" : "Aysu dinləyir");
        aysu?.setState(mode === "speaking" ? "speaking" : "listening");
        if (mode === "listening") aysu?.clearAlignment();
      },
      onAudioAlignment: (al) => aysu?.pushAlignment(al),
      onMessage: ({ source, message }) => {
        reactToTone(source, message);
        addMsg(source === "user" ? "user" : "bot", stripTags(message));
      },
      onError: (e) => addMsg("bot", "Səs xətası: " + (e?.message || e)),
      onDisconnect: () => {
        voice = null; calling = false; cancelCall = null;
        stopRingOnce();
        aysu?.stopAudio(); aysu?.setState("idle");
        closeCallScreen();
        endConversation(voiceId);
      },
    });
    if (cancelled) { await session.endSession(); return; }
    voice = session;
    cancelCall = null;
  } catch (e) {
    if (cancelled) return;
    stopRingOnce();
    calling = false;
    closeCallScreen();
    addMsg("bot", "Zəng qoşulmadı. Mikrofona icazə verin və yenidən cəhd edin. (" + e.message + ")");
  }
}

// ---------------------------------------------------------------- boot
async function boot() {
  config = await fetch("/api/config").then((r) => r.json());
  $("#model-label").textContent = `${config.model} · ${config.embed_model}`;
  for (const c of config.customers) $("#customer").append(new Option(`${c.name} (${c.city})`, c.id));
  products = await fetch("/api/products").then((r) => r.json());
  const cats = ["Hamısı", ...new Set(products.map((p) => p.category))];
  $("#cats").innerHTML = cats.map((c, i) => `<button class="cat-btn${i ? "" : " on"}" data-cat="${esc(c)}">${esc(c)}</button>`).join("");
  renderProducts("Hamısı");
  addMsg("bot", "Salam! Mən Aysu, Mallard-ın dəstək agentiyəm. Sifariş, çatdırılma, qaytarma: nə lazımdırsa yazın. Zədəli məhsulun şəklini də göndərə bilərsiniz.");
  paintIcons();
}

function renderProducts(cat) {
  const list = cat === "Hamısı" ? products : products.filter((p) => p.category === cat);
  $("#products-grid").innerHTML = list.map((p) => `
    <article class="card glass">
      <div class="thumb"><img src="/static/img/${esc(p.id)}.jpg" alt="${esc(p.name)}" loading="lazy"
        onerror="this.replaceWith(Object.assign(document.createElement('i'), {dataset: {lucide: '${ICON[p.id] || "package"}'}})); window.lucide && lucide.createIcons();"></div>
      <div class="cat">${esc(p.category)}</div>
      <div class="name">${esc(p.name)}</div>
      <div class="row">
        <div><div class="price">${p.price.toLocaleString("az-AZ", { minimumFractionDigits: 0 })} ₼</div>
          <div class="stock${p.stock < 8 ? " low" : ""}">${p.stock < 8 ? `Son ${p.stock} ədəd` : "Stokda var"}</div></div>
        <button class="add" title="Mallardə at">${icon("plus")}</button>
      </div>
    </article>`).join("");
  paintIcons();
}

function openPanel() { $("#panel").classList.add("open"); $("#fab").style.display = "none"; $("#input").focus(); }


$("#cats").addEventListener("click", (e) => {
  const b = e.target.closest(".cat-btn"); if (!b) return;
  document.querySelectorAll(".cat-btn").forEach((x) => x.classList.toggle("on", x === b));
  renderProducts(b.dataset.cat);
});
$("#products-grid").addEventListener("click", (e) => {
  const b = e.target.closest(".add");
  if (b) { $("#cart-count").textContent = ++cart; b.innerHTML = icon("check"); paintIcons(); }
});
$("#hero-aysu").onclick = openPanel;
$("#band-aysu").onclick = openPanel;
$("#fab").onclick = openPanel;
$("#close").onclick = () => { $("#panel").classList.remove("open"); $("#fab").style.display = ""; };
$("#send").onclick = () => send($("#input").value);
$("#input").addEventListener("input", () => { if (!voice) aysu?.setState("listening"); });
$("#input").addEventListener("keydown", (e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send($("#input").value); } });
$("#chips").addEventListener("click", (e) => { if (e.target.classList.contains("chip")) send(e.target.textContent); });
$("#file").addEventListener("change", async (e) => {
  for (const f of e.target.files) pendingImages.push(await downscale(f));
  $("#preview").innerHTML = pendingImages.map((i) => `<img src="data:${i.mime};base64,${i.data}" alt="">`).join("");
  e.target.value = "";
});
$("#end").onclick = async () => { const id = conversationId; conversationId = null; await endConversation(id); };
$("#call").onclick = toggleCall;
$("#hangup").onclick = () => { if (voice) voice.endSession(); else if (cancelCall) cancelCall(); };
$("#customer").addEventListener("change", () => { conversationId = null; $("#messages").innerHTML = ""; addMsg("bot", "Yeni söhbət. Necə kömək edə bilərəm?"); });

boot();
