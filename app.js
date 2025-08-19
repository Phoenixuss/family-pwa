class FaceRecognitionApp {
    constructor() {
        this.video = document.getElementById('video');
        this.canvas = document.getElementById('canvas');
        this.ctx = this.canvas.getContext('2d');
        this.status = document.getElementById('status');
        
        // UI elements
        this.startBtn = document.getElementById('startBtn');
        this.stopBtn = document.getElementById('stopBtn');
        this.detectBtn = document.getElementById('detectBtn');
        this.registerBtn = document.getElementById('registerBtn');
        this.syncDriveBtn = document.getElementById('syncDriveBtn');
        this.switchCameraBtn = document.getElementById('switchCameraBtn');
        this.cameraIndicator = document.getElementById('cameraIndicator');
        
        // Registration elements
        this.registrationMode = document.getElementById('registrationMode');
        this.recognitionMode = document.getElementById('recognitionMode');
        this.personNameInput = document.getElementById('personName');
        this.startRegistration = document.getElementById('startRegistration');
        this.captureAngle = document.getElementById('captureAngle');
        this.completeRegistration = document.getElementById('completeRegistration');
        this.cancelRegistration = document.getElementById('cancelRegistration');
        this.angleIndicator = document.getElementById('angleIndicator');
        
        // Camera state
        this.currentStream = null;
        this.currentCamera = 'user'; // 'user' for front, 'environment' for back
        this.availableCameras = [];
        this.currentCameraDevice = null;
        
        // Performance tracking
        this.performanceMarks = {};
        
        // Face detection and recognition
        this.faceDetection = null;
        this.faceNetModel = null;
        this.isDetecting = false;
        this.isRegistering = false;
        this.currentDetections = [];
        
        // Registration state
        this.currentRegistration = {
            name: '',
            angles: [],
            currentAngleIndex: 0,
            embeddings: []
        };
        
        this.angleInstructions = [
            { name: 'Straight', instruction: '👤 Look directly at the camera', emoji: '👤' },
            { name: 'Up', instruction: '👆 Tilt your head up 30°', emoji: '👆' },
            { name: 'Down', instruction: '👇 Tilt your head down 30°', emoji: '👇' },
            { name: 'Right', instruction: '👉 Turn your head right 45°', emoji: '👉' },
            { name: 'Left', instruction: '👈 Turn your head left 45°', emoji: '👈' }
        ];
        
        // Storage and settings
        this.familyMembers = this.loadFamilyMembers();
        this.threshold = 0.6;
        this.lastRecognitionTime = 0;
        this.recognitionCooldown = 2000; // 2 seconds
        
        this.init();
    }
    
    async init() {
        try {
            performance.mark('app-init-start');
            this.updateStatus('🚀 Initializing face detection...', 'status');
            
            // Check camera permissions and enumerate devices
            await this.checkCameraPermissions();
            await this.enumerateCameras();
            
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
            
            // Load FaceNet model
            await this.initFaceNet();
            
            this.setupEventListeners();
            this.displayFamilyMembers();
            
            performance.mark('app-init-end');
            performance.measure('app-initialization', 'app-init-start', 'app-init-end');
            
            this.updateStatus('✅ Ready! Start camera to begin recognition.', 'success');
            
        } catch (error) {
            console.error('Initialization error:', error);
            this.updateStatus('❌ Failed to initialize: ' + error.message, 'error');
        }
    }
    
    async checkCameraPermissions() {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ 
                video: { facingMode: 'user' } 
            });
            stream.getTracks().forEach(track => track.stop());
        } catch (error) {
            throw new Error('Camera permission required for face recognition');
        }
    }
    
    async enumerateCameras() {
        try {
            const devices = await navigator.mediaDevices.enumerateDevices();
            this.availableCameras = devices.filter(device => device.kind === 'videoinput');
            
            console.log(`Found ${this.availableCameras.length} camera(s):`, this.availableCameras);
            
            this.switchCameraBtn.disabled = this.availableCameras.length < 2;
            if (this.availableCameras.length < 2) {
                this.switchCameraBtn.style.opacity = '0.5';
                this.switchCameraBtn.title = 'Only one camera available';
            }
            
        } catch (error) {
            console.warn('Could not enumerate cameras:', error);
        }
    }
    
    async initFaceNet() {
        try {
            performance.mark('facenet-load-start');
            this.updateStatus('🧠 Loading FaceNet model...', 'status');
            
            this.faceNetModel = await tf.loadLayersModel('https://phoenixuss.github.io/pwa-assets/model/facenet/model.json');
            
            performance.mark('facenet-load-end');
            performance.measure('facenet-loading', 'facenet-load-start', 'facenet-load-end');
            
            console.log('✅ FaceNet model loaded successfully');
        } catch (error) {
            console.error('❌ FaceNet loading error:', error);
            throw new Error('Failed to load FaceNet model');
        }
    }
    
    setupEventListeners() {
        // Camera controls
        this.startBtn.addEventListener('click', () => this.startCamera());
        this.stopBtn.addEventListener('click', () => this.stopCamera());
        this.detectBtn.addEventListener('click', () => this.toggleDetection());
        this.registerBtn.addEventListener('click', () => this.enterRegistrationMode());
        this.syncDriveBtn.addEventListener('click', () => this.syncToGoogleDrive());
        this.switchCameraBtn.addEventListener('click', () => this.switchCamera());
        
        // Registration controls
        this.startRegistration.addEventListener('click', () => this.startRegistrationProcess());
        this.captureAngle.addEventListener('click', () => this.captureCurrentAngle());
        this.completeRegistration.addEventListener('click', () => this.completeRegistrationProcess());
        this.cancelRegistration.addEventListener('click', () => this.exitRegistrationMode());
        
        this.video.addEventListener('loadedmetadata', () => {
            this.adjustCanvasSize();
        });
        
        // Handle orientation changes on mobile
        window.addEventListener('orientationchange', () => {
            setTimeout(() => this.adjustCanvasSize(), 500);
        });
        
        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            if (e.altKey && e.key === 's') {
                e.preventDefault();
                this.switchCamera();
            }
            if (e.altKey && e.key === 'c') {
                e.preventDefault();
                if (this.isRegistering && this.currentDetections.length > 0) {
                    this.captureCurrentAngle();
                }
            }
        });
    }
    
    async startCamera() {
        try {
            performance.mark('camera-start-begin');
            this.updateStatus('📹 Starting camera...', 'status');
            
            if (this.currentStream) {
                this.currentStream.getTracks().forEach(track => track.stop());
            }
            
            const constraints = {
                video: {
                    width: { ideal: 640 },
                    height: { ideal: 480 },
                    facingMode: this.currentCamera
                }
            };
            
            if (this.currentCameraDevice) {
                constraints.video.deviceId = { exact: this.currentCameraDevice };
                delete constraints.video.facingMode;
            }
            
            this.currentStream = await navigator.mediaDevices.getUserMedia(constraints);
            this.video.srcObject = this.currentStream;
            
            await new Promise((resolve) => {
                this.video.onloadedmetadata = () => {
                    this.adjustCanvasSize();
                    resolve();
                };
            });
            
            // Update UI
            this.startBtn.disabled = true;
            this.stopBtn.disabled = false;
            this.detectBtn.disabled = false;
            this.registerBtn.disabled = false;
            this.syncDriveBtn.disabled = false;
            this.switchCameraBtn.disabled = this.availableCameras.length < 2;
            
            this.updateCameraIndicator();
            
            performance.mark('camera-start-end');
            performance.measure('camera-startup', 'camera-start-begin', 'camera-start-end');
            
            this.updateStatus('✅ Camera started!', 'success');
            
        } catch (error) {
            console.error('Camera error:', error);
            this.handleCameraError(error);
        }
    }
    
    handleCameraError(error) {
        let errorMessage = 'Camera error: ';
        
        switch (error.name) {
            case 'NotAllowedError':
                errorMessage += 'Permission denied. Please allow camera access and refresh.';
                break;
            case 'NotFoundError':
                errorMessage += 'No camera found. Please connect a camera.';
                break;
            case 'NotReadableError':
                errorMessage += 'Camera is already in use by another app.';
                break;
            case 'OverconstrainedError':
                errorMessage += 'Camera constraints could not be satisfied.';
                break;
            case 'SecurityError':
                errorMessage += 'Camera access blocked due to security policy.';
                break;
            default:
                errorMessage += error.message;
        }
        
        this.updateStatus('❌ ' + errorMessage, 'error');
    }
    
    stopCamera() {
        if (this.currentStream) {
            this.currentStream.getTracks().forEach(track => track.stop());
            this.currentStream = null;
            this.video.srcObject = null;
        }
        
        this.isDetecting = false;
        this.isRegistering = false;
        
        // Update UI
        this.startBtn.disabled = false;
        this.stopBtn.disabled = true;
        this.detectBtn.disabled = true;
        this.registerBtn.disabled = true;
        this.syncDriveBtn.disabled = true;
        this.switchCameraBtn.disabled = true;
        this.detectBtn.textContent = '🔍 Start Recognition';
        
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.updateStatus('📷 Camera stopped.', 'status');
    }
    
    async switchCamera() {
        if (!this.currentStream) {
            this.updateStatus('⚠️ Please start the camera first', 'error');
            return;
        }
        
        try {
            this.updateStatus('🔄 Switching camera...', 'status');
            
            // Toggle between front and back camera
            this.currentCamera = this.currentCamera === 'user' ? 'environment' : 'user';
            
            // Restart camera with new facing mode
            await this.startCamera();
            
            // If we were detecting, restart detection
            if (this.isDetecting) {
                this.detectLoop();
            }
            
            const cameraType = this.currentCamera === 'user' ? 'front' : 'back';
            this.updateStatus(`✅ Switched to ${cameraType} camera`, 'success');
            
        } catch (error) {
            console.error('Camera switch error:', error);
            this.updateStatus('❌ Failed to switch camera: ' + error.message, 'error');
            
            // Revert camera if switch failed
            this.currentCamera = this.currentCamera === 'user' ? 'environment' : 'user';
        }
    }
    
    updateCameraIndicator() {
        const cameraName = this.currentCamera === 'user' ? '🤳 Front Camera' : '📷 Back Camera';
        this.cameraIndicator.textContent = cameraName;
    }
    
    adjustCanvasSize() {
        if (this.video.videoWidth && this.video.videoHeight) {
            this.canvas.width = this.video.videoWidth;
            this.canvas.height = this.video.videoHeight;
        }
    }
    
    // Registration methods
    enterRegistrationMode() {
        this.recognitionMode.style.display = 'none';
        this.registrationMode.style.display = 'block';
        this.angleIndicator.style.display = 'block';
        this.resetRegistrationState();
    }
    
    exitRegistrationMode() {
        this.registrationMode.style.display = 'none';
        this.recognitionMode.style.display = 'block';
        this.angleIndicator.style.display = 'none';
        this.resetRegistrationState();
    }
    
    resetRegistrationState() {
        this.currentRegistration = {
            name: '',
            angles: [],
            currentAngleIndex: 0,
            embeddings: []
        };
        
        this.isRegistering = false;
        this.personNameInput.value = '';
        this.startRegistration.style.display = 'inline-block';
        this.captureAngle.style.display = 'none';
        this.completeRegistration.style.display = 'none';
        this.angleIndicator.textContent = 'Ready to start';
        
        // Reset progress indicators
        for (let i = 0; i <= 4; i++) {
            const step = document.getElementById(`step${i}`);
            if (step) {
                step.className = 'progress-step';
            }
        }
        const step0 = document.getElementById('step0');
        if (step0) {
            step0.className = 'progress-step active';
        }
    }
    
    startRegistrationProcess() {
        const name = this.personNameInput.value.trim();
        if (!name) {
            alert('Please enter a name first');
            return;
        }
        
        if (this.familyMembers[name]) {
            const overwrite = confirm(`${name} already exists. Overwrite?`);
            if (!overwrite) return;
        }
        
        if (!this.currentStream) {
            alert('Please start the camera first');
            return;
        }
        
        this.currentRegistration.name = name;
        this.currentRegistration.currentAngleIndex = 0;
        
        this.startRegistration.style.display = 'none';
        this.captureAngle.style.display = 'inline-block';
        
        this.showCurrentAngleInstruction();
        this.isRegistering = true;
        this.detectLoop();
    }
    
    showCurrentAngleInstruction() {
        const currentAngle = this.angleInstructions[this.currentRegistration.currentAngleIndex];
        this.angleIndicator.innerHTML = `${currentAngle.emoji} ${currentAngle.instruction}`;
        
        // Update progress
        for (let i = 0; i <= 4; i++) {
            const step = document.getElementById(`step${i}`);
            if (step) {
                if (i < this.currentRegistration.currentAngleIndex) {
                    step.className = 'progress-step completed';
                } else if (i === this.currentRegistration.currentAngleIndex) {
                    step.className = 'progress-step active';
                } else {
                    step.className = 'progress-step';
                }
            }
        }
    }
    
    async captureCurrentAngle() {
        if (this.currentDetections.length === 0) {
            alert('❌ No face detected. Please ensure your face is visible and well-lit.');
            return;
        }
        
        try {
            performance.mark('capture-start');
            
            const detection = this.currentDetections[0];
            const faceImage = this.extractFaceImage(detection);
            const embedding = await this.extractFaceEmbedding(faceImage);
            
            this.currentRegistration.embeddings.push({
                angle: this.angleInstructions[this.currentRegistration.currentAngleIndex].name,
                embedding: embedding,
                camera: this.currentCamera,
                capturedAt: new Date().toISOString()
            });
            
            performance.mark('capture-end');
            performance.measure('face-capture', 'capture-start', 'capture-end');
            
            this.currentRegistration.currentAngleIndex++;
            
            if (this.currentRegistration.currentAngleIndex < this.angleInstructions.length) {
                this.showCurrentAngleInstruction();
                
                // Optional: Auto-suggest camera switch for better angles
                if (this.currentRegistration.currentAngleIndex === 2 && this.availableCameras.length > 1) {
                    const shouldSwitch = confirm('💡 Tip: Would you like to switch to back camera for someone to help you with the remaining angles?');
                    if (shouldSwitch) {
                        await this.switchCamera();
                    }
                }
            } else {
                // All angles captured
                this.captureAngle.style.display = 'none';
                this.completeRegistration.style.display = 'inline-block';
                this.angleIndicator.innerHTML = '✅ All angles captured! Click Complete Registration.';
                
                // Mark all steps as completed
                for (let i = 0; i <= 4; i++) {
                    const step = document.getElementById(`step${i}`);
                    if (step) {
                        step.className = 'progress-step completed';
                    }
                }
            }
            
        } catch (error) {
            console.error('Capture error:', error);
            alert('❌ Failed to capture face. Please try again.');
        }
    }
    
    async completeRegistrationProcess() {
        try {
            const name = this.currentRegistration.name;
            const embeddings = this.currentRegistration.embeddings;
            
            // Save family member with enhanced metadata
            this.familyMembers[name] = {
                embeddings: embeddings,
                registeredAt: new Date().toISOString(),
                lastSeen: null,
                recognitionCount: 0,
                registeredWith: {
                    totalAngles: embeddings.length,
                    cameras: [...new Set(embeddings.map(e => e.camera))],
                    device: navigator.userAgent,
                    appVersion: '2.0.0'
                }
            };
            
            this.saveFamilyMembers();
            this.displayFamilyMembers();
            
            // Show success message with details
            const cameraInfo = this.familyMembers[name].registeredWith.cameras.join(' & ');
            alert(`✅ ${name} registered successfully!\n📸 ${embeddings.length} angles captured\n📱 Using: ${cameraInfo} camera(s)`);
            
            this.exitRegistrationMode();
            
        } catch (error) {
            console.error('Registration completion error:', error);
            alert('❌ Failed to complete registration. Please try again.');
        }
    }
    
    displayFamilyMembers() {
        const membersList = document.getElementById('familyMembersList');
        const members = Object.keys(this.familyMembers);
        
        if (members.length === 0) {
            membersList.innerHTML = '<p style="text-align: center; color: #ccc; margin-top: 20px;">👥 No family members registered yet</p>';
            return;
        }
        
        let html = '<h3 style="text-align: center; margin-bottom: 20px;">👨‍👩‍👧‍👦 Registered Family Members</h3>';
        html += '<div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 15px;">';
        
        members.forEach(name => {
            const member = this.familyMembers[name];
            const lastSeen = member.lastSeen ? 
                new Date(member.lastSeen).toLocaleString() : 'Never seen';
            const angleCount = member.embeddings ? member.embeddings.length : 0;
            const recognitionCount = member.recognitionCount || 0;
            
            html += `
                <div style="
                    background: rgba(255,255,255,0.1); 
                    padding: 15px; 
                    border-radius: 10px;
                    border-left: 4px solid #4CAF50;
                ">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                        <strong style="font-size: 18px;">👤 ${name}</strong>
                        <span style="background: #4CAF50; color: white; padding: 2px 8px; border-radius: 12px; font-size: 12px;">
                            ${recognitionCount} recognitions
                        </span>
                    </div>
                    <small style="color: rgba(255,255,255,0.8); line-height: 1.4;">
                        📅 Registered: ${new Date(member.registeredAt).toLocaleDateString()}<br>
                        📸 Angles: ${angleCount}<br>
                        👁️ Last seen: ${lastSeen}<br>
                        📱 Cameras: ${member.registeredWith ? member.registeredWith.cameras.join(', ') : 'Unknown'}
                    </small>
                </div>
            `;
        });
        
        html += '</div>';
        membersList.innerHTML = html;
    }
    
    // Face embedding and recognition methods
    async extractFaceEmbedding(faceImageCanvas) {
        if (!this.faceNetModel) {
            throw new Error('FaceNet model not loaded');
        }
        
        performance.mark('embedding-start');
        
        const resizedCanvas = document.createElement('canvas');
        const ctx = resizedCanvas.getContext('2d');
        resizedCanvas.width = 160;
        resizedCanvas.height = 160;
        ctx.drawImage(faceImageCanvas, 0, 0, 160, 160);
        
        const tensor = tf.browser.fromPixels(resizedCanvas)
            .expandDims(0)
            .cast('float32')
            .div(255.0);
        
        const embedding = await this.faceNetModel.predict(tensor);
        const embeddingArray = await embedding.data();
        
        tensor.dispose();
        embedding.dispose();
        
        performance.mark('embedding-end');
        performance.measure('face-embedding', 'embedding-start', 'embedding-end');
        
        return Array.from(embeddingArray);
    }
    
    async recognizeFace(faceImageCanvas) {
        try {
            // Throttle recognition to prevent excessive processing
            const now = Date.now();
            if (now - this.lastRecognitionTime < this.recognitionCooldown) {
                return null;
            }
            
            const queryEmbedding = await this.extractFaceEmbedding(faceImageCanvas);
            
            let bestMatch = null;
            let bestSimilarity = 0;
            
            for (const [name, memberData] of Object.entries(this.familyMembers)) {
                for (const angleData of memberData.embeddings) {
                    const similarity = this.calculateCosineSimilarity(queryEmbedding, angleData.embedding);
                    
                    if (similarity > bestSimilarity && similarity > this.threshold) {
                        bestSimilarity = similarity;
                        bestMatch = { name, angle: angleData.angle };
                    }
                }
            }
            
            if (bestMatch) {
                this.familyMembers[bestMatch.name].lastSeen = new Date().toISOString();
                this.familyMembers[bestMatch.name].recognitionCount = (this.familyMembers[bestMatch.name].recognitionCount || 0) + 1;
                this.saveFamilyMembers();
                this.lastRecognitionTime = now;
            }
            
            return bestMatch ? {
                name: bestMatch.name,
                confidence: bestSimilarity,
                matchedAngle: bestMatch.angle
            } : null;
            
        } catch (error) {
            console.error('Recognition error:', error);
            return null;
        }
    }
    
    calculateCosineSimilarity(embedding1, embedding2) {
        let dotProduct = 0;
        let norm1 = 0;
        let norm2 = 0;
        
        for (let i = 0; i < embedding1.length; i++) {
            dotProduct += embedding1[i] * embedding2[i];
            norm1 += embedding1[i] * embedding1[i];
            norm2 += embedding2[i] * embedding2[i];
        }
        
        return dotProduct / (Math.sqrt(norm1) * Math.sqrt(norm2));
    }
    
    async toggleDetection() {
        if (!this.isDetecting) {
            this.isDetecting = true;
            this.detectBtn.textContent = '⏹️ Stop Recognition';
            this.updateStatus('🔍 Recognizing faces...', 'status');
            this.detectLoop();
        } else {
            this.isDetecting = false;
            this.detectBtn.textContent = '🔍 Start Recognition';
            this.updateStatus('Recognition stopped.', 'status');
            this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        }
    }
    
    async detectLoop() {
        if ((!this.isDetecting && !this.isRegistering) || !this.faceDetection) return;
        
        try {
            await this.faceDetection.send({ image: this.video });
        } catch (error) {
            console.error('Detection error:', error);
        }
        
        if (this.isDetecting || this.isRegistering) {
            requestAnimationFrame(() => this.detectLoop());
        }
    }
    
    async onResults(results) {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.currentDetections = results.detections || [];
        
        if (this.currentDetections.length > 0) {
            for (const detection of this.currentDetections) {
                this.drawDetection(detection);
                
                if (this.isDetecting && !this.isRegistering && this.faceNetModel) {
                    const faceImage = this.extractFaceImage(detection);
                    const recognition = await this.recognizeFace(faceImage);
                    
                    if (recognition) {
                        this.drawRecognitionLabel(detection, recognition);
                        this.displayRecognitionResult(recognition);
                    }
                }
            }
            
            if (!this.isRegistering) {
                this.updateStatus(`Found ${this.currentDetections.length} face(s)`, 'success');
            }
        } else {
            if (!this.isRegistering) {
                this.updateStatus('No faces detected', 'status');
            }
        }
    }
    
    displayRecognitionResult(recognition) {
        const results = document.getElementById('recognitionResults');
        results.innerHTML = `
            <div style="
                background: linear-gradient(135deg, rgba(76, 175, 80, 0.1), rgba(76, 175, 80, 0.2)); 
                padding: 20px; 
                border-radius: 15px; 
                margin: 15px 0;
                border-left: 4px solid #4CAF50;
                animation: fadeIn 0.3s ease;
            ">
                <h3 style="margin-bottom: 10px;">👋 Hello, ${recognition.name}!</h3>
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 10px; font-size: 14px;">
                    <p><strong>🎯 Confidence:</strong> ${Math.round(recognition.confidence * 100)}%</p>
                    <p><strong>📐 Matched Angle:</strong> ${recognition.matchedAngle}</p>
                    <p><strong>⏰ Time:</strong> ${new Date().toLocaleTimeString()}</p>
                    <p><strong>📷 Camera:</strong> ${this.currentCamera === 'user' ? 'Front' : 'Back'}</p>
                </div>
            </div>
        `;
        
        // Add fade animation
        const style = document.createElement('style');
        style.textContent = `
            @keyframes fadeIn {
                from { opacity: 0; transform: translateY(10px); }
                to { opacity: 1; transform: translateY(0); }
            }
        `;
        document.head.appendChild(style);
        
        // Update family members display to show last seen
        setTimeout(() => this.displayFamilyMembers(), 1000);
    }
    
    extractFaceImage(detection) {
        const bbox = detection.boundingBox;
        const x = bbox.xCenter * this.canvas.width - (bbox.width * this.canvas.width) / 2;
        const y = bbox.yCenter * this.canvas.height - (bbox.height * this.canvas.height) / 2;
        const width = bbox.width * this.canvas.width;
        const height = bbox.height * this.canvas.height;
        
        const faceCanvas = document.createElement('canvas');
        const faceCtx = faceCanvas.getContext('2d');
        faceCanvas.width = width;
        faceCanvas.height = height;
        
        faceCtx.drawImage(this.video, x, y, width, height, 0, 0, width, height);
        return faceCanvas;
    }
    
    drawDetection(detection) {
        const bbox = detection.boundingBox;
        const x = bbox.xCenter * this.canvas.width - (bbox.width * this.canvas.width) / 2;
        const y = bbox.yCenter * this.canvas.height - (bbox.height * this.canvas.height) / 2;
        const width = bbox.width * this.canvas.width;
        const height = bbox.height * this.canvas.height;
        
        this.ctx.strokeStyle = this.isRegistering ? '#ff9800' : '#00ff00';
        this.ctx.lineWidth = 3;
        this.ctx.strokeRect(x, y, width, height);
        
        // Add corner indicators
        const cornerSize = 20;
        this.ctx.fillStyle = this.ctx.strokeStyle;
        
        // Top-left corner
        this.ctx.fillRect(x, y, cornerSize, 3);
        this.ctx.fillRect(x, y, 3, cornerSize);
        
        // Top-right corner
        this.ctx.fillRect(x + width - cornerSize, y, cornerSize, 3);
        this.ctx.fillRect(x + width - 3, y, 3, cornerSize);
        
        // Bottom-left corner
        this.ctx.fillRect(x, y + height - 3, cornerSize, 3);
        this.ctx.fillRect(x, y + height - cornerSize, 3, cornerSize);
        
        // Bottom-right corner
        this.ctx.fillRect(x + width - cornerSize, y + height - 3, cornerSize, 3);
        this.ctx.fillRect(x + width - 3, y + height - cornerSize, 3, cornerSize);
    }
    
    drawRecognitionLabel(detection, recognition) {
        const bbox = detection.boundingBox;
        const x = bbox.xCenter * this.canvas.width - (bbox.width * this.canvas.width) / 2;
        const y = bbox.yCenter * this.canvas.height - (bbox.height * this.canvas.height) / 2;
        
        // Draw background rectangle for text
        const text = `${recognition.name} (${Math.round(recognition.confidence * 100)}%)`;
        this.ctx.font = 'bold 16px Arial';
        const textMetrics = this.ctx.measureText(text);
        const textWidth = textMetrics.width;
        const textHeight = 20;
        
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        this.ctx.fillRect(x - 5, y - textHeight - 15, textWidth + 10, textHeight + 5);
        
        // Draw text
        this.ctx.fillStyle = '#00ff00';
        this.ctx.fillText(text, x, y - 10);
    }
    
    async syncToGoogleDrive() {
        try {
            this.updateStatus('☁️ Syncing to Google Drive...', 'status');
            
            const familyData = {
                members: this.familyMembers,
                exportedAt: new Date().toISOString(),
                totalMembers: Object.keys(this.familyMembers).length,
                appVersion: '2.0.0',
                deviceInfo: {
                    userAgent: navigator.userAgent,
                    availableCameras: this.availableCameras.length,
                    screenResolution: `${screen.width}x${screen.height}`,
                    language: navigator.language
                }
            };
            
            const dataBlob = new Blob([JSON.stringify(familyData, null, 2)], {
                type: 'application/json'
            });
            
            const downloadUrl = URL.createObjectURL(dataBlob);
            const a = document.createElement('a');
            a.href = downloadUrl;
            a.download = `family-data-${new Date().toISOString().split('T')[0]}.json`;
            a.click();
            
            URL.revokeObjectURL(downloadUrl);
            
            this.updateStatus('✅ Family data downloaded! Upload this file to your Google Drive.', 'success');
            
        } catch (error) {
            console.error('Sync error:', error);
            this.updateStatus('❌ Sync failed: ' + error.message, 'error');
        }
    }
    
    // Storage methods
    loadFamilyMembers() {
        try {
            const stored = localStorage.getItem('familyMembers');
            return stored ? JSON.parse(stored) : {};
        } catch (error) {
            console.error('Error loading family members:', error);
            return {};
        }
    }
    
    saveFamilyMembers() {
        try {
            localStorage.setItem('familyMembers', JSON.stringify(this.familyMembers));
            
            // Also backup to session storage as failsafe
            sessionStorage.setItem('familyMembers-backup', JSON.stringify(this.familyMembers));
        } catch (error) {
            console.error('Error saving family members:', error);
        }
    }
    
    updateStatus(message, type = 'status') {
        this.status.textContent = message;
        this.status.className = `status ${type}`;
        
        // Auto-clear status after some time for non-error messages
        if (type !== 'error') {
            setTimeout(() => {
                if (this.status.textContent === message) {
                    this.status.textContent = '';
                    this.status.className = 'status';
                }
            }, 5000);
        }
    }
}

// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    performance.mark('app-start');
    const app = new FaceRecognitionApp();
    window.faceApp = app; // Make app available globally for debugging
    performance.mark('app-ready');
    performance.measure('total-app-load', 'app-start', 'app-ready');
});

// Handle app visibility changes for performance
document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
        console.log('📱 App hidden - pausing non-essential operations');
    } else {
        console.log('📱 App visible - resuming operations');
    }
});
