class FaceRecognitionApp {
    constructor() {
        this.video = document.getElementById('video');
        this.canvas = document.getElementById('canvas');
        this.ctx = this.canvas.getContext('2d');
        this.status = document.getElementById('status');
        this.startBtn = document.getElementById('startBtn');
        this.stopBtn = document.getElementById('stopBtn');
        this.detectBtn = document.getElementById('detectBtn');
        
        this.faceDetection = null;
        this.camera = null;
        this.isDetecting = false;
        
        this.init();
    }
    
    async init() {
        try {
            this.updateStatus('Loading face detection model...', 'status');
            
            // Initialize MediaPipe Face Detection
            this.faceDetection = new FaceDetection({
                locateFile: (file) => {
                    return `https://cdn.jsdelivr.net/npm/@mediapipe/face_detection/${file}`;
                }
            });
            
            this.faceDetection.setOptions({
                model: 'short',
                minDetectionConfidence: 0.5,
            });
            
            this.faceDetection.onResults(this.onResults.bind(this));
            
            this.setupEventListeners();
            this.updateStatus('Ready! Click "Start Camera" to begin.', 'success');
            
        } catch (error) {
            console.error('Initialization error:', error);
            this.updateStatus('Failed to initialize face detection: ' + error.message, 'error');
        }
    }
    
    setupEventListeners() {
        this.startBtn.addEventListener('click', () => this.startCamera());
        this.stopBtn.addEventListener('click', () => this.stopCamera());
        this.detectBtn.addEventListener('click', () => this.toggleDetection());
        
        // Handle video metadata loaded
        this.video.addEventListener('loadedmetadata', () => {
            this.canvas.width = this.video.videoWidth;
            this.canvas.height = this.video.videoHeight;
        });
    }
    
    async startCamera() {
        try {
            this.updateStatus('Starting camera...', 'status');
            
            const stream = await navigator.mediaDevices.getUserMedia({
                video: {
                    width: { ideal: 640 },
                    height: { ideal: 480 },
                    facingMode: 'user'
                }
            });
            
            this.video.srcObject = stream;
            
            // Wait for video to load
            await new Promise((resolve) => {
                this.video.onloadedmetadata = () => {
                    this.canvas.width = this.video.videoWidth;
                    this.canvas.height = this.video.videoHeight;
                    resolve();
                };
            });
            
            this.startBtn.disabled = true;
            this.stopBtn.disabled = false;
            this.detectBtn.disabled = false;
            
            this.updateStatus('Camera started! You can now detect faces.', 'success');
            
        } catch (error) {
            console.error('Camera error:', error);
            this.updateStatus('Camera access denied or not available: ' + error.message, 'error');
        }
    }
    
    stopCamera() {
        if (this.video.srcObject) {
            const tracks = this.video.srcObject.getTracks();
            tracks.forEach(track => track.stop());
            this.video.srcObject = null;
        }
        
        this.isDetecting = false;
        this.startBtn.disabled = false;
        this.stopBtn.disabled = true;
        this.detectBtn.disabled = true;
        this.detectBtn.textContent = 'Detect Faces';
        
        // Clear canvas
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        this.updateStatus('Camera stopped.', 'status');
    }
    
    async toggleDetection() {
        if (!this.isDetecting) {
            this.isDetecting = true;
            this.detectBtn.textContent = 'Stop Detection';
            this.updateStatus('Detecting faces...', 'status');
            this.detectLoop();
        } else {
            this.isDetecting = false;
            this.detectBtn.textContent = 'Detect Faces';
            this.updateStatus('Detection stopped.', 'status');
            // Clear canvas
            this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        }
    }
    
    async detectLoop() {
        if (!this.isDetecting || !this.faceDetection) return;
        
        try {
            await this.faceDetection.send({ image: this.video });
        } catch (error) {
            console.error('Detection error:', error);
        }
        
        if (this.isDetecting) {
            requestAnimationFrame(() => this.detectLoop());
        }
    }
    
    onResults(results) {
        // Clear canvas
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        if (results.detections && results.detections.length > 0) {
            this.updateStatus(`Found ${results.detections.length} face(s)`, 'success');
            
            // Draw detections
            results.detections.forEach((detection) => {
                this.drawDetection(detection);
            });
        } else {
            this.updateStatus('No faces detected', 'status');
        }
    }
    
    drawDetection(detection) {
        const bbox = detection.boundingBox;
        const x = bbox.xCenter * this.canvas.width - (bbox.width * this.canvas.width) / 2;
        const y = bbox.yCenter * this.canvas.height - (bbox.height * this.canvas.height) / 2;
        const width = bbox.width * this.canvas.width;
        const height = bbox.height * this.canvas.height;
        
        // Draw bounding box
        this.ctx.strokeStyle = '#00ff00';
        this.ctx.lineWidth = 2;
        this.ctx.strokeRect(x, y, width, height);
        
        // Draw confidence score
        if (detection.score) {
            this.ctx.fillStyle = '#00ff00';
            this.ctx.font = '16px Arial';
            this.ctx.fillText(
                `${Math.round(detection.score[0] * 100)}%`,
                x,
                y - 5
            );
        }
        
        // Draw key points if available
        if (detection.landmarks) {
            this.ctx.fillStyle = '#ff0000';
            detection.landmarks.forEach((landmark) => {
                const px = landmark.x * this.canvas.width;
                const py = landmark.y * this.canvas.height;
                this.ctx.beginPath();
                this.ctx.arc(px, py, 3, 0, 2 * Math.PI);
                this.ctx.fill();
            });
        }
    }
    
    updateStatus(message, type = 'status') {
        this.status.textContent = message;
        this.status.className = `status ${type}`;
    }
}

// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new FaceRecognitionApp();
});
