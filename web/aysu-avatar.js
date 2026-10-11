// Aysu 3D avatar: Three.js renderer with audio-driven lip sync, blinking, gaze and idle motion.
//
//   const aysu = new AysuAvatar(el, { src: "/static/avatar/aysu.glb", framing: "bust" });
//   await aysu.load();
//   aysu.setState("listening" | "thinking" | "speaking" | "idle");
//   aysu.useFrequencySource(() => voice.getOutputByteFrequencyData());   // voice call lip sync
//   aysu.speakText("Salam!");                                             // silent lip sync for chat
//   aysu.setEmotion("happy" | "empathetic" | "concerned" | "neutral");
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/addons/libs/meshopt_decoder.module.js";

const FACE_KEYS = ["jawOpen", "mouthSmile", "mouthStretch", "mouthFunnel", "mouthPucker", "mouthRollLower",
  "mouthPress", "browInnerUp", "browDown", "eyeBlinkLeft", "eyeBlinkRight"];

const EMOTIONS = {
  neutral: {},
  happy: { mouthSmile: 0.55, browInnerUp: 0.12 },
  empathetic: { browInnerUp: 0.5, mouthSmile: 0.12 },
  concerned: { browInnerUp: 0.35, browDown: 0.25, mouthPress: 0.15 },
};

// letter -> mouth shape for text-only (chat) lip sync; Azerbaijani alphabet aware
const LETTER_SHAPES = [
  [/[aəAƏ]/, { jawOpen: 0.62, mouthStretch: 0.1 }],
  [/[eiıEIİ]/, { jawOpen: 0.32, mouthStretch: 0.45 }],
  [/[oöOÖ]/, { jawOpen: 0.42, mouthFunnel: 0.55 }],
  [/[uüUÜwW]/, { jawOpen: 0.22, mouthPucker: 0.6 }],
  [/[bmpBMP]/, { mouthPress: 0.75 }],
  [/[fvFV]/, { mouthRollLower: 0.65, jawOpen: 0.08 }],
  [/[a-zA-ZçşğÇŞĞ]/, { jawOpen: 0.22 }],
];

const lerp = (a, b, k) => a + (b - a) * k;
const clamp01 = (x) => Math.max(0, Math.min(1, x));
const rand = (a, b) => a + Math.random() * (b - a);

export class AysuAvatar {
  constructor(container, opts = {}) {
    this.el = container;
    this.opts = { src: "/static/avatar/aysu.glb", framing: "bust", followPointer: true, pixelRatioCap: 2, ...opts };
    this.state = "idle";
    this.morphs = [];            // [{ mesh, dict }]
    this.current = Object.fromEntries(FACE_KEYS.map((k) => [k, 0]));
    this.emotion = { pose: {}, until: 0 };
    this.gaze = { x: 0, y: 0, tx: 0, ty: 0, nextSaccade: 0, pointer: null };
    this.blink = { next: performance.now() + 2000, t: -1, double: false };
    this.freqSource = null;
    this.textQueue = [];         // [{ at, pose }]
    this.visible = true;
    this.disposed = false;
  }

