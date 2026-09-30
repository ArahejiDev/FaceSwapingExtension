const MODELOS = chrome.runtime.getURL("lib/models");
const CONFIANZA_MIN = 0.5; // 0-1. Raise for fewer false positives, lower to catch more faces

let listo = null;
let cola = Promise.resolve();

// NOTE: faceapi.nets.X.loadFromUri() breaks "chrome-extension://..." URLs
// (turns "//" into "/"), so we load the manifest and weights by hand.
async function cargarModelo() {
  const r = await fetch(MODELOS + "/ssd_mobilenetv1_model-weights_manifest.json");
  if (!r.ok) throw new Error("could not read the model manifest: " + r.status);
  const manifest = await r.json();
  const pesos = await faceapi.tf.io.loadWeights(manifest, MODELOS);
  faceapi.nets.ssdMobilenetv1.loadFromWeightMap(pesos);
}

function iniciar() {
  if (!listo) {
    listo = (async () => {
      const tf = faceapi.tf;
      let ok = false;
      try {
        ok = await tf.setBackend("webgl");
      } catch (_) {}
      if (!ok) await tf.setBackend("cpu");
      await tf.ready();
      await cargarModelo();
      console.debug("[face-swap] ready, backend:", tf.getBackend());
    })().catch((e) => {
      listo = null; // retry on the next image
      throw e;
    });
  }
  return listo;
}

function cargarImagen(dataUrl) {
  return new Promise((res, rej) => {
    const img = new Image();
    img.onload = () => res(img);
    img.onerror = () => rej(new Error("could not load the image"));
    img.src = dataUrl;
  });
}

async function hayCara(dataUrl) {
  await iniciar();
  const img = await cargarImagen(dataUrl);
  const caras = await faceapi.detectAllFaces(
    img,
    new faceapi.SsdMobilenetv1Options({ minConfidence: CONFIANZA_MIN })
  );
  console.debug("[face-swap] faces:", caras.length);
  return caras.length > 0;
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.target !== "offscreen") return;

  // one image at a time
  cola = cola.then(async () => {
    try {
      sendResponse({ found: await hayCara(msg.dataUrl) });
    } catch (e) {
      sendResponse({ found: false, error: String(e) });
    }
  });

  return true;
});
