const video = document.getElementById('video');
const canvas = document.getElementById('overlay');
const ctx = canvas.getContext('2d');
const statusEl = document.getElementById('status');

let facenetModel = null;

// ✅ Load FaceNet model
async function loadModel() {
  statusEl.innerText = "Loading FaceNet model...";
  facenetModel = await tf.loadLayersModel("https://phoenixuss.github.io/pwa-assets/models/facenet/model.json");
  statusEl.innerText = "Model loaded. Starting camera...";
}

// ✅ Setup MediaPipe face detection
const faceDetection = new FaceDetection.FaceDetection({
  locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/face_detection/${file}`
});
faceDetection.setOptions({ model: 'short', minDetectionConfidence: 0.6 });
faceDetection.onResults(onFaceResults);

// ✅ Start camera
async function startCamera() {
  const camera = new Camera(video, {
    onFrame: async () => {
      await faceDetection.send({ image: video });
    },
    width: 640,
    height: 480
  });
  camera.start();
}

// ✅ Handle face detection results
async function onFaceResults(results) {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  if (results.detections.length > 0) {
    const detection = results.detections[0];
    const bbox = detection.boundingBox;

    // Draw box
    ctx.strokeStyle = "lime";
    ctx.lineWidth = 3;
    ctx.strokeRect(
      bbox.xCenter * video.videoWidth - (bbox.width * video.videoWidth) / 2,
      bbox.yCenter * video.videoHeight - (bbox.height * video.videoHeight) / 2,
      bbox.width * video.videoWidth,
      bbox.height * video.videoHeight
    );

    // Extract face crop → embedding
    const faceCanvas = document.createElement('canvas');
    const faceCtx = faceCanvas.getContext('2d');
    faceCanvas.width = bbox.width * video.videoWidth;
    faceCanvas.height = bbox.height * video.videoHeight;
    faceCtx.drawImage(
      video,
      (bbox.xCenter - bbox.width/2) * video.videoWidth,
      (bbox.yCenter - bbox.height/2) * video.videoHeight,
      bbox.width * video.videoWidth,
      bbox.height * video.videoHeight,
      0, 0,
      faceCanvas.width,
      faceCanvas.height
    );

    if (facenetModel) {
      const embedding = tf.tidy(() => {
        let tensor = tf.browser.fromPixels(faceCanvas)
          .resizeNearestNeighbor([160, 160])
          .toFloat()
          .div(255.0)
          .expandDims(0);
        return facenetModel.predict(tensor).dataSync();
      });

      statusEl.innerText = `Embedding length: ${embedding.length}`;
    }
  }
}

// ✅ Start everything
(async () => {
  await loadModel();
  await startCamera();
})();