  async load() {
    const { el, opts } = this;
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, opts.pixelRatioCap));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    el.append(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(24, 1, 0.01, 20);
    this.scene.add(new THREE.HemisphereLight(0xffffff, 0xb9c3d6, 1.4));
    const key = new THREE.DirectionalLight(0xffffff, 2.2); key.position.set(0.6, 0.9, 1.4); this.scene.add(key);
    const rim = new THREE.DirectionalLight(0xa9c8ff, 1.3); rim.position.set(-1.2, 0.6, -0.8); this.scene.add(rim);
    const fill = new THREE.DirectionalLight(0xffd9e1, 0.6); fill.position.set(-0.8, -0.2, 1.0); this.scene.add(fill);

    const loader = new GLTFLoader();
    loader.setMeshoptDecoder(MeshoptDecoder);
    const gltf = await loader.loadAsync(opts.src);
    this.root = new THREE.Group();
    this.root.add(gltf.scene);
    this.scene.add(this.root);

    gltf.scene.traverse((o) => {
      if (o.isMesh && o.morphTargetDictionary) this.morphs.push({ mesh: o, dict: o.morphTargetDictionary });
      if (/eye.?left/i.test(o.name)) this.eyeL = o;
      if (/eye.?right/i.test(o.name)) this.eyeR = o;
    });
    this.eyeBase = [this.eyeL, this.eyeR].map((e) => e && e.rotation.clone());
    this.frame(opts.framing);

    this.resizeObs = new ResizeObserver(() => this.resize());
    this.resizeObs.observe(el);
    this.visObs = new IntersectionObserver(([e]) => { this.visible = e.isIntersecting; });
    this.visObs.observe(el);
    if (opts.followPointer) {
      this.onPointer = (e) => {
        const r = el.getBoundingClientRect();
        const cx = r.left + r.width / 2, cy = r.top + r.height * 0.35;
        this.gaze.pointer = { x: Math.max(-1, Math.min(1, (e.clientX - cx) / (window.innerWidth / 2))),
                              y: Math.max(-1, Math.min(1, (cy - e.clientY) / (window.innerHeight / 2))), at: performance.now() };
      };
      window.addEventListener("pointermove", this.onPointer, { passive: true });
    }
    this.resize();
    this.renderer.setAnimationLoop(() => this.tick());
    return this;
  }

  frame(framing = "bust") {
    // frame the head from the eye height; "face" is a closer crop
    const box = new THREE.Box3().setFromObject(this.root);
    const size = box.getSize(new THREE.Vector3());
    const eyeY = this.eyeL ? this.eyeL.getWorldPosition(new THREE.Vector3()).y : box.max.y - size.y * 0.3;
    const h = framing === "face" ? size.y * 0.46 : size.y * 0.86;
    const centerY = framing === "face" ? eyeY - size.y * 0.02 : eyeY - size.y * 0.12;
    const dist = (h / 2) / Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2));
    this.camera.position.set(0, centerY + size.y * 0.02, box.max.z + dist);
    this.camera.lookAt(0, centerY, 0);
    this.opts.framing = framing;
  }

  resize() {
    const { clientWidth: w, clientHeight: h } = this.el;
    if (!w || !h) return;
    this.renderer.setSize(w, h, false);
    this.renderer.domElement.style.width = "100%";
    this.renderer.domElement.style.height = "100%";
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  // ------------------------------------------------------------------ public API
  setState(state) {
    if (state === this.state) return;
    this.state = state;
    if (state === "thinking") { this.gaze.tx = rand(0.35, 0.55) * (Math.random() < 0.5 ? -1 : 1); this.gaze.ty = 0.35; }
    if (state === "listening") { this.gaze.tx = 0; this.gaze.ty = 0; }
  }

  setEmotion(name, { durationMs = 2500 } = {}) {
    this.emotion = { pose: EMOTIONS[name] || {}, until: performance.now() + durationMs };
  }

  useFrequencySource(fn) { this.freqSource = fn; this.textQueue = []; }
  stopAudio() { this.freqSource = null; }

  speakText(text) {
    // schedule one mouth shape per letter; pauses on punctuation, mouth closes between words
    const t0 = performance.now();
    let at = 0;
    const q = [];
    for (const ch of text.slice(0, 600)) {
      if (/[.!?]/.test(ch)) { q.push({ at: t0 + at, pose: {} }); at += 320; continue; }
      if (/[,;:]/.test(ch)) { q.push({ at: t0 + at, pose: {} }); at += 180; continue; }
      if (/\s/.test(ch)) { q.push({ at: t0 + at, pose: { jawOpen: 0.05 } }); at += 45; continue; }
      const shape = LETTER_SHAPES.find(([re]) => re.test(ch));
      if (!shape) continue;
      q.push({ at: t0 + at, pose: shape[1] });
      at += 62;
    }
    q.push({ at: t0 + at, pose: {}, end: true });
    this.textQueue = q;
    this.setState("speaking");
  }

  dispose() {
    this.disposed = true;
    this.renderer?.setAnimationLoop(null);
    this.resizeObs?.disconnect();
    this.visObs?.disconnect();
    if (this.onPointer) window.removeEventListener("pointermove", this.onPointer);
    this.renderer?.dispose();
    this.renderer?.domElement.remove();
  }

  // ------------------------------------------------------------------ animation
  mouthFromAudio() {
    const data = this.freqSource && this.freqSource();
    if (!data || !data.length) return {};
    const band = (a, b) => {
      let s = 0; const i0 = Math.floor(a * data.length), i1 = Math.max(i0 + 1, Math.floor(b * data.length));
      for (let i = i0; i < i1; i++) s += data[i];
      return s / (i1 - i0) / 255;
    };
    const low = band(0.01, 0.08), mid = band(0.08, 0.25), high = band(0.25, 0.6);
    const energy = low * 0.5 + mid * 0.35 + high * 0.15;
    if (energy < 0.05) return { mouthPress: 0.25 };                  // silence between syllables: lips close
    const open = clamp01((energy - 0.05) * 2.6);
    const round = clamp01((low - mid * 1.1) * 3);                     // dark vowels o/u
    const wide = clamp01((high - low * 0.6) * 3);                     // bright vowels i/e
    return { jawOpen: open * (1 - round * 0.4), mouthFunnel: round * 0.6, mouthPucker: round * 0.35,
             mouthStretch: wide * 0.5, mouthSmile: 0.08 };
  }

  mouthFromText(now) {
    const q = this.textQueue;
    while (q.length > 1 && q[1].at <= now) q.shift();
    if (!q.length) return null;
    if (q[0].end && q[0].at <= now) { this.textQueue = []; if (this.state === "speaking") this.setState("idle"); return {}; }
    return q[0].at <= now ? q[0].pose : {};
  }

  tick() {
    if (this.disposed || !this.visible) return;
    const now = performance.now();
    const dt = Math.min(0.05, (now - (this.lastNow || now)) / 1000 || 0.016);
    this.lastNow = now;
    const t = now / 1000;

    // ---- target face pose
    const target = Object.fromEntries(FACE_KEYS.map((k) => [k, 0]));
    if (this.state === "idle") target.mouthSmile = 0.12 + Math.sin(t * 0.3) * 0.04;
    if (this.state === "listening") { target.mouthSmile = 0.16; target.browInnerUp = 0.08; }
    if (this.state === "thinking") { target.browDown = 0.18; target.mouthPress = 0.2; }
    let mouth = null;
    if (this.freqSource) mouth = this.mouthFromAudio();
    else if (this.textQueue.length) mouth = this.mouthFromText(now);
    if (mouth) Object.assign(target, { mouthSmile: target.mouthSmile * 0.5 }, mouth);
    if (now < this.emotion.until) for (const [k, v] of Object.entries(this.emotion.pose)) target[k] = Math.max(target[k], v);

    // ---- blinking (occasional double blink)
    if (this.blink.t < 0 && now > this.blink.next) { this.blink.t = 0; this.blink.double = Math.random() < 0.15; }
    let lid = 0;
    if (this.blink.t >= 0) {
      this.blink.t += dt * 1000;
      const d = this.blink.t;
      lid = d < 70 ? d / 70 : d < 160 ? 1 - (d - 70) / 90 : 0;
      if (d >= 160) {
        this.blink.t = -1;
        this.blink.next = now + (this.blink.double ? 140 : rand(2200, this.state === "listening" ? 4200 : 5600));
        this.blink.double = false;
      }
    }
    target.eyeBlinkLeft = target.eyeBlinkRight = Math.max(lid, this.gaze.y < -0.3 ? 0.25 : 0);

    // ---- smooth toward target (mouth fast, brows slower)
    for (const k of FACE_KEYS) {
      const speed = k.startsWith("eyeBlink") ? 1 : k.startsWith("brow") ? 6 : 18;
      this.current[k] = lerp(this.current[k], target[k], 1 - Math.exp(-speed * dt));
    }
    for (const { mesh, dict } of this.morphs) {
      for (const k of FACE_KEYS) if (k in dict) mesh.morphTargetInfluences[dict[k]] = this.current[k];
    }

    // ---- gaze: pointer when recent, otherwise saccades around the camera
    const g = this.gaze;
    const pointerFresh = g.pointer && now - g.pointer.at < 2500 && this.state !== "thinking";
    if (pointerFresh) { g.tx = g.pointer.x * 0.6; g.ty = g.pointer.y * 0.4; }
    else if (now > g.nextSaccade && this.state !== "thinking") {
      const spread = this.state === "listening" ? 0.08 : this.state === "speaking" ? 0.18 : 0.35;
      g.tx = rand(-spread, spread); g.ty = rand(-spread * 0.6, spread * 0.6);
      g.nextSaccade = now + rand(700, this.state === "listening" ? 2600 : 1800);
    }
    g.x = lerp(g.x, g.tx, 1 - Math.exp(-14 * dt));
    g.y = lerp(g.y, g.ty, 1 - Math.exp(-14 * dt));
    [this.eyeL, this.eyeR].forEach((e, i) => {
      if (!e) return;
      e.rotation.y = this.eyeBase[i].y + g.x * 0.38;
      e.rotation.x = this.eyeBase[i].x - g.y * 0.26;
    });

    // ---- head and breathing; the head follows the eyes about 30%
    const talk = this.current.jawOpen;
    this.root.rotation.y = lerp(this.root.rotation.y, g.x * 0.11 + Math.sin(t * 0.5) * 0.015, 1 - Math.exp(-4 * dt));
    this.root.rotation.x = lerp(this.root.rotation.x, -g.y * 0.05 + Math.sin(t * 0.9) * 0.008 + talk * 0.02, 1 - Math.exp(-4 * dt));
    this.root.rotation.z = Math.sin(t * 0.37) * 0.01 + (this.state === "thinking" ? 0.025 : 0);
    this.root.position.y = Math.sin(t * 1.5) * 0.0025;

    this.renderer.render(this.scene, this.camera);
  }
}
