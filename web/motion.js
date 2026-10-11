// Motion layer for the Mallard store: scroll reveals, hero word rise, parallax tilt, card sheen,
// spring buttons, fly-to-cart and a shrinking nav. Everything is skipped under prefers-reduced-motion.
const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

// ---------- scroll reveal (blur + rise, staggered within each group)
export function reveal(root = document) {
  const els = root.querySelectorAll("[data-reveal]:not(.revealed)");
  if (reduce) { els.forEach((e) => e.classList.add("revealed")); return; }
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (!e.isIntersecting) continue;
      const el = e.target;
      const siblings = [...el.parentElement.querySelectorAll(":scope > [data-reveal]")];
      el.style.transitionDelay = `${Math.min(siblings.indexOf(el), 8) * 70}ms`;
      el.classList.add("revealed");
      io.unobserve(el);
    }
  }, { threshold: 0.12, rootMargin: "0px 0px -6% 0px" });
  els.forEach((e) => io.observe(e));
}

// ---------- hero headline: each word rises in
function splitWords(el) {
  const walk = (node) => {
    for (const child of [...node.childNodes]) {
      if (child.nodeType === 3) {
        const frag = document.createDocumentFragment();
        child.textContent.split(/(\s+)/).forEach((w) => {
          if (!w.trim()) { frag.append(w); return; }
          const s = document.createElement("span");
          s.className = "word"; s.textContent = w; frag.append(s);
        });
        child.replaceWith(frag);
      } else if (child.nodeType === 1 && child.tagName !== "BR") walk(child);
    }
  };
  walk(el);
  el.querySelectorAll(".word").forEach((w, i) => { w.style.animationDelay = `${120 + i * 70}ms`; });
  el.classList.add("words-in");
}

// ---------- 3D tilt + light sheen that follows the cursor
function tilt(el, max = 7) {
  if (reduce) return;
  let raf = 0;
  el.addEventListener("pointermove", (e) => {
    const r = el.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(() => {
      el.style.setProperty("--rx", `${(0.5 - y) * max}deg`);
      el.style.setProperty("--ry", `${(x - 0.5) * max}deg`);
      el.style.setProperty("--mx", `${x * 100}%`);
      el.style.setProperty("--my", `${y * 100}%`);
    });
  });
  el.addEventListener("pointerleave", () => { el.style.setProperty("--rx", "0deg"); el.style.setProperty("--ry", "0deg"); });
}
export function tiltAll(selector, max) { document.querySelectorAll(selector).forEach((el) => { if (!el.dataset.tilt) { el.dataset.tilt = 1; tilt(el, max); } }); }

// ---------- fly a product image into the cart
export function flyToCart(img, cartEl) {
  cartEl.classList.remove("bump"); void cartEl.offsetWidth; cartEl.classList.add("bump");
  if (reduce || !img) return;
  const a = img.getBoundingClientRect(), b = cartEl.getBoundingClientRect();
  const ghost = img.cloneNode();
  ghost.className = "fly";
  Object.assign(ghost.style, { left: `${a.left}px`, top: `${a.top}px`, width: `${a.width}px`, height: `${a.height}px` });
  document.body.append(ghost);
  const dx = b.left + b.width / 2 - (a.left + a.width / 2), dy = b.top + b.height / 2 - (a.top + a.height / 2);
  ghost.animate([
    { transform: "translate(0,0) scale(1)", opacity: 1, borderRadius: "18px" },
    { transform: `translate(${dx * 0.6}px, ${dy - 120}px) scale(.45)`, opacity: .9, offset: .55 },
    { transform: `translate(${dx}px, ${dy}px) scale(.08)`, opacity: .2, borderRadius: "50%" },
  ], { duration: 820, easing: "cubic-bezier(.5,0,.3,1)" }).onfinish = () => ghost.remove();
}

// ---------- boot
export function initMotion() {
  // nav shrinks once the page scrolls
  const nav = document.querySelector(".topbar");
  const onScroll = () => nav && nav.classList.toggle("scrolled", window.scrollY > 24);
  window.addEventListener("scroll", onScroll, { passive: true }); onScroll();

  const h1 = document.querySelector(".hero h1");
  if (h1 && !reduce) splitWords(h1);

  // hero product follows the pointer a little (parallax)
  const visual = document.querySelector(".hero-visual");
  if (visual && !reduce) {
    document.querySelector(".hero").addEventListener("pointermove", (e) => {
      const r = visual.getBoundingClientRect();
      const x = (e.clientX - (r.left + r.width / 2)) / window.innerWidth, y = (e.clientY - (r.top + r.height / 2)) / window.innerHeight;
      visual.style.setProperty("--px", x.toFixed(3)); visual.style.setProperty("--py", y.toFixed(3));
    });
  }
  // spotlight that follows the cursor on the dark band
  const band = document.querySelector(".ai-band");
  if (band && !reduce) band.addEventListener("pointermove", (e) => {
    const r = band.getBoundingClientRect();
    band.style.setProperty("--sx", `${e.clientX - r.left}px`); band.style.setProperty("--sy", `${e.clientY - r.top}px`);
  });
  tiltAll(".trust .item, .review, .ai-feat", 5);
  reveal();
}
