// ChillDesk pitch deck (Mallard palette). node build.js -> ChillDesk.pptx
// Fine-tuning numbers are read from ../training/out/results_*.json when present.
const fs = require("fs");
const path = require("path");
const pptxgen = require("pptxgenjs");
const sharp = require("sharp");
const React = require("react");
const { renderToStaticMarkup } = require("react-dom/server");
const Lu = require("react-icons/lu");
const { applyTheme } = require(process.env.PPTX_SKILL + "/scripts/apply_theme.js");

const HERE = __dirname;
const SHOTS = path.join(HERE, "shots");
const ASSETS = path.join(HERE, "assets");
const TRAIN = path.join(HERE, "..", "training", "out");
fs.mkdirSync(ASSETS, { recursive: true });

const THEME = {
  name: "Mallard",
  headFontFace: "Calibri",
  bodyFontFace: "Calibri",
  colors: {
    dk1: "10242B", lt1: "FFFFFF", dk2: "0F2A33", lt2: "F6F2EA",
    accent1: "0B7A5C", accent2: "14B8A6", accent3: "F97316", accent4: "16C79A", accent5: "5F6D6B", accent6: "FDBA4D",
    hlink: "0B7A5C", folHlink: "14B8A6",
  },
};
const HEX = THEME.colors;

// ------------------------------------------------------------------ generated art
async function meshPng(file, dark) {
  const blobs = dark
    ? [["16C79A", 0.42, 18, 20, 38], ["14B8A6", 0.30, 85, 15, 32], ["F97316", 0.24, 75, 95, 36], ["0B7A5C", 0.35, 10, 90, 30]]
    : [["16C79A", 0.30, 8, 12, 34], ["14B8A6", 0.24, 92, 8, 30], ["F97316", 0.18, 78, 96, 36], ["0F2A33", 0.08, 15, 95, 30]];
  const base = dark ? "#0F2A33" : "#F9F6F0";
  const defs = blobs.map(([c, o], i) => `<radialGradient id="g${i}"><stop offset="0" stop-color="#${c}" stop-opacity="${o}"/><stop offset="1" stop-color="#${c}" stop-opacity="0"/></radialGradient>`).join("");
  const circles = blobs.map(([, , x, y, r], i) => `<ellipse cx="${x * 19.2}" cy="${y * 10.8}" rx="${r * 26}" ry="${r * 20}" fill="url(#g${i})"/>`).join("");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1920" height="1080"><defs>${defs}</defs><rect width="1920" height="1080" fill="${base}"/>${circles}</svg>`;
  await sharp(Buffer.from(svg)).png().toFile(path.join(ASSETS, file));
}

async function ripplePng(file, color, alpha) {
  const rings = [1, 2, 3, 4, 5, 6].map((i) => `<ellipse cx="500" cy="500" rx="${i * 80}" ry="${i * 34}" fill="none" stroke="#${color}" stroke-opacity="${alpha / i ** 0.6}" stroke-width="3"/>`).join("");
  await sharp(Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="1000">${rings}</svg>`)).png().toFile(path.join(ASSETS, file));
}

async function iconPng(name, color, size = 256) {
  const svg = renderToStaticMarkup(React.createElement(Lu[name], { color: "#" + color, size, strokeWidth: 1.8 }));
  const buf = await sharp(Buffer.from(svg)).png().toBuffer();
  return "image/png;base64," + buf.toString("base64");
}

async function roundedShot(src, out, radius = 28) {
  const img = sharp(path.join(SHOTS, src));
  const { width, height } = await img.metadata();
  const mask = Buffer.from(`<svg width="${width}" height="${height}"><rect width="${width}" height="${height}" rx="${radius}" ry="${radius}"/></svg>`);
  await img.composite([{ input: mask, blend: "dest-in" }]).png().toFile(path.join(ASSETS, out));
  return { path: path.join(ASSETS, out), ratio: height / width };
}

function results() {
  const r = {};
  for (const k of ["base", "finetuned", "teacher"]) {
    const f = path.join(TRAIN, `results_${k}.json`);
    if (fs.existsSync(f)) r[k] = JSON.parse(fs.readFileSync(f, "utf8")).metrics;
  }
  const logF = path.join(TRAIN, "train_log.json");
  r.log = fs.existsSync(logF) ? JSON.parse(fs.readFileSync(logF, "utf8")) : null;
  return r;
}

// ------------------------------------------------------------------ deck
(async () => {
  await meshPng("bg-light.png", false);
  await meshPng("bg-dark.png", true);
  await ripplePng("ripples-light.png", "14B8A6", 0.55);
  await ripplePng("ripples-dark.png", "0B7A5C", 0.45);
  await sharp(path.join(HERE, "..", "web", "brand", "mallard.svg")).resize(512, 512).png().toFile(path.join(ASSETS, "logo.png"));
  const LOGO = path.join(ASSETS, "logo.png");

  const pres = new pptxgen();
  pres.layout = "LAYOUT_WIDE"; // 13.33 x 7.5
  pres.title = "ChillDesk — Gemma 4 AI support agent";
  pres.author = "team-Chill";
  pres.company = "team-Chill";
  pres.theme = { headFontFace: THEME.headFontFace, bodyFontFace: THEME.bodyFontFace };
  const C = pres.SchemeColor;
  const W = 13.333;

  // ---- layouts
  pres.defineSlideMaster({
    title: "DARK_TITLE", background: { path: path.join(ASSETS, "bg-dark.png") },
    objects: [{ placeholder: { options: { name: "title", type: "title", x: 0.8, y: 2.35, w: 7.2, h: 1.4, fontSize: 60, bold: true, color: C.background1, valign: "top", align: "left", margin: 0 }, text: "" } },
              { placeholder: { options: { name: "body", type: "body", x: 0.8, y: 3.75, w: 6.8, h: 1.2, fontSize: 22, color: C.background2, valign: "top", align: "left", margin: 0 }, text: "" } }],
  });
  pres.defineSlideMaster({
    title: "LIGHT_CONTENT", background: { path: path.join(ASSETS, "bg-light.png") },
    objects: [{ image: { path: LOGO, x: 12.25, y: 0.42, w: 0.5, h: 0.5 } },
              { placeholder: { options: { name: "title", type: "title", x: 0.7, y: 0.4, w: 11.2, h: 0.85, fontSize: 36, bold: true, color: C.text1, valign: "middle", margin: 0 }, text: "" } }],
    slideNumber: { x: 12.3, y: 6.95, w: 0.6, h: 0.3, fontSize: 10, color: C.accent5 },
  });
  pres.defineSlideMaster({
    title: "DARK_CONTENT", background: { path: path.join(ASSETS, "bg-dark.png") },
    objects: [{ image: { path: LOGO, x: 12.25, y: 0.42, w: 0.5, h: 0.5 } },
              { placeholder: { options: { name: "title", type: "title", x: 0.7, y: 0.4, w: 11.2, h: 0.85, fontSize: 36, bold: true, color: C.background1, valign: "middle", margin: 0 }, text: "" } }],
    slideNumber: { x: 12.3, y: 6.95, w: 0.6, h: 0.3, fontSize: 10, color: C.accent2 },
  });

  // ---- helpers (fresh option objects every call: pptxgenjs mutates them)
  const shadow = () => ({ type: "outer", color: "0F2A33", opacity: 0.18, blur: 18, offset: 6, angle: 90 });
  const card = (s, name, x, y, w, h, dark = false) => s.addShape(pres.shapes.ROUNDED_RECTANGLE, {
    objectName: name, x, y, w, h, rectRadius: 0.22,
    fill: dark ? { color: C.background1, transparency: 90 } : { color: C.background1, transparency: 12 },
    line: dark ? { color: C.background1, transparency: 80, width: 0.75 } : { color: C.background1, width: 1 },
    shadow: dark ? undefined : shadow(),
  });
  const iconBubble = async (s, name, icon, x, y, d = 0.62, bg = C.accent1, fg = "FFFFFF") => {
    s.addShape(pres.shapes.OVAL, { objectName: name + "_bg", x, y, w: d, h: d, fill: { color: bg } });
    s.addImage({ objectName: name, data: await iconPng(icon, fg), x: x + d * 0.22, y: y + d * 0.22, w: d * 0.56, h: d * 0.56 });
  };
  const shot = async (s, name, file, x, y, w, frameDark = false) => {
    const r = await roundedShot(file, file.replace(/\.\w+$/, "-r.png"));
    const h = w * r.ratio;
    s.addImage({ objectName: name, path: r.path, x, y, w, h, shadow: frameDark ? undefined : shadow() });
    return h;
  };
  const text = (s, name, t, o) => s.addText(t, { objectName: name, isTextBox: true, margin: 0, valign: "top", ...o });

  const R = results();

  // =============================================================== 1. title
  let s = pres.addSlide({ masterName: "DARK_TITLE" });
  s.addImage({ path: path.join(ASSETS, "ripples-dark.png"), x: 6.6, y: 2.1, w: 6.6, h: 6.6, transparency: 10 });
  s.addImage({ objectName: "anim_logo", path: LOGO, x: 0.8, y: 1.05, w: 1.05, h: 1.05 });
  s.addText("ChillDesk", { placeholder: "title" });
  s.addText("Açıq çəkili Gemma 4 ilə onlayn mağazalar üçün AI dəstək agenti", { placeholder: "body" });
  ["Best Use of Gemma 4", "Best Open-Source AI Project"].forEach((t, i) => {
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { objectName: `anim_chip${i}`, x: 0.8 + i * 2.75, y: 5.25, w: i ? 3.0 : 2.55, h: 0.48, rectRadius: 0.24,
      fill: { color: C.accent3, transparency: i ? 100 : 0 }, line: { color: C.accent3, width: 1.25 } });
    text(s, `anim_chipt${i}`, t, { x: 0.8 + i * 2.75, y: 5.25, w: i ? 3.0 : 2.55, h: 0.48, fontSize: 14, bold: true, align: "center", valign: "middle", color: C.background1 });
  });
  text(s, "anim_team", "team-Chill · Ducktoberfest Baku 2026 · Hacktoberfest Hack Day", { x: 0.8, y: 6.55, w: 7, h: 0.4, fontSize: 14, color: C.accent2 });
  await shot(s, "anim_phone", "05-call-aysu.png", 8.75, 0.6, 3.55, true);
  s.addNotes("ChillDesk: Mallard adlı onlayn mağaza üçün AI dəstək agenti. Beyni açıq çəkili Gemma 4-dür. Chat, şəkil və səsli zəng bir yerdədir, söhbətdən sonrakı işlər avtomatik görülür.");

  // =============================================================== 2. problem
  s = pres.addSlide({ masterName: "LIGHT_CONTENT" });
  s.addText("Müştəri dəstəyi yavaş, baha və dağınıqdır", { placeholder: "title" });
  const probs = [
    ["LuClock", "Suallar 24/7 gəlir", "“Sifarişim haradadır?”, “pulum nə vaxt qayıdır?” — eyni suallar gecə-gündüz təkrarlanır, cavab növbədə gözləyir."],
    ["LuCamera", "Şəkil və zəng əl ilə", "Zədəli məhsulun şəkli, telefon zəngi, qəbz — operator hər birinə baxıb sistemdə əl ilə qərar verir."],
    ["LuClipboardList", "Əl ilə hesabat", "Xülasə, kateqoriya, bilet, müştəriyə follow-up email — hər söhbətdən sonra dəqiqələr itir."],
  ];
  for (let i = 0; i < 3; i++) {
    const x = 0.7 + i * 4.05;
    card(s, `anim_card${i}`, x, 1.75, 3.75, 4.3);
    await iconBubble(s, `anim_ic${i}`, probs[i][0], x + 0.4, 2.15, 0.8, i === 2 ? C.accent3 : C.accent1);
    text(s, `anim_h${i}`, probs[i][1], { x: x + 0.4, y: 3.2, w: 3.0, h: 0.6, fontSize: 22, bold: true, color: C.text1 });
    text(s, `anim_p${i}`, probs[i][2], { x: x + 0.4, y: 3.9, w: 3.0, h: 1.9, fontSize: 15, color: C.accent5 });
  }
  text(s, "anim_punch", "Kiçik mağazanın 24/7 dəstək komandası saxlamağa imkanı yoxdur.", { x: 0.7, y: 6.35, w: 11, h: 0.45, fontSize: 18, italic: true, color: C.accent1 });
  s.addNotes("Problem: dəstək sualları təkrarlanır, şəkillər və zənglər əl ilə yoxlanılır, söhbətdən sonra da iş qalır. Kiçik mağaza üçün bu baha başa gəlir.");

  // =============================================================== 3. solution
  s = pres.addSlide({ masterName: "LIGHT_CONTENT" });
  s.addText("Tanış olun: Aysu", { placeholder: "title" });
  const feats = [
    ["LuMessageSquareText", "Chat + real hərəkət", "Gemma 4 function calling: sifarişi tapır, izləyir, qaytarma və bilet açır"],
    ["LuCamera", "Şəkli görür", "Zədəli məhsulun şəkli → Gemma 4 vision → qərar"],
    ["LuPhone", "Səsli zəng, 3D Aysu", "Lipsync, tona görə emosiya, Azərbaycan dilində"],
    ["LuZap", "Avtomatlaşdırma", "Xülasə, prioritet, avto-bilet, follow-up email"],
  ];
  for (let i = 0; i < feats.length; i++) {
    const y = 1.6 + i * 1.28;
    await iconBubble(s, `anim_f${i}`, feats[i][0], 0.7, y, 0.7, i === 3 ? C.accent3 : C.accent1);
    text(s, `anim_fh${i}`, feats[i][1], { x: 1.6, y: y - 0.02, w: 4.4, h: 0.42, fontSize: 20, bold: true, color: C.text1 });
    text(s, `anim_fp${i}`, feats[i][2], { x: 1.6, y: y + 0.42, w: 4.4, h: 0.6, fontSize: 14, color: C.accent5 });
  }
  await shot(s, "anim_hero", "01-hero.jpg", 6.35, 1.65, 6.3);
  text(s, "anim_cap", "Mallard — Ducktoberfest üçün qurduğumuz demo mağaza", { x: 6.35, y: 4.75, w: 6.3, h: 0.35, fontSize: 12, color: C.accent5, align: "right" });
  s.addNotes("Aysu dörd işi görür: alətlərlə real hərəkət, şəkli anlamaq, 3D avatarla səsli zəng və söhbətdən sonra avtomatlaşdırma.");

  // =============================================================== 4. photo demo
  s = pres.addSlide({ masterName: "LIGHT_CONTENT" });
  s.addText("Şəkil göndər, həll al", { placeholder: "title" });
  await shot(s, "anim_photo", "damaged-headphones.jpg", 0.7, 1.7, 3.3);
  text(s, "anim_photocap", "Müştərinin göndərdiyi şəkil", { x: 0.7, y: 4.0, w: 3.3, h: 0.3, fontSize: 12, color: C.accent5, align: "center" });
  await shot(s, "anim_chat", "03-chat-photo.png", 4.35, 1.4, 3.3);
  const steps = [
    ["Gemma 4 şəkli görür", "“sol qulaqcıqda çat” → photo_assessment"],
    ["list_orders → get_order", "Leyla-nın ML-1042 sifarişini Neon-dan tapır"],
    ["create_return", "Qayda mühərriki: 14 gün + zədə = pulsuz dəyişmə"],
    ["Cavab + müraciət RT-…", "Kuryer köhnəni götürür, yenisini gətirir"],
  ];
  steps.forEach(([h, p], i) => {
    const y = 1.6 + i * 1.22;
    s.addShape(pres.shapes.OVAL, { objectName: `anim_n${i}`, x: 8.1, y, w: 0.5, h: 0.5, fill: { color: C.accent1 } });
    text(s, `anim_nt${i}`, String(i + 1), { x: 8.1, y, w: 0.5, h: 0.5, fontSize: 16, bold: true, color: C.background1, align: "center", valign: "middle" });
    text(s, `anim_sh${i}`, h, { x: 8.8, y: y - 0.02, w: 3.9, h: 0.4, fontSize: 17, bold: true, color: C.text1 });
    text(s, `anim_sp${i}`, p, { x: 8.8, y: y + 0.4, w: 3.9, h: 0.6, fontSize: 13, color: C.accent5 });
  });
  text(s, "anim_took", "≈13 saniyə · 4 tool çağırışı · 0 operator", { x: 0.7, y: 4.6, w: 3.3, h: 0.9, fontSize: 18, bold: true, color: C.accent3 });
  s.addNotes("Canlı ssenari: müştəri çatlı qulaqlığın şəklini göndərir. Gemma 4 şəkli təsvir edir, sifarişi tapır, qayda mühərriki ilə dəyişmə müraciəti açır. Hər addım chat-də görünür.");

  // =============================================================== 5. voice
  s = pres.addSlide({ masterName: "DARK_CONTENT" });
  s.addText("Zəng kimi: səsli Aysu", { placeholder: "title" });
  await shot(s, "anim_ring", "04-call-ringing.png", 0.75, 1.5, 2.85, true);
  await shot(s, "anim_live", "05-call-aysu.png", 3.85, 1.5, 3.25, true);
  const vf = [
    ["LuBrain", "Beyin Gemma 4-dür", "ElevenLabs yalnız STT/TTS; cavabı bizim Custom LLM endpoint verir"],
    ["LuAudioWaveform", "Hərf səviyyəsində lipsync", "Hər səs hissəsinin hərf zamanlaması + səsin real gücü"],
    ["LuSmile", "Tona görə emosiya", "[empathetically] səsi də, üzü də dəyişir"],
    ["LuPhoneCall", "Real zəng hissi", "425 Hz “duut… duut”, qoşulanda Aysu görünür"],
  ];
  for (let i = 0; i < vf.length; i++) {
    const y = 1.6 + i * 1.25;
    await iconBubble(s, `anim_v${i}`, vf[i][0], 7.55, y, 0.62, i === 2 ? C.accent3 : C.accent1);
    text(s, `anim_vh${i}`, vf[i][1], { x: 8.4, y: y - 0.02, w: 4.3, h: 0.4, fontSize: 18, bold: true, color: C.background1 });
    text(s, `anim_vp${i}`, vf[i][2], { x: 8.4, y: y + 0.4, w: 4.3, h: 0.6, fontSize: 13, color: C.background2 });
  }
  s.addNotes("Səsli zəng: ElevenLabs səsi tanıyır və səsləndirir, amma cavabı Gemma 4 verir. Avatar hərflərin zamanlaması ilə danışır, Gemma-nın seçdiyi ton tag-i ilə həm səs, həm üz dəyişir.");

  // =============================================================== 6. automation
  s = pres.addSlide({ masterName: "LIGHT_CONTENT" });
  s.addText("Söhbət bitir, iş özü görülür", { placeholder: "title" });
  await shot(s, "anim_dash", "06-dashboard.jpg", 0.7, 1.55, 8.1);
  const outs = ["Xülasə", "Kateqoriya", "Təcililik", "Emosiya", "Həll olundu?", "İnsan lazımdır?", "Avto-bilet", "Follow-up email", "KB boşluğu"];
  card(s, "anim_jsoncard", 9.2, 1.55, 3.45, 4.75);
  text(s, "anim_jsonh", "Gemma 4 → JSON", { x: 9.5, y: 1.8, w: 2.95, h: 0.4, fontSize: 18, bold: true, color: C.accent1 });
  outs.forEach((o, i) => {
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { objectName: `anim_o${i}`, x: 9.5, y: 2.35 + i * 0.42, w: 2.85, h: 0.34, rectRadius: 0.17,
      fill: { color: i >= 6 ? C.accent3 : C.accent1, transparency: 85 }, line: { color: i >= 6 ? C.accent3 : C.accent1, width: 0.75, transparency: 40 } });
    text(s, `anim_ot${i}`, o, { x: 9.65, y: 2.35 + i * 0.42, w: 2.6, h: 0.34, fontSize: 12, bold: true, color: i >= 6 ? C.accent3 : C.accent1, valign: "middle" });
  });
  s.addNotes("Hər söhbət bitəndə və ya səsli zəng 90 saniyə sakit qalanda Gemma 4 onu analiz edir: xülasə, prioritet, emosiya, lazım olsa avto-bilet və müştəriyə hazır follow-up email. Hamısı Neon-a yazılır və dashboard-da görünür.");

  // =============================================================== 7. architecture
  s = pres.addSlide({ masterName: "LIGHT_CONTENT" });
  s.addText("Arxitektura", { placeholder: "title" });
  const box = (name, label, sub, x, y, w, h, color) => {
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { objectName: name, x, y, w, h, rectRadius: 0.18, fill: { color: C.background1 }, line: { color, width: 1.75 }, shadow: shadow() });
    text(s, name + "_t", [{ text: label, options: { bold: true, fontSize: 16, color: C.text1, breakLine: true } }, { text: sub, options: { fontSize: 12, color: C.accent5 } }],
      { x: x + 0.15, y: y + 0.12, w: w - 0.3, h: h - 0.2, align: "center", valign: "middle" });
  };
  const arrow = (name, x1, y1, x2, y2) => s.addShape(pres.shapes.LINE, { objectName: name, x: Math.min(x1, x2), y: Math.min(y1, y2), w: Math.abs(x2 - x1) || 0.001, h: Math.abs(y2 - y1) || 0.001,
    flipH: x2 < x1, flipV: y2 < y1, line: { color: C.accent5, width: 1.5, endArrowType: "triangle" } });
  box("anim_a0", "Brauzer", "Mallard mağaza · Aysu widget · ChillDesk panel", 0.7, 1.7, 3.2, 1.2, C.accent2);
  box("anim_a1", "ElevenLabs", "STT (Scribe v2) · TTS · WebSocket", 0.7, 3.7, 3.2, 1.2, C.accent5);
  box("anim_a2", "FastAPI backend", "/api/chat (SSE) · /v1/chat/completions · avtomatlaşdırma", 5.0, 2.7, 3.3, 1.3, C.accent1);
  box("anim_a3", "Gemma 4 26B MoE", "Gemini API · function calling · vision", 9.35, 1.45, 3.3, 1.15, C.accent1);
  box("anim_a4", "Gemma 4 E4B", "Ollama · lokal ehtiyat (429 olanda)", 9.35, 2.85, 3.3, 1.0, C.accent3);
  box("anim_a5", "Neon Postgres + pgvector", "müştəri, sifariş, qaytarma, bilet, söhbət", 9.35, 4.1, 3.3, 1.15, C.accent2);
  box("anim_a6", "EmbeddingGemma", "lokal RAG · 768-dim", 5.0, 5.05, 3.3, 1.0, C.accent2);
  arrow("anim_l0", 3.9, 2.3, 5.0, 3.1); arrow("anim_l1", 3.9, 4.3, 5.0, 3.6); arrow("anim_l2", 2.3, 2.9, 2.3, 3.7);
  arrow("anim_l3", 8.3, 3.0, 9.35, 2.05); arrow("anim_l4", 8.3, 3.35, 9.35, 3.35); arrow("anim_l5", 8.3, 3.7, 9.35, 4.65);
  arrow("anim_l6", 6.65, 4.0, 6.65, 5.05); arrow("anim_l7", 8.3, 5.55, 9.35, 4.95);
  s.addNotes("Brauzer chat-i SSE ilə, səsi ElevenLabs ilə göndərir. ElevenLabs bizim OpenAI-uyğun endpoint-i çağırır. Backend Gemma 4 agent dövrəsini işlədir, alətlər Neon-a yazır, bilik bazası EmbeddingGemma və pgvector ilə axtarılır. Gemini limiti dolsa, lokal Gemma 4 davam edir.");

  // =============================================================== 8. fine-tuning method
  s = pres.addSlide({ masterName: "DARK_CONTENT" });
  s.addText("Öz modelimizi öyrətdik: Unsloth QLoRA", { placeholder: "title" });
  const nTrain = R.log ? R.log.train_examples : 189;
  const nTest = (R.teacher || R.base || {}).n || 40;
  const secs = R.log ? Math.round(R.log.seconds) : null;
  const stats = [[`${nTrain + nTest}`, "etiketli Azərbaycanca söhbət"], ["1B", "parametr — Gemma 3 1B (4-bit)"], ["8 GB", "noutbuk GPU (RTX 4070)"], [secs ? `${secs} s` : "~ dəq", "train müddəti"]];
  stats.forEach(([v, l], i) => {
    const x = 0.75 + i * 3.1;
    card(s, `anim_st${i}`, x, 1.55, 2.85, 1.75, true);
    text(s, `anim_sv${i}`, v, { x: x + 0.3, y: 1.7, w: 2.3, h: 0.9, fontSize: 44, bold: true, color: i === 3 ? C.accent3 : C.accent4 });
    text(s, `anim_sl${i}`, l, { x: x + 0.3, y: 2.6, w: 2.3, h: 0.6, fontSize: 13, color: C.background2 });
  });
  const pipe = [
    ["LuDatabase", "1 · Data", "Etiketləri əvvəlcə seçirik (7 kateqoriya × 3 təcililik × 3 emosiya, 12 məhsul, 6 müştəri üslubu), Gemma 4 26B onlara uyğun söhbət yazır. Ground truth dəqiqdir."],
    ["LuCpu", "2 · Train", "Unsloth QLoRA, rank 16, yalnız JSON cavab üzərində loss. Kiçik model bizim etiket qaydalarımızı öyrənir."],
    ["LuChartColumn", "3 · Eval", `${nTest} gizli test söhbəti: base 1B vs fine-tuned 1B vs Gemma 4 26B. Hər sahə ayrıca ölçülür.`],
  ];
  for (let i = 0; i < pipe.length; i++) {
    const x = 0.75 + i * 4.13;
    await iconBubble(s, `anim_pi${i}`, pipe[i][0], x, 3.75, 0.62, i === 1 ? C.accent3 : C.accent1);
    text(s, `anim_ph${i}`, pipe[i][1], { x: x + 0.8, y: 3.8, w: 3.0, h: 0.5, fontSize: 20, bold: true, color: C.background1 });
    text(s, `anim_pp${i}`, pipe[i][2], { x, y: 4.55, w: 3.8, h: 2.1, fontSize: 13, color: C.background2 });
  }
  s.addNotes("Məqsəd: söhbət analizini internetsiz, kiçik açıq modeldə işlətmək. Datanı müəllim model yazdı, amma etiketləri biz əvvəlcədən seçdik, ona görə doğru cavablar dəqiq məlumdur.");

  // =============================================================== 9. results
  s = pres.addSlide({ masterName: "LIGHT_CONTENT" });
  s.addText("Nəticə: kiçik model, böyük fərq", { placeholder: "title" });
  const fields = [["acc_category", "Kateqoriya"], ["acc_urgency", "Təcililik"], ["acc_sentiment", "Emosiya"], ["acc_resolved", "Həll olundu"], ["acc_needs_human", "İnsan lazım"], ["acc_team", "Komanda"]];
  const series = [["base", "Gemma 3 1B (base)"], ["finetuned", "Gemma 3 1B + LoRA (bizim)"], ["teacher", "Gemma 4 26B (API)"]].filter(([k]) => R[k]);
  if (series.length) {
    s.addChart(pres.charts.BAR, series.map(([k, n]) => ({ name: n, labels: fields.map((f) => f[1]), values: fields.map(([m]) => Math.round(R[k][m] * 100)) })), {
      objectName: "anim_chart", x: 0.6, y: 1.45, w: 8.4, h: 5.3, barDir: "col", barGapWidthPct: 60,
      chartColors: series.map(([k]) => ({ base: "9AA5A3", finetuned: HEX.accent1, teacher: HEX.accent3 }[k])),
      showValue: true, dataLabelPosition: "outEnd", dataLabelFontSize: 10, dataLabelColor: HEX.dk1, dataLabelFontFace: "+mn-lt",
      catAxisLabelColor: HEX.accent5, catAxisLabelFontSize: 12, catAxisLabelFontFace: "+mn-lt",
      valAxisMaxVal: 100, valAxisMinVal: 0, valAxisLabelColor: HEX.accent5, valAxisLabelFontSize: 10, valAxisLabelFontFace: "+mn-lt",
      valGridLine: { color: "E3DED4", size: 0.5 }, catGridLine: { style: "none" },
      showLegend: true, legendPos: "t", legendFontSize: 12, legendColor: HEX.dk1, legendFontFace: "+mn-lt",
      showTitle: true, title: "Test dəqiqliyi, % (gizli test seti)", titleFontSize: 14, titleColor: HEX.dk1, titleFontFace: "+mn-lt",
    });
  }
  const pct = (k, m) => (R[k] ? Math.round(R[k][m] * 100) : null);
  const call = [
    [pct("finetuned", "acc_mean") ?? "…", "%", "fine-tuned 1B orta dəqiqlik", C.accent1],
    [pct("base", "acc_mean") ?? "…", "%", "eyni model, fine-tune-suz", C.accent5],
    [pct("teacher", "acc_mean") ?? "…", "%", "Gemma 4 26B, zero-shot", C.accent3],
  ];
  call.forEach(([v, u, l, c], i) => {
    card(s, `anim_cc${i}`, 9.35, 1.5 + i * 1.75, 3.3, 1.5);
    text(s, `anim_cv${i}`, [{ text: String(v), options: { fontSize: 44, bold: true, color: c } }, { text: u, options: { fontSize: 22, bold: true, color: c } }], { x: 9.6, y: 1.6 + i * 1.75, w: 2.9, h: 0.85 });
    text(s, `anim_cl${i}`, l, { x: 9.6, y: 2.45 + i * 1.75, w: 2.9, h: 0.45, fontSize: 13, color: C.accent5 });
  });
  s.addNotes("Gizli test setində eyni 1B model fine-tune-dan əvvəl və sonra, üstəlik 26 milyard parametrli Gemma 4 zero-shot. Fine-tuned kiçik model bizim etiket qaydalarımızı öyrənib və lokal, internetsiz işləyir.");

  // =============================================================== 10. open source
  s = pres.addSlide({ masterName: "LIGHT_CONTENT" });
  s.addText("Hamısı açıq", { placeholder: "title" });
  const oss = [
    ["LuSparkles", "Gemma 4 26B / E4B", "Agent, vision, analiz", "Apache 2.0"],
    ["LuSearch", "EmbeddingGemma", "Lokal RAG embedding", "Gemma Terms"],
    ["LuCpu", "Gemma 3 1B + LoRA", "Fine-tuned analitik", "Gemma Terms"],
    ["LuWrench", "Unsloth · Ollama", "Train və lokal inferens", "Apache 2.0 · MIT"],
    ["LuDatabase", "Neon · pgvector", "Postgres + vektor axtarışı", "Apache 2.0 · PostgreSQL"],
    ["LuGithub", "ChillDesk kodu", "github.com/Ducktoberfest/team-Chill", "MIT"],
  ];
  for (let i = 0; i < oss.length; i++) {
    const x = 0.7 + (i % 3) * 4.05, y = 1.65 + Math.floor(i / 3) * 2.45;
    card(s, `anim_os${i}`, x, y, 3.75, 2.1);
    await iconBubble(s, `anim_oi${i}`, oss[i][0], x + 0.35, y + 0.35, 0.62, i === 5 ? C.accent3 : C.accent1);
    text(s, `anim_oh${i}`, oss[i][1], { x: x + 1.15, y: y + 0.35, w: 2.4, h: 0.62, fontSize: 18, bold: true, color: C.text1, valign: "middle" });
    text(s, `anim_op${i}`, oss[i][2], { x: x + 0.35, y: y + 1.12, w: 3.1, h: 0.4, fontSize: 13, color: C.accent5 });
    text(s, `anim_ol${i}`, oss[i][3], { x: x + 0.35, y: y + 1.52, w: 3.1, h: 0.35, fontSize: 12, bold: true, color: C.accent1 });
  }
  s.addNotes("Bütün AI qatı açıq çəkili Gemma ailəsidir. Kod MIT lisenziyalıdır, README-də modellər, lisenziyalar və işə salma qaydası var.");

  // =============================================================== 11. closing
  s = pres.addSlide({ masterName: "DARK_TITLE" });
  s.addImage({ path: path.join(ASSETS, "ripples-dark.png"), x: 6.4, y: 1.6, w: 7, h: 7, transparency: 10 });
  s.addImage({ objectName: "anim_logo2", path: LOGO, x: 0.8, y: 1.05, w: 1.05, h: 1.05 });
  s.addText("Təşəkkürlər!", { placeholder: "title" });
  s.addText("İndi Aysuya zəng edək.", { placeholder: "body" });
  text(s, "anim_repo", "github.com/Ducktoberfest/team-Chill", { x: 0.8, y: 5.25, w: 7, h: 0.5, fontSize: 20, bold: true, color: C.accent3 });
  text(s, "anim_team2", "team-Chill · Ducktoberfest Baku 2026", { x: 0.8, y: 6.55, w: 7, h: 0.4, fontSize: 14, color: C.accent2 });
  await shot(s, "anim_ring2", "04-call-ringing.png", 8.85, 0.7, 3.4, true);
  s.addNotes("Təşəkkür. Sonra canlı demo: Aysuya zəng, zədəli məhsul şəkli və dashboard-da avtomatik analiz.");

  const out = path.join(HERE, "ChillDesk.pptx");
  await pres.writeFile({ fileName: out });
  await applyTheme(out, THEME);
  console.log("wrote", out, "| results:", Object.keys(R).filter((k) => R[k] && k !== "log").join(",") || "none");
})().catch((e) => { console.error(e); process.exit(1); });
