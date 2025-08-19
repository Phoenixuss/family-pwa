const video = document.getElementById("video");

async function startCamera() {
  try {
    // Request camera permission
    const stream = await navigator.mediaDevices.getUserMedia({ video: true });
    video.srcObject = stream;
    console.log("Camera started ✅");
  } catch (err) {
    console.error("Camera error ❌", err);
    alert("Could not access camera: " + err.message);
  }
}

// Start camera when page loads
window.addEventListener("load", startCamera);
