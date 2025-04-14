// Get video and canvas elements
const video = document.getElementById('video');
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const cameraSelect = document.getElementById('cameraSelect');
const startButton = document.getElementById('startButton');
const requestCameraButton = document.getElementById('requestCameraButton');
const permissionMessage = document.getElementById('permissionMessage');
const statusDiv = document.getElementById('status');
const fpsCounter = document.getElementById('fps');
const detectionCount = document.getElementById('detection-count');

// Set canvas size
canvas.width = 640;
canvas.height = 480;

let currentStream = null;
let detectionInterval = null;
let lastTime = 0;
let frameCount = 0;
let currentFPS = 0;

// Update status message
function updateStatus(message, isError = false) {
    statusDiv.textContent = message;
    statusDiv.style.backgroundColor = isError ? 'var(--error-color)' : 'var(--success-color)';
    statusDiv.style.color = 'white';
}

// Calculate FPS
function updateFPS() {
    const now = performance.now();
    frameCount++;
    
    if (now - lastTime >= 1000) {
        currentFPS = Math.round((frameCount * 1000) / (now - lastTime));
        fpsCounter.textContent = currentFPS;
        frameCount = 0;
        lastTime = now;
    }
}

// Function to update permission message
function updatePermissionMessage(message, isError = false) {
    permissionMessage.textContent = message;
    permissionMessage.style.backgroundColor = isError ? '#ffebee' : '#e3f2fd';
    permissionMessage.style.color = isError ? '#c62828' : '#1565c0';
}

// Function to get available cameras
async function getCameras() {
    try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoDevices = devices.filter(device => device.kind === 'videoinput');
        
        // Clear existing options
        cameraSelect.innerHTML = '';
        
        // Add camera options
        videoDevices.forEach((device, index) => {
            const option = document.createElement('option');
            option.value = device.deviceId;
            option.text = device.label || `Camera ${index + 1}`;
            cameraSelect.appendChild(option);
        });
        
        // Enable camera select if cameras are found
        if (videoDevices.length > 0) {
            cameraSelect.disabled = false;
            startButton.disabled = false;
            updatePermissionMessage('Camera access granted. Please select a camera to start detection.');
        } else {
            updatePermissionMessage('No cameras found. Please check your camera connection.', true);
        }
    } catch (error) {
        console.error('Error getting cameras:', error);
        updatePermissionMessage('Error accessing cameras: ' + error.message, true);
    }
}

// Function to setup selected camera
async function setupCamera(deviceId) {
    try {
        const constraints = {
            video: {
                deviceId: deviceId ? { exact: deviceId } : undefined,
                width: { ideal: 640 },
                height: { ideal: 480 }
            }
        };
        
        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        video.srcObject = stream;
        await video.play();
        updatePermissionMessage('Camera is ready. Click Start Detection to begin.');
        return true;
    } catch (error) {
        console.error('Error setting up camera:', error);
        updatePermissionMessage('Error accessing camera: ' + error.message, true);
        return false;
    }
}

// Function to detect objects
async function detect() {
    try {
        // Draw video frame to canvas
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        
        // Get image data from canvas
        const imageData = canvas.toDataURL('image/jpeg', 0.8);
        
        // Send to server for detection
        const response = await fetch('/detect', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ image: imageData })
        });
        
        const result = await response.json();
        console.log('Detection result:', result);
        
        // Draw detections on canvas
        if (result.detections) {
            result.detections.forEach(detection => {
                const [x1, y1, x2, y2] = detection.bbox;
                const conf = detection.confidence;
                const cls = detection.class;
                
                // Draw box
                ctx.strokeStyle = '#00FF00';
                ctx.lineWidth = 2;
                ctx.strokeRect(x1, y1, x2 - x1, y2 - y1);
                
                // Draw label
                ctx.fillStyle = '#00FF00';
                ctx.font = '16px Arial';
                ctx.fillText(`Class ${cls} (${conf.toFixed(2)})`, x1, y1 - 5);
            });
        }
    } catch (error) {
        console.error('Error in detection:', error);
    }
}

// Event listener for request camera button
requestCameraButton.addEventListener('click', async () => {
    try {
        // Request camera access
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        stream.getTracks().forEach(track => track.stop()); // Stop the stream after getting permission
        
        // Get available cameras
        await getCameras();
        
        // Hide request button
        requestCameraButton.style.display = 'none';
    } catch (error) {
        console.error('Error requesting camera access:', error);
        if (error.name === 'NotAllowedError') {
            updatePermissionMessage('Camera access denied. Please allow camera access in your browser settings.', true);
        } else if (error.name === 'NotFoundError') {
            updatePermissionMessage('No camera found. Please check your camera connection.', true);
        } else {
            updatePermissionMessage('Error accessing camera: ' + error.message, true);
        }
    }
});

// Event listener for camera selection
cameraSelect.addEventListener('change', async () => {
    const deviceId = cameraSelect.value;
    await setupCamera(deviceId);
});

// Event listener for start button
startButton.addEventListener('click', async () => {
    try {
        const deviceId = cameraSelect.value;
        const success = await setupCamera(deviceId);
        
        if (success) {
            startButton.disabled = true;
            cameraSelect.disabled = true;
            updatePermissionMessage('Detection is running...');
            // Start detection loop
            setInterval(detect, 100);
        }
    } catch (error) {
        console.error('Error starting camera:', error);
        updatePermissionMessage('Error starting detection: ' + error.message, true);
    }
});

// Initialize
getCameras(); 