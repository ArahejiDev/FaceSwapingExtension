const MIN = 80; // px, ignore icons and small things
const vistas = new WeakSet();
const asignada = new WeakMap(); // img -> photo we assigned

let fotos = [];
let activo = true;

const listo = chrome.storage.local.get(["fotos", "activo"]).then((d) => {
  fotos = (d.fotos || []).map((f) => f.dataUrl);
  activo = d.activo !== false;
});

chrome.storage.onChanged.addListener((cambios, area) => {
  if (area !== "local") return;
  if (cambios.fotos) fotos = (cambios.fotos.newValue || []).map((f) => f.dataUrl);
  if (cambios.activo) activo = cambios.activo.newValue !== false;
});

function fotoAleatoria() {
  return fotos[Math.floor(Math.random() * fotos.length)];
}

function reemplazar(img) {
  // lock the current size so the page layout does not shift
  const r = img.getBoundingClientRect();
  if (r.width > 0 && r.height > 0) {
    img.style.width = r.width + "px";
    img.style.height = r.height + "px";
  }
  img.removeAttribute("srcset");
  img.removeAttribute("sizes");
  img.closest("picture")?.querySelectorAll("source").forEach((s) => s.remove());
  const foto = fotoAleatoria();
  asignada.set(img, foto);
  img.src = foto;
  img.style.objectFit = "cover";
}

async function blobADataUrl(url) {
  const blob = await (await fetch(url)).blob();
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result);
    r.onerror = rej;
    r.readAsDataURL(blob);
  });
}

async function procesar(img) {
  if (asignada.has(img) || vistas.has(img)) return;

  await listo;
  if (!activo || !fotos.length) return;

  const src = img.currentSrc || img.src;
  if (!src || src.startsWith("chrome-extension:")) return;
  if (/^data:image\/svg/.test(src) || /\.svg(\?|$)/i.test(src)) return;
  if (img.naturalWidth < MIN || img.naturalHeight < MIN) return;

  vistas.add(img);

  try {
    const msg = { target: "background" };
    if (src.startsWith("data:")) msg.dataUrl = src;
    else if (src.startsWith("blob:")) msg.dataUrl = await blobADataUrl(src);
    else msg.url = src;

    const r = await chrome.runtime.sendMessage(msg);
    if (r?.error) console.debug("[face-swap] error:", r.error, src.slice(0, 80));
    if (r?.found && fotos.length) reemplazar(img);
  } catch (e) {
    console.debug("[face-swap] failure:", e);
  }
}

// Only process visible (or nearly visible) images, so on-screen ones go first
const io = new IntersectionObserver(
  (entradas) => {
    for (const e of entradas) {
      if (!e.isIntersecting) continue;
      io.unobserve(e.target);
      procesar(e.target);
    }
  },
  { rootMargin: "400px" }
);

function revisar(img) {
  if (img.complete && img.naturalWidth) io.observe(img);
  else img.addEventListener("load", () => io.observe(img), { once: true });
}

document.querySelectorAll("img").forEach(revisar);

new MutationObserver((muts) => {
  for (const m of muts) {
    if (m.type === "attributes") {
      const img = m.target;
      if (img.tagName !== "IMG") continue;
      // change made by us -> ignore
      if (asignada.get(img) === img.getAttribute("src")) continue;
      // the site (e.g. Google) changed the src: check again
      asignada.delete(img);
      vistas.delete(img);
      revisar(img);
      continue;
    }
    m.addedNodes.forEach((n) => {
      if (n.nodeType !== 1) return;
      if (n.tagName === "IMG") revisar(n);
      else n.querySelectorAll?.("img").forEach(revisar);
    });
  }
}).observe(document.documentElement, {
  childList: true,
  subtree: true,
  attributes: true,
  attributeFilter: ["src"],
});
