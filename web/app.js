// Səbət demo store + Aysu support widget (web chat over SSE, voice via ElevenLabs).
const $ = (s) => document.querySelector(s);
const EMOJI = { "Elektronika": "🎧", "Aksesuar": "🧩", "Məişət texnikası": "🧊", "Ev və tekstil": "🛏️", "Geyim": "🧥" };

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
  el.innerHTML = `<details><summary>⚙️ <b>${esc(ev.name)}</b> · ${esc(ev.label)}</summary><pre>${detail}</pre></details>`;
  $("#messages").append(el);
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
  const typing = addNote("Aysu yazır…");
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
        else if (ev.type === "tool") { addStep(ev); $("#messages").append(typing); }
        else if (ev.type === "text") addMsg("bot", ev.text);
        else if (ev.type === "error") addMsg("bot", "⚠️ " + ev.error);
      }
    }
  } catch (e) {
    addMsg("bot", "⚠️ Bağlantı xətası: " + e.message);
  } finally {
    typing.remove();
    busy = false; $("#send").disabled = false;
  }
}

async function endConversation(id) {
  if (!id) return;
  const note = addNote("Söhbət bağlanır, Gemma avtomatik analiz edir…");
  const r = await fetch(`/api/conversations/${id}/end`, { method: "POST" }).then((r) => r.json()).catch(() => null);
  note.remove();
  const a = r && r.analysis;
  if (a) {
    addNote(`✅ Analiz: ${a.category} · ${a.urgency} · ${a.sentiment}${a.auto_ticket ? " · bilet " + a.auto_ticket : ""} — panelə baxın`);
  }
}

// ---------------------------------------------------------------- voice (ElevenLabs Conversational AI)
async function toggleCall() {
  if (voice) { await voice.endSession(); return; }
  if (!config.agent_id) { addMsg("bot", "Səsli agent qurulmayıb (ELEVENLABS_AGENT_ID)."); return; }
  const { Conversation } = await import("https://cdn.jsdelivr.net/npm/@elevenlabs/client@1.27.0/+esm");
  const start = await fetch("/api/voice/start", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ customer_id: $("#customer").value || null }),
  }).then((r) => r.json());
  const voiceId = start.conversation_id;
  $("#voice-bar").classList.add("on");
  $("#voice-status").textContent = "Qoşulur…";
  try {
    voice = await Conversation.startSession({
      agentId: config.agent_id,
      connectionType: "webrtc",
      customLlmExtraBody: { conversation_id: voiceId, customer_id: $("#customer").value || null },
      onConnect: () => { $("#voice-status").textContent = "Zəng gedir — danışın"; },
      onModeChange: ({ mode }) => { $("#voice-status").textContent = mode === "speaking" ? "Aysu danışır…" : "Dinləyir…"; },
      onMessage: ({ source, message }) => addMsg(source === "user" ? "user" : "bot", message),
      onError: (e) => addMsg("bot", "⚠️ Səs xətası: " + (e?.message || e)),
      onDisconnect: () => {
        voice = null;
        $("#voice-bar").classList.remove("on");
        $("#call").textContent = "📞";
        endConversation(voiceId);
      },
    });
    $("#call").textContent = "⏹";
  } catch (e) {
    $("#voice-bar").classList.remove("on");
    addMsg("bot", "⚠️ Mikrofona icazə lazımdır və ya səs xidməti əlçatmazdır: " + e.message);
  }
}

// ---------------------------------------------------------------- boot
async function boot() {
  config = await fetch("/api/config").then((r) => r.json());
  $("#model-label").textContent = `${config.model} · ${config.embed_model}`;
  for (const c of config.customers) $("#customer").append(new Option(`${c.name} (${c.city})`, c.id));
  const products = await fetch("/api/products").then((r) => r.json());
  $("#products").innerHTML = products.map((p) => `
    <article class="card">
      <div class="thumb">${EMOJI[p.category] || "📦"}</div>
      <div class="cat">${esc(p.category)}</div>
      <div class="name">${esc(p.name)}</div>
      <div class="price">${p.price.toFixed(2)} ₼</div>
    </article>`).join("");
  addMsg("bot", "Salam! Mən Aysu, Səbət-in dəstək agentiyəm. Sifariş, çatdırılma, qaytarma — nə lazımdırsa yazın. Zədəli məhsulun şəklini də göndərə bilərsiniz 📎");
}

$("#fab").onclick = () => { $("#panel").classList.add("open"); $("#fab").style.display = "none"; $("#input").focus(); };
$("#close").onclick = () => { $("#panel").classList.remove("open"); $("#fab").style.display = ""; };
$("#send").onclick = () => send($("#input").value);
$("#input").addEventListener("keydown", (e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send($("#input").value); } });
$("#chips").addEventListener("click", (e) => { if (e.target.classList.contains("chip")) send(e.target.textContent); });
$("#file").addEventListener("change", async (e) => {
  for (const f of e.target.files) pendingImages.push(await downscale(f));
  $("#preview").innerHTML = pendingImages.map((i) => `<img src="data:${i.mime};base64,${i.data}" alt="">`).join("");
  e.target.value = "";
});
$("#end").onclick = async () => { const id = conversationId; conversationId = null; await endConversation(id); };
$("#call").onclick = toggleCall;
$("#customer").addEventListener("change", () => { conversationId = null; $("#messages").innerHTML = ""; addMsg("bot", "Yeni söhbət. Necə kömək edə bilərəm?"); });

boot();
