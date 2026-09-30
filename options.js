const $grid = document.getElementById("grid");
const $activo = document.getElementById("activo");
const $archivos = document.getElementById("archivos");
const $estado = document.getElementById("estado");
const $zona = document.getElementById("zona");
const $contador = document.getElementById("contador");

const MAX_LADO = 900; // px, shrink photos so they stay small

async function leer() {
  const d = await chrome.storage.local.get(["fotos", "activo"]);
  return { fotos: d.fotos || [], activo: d.activo !== false };
}

async function pintar() {
  const { fotos, activo } = await leer();
  $activo.checked = activo;
  $grid.innerHTML = "";
  $contador.textContent = fotos.length === 1 ? "1 photo" : `${fotos.length} photos`;

  if (!fotos.length) {
    $grid.innerHTML = '<p class="vacio">No photos yet. Add some to get started.</p>';
    return;
  }

  for (const f of fotos) {
    const div = document.createElement("div");
    div.className = "foto";
    const img = document.createElement("img");
    img.src = f.dataUrl;
    img.alt = "Replacement photo";
    const btn = document.createElement("button");
    btn.textContent = "✕";
    btn.title = "Delete";
    btn.setAttribute("aria-label", "Delete photo");
    btn.addEventListener("click", async () => {
      const { fotos } = await leer();
      await chrome.storage.local.set({ fotos: fotos.filter((x) => x.id !== f.id) });
      pintar();
    });
    div.append(img, btn);
    $grid.append(div);
  }
}

async function redimensionar(file) {
  const bmp = await createImageBitmap(file);
  const s = Math.min(1, MAX_LADO / Math.max(bmp.width, bmp.height));
  const c = document.createElement("canvas");
  c.width = Math.round(bmp.width * s);
  c.height = Math.round(bmp.height * s);
  c.getContext("2d").drawImage(bmp, 0, 0, c.width, c.height);
  return c.toDataURL("image/jpeg", 0.85);
}

async function anadir(files) {
  files = files.filter((f) => f.type.startsWith("image/"));
  if (!files.length) return;
  $estado.textContent = "Saving…";

  const { fotos } = await leer();
  let ok = 0;
  for (const file of files) {
    try {
      const dataUrl = await redimensionar(file);
      fotos.push({ id: crypto.randomUUID(), dataUrl });
      ok++;
    } catch (_) {}
  }
  await chrome.storage.local.set({ fotos });
  $estado.textContent = `${ok} photo(s) added. Reload open tabs to apply them.`;
  pintar();
}

$archivos.addEventListener("change", async () => {
  await anadir([...$archivos.files]);
  $archivos.value = "";
});

["dragenter", "dragover"].forEach((ev) =>
  $zona.addEventListener(ev, (e) => { e.preventDefault(); $zona.classList.add("encima"); })
);
["dragleave", "drop"].forEach((ev) =>
  $zona.addEventListener(ev, (e) => { e.preventDefault(); $zona.classList.remove("encima"); })
);
$zona.addEventListener("drop", (e) => anadir([...e.dataTransfer.files]));

$activo.addEventListener("change", () => {
  chrome.storage.local.set({ activo: $activo.checked });
});

pintar();
