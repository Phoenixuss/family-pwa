// runs after DOM is parsed because <script defer>
(async function main() {
  const statusEl = document.getElementById('status');
  const video = document.getElementById('video');
  const canvas = document.getElementById('overlay');

  // guard: make sure elements exist
  if (!video || !canvas) {
    console.error('video/canvas elements not found in DOM');
    return;
  }

  // we’ll set ctx only after we know canvas exists
  const ctx = canvas.getContext('2d');

  // ---- 1) load FaceNet model ----
  let facenetModel = null;
  async function loadModel() {
    try {
      statusEl.textContent = 'loading FaceNet model…';
      // hosted model on your GitHub Pages assets
      const MODEL_URL = 'https://phoenixuss.github.io/pwa-assets/model/facenet/model.json';
      facenetModel = await tf.loadLayersModel(MODEL_URL);
      statusEl.textContent = 'model loaded ✓';
    } catch (e) {
      console.error('model load failed', e);
      statusEl.textContent = 'failed to load model (see console)';
      throw e;
    }
  }

  // ---- 2) setup MediaPipe Face Detection ----
  const faceDetection = new FaceDetection({
    locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/face_detection/${file}`,
  });
  faceDetection.setOptions({ model: 'short', minDetectionConfidence: 0.6 });
  faceDetection.onResults(onFaceResults);

  // ---- 3) start camera ----
  async function startCamera() {
    // wait for permissions / stream
    try {
      // Ask once so iOS Safari prompts early (Camera util will reuse it)
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      video.srcObject = stream;
      await video.play();
    } catch (err) {
      console.error('camera permission/availability error', err);
      statusEl.textContent = `camera error: ${err.message}`;
      throw err;
    }

    // ensure video metadata is ready so we know intrinsic size
    await new Promise((resolve) => {
      if (video.readyState >= 1 && video.videoWidth) return resolve();
      video.addEventListener('loadedmetadata', resolve, { once: true });
    });

    // match canvas to actual video resolution for crisp drawings
    resizeCanvasToVideo();

    // Use MediaPipe Camera helper to drive frames into the detector
    const cam = new Camera(video, {
      onFrame: async () => {
        // NOTE: FaceDetection expects the HTMLVideoElement itself
        await faceDetection.send({ image: video });
      },
      width: video.videoWidth || 640,
      height: video.videoHeight || 480,
    });
    cam.start();
    statusEl.textContent = 'camera running ✓';
  }

  function resizeCanvasToVideo() {
    const { videoWidth, videoHeight } = video;
    if (!videoWidth || !videoHeight) return;
    // set canvas pixel size and CSS size to match the video element
    canvas.width = videoWidth;
    canvas.height = videoHeight;
  }

  window.addEventListener('resize', resizeCanvasToVideo);
  video.addEventListener('loadedmetadata', resizeCanvasToVideo);

  // ---- 4) handle face detection results ----
  async function onFaceResults(results) {
    // clear previous drawings
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (!results || !results.detections || results.detections.length === 0) {
      statusEl.textContent = 'no face detected';
      return;
    }

    // take the first detected face
    const det = results.detections[0];
    const b = det.boundingBox;

    // scale from relative to pixel coords
    const x = (b.xCenter - b.width / 2) * canvas.width;
    const y = (b.yCenter - b.height / 2) * canvas.height;
    const w = b.width * canvas.width;
    const h = b.height * canvas.height;

    // draw box
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#3cf86a';
    ctx.strokeRect(x, y, w, h);

    // make a cropped face canvas
    const faceCanvas = document.createElement('canvas');
    const fctx = faceCanvas.getContext('2d');
    faceCanvas.width = Math.max(1, Math.floor(w));
    faceCanvas.height = Math.max(1, Math.floor(h));
    // draw the face crop from the *video* (source of truth)
    fctx.drawImage(video, x, y, w, h, 0, 0, faceCanvas.width, faceCanvas.height);

    // embed via FaceNet if model is ready
    if (facenetModel) {
      const embedding = tf.tidy(() => {
        let t = tf.browser.fromPixels(faceCanvas)
          .resizeNearestNeighbor([160, 160])
          .toFloat()
          .div(255)
          .expandDims(0); // [1,160,160,3]
        const out = facenetModel.predict(t); // shape [1, N]
        return out.dataSync(); // Float32Array
      });

      statusEl.textContent = `face detected ✓ | embedding length: ${embedding.length}`;
    } else {
      statusEl.textContent = 'face detected ✓ (model not ready?)';
    }
  }

  // ---- 5) boot ----
  try {
    await loadModel();
    await startCamera();
  } catch (e) {
    // already logged
  }
})();


