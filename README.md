# EyeFlow V4

Camera-based directional gaze navigation prototype by Yashwanth Pentakota.

## Run locally

No build step or npm install required. Install Python 3, open a terminal in this folder, and run:

```sh
python -m http.server 8000
```

On Windows, `py -m http.server 8000` also works.
Open http://localhost:8000 for the simulated recruiter demo, or http://localhost:8000/live.html for actual webcam tracking. Keep the terminal running. Do not open the HTML by double-clicking it: ES modules and camera access need a web server.

## Host with GitHub Pages

1. Create a repository named `eyeflow` on GitHub.
2. Extract this ZIP. Upload the CONTENTS of the `EyeFlow_V4` folder to the repository root. `index.html` must be at the root, not in a nested folder.
3. Commit the files to the `main` branch.
4. Open Settings > Pages. Under Build and deployment, select Deploy from a branch. Select `main`, choose `/ (root)`, and Save.
5. Once deployment completes, open the URL displayed by GitHub Pages. Append `live.html` to open the camera lab directly.

The repository stores code; GitHub Pages runs this static application in the visitor's browser. No backend, API key, or paid service is required. Use HTTPS for hosted camera access.

## Try live tracking

1. Open `live.html` in Chrome, Edge, or Safari.
2. Select Start camera and allow permission.
3. Select Calibrate. Follow the center, top, and bottom targets twice: once to learn, then once to verify. Keep your head steady.
4. Select Start scrolling. Look at center to arm, then hold your eyes down for the next reel or up for the previous reel.
5. The default hold is 20 seconds. The slider lets you shorten it for testing. Return to center after each action.

If detection is weak, improve lighting, reduce reflections on glasses, move sensitivity toward Easier, and recalibrate. Camera off stops the stream. Escape pauses active scrolling.

## What is included

- `index.html`, `demo.css`, `demo.js`: explicitly simulated recruiter demonstration, 20-second default hold and 3-second quick preview.
- `live.html`, `style.css`, `app.js`: live camera interface, calibration, landmarks, diagnostics, and dwell controls.
- `tracking.mjs`: per-eye features, calibration fitting and validation, smoothing, direction hysteresis, and pause-aware dwell.
- `social.js`, `media/`: sample video feed and local uploads.
- `tests/tracking.mjs`: calibration and gaze logic regression checks.

## Tests

With Node.js installed:

```sh
node tests/tracking.mjs
```

## Technical scope

MediaPipe face landmarks and blendshapes estimate up/center/down after per-session calibration. This is not a precise screen gaze cursor. Scrolling controls only this page. The landing page simulation does not detect eyes. Live accuracy depends on device, lighting, and calibration; accuracy, accessibility suitability, latency, and power use have not been benchmarked.

Camera frames are processed in the browser and are not uploaded by this application. Model files load from jsDelivr and Google; fonts load from Google Fonts. Internet access is required for these assets. Calibration remains in memory. User-selected videos stay in the browser session.

## Media attribution

Flowers: MDN CC0 sample, https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4

Big Buck Bunny: Blender Foundation, https://peach.blender.org/ , licensed CC BY 3.0, https://creativecommons.org/licenses/by/3.0/ . The sample is a demo excerpt supplied by W3Schools. The third reel repeats the flower clip.

Dependencies retain their own licenses. This package does not assign a license to the project source; choose a source license before distributing it as a licensed open-source project.


## V4 changes and testing

- Separate left-iris, right-iris, both-iris and blendshape candidate signals. Pixel aspect ratio is included in eye geometry.
- Three training targets followed by three independent check targets. Only signals passing all three checks can enable scrolling. Each target times out after 20 seconds.
- Uses one validated signal rather than rejecting a strong signal because a weaker signal disagrees.
- Three-sample median and time-based smoothing, direction hysteresis, and a 350 ms center rearm.
- Brief blinks pause recognized dwell time; gaps over 350 ms, lost faces, head movement and stalls reset/rearm rather than trigger an action. The 20-second default counts recognized directional gaze time, not blink time.
- Camera selector, cancelable startup, 2-second test hold, visible timer, processed FPS, inference timing, and local JSON diagnostics download.
- Diagnostic export includes counters, timing and calibration pass rates. No images, raw landmarks or camera identifiers are included. Nothing is sent automatically.

Run `node tests/tracking.mjs` for the V4 regression tests. Synthetic tests cover signal geometry, calibration validation, invalid values, smoothing, dwell timing, blinks, lost faces, stalls and rearming. These tests do not measure camera accuracy, accessibility suitability or real-device performance. Browser visual QA and live-camera testing have not been completed in the development environment.

First test on your own device: start camera, complete six targets, select Use 2s test hold, then Start scrolling. Look at center first, then down. Use Download session diagnostics to capture a troubleshooting report. Restore the 20-second hold for the original interaction. Camera off stops all camera tracks.
