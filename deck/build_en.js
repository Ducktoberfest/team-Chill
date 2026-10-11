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
    ? [["2EE6B0", 0.55, 14, 16, 30], ["14B8A6", 0.45, 88, 10, 26], ["F97316", 0.38, 78, 98, 28], ["0B7A5C", 0.6, 6, 92, 26], ["5EEAD4", 0.25, 55, 45, 18]]
    : [["2EE6B0", 0.55, 6, 10, 28], ["5EEAD4", 0.5, 94, 6, 24], ["FDBA4D", 0.42, 80, 100, 26], ["A7F3D0", 0.5, 12, 98, 22], ["14B8A6", 0.18, 55, 50, 16]];
  const base = dark ? "#0F2A33" : "#F9F6F0";
  const defs = blobs.map(([c, o], i) => `<radialGradient id="g${i}"><stop offset="0" stop-color="#${c}" stop-opacity="${o}"/><stop offset="1" stop-color="#${c}" stop-opacity="0"/></radialGradient>`).join("");
  const circles = blobs.map(([, , x, y, r], i) => `<ellipse cx="${x * 19.2}" cy="${y * 10.8}" rx="${r * 26}" ry="${r * 20}" fill="url(#g${i})"/>`).join("");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1920" height="1080"><defs>${defs}</defs><rect width="1920" height="1080" fill="${base}"/>${circles}</svg>`;
  await sharp(Buffer.from(svg)).blur(40).png().toFile(path.join(ASSETS, file));
}

// frosted glass sphere used as a morphing decoration (same name on every slide -> Morph glides it)
async function glassOrbPng(file, tint) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="800"><defs>
    <radialGradient id="f" cx="35%" cy="30%" r="75%"><stop offset="0" stop-color="#fff" stop-opacity=".75"/><stop offset=".45" stop-color="#${tint}" stop-opacity=".28"/><stop offset="1" stop-color="#${tint}" stop-opacity=".10"/></radialGradient>
    <linearGradient id="e" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".95"/><stop offset=".5" stop-color="#fff" stop-opacity=".15"/><stop offset="1" stop-color="#fff" stop-opacity=".6"/></linearGradient></defs>
    <circle cx="400" cy="400" r="380" fill="url(#f)"/><circle cx="400" cy="400" r="378" fill="none" stroke="url(#e)" stroke-width="6"/>
    <ellipse cx="290" cy="230" rx="150" ry="80" fill="#fff" fill-opacity=".35" transform="rotate(-30 290 230)"/></svg>`;
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
  await glassOrbPng("orb-a.png", "14B8A6");
  await glassOrbPng("orb-b.png", "F97316");
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
    objects: [{ placeholder: { options: { name: "title", type: "title", x: 0.8, y: 2.35, w: 5.9, h: 1.4, fontSize: 60, bold: true, color: C.background1, valign: "top", align: "left", margin: 0 }, text: "" } },
              { placeholder: { options: { name: "body", type: "body", x: 0.8, y: 3.75, w: 5.7, h: 1.2, fontSize: 22, color: C.background2, valign: "top", align: "left", margin: 0 }, text: "" } }],
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
    fill: dark ? { color: C.background1, transparency: 88 } : { color: C.background1, transparency: 35 },
    line: dark ? { color: C.background1, transparency: 70, width: 1 } : { color: C.background1, width: 1.5 },
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

  // two glass spheres on every slide; Morph moves them between slides
  const ORBS = [ // [ax, ay, ad, bx, by, bd] per slide (inches)
    [10.6, -1.0, 3.6, 7.25, 6.25, 1.5], [11.6, 5.3, 2.6, -1.2, -0.9, 2.2], [12.1, 3.6, 1.9, 4.6, -1.3, 2.0],
    [-1.1, 5.6, 2.6, 12.0, -0.8, 2.2], [6.2, 5.9, 2.4, 12.2, 0.8, 1.6], [12.0, 5.8, 2.2, -1.0, 2.6, 1.9],
    [3.8, 6.1, 1.8, 11.9, -1.2, 2.4], [-1.2, -1.1, 3.0, 11.4, 5.6, 2.6], [12.2, -0.9, 2.2, 8.4, 6.3, 1.7],
    [-1.0, 3.4, 2.2, 12.1, 5.9, 2.0], [10.9, -1.3, 3.8, 6.2, -1.0, 2.0],
  ];
  let slideNo = 0;
  const orbs = (sl) => {
    const [ax, ay, ad, bx, by, bd] = ORBS[slideNo++ % ORBS.length];
    sl.addImage({ objectName: "!!orbA", path: path.join(ASSETS, "orb-a.png"), x: ax, y: ay, w: ad, h: ad });
    sl.addImage({ objectName: "!!orbB", path: path.join(ASSETS, "orb-b.png"), x: bx, y: by, w: bd, h: bd });
  };

  // =============================================================== 1. title
  let s = pres.addSlide({ masterName: "DARK_TITLE" });
  orbs(s);
  s.addImage({ path: path.join(ASSETS, "ripples-dark.png"), x: 6.6, y: 2.1, w: 6.6, h: 6.6, transparency: 10 });
  s.addImage({ objectName: "anim_logo", path: LOGO, x: 0.8, y: 1.05, w: 1.05, h: 1.05 });
  s.addText("ChillDesk", { placeholder: "title" });
  s.addText("An open-weight Gemma 4 AI support agent for online stores", { placeholder: "body" });
  ["Best Use of Gemma 4", "Best Open-Source AI Project"].forEach((t, i) => {
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { objectName: `anim_chip${i}`, x: 0.8 + i * 2.75, y: 5.25, w: i ? 3.0 : 2.55, h: 0.48, rectRadius: 0.24,
      fill: { color: C.accent3, transparency: i ? 100 : 0 }, line: { color: C.accent3, width: 1.25 } });
    text(s, `anim_chipt${i}`, t, { x: 0.8 + i * 2.75, y: 5.25, w: i ? 3.0 : 2.55, h: 0.48, fontSize: 14, bold: true, align: "center", valign: "middle", color: C.background1 });
  });
  text(s, "anim_team", "team-Chill · Ducktoberfest Baku 2026 · Hacktoberfest Hack Day", { x: 0.8, y: 6.55, w: 7, h: 0.4, fontSize: 14, color: C.accent2 });
  await shot(s, "anim_site", "01-hero.jpg", 7.0, 1.25, 5.75, true);
  await shot(s, "anim_site2", "02-products.jpg", 8.3, 3.85, 4.6, true);
  s.addNotes("ChillDesk is an AI support agent for an online store called Mallard. Its brain is open-weight Gemma 4. Chat, photos and voice calls live in one place, and the follow-up work after each conversation happens automatically.");

  // =============================================================== 2. problem
  s = pres.addSlide({ masterName: "LIGHT_CONTENT" });
  orbs(s);
  s.addText("Support is slow, costly and scattered", { placeholder: "title" });
  const probs = [
    ["LuClock", "24/7 questions", "“Where is my order?”, “when do I get my money back?” The same questions repeat day and night while customers wait in a queue."],
    ["LuCamera", "Manual checks", "A damaged-product photo, a phone call, a receipt: an operator checks each one and decides by hand."],
    ["LuClipboardList", "Manual wrap-up", "Summary, category, ticket and a follow-up email take minutes after every conversation."],
  ];
  for (let i = 0; i < 3; i++) {
    const x = 0.7 + i * 4.05;
    card(s, `anim_card${i}`, x, 1.75, 3.75, 4.3);
    await iconBubble(s, `anim_ic${i}`, probs[i][0], x + 0.4, 2.15, 0.8, i === 2 ? C.accent3 : C.accent1);
    text(s, `anim_h${i}`, probs[i][1], { x: x + 0.4, y: 3.2, w: 3.0, h: 0.6, fontSize: 22, bold: true, color: C.text1 });
    text(s, `anim_p${i}`, probs[i][2], { x: x + 0.4, y: 3.9, w: 3.0, h: 1.9, fontSize: 15, color: C.accent5 });
  }
  text(s, "anim_punch", "A small store can’t afford a 24/7 support team.", { x: 0.7, y: 6.35, w: 11, h: 0.45, fontSize: 18, italic: true, color: C.accent1 });
  s.addNotes("The problem: support questions repeat, photos and calls are checked by hand, and work remains after each conversation. For a small store that is expensive.");

  // =============================================================== 3. solution
  s = pres.addSlide({ masterName: "LIGHT_CONTENT" });
  orbs(s);
  s.addText("Meet Aysu", { placeholder: "title" });
  const feats = [
    ["LuMessageSquareText", "Chat that takes action", "Gemma 4 function calling: finds and tracks orders, opens returns and tickets"],
    ["LuCamera", "Sees photos", "Damaged-product photo → Gemma 4 vision → decision"],
    ["LuPhone", "Voice calls, 3D Aysu", "Lip sync and tone-driven emotion, in Azerbaijani"],
    ["LuZap", "Automation", "Summary, priority, auto-ticket, follow-up email"],
  ];
  for (let i = 0; i < feats.length; i++) {
    const y = 1.6 + i * 1.28;
    await iconBubble(s, `anim_f${i}`, feats[i][0], 0.7, y, 0.7, i === 3 ? C.accent3 : C.accent1);
    text(s, `anim_fh${i}`, feats[i][1], { x: 1.6, y: y - 0.02, w: 4.4, h: 0.42, fontSize: 20, bold: true, color: C.text1 });
    text(s, `anim_fp${i}`, feats[i][2], { x: 1.6, y: y + 0.42, w: 4.4, h: 0.6, fontSize: 14, color: C.accent5 });
  }
  s.addImage({ path: path.join(ASSETS, "ripples-light.png"), x: 6.55, y: 2.6, w: 6.4, h: 6.4, transparency: 15 });
  await shot(s, "anim_aysu", "07-aysu-portrait.png", 7.75, 1.4, 3.95);
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, { objectName: "anim_badge", x: 8.0, y: 6.05, w: 3.45, h: 0.55, rectRadius: 0.27, fill: { color: C.background1 }, line: { color: C.accent1, width: 1 }, shadow: shadow() });
  text(s, "anim_badget", [{ text: "Aysu", options: { bold: true, color: C.accent1 } }, { text: "  ·  Mallard support agent", options: { color: C.accent5 } }],
    { x: 8.0, y: 6.05, w: 3.45, h: 0.55, fontSize: 14, align: "center", valign: "middle" });
  s.addNotes("Aysu does four things: real actions through tools, understanding photos, voice calls with a 3D avatar, and automation after each conversation.");

  // =============================================================== 4. photo demo
  s = pres.addSlide({ masterName: "LIGHT_CONTENT" });
  orbs(s);
  s.addText("Send a photo, get it solved", { placeholder: "title" });
  await shot(s, "anim_photo", "damaged-headphones.jpg", 0.7, 1.7, 3.3);
  text(s, "anim_photocap", "The photo the customer sent", { x: 0.7, y: 4.0, w: 3.3, h: 0.3, fontSize: 12, color: C.accent5, align: "center" });
  await shot(s, "anim_chat", "03-chat-photo.png", 4.35, 1.4, 3.3);
  const steps = [
    ["Gemma 4 reads the photo", "“crack on the left ear cup” → photo_assessment"],
    ["list_orders → get_order", "Finds Leyla’s order ML-1042 in Neon"],
    ["create_return", "Policy engine: 14 days + damage = free replacement"],
    ["Answer + return RT-…", "A courier swaps the old one for a new one"],
  ];
  steps.forEach(([h, p], i) => {
    const y = 1.6 + i * 1.22;
    s.addShape(pres.shapes.OVAL, { objectName: `anim_n${i}`, x: 8.1, y, w: 0.5, h: 0.5, fill: { color: C.accent1 } });
    text(s, `anim_nt${i}`, String(i + 1), { x: 8.1, y, w: 0.5, h: 0.5, fontSize: 16, bold: true, color: C.background1, align: "center", valign: "middle" });
    text(s, `anim_sh${i}`, h, { x: 8.8, y: y - 0.02, w: 3.9, h: 0.4, fontSize: 17, bold: true, color: C.text1 });
    text(s, `anim_sp${i}`, p, { x: 8.8, y: y + 0.4, w: 3.9, h: 0.6, fontSize: 13, color: C.accent5 });
  });
  text(s, "anim_took", "≈13 seconds · 4 tool calls · 0 operators", { x: 0.7, y: 4.6, w: 3.3, h: 0.9, fontSize: 18, bold: true, color: C.accent3 });
  s.addNotes("Live scenario: the customer sends a photo of cracked headphones. Gemma 4 describes the photo, finds the order and opens a replacement through the policy engine. Every step is visible in the chat.");

  // =============================================================== 5. voice
  s = pres.addSlide({ masterName: "DARK_CONTENT" });
  orbs(s);
  s.addText("Just like a call: voice Aysu", { placeholder: "title" });
  await shot(s, "anim_ring", "04-call-ringing.png", 0.75, 1.5, 2.85, true);
  await shot(s, "anim_live", "05-call-aysu.png", 3.85, 1.5, 3.25, true);
  const vf = [
    ["LuBrain", "The brain is Gemma 4", "ElevenLabs does only STT/TTS; our Custom LLM endpoint writes the answer"],
    ["LuAudioWaveform", "Character-level lip sync", "Per-character timing of every audio chunk + real loudness"],
    ["LuSmile", "Emotion follows the tone", "[empathetically] changes both the voice and the face"],
    ["LuPhoneCall", "Feels like a real call", "425 Hz ringback, Aysu appears when she picks up"],
  ];
  for (let i = 0; i < vf.length; i++) {
    const y = 1.6 + i * 1.25;
    await iconBubble(s, `anim_v${i}`, vf[i][0], 7.55, y, 0.62, i === 2 ? C.accent3 : C.accent1);
    text(s, `anim_vh${i}`, vf[i][1], { x: 8.4, y: y - 0.02, w: 4.3, h: 0.4, fontSize: 18, bold: true, color: C.background1 });
    text(s, `anim_vp${i}`, vf[i][2], { x: 8.4, y: y + 0.4, w: 4.3, h: 0.6, fontSize: 13, color: C.background2 });
  }
  s.addNotes("Voice: ElevenLabs recognizes and speaks, but Gemma 4 writes the answer. The avatar moves its lips to character timings, and the tone tag Gemma picks changes both the voice and the face.");

  // =============================================================== 6. automation
  s = pres.addSlide({ masterName: "LIGHT_CONTENT" });
  orbs(s);
  s.addText("The chat ends, the work gets done", { placeholder: "title" });
  await shot(s, "anim_dash", "06-dashboard.jpg", 0.7, 1.55, 8.1);
  const outs = ["Summary", "Category", "Urgency", "Sentiment", "Resolved?", "Needs a human?", "Auto-ticket", "Follow-up email", "KB gap"];
  card(s, "anim_jsoncard", 9.2, 1.55, 3.45, 4.75);
  text(s, "anim_jsonh", "Gemma 4 → JSON", { x: 9.5, y: 1.8, w: 2.95, h: 0.4, fontSize: 18, bold: true, color: C.accent1 });
  outs.forEach((o, i) => {
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { objectName: `anim_o${i}`, x: 9.5, y: 2.35 + i * 0.42, w: 2.85, h: 0.34, rectRadius: 0.17,
      fill: { color: i >= 6 ? C.accent3 : C.accent1, transparency: 85 }, line: { color: i >= 6 ? C.accent3 : C.accent1, width: 0.75, transparency: 40 } });
    text(s, `anim_ot${i}`, o, { x: 9.65, y: 2.35 + i * 0.42, w: 2.6, h: 0.34, fontSize: 12, bold: true, color: i >= 6 ? C.accent3 : C.accent1, valign: "middle" });
  });
  s.addNotes("When a conversation ends, or goes quiet for 10 seconds, Gemma 4 analyzes it: summary, priority, sentiment, an auto-ticket if needed, and a ready follow-up email. Everything is written to Neon and shown on the dashboard.");

  // =============================================================== 7. architecture
  s = pres.addSlide({ masterName: "LIGHT_CONTENT" });
  orbs(s);
  s.addText("Architecture", { placeholder: "title" });
  const box = (name, label, sub, x, y, w, h, color) => {
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { objectName: name, x, y, w, h, rectRadius: 0.18, fill: { color: C.background1 }, line: { color, width: 1.75 }, shadow: shadow() });
    text(s, name + "_t", [{ text: label, options: { bold: true, fontSize: 16, color: C.text1, breakLine: true } }, { text: sub, options: { fontSize: 12, color: C.accent5 } }],
      { x: x + 0.15, y: y + 0.12, w: w - 0.3, h: h - 0.2, align: "center", valign: "middle" });
  };
  const arrow = (name, x1, y1, x2, y2) => s.addShape(pres.shapes.LINE, { objectName: name, x: Math.min(x1, x2), y: Math.min(y1, y2), w: Math.abs(x2 - x1) || 0.001, h: Math.abs(y2 - y1) || 0.001,
    flipH: x2 < x1, flipV: y2 < y1, line: { color: C.accent5, width: 1.5, endArrowType: "triangle" } });
  box("anim_a0", "Browser", "Mallard store · Aysu widget · ChillDesk dashboard", 0.7, 1.7, 3.2, 1.2, C.accent2);
  box("anim_a1", "ElevenLabs", "STT (Scribe v2) · TTS · WebSocket", 0.7, 3.7, 3.2, 1.2, C.accent5);
  box("anim_a2", "FastAPI backend", "/api/chat (SSE) · /v1/chat/completions · automation", 5.0, 2.7, 3.3, 1.3, C.accent1);
  box("anim_a3", "Gemma 4 26B MoE", "Gemini API · function calling · vision", 9.35, 1.45, 3.3, 1.15, C.accent1);
  box("anim_a4", "Gemma 4 E4B", "Ollama · local fallback (on 429)", 9.35, 2.85, 3.3, 1.0, C.accent3);
  box("anim_a5", "Neon Postgres + pgvector", "customers, orders, returns, tickets, conversations", 9.35, 4.1, 3.3, 1.15, C.accent2);
  box("anim_a6", "EmbeddingGemma", "local RAG · 768-dim", 5.0, 5.05, 3.3, 1.0, C.accent2);
  arrow("anim_l0", 3.9, 2.3, 5.0, 3.1); arrow("anim_l1", 3.9, 4.3, 5.0, 3.6); arrow("anim_l2", 2.3, 2.9, 2.3, 3.7);
  arrow("anim_l3", 8.3, 3.0, 9.35, 2.05); arrow("anim_l4", 8.3, 3.35, 9.35, 3.35); arrow("anim_l5", 8.3, 3.7, 9.35, 4.65);
  arrow("anim_l6", 6.65, 4.0, 6.65, 5.05); arrow("anim_l7", 8.3, 5.55, 9.35, 4.95);
  s.addNotes("The browser sends chat over SSE and voice through ElevenLabs, which calls our OpenAI-compatible endpoint. The backend runs the Gemma 4 agent loop, tools write to Neon, and the knowledge base is searched with EmbeddingGemma and pgvector. If the Gemini quota runs out, local Gemma 4 takes over.");

  // =============================================================== 8. fine-tuning method
  s = pres.addSlide({ masterName: "DARK_CONTENT" });
  orbs(s);
  s.addText("We trained our own model: Unsloth QLoRA", { placeholder: "title" });
  const nTrain = R.log ? R.log.train_examples : 189;
  const nTest = (R.teacher || R.base || {}).n || 40;
  const secs = R.log ? Math.round(R.log.seconds) : null;
  const stats = [[`${nTrain + nTest}`, "labelled Azerbaijani conversations"], ["1B", "parameters — Gemma 3 1B (4-bit)"], ["8 GB", "laptop GPU (RTX 4070)"], [secs ? `${secs} s` : "~ min", "training time"]];
  stats.forEach(([v, l], i) => {
    const x = 0.75 + i * 3.1;
    card(s, `anim_st${i}`, x, 1.55, 2.85, 1.75, true);
    text(s, `anim_sv${i}`, v, { x: x + 0.3, y: 1.7, w: 2.3, h: 0.9, fontSize: 44, bold: true, color: i === 3 ? C.accent3 : C.accent4 });
    text(s, `anim_sl${i}`, l, { x: x + 0.3, y: 2.6, w: 2.3, h: 0.6, fontSize: 13, color: C.background2 });
  });
  const pipe = [
    ["LuDatabase", "1 · Data", "We sample the labels first (7 categories × 3 urgencies × 3 sentiments, 12 products, 6 customer styles), then Gemma 4 26B writes a matching conversation. The ground truth is exact."],
    ["LuCpu", "2 · Train", "Unsloth QLoRA, rank 16, loss on the JSON answer only. The small model learns our labelling rules."],
    ["LuChartColumn", "3 · Eval", `${nTest} held-out conversations: base 1B vs fine-tuned 1B vs Gemma 4 26B. Every field is scored separately.`],
  ];
  for (let i = 0; i < pipe.length; i++) {
    const x = 0.75 + i * 4.13;
    await iconBubble(s, `anim_pi${i}`, pipe[i][0], x, 3.75, 0.62, i === 1 ? C.accent3 : C.accent1);
    text(s, `anim_ph${i}`, pipe[i][1], { x: x + 0.8, y: 3.8, w: 3.0, h: 0.5, fontSize: 20, bold: true, color: C.background1 });
    text(s, `anim_pp${i}`, pipe[i][2], { x, y: 4.55, w: 3.8, h: 2.1, fontSize: 13, color: C.background2 });
  }
  s.addNotes("Goal: run conversation analysis offline on a small open model. A teacher model wrote the data, but we chose the labels up front, so the correct answers are known exactly.");

  // =============================================================== 9. results
  s = pres.addSlide({ masterName: "LIGHT_CONTENT" });
  orbs(s);
  s.addText("Result: small model, big jump", { placeholder: "title" });
  const fields = [["acc_category", "Category"], ["acc_urgency", "Urgency"], ["acc_sentiment", "Sentiment"], ["acc_resolved", "Resolved"], ["acc_needs_human", "Needs human"], ["acc_team", "Team"]];
  const series = [["base", "Gemma 3 1B (base)"], ["finetuned", "Gemma 3 1B + LoRA (ours)"], ["teacher", "Gemma 4 26B (API)"]].filter(([k]) => R[k]);
  if (series.length) {
    s.addChart(pres.charts.BAR, series.map(([k, n]) => ({ name: n, labels: fields.map((f) => f[1]), values: fields.map(([m]) => Math.round(R[k][m] * 100)) })), {
      objectName: "anim_chart", x: 0.6, y: 1.45, w: 8.4, h: 5.3, barDir: "col", barGapWidthPct: 60,
      chartColors: series.map(([k]) => ({ base: "9AA5A3", finetuned: HEX.accent1, teacher: HEX.accent3 }[k])),
      showValue: true, dataLabelPosition: "outEnd", dataLabelFontSize: 10, dataLabelColor: HEX.dk1, dataLabelFontFace: "+mn-lt",
      catAxisLabelColor: HEX.accent5, catAxisLabelFontSize: 12, catAxisLabelFontFace: "+mn-lt",
      valAxisMaxVal: 100, valAxisMinVal: 0, valAxisLabelColor: HEX.accent5, valAxisLabelFontSize: 10, valAxisLabelFontFace: "+mn-lt",
      valGridLine: { color: "E3DED4", size: 0.5 }, catGridLine: { style: "none" },
      showLegend: true, legendPos: "t", legendFontSize: 12, legendColor: HEX.dk1, legendFontFace: "+mn-lt",
      showTitle: true, title: "Test accuracy, % (held-out set)", titleFontSize: 14, titleColor: HEX.dk1, titleFontFace: "+mn-lt",
    });
  }
  const pct = (k, m) => (R[k] ? Math.round(R[k][m] * 100) : null);
  const call = [
    [pct("finetuned", "acc_mean") ?? "…", "%", "fine-tuned 1B mean accuracy", C.accent1],
    [pct("base", "acc_mean") ?? "…", "%", "same model, not fine-tuned", C.accent5],
    [pct("teacher", "acc_mean") ?? "…", "%", "Gemma 4 26B, zero-shot", C.accent3],
  ];
  call.forEach(([v, u, l, c], i) => {
    card(s, `anim_cc${i}`, 9.35, 1.5 + i * 1.75, 3.3, 1.5);
    text(s, `anim_cv${i}`, [{ text: String(v), options: { fontSize: 44, bold: true, color: c } }, { text: u, options: { fontSize: 22, bold: true, color: c } }], { x: 9.6, y: 1.6 + i * 1.75, w: 2.9, h: 0.85 });
    text(s, `anim_cl${i}`, l, { x: 9.6, y: 2.45 + i * 1.75, w: 2.9, h: 0.45, fontSize: 13, color: C.accent5 });
  });
  s.addNotes("On the held-out set: the same 1B model before and after fine-tuning, plus 26-billion-parameter Gemma 4 zero-shot. The fine-tuned small model learned our labelling rules and runs locally, offline.");

  // =============================================================== 10. open source
  s = pres.addSlide({ masterName: "LIGHT_CONTENT" });
  orbs(s);
  s.addText("Open all the way down", { placeholder: "title" });
  const oss = [
    ["LuSparkles", "Gemma 4 26B / E4B", "Agent, vision, analysis", "Apache 2.0"],
    ["LuSearch", "EmbeddingGemma", "Local RAG embeddings", "Gemma Terms"],
    ["LuCpu", "Gemma 3 1B + LoRA", "Fine-tuned analyst", "Gemma Terms"],
    ["LuWrench", "Unsloth · Ollama", "Training and local inference", "Apache 2.0 · MIT"],
    ["LuDatabase", "Neon · pgvector", "Postgres + vector search", "Apache 2.0 · PostgreSQL"],
    ["LuGithub", "ChillDesk code", "github.com/Ducktoberfest/team-Chill", "MIT"],
  ];
  for (let i = 0; i < oss.length; i++) {
    const x = 0.7 + (i % 3) * 4.05, y = 1.65 + Math.floor(i / 3) * 2.45;
    card(s, `anim_os${i}`, x, y, 3.75, 2.1);
    await iconBubble(s, `anim_oi${i}`, oss[i][0], x + 0.35, y + 0.35, 0.62, i === 5 ? C.accent3 : C.accent1);
    text(s, `anim_oh${i}`, oss[i][1], { x: x + 1.15, y: y + 0.35, w: 2.4, h: 0.62, fontSize: 18, bold: true, color: C.text1, valign: "middle" });
    text(s, `anim_op${i}`, oss[i][2], { x: x + 0.35, y: y + 1.12, w: 3.1, h: 0.4, fontSize: 13, color: C.accent5 });
    text(s, `anim_ol${i}`, oss[i][3], { x: x + 0.35, y: y + 1.52, w: 3.1, h: 0.35, fontSize: 12, bold: true, color: C.accent1 });
  }
  s.addNotes("The whole AI layer is the open-weight Gemma family. The code is MIT; the README lists the models, licenses and how to run it.");

  // =============================================================== 11. closing
  s = pres.addSlide({ masterName: "DARK_TITLE" });
  orbs(s);
  s.addImage({ path: path.join(ASSETS, "ripples-dark.png"), x: 6.4, y: 1.6, w: 7, h: 7, transparency: 10 });
  s.addImage({ objectName: "anim_logo2", path: LOGO, x: 0.8, y: 1.05, w: 1.05, h: 1.05 });
  s.addText("Thank you!", { placeholder: "title" });
  s.addText("Now let’s call Aysu.", { placeholder: "body" });
  text(s, "anim_repo", "github.com/Ducktoberfest/team-Chill", { x: 0.8, y: 5.25, w: 7, h: 0.5, fontSize: 20, bold: true, color: C.accent3 });
  text(s, "anim_team2", "team-Chill · Ducktoberfest Baku 2026", { x: 0.8, y: 6.55, w: 7, h: 0.4, fontSize: 14, color: C.accent2 });
  await shot(s, "anim_ring2", "04-call-ringing.png", 8.85, 0.7, 3.4, true);
  s.addNotes("Thank you. Next, the live demo: a call to Aysu, a damaged-product photo and the automatic analysis on the dashboard.");

  const out = path.join(HERE, "ChillDesk-EN.pptx");
  await pres.writeFile({ fileName: out });
  await applyTheme(out, THEME);
  console.log("wrote", out, "| results:", Object.keys(R).filter((k) => R[k] && k !== "log").join(",") || "none");
})().catch((e) => { console.error(e); process.exit(1); });
