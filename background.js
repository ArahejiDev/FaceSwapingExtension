let creando = null;
const cache = new Map(); // url -> has face

// Clicking the toolbar icon opens the photos page
chrome.action.onClicked.addListener(() => chrome.runtime.openOptionsPage());

async function asegurarOffscreen() {
  const ctx = await chrome.runtime.getContexts({
    contextTypes: ["OFFSCREEN_DOCUMENT"],
  });
  if (ctx.length) return;
  if (!creando) {
    creando = chrome.offscreen.createDocument({
      url: "offscreen.html",
      reasons: ["WORKERS"],
      justification: "Face detection in images with TensorFlow.js",
    });
  }
  try {
    await creando;
  } finally {
    creando = null; // if it fails, allow a retry on the next image
  }
}

async function urlADataUrl(url) {
  const r = await fetch(url);
  const blob = await r.blob();
  if (blob.type.includes("svg")) throw new Error("svg not supported");
  const buf = new Uint8Array(await blob.arrayBuffer());
  let bin = "";
  for (let i = 0; i < buf.length; i += 0x8000) {
    bin += String.fromCharCode(...buf.subarray(i, i + 0x8000));
  }
  return `data:${blob.type || "image/png"};base64,${btoa(bin)}`;
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.target !== "background") return;

  (async () => {
    try {
      const clave = msg.url || null;
      if (clave && cache.has(clave)) {
        sendResponse({ found: cache.get(clave) });
        return;
      }

      const dataUrl = msg.dataUrl || (await urlADataUrl(msg.url));
      await asegurarOffscreen();
      const r = await chrome.runtime.sendMessage({ target: "offscreen", dataUrl });

      const found = !!r?.found;
      if (clave && !r?.error) cache.set(clave, found); // do not cache errors
      sendResponse({ found, error: r?.error });
    } catch (e) {
      sendResponse({ found: false, error: String(e) });
    }
  })();

  return true; // async response
});
