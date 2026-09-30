<p align="center">
  <img src="icons/icon128.png" alt="Face Swap icon" width="96" />
</p>

<h1 align="center">Face Swap</h1>

<p align="center">
  A Chrome extension that detects faces in the images of any web page and swaps them for photos you choose.<br />
  Everything runs locally in your browser. Nothing is uploaded anywhere.
</p>

## How it works

1. A content script watches the images on the page (including ones added later, as you scroll).
2. Each image large enough to hold a face is sent to the background service worker, which fetches it and passes it to an [offscreen document](https://developer.chrome.com/docs/extensions/reference/api/offscreen).
3. The offscreen document runs an SSD MobileNet v1 face detector with [face-api.js](https://github.com/vladmandic/face-api) (TensorFlow.js, WebGL with CPU fallback).
4. If a face is found, the image is replaced by one of your photos, picked at random.

Results are cached per image URL, and only images near the viewport are processed, so what you're looking at gets swapped first.

## Install (unpacked)

There is no build step.

1. Clone or download this repository:
   ```bash
   git clone https://github.com/ArahejiDev/FaceSwapingExtension.git
   ```
2. Open `chrome://extensions` and turn on **Developer mode**.
3. Click **Load unpacked** and select this folder (the one containing `manifest.json`).
4. Click the extension icon to open the photos page, then add one or more photos.
5. Reload any tabs that were already open.

Requires Chrome 116 or newer (or another Chromium browser with the `offscreen` API and `runtime.getContexts`).

## Usage

- **Add photos:** drag them onto the page or use *Choose photos*. They are shrunk to 900 px on the longest side and stored as JPEG.
- **Remove a photo:** hover it and click the red button.
- **Pause:** use the *Swap faces on websites* switch. No reload needed.

## Privacy

- Your replacement photos are stored in `chrome.storage.local`, on your machine only.
- Face detection runs on-device. The model files ship inside the extension.
- The extension makes no requests to any server of its own. To analyse an image, the background worker re-downloads it from the same URL the page already used.
- Requested permissions:
  - `<all_urls>` to run on any page and fetch its images.
  - `storage` and `unlimitedStorage` to keep your photos.
  - `offscreen` to run the detector in a hidden page.

## Configuration

| What | Where | Default |
| --- | --- | --- |
| Detection confidence (raise for fewer false positives, lower to catch more faces) | `CONFIDENCE_MIN` in `offscreen.js` | `0.5` |
| Ignore images smaller than this (px) | `MIN` in `content.js` | `80` |
| Max side of stored photos (px) | `MAX_SIDE` in `options.js` | `900` |

## Project structure

```
manifest.json      Manifest V3 configuration
background.js      Service worker: fetches images, manages the offscreen document, caches results
offscreen.html/js  Hidden page that loads the model and detects faces
content.js         Finds images on the page and swaps them
options.html/js    Photos page (upload, delete, on/off switch)
icons/             Extension icons
lib/               face-api.js and the SSD MobileNet v1 model
```

## Code notes

Every source file starts with a header comment explaining its role and message flow. Some identifiers are in Spanish (`fotos` = photos, `activo` = enabled, `cola` = queue, ...); each header contains a small glossary.

## Known limitations

- Only `<img>` elements are handled. CSS background images, `<canvas>` and video are not.
- SVG images and images under 80 px are skipped.
- Sites with a strict Content Security Policy may block the replacement (`data:`) images.
- Photos are swapped at random, so the same person will not always get the same replacement.

## Troubleshooting

Open `chrome://extensions`, find the extension and click **Inspect views** (service worker / offscreen page). The extension logs with the prefix `[face-swap]`. A healthy start looks like `[face-swap] ready, backend: webgl`.

## Notes on `loadFromUri`

`faceapi.nets.*.loadFromUri()` mangles `chrome-extension://` URLs (it collapses `//` into `/`), so the model is loaded manually with `tf.io.loadWeights` in `offscreen.js`. If you swap in another face-api model, load it the same way.

## Responsible use

Meant for fun, privacy and design experiments. Don't use it to deceive people or to misrepresent who appears in an image.

## Credits and license

Released under the [MIT License](LICENSE). Third-party components are listed in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
