const video = document.getElementById("video");
const canvas = document.getElementById("overlay");
const ctx = canvas.getContext("2d");

// Start camera
async function startCamera() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: true });
    video.srcObject = stream;
  } catch (err) {
    console.error("Camera error:", err);
  }
}

// Load models (FaceNet + face-api detection)
async function loadModels() {
  console.log("Loading models...");

  // Face detection model
  await faceapi.nets.tinyFaceDetector.loadFromUri("https://justadudewhohacks.github.io/face-api.js/models");

  // Load your FaceNet model (hosted on GitHub)
  const facenetModel = await tf.loadGraphModel(
    "https://phoenixuss.github.io/pwa-assets/model/facenet/model.json"
  );

  console.log("Models loaded!");
  return facenetModel;
}

// Run face detection + embedding extraction
async function run() {
  const facenet = await loadModels();
  startCamera();

  video.addEventListener("playing", async () => {
    console.log("Video started...");
    setInterval(async () => {
      const detections = await faceapi.detectAllFaces(video, new faceapi.TinyFaceDetectorOptions());

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      detections.forEach(det => {
        const { x, y, width, height } = det.box;
        ctx.strokeStyle = "red";
        ctx.lineWidth = 2;
        ctx.strokeRect(x, y, width, height);
      });

      // If a face is found, crop and get FaceNet embedding
      if (detections.length > 0) {
        const faceBox = detections[0].box;
        const input = tf.browser.fromPixels(video)
          .slice([faceBox.y, faceBox.x, 0], [faceBox.height, faceBox.width, 3])
          .resizeNearestNeighbor([160, 160]) // FaceNet input size
          .toFloat()
          .div(tf.scalar(255))
          .expandDims();

        const embedding = facenet.predict(input);
        console.log("Face embedding:", embedding.dataSync()); // 128-d vector
      }
    }, 1000);
  });
}

run();
