const video = document.getElementById('video');
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const cameraSelect = document.getElementById('camera-select');
const startButton = document.getElementById('start-button');
const permissionMessage = document.getElementById('permission-message');
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

// Get available cameras
async function getCameras() {
    try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoDevices = devices.filter(device => device.kind === 'videoinput');
        
        cameraSelect.innerHTML = '<option value="">Chọn camera...</option>';
        videoDevices.forEach(device => {
            const option = document.createElement('option');
            option.value = device.deviceId;
            option.text = device.label || `Camera ${videoDevices.indexOf(device) + 1}`;
            cameraSelect.appendChild(option);
        });
        
        cameraSelect.disabled = false;
        permissionMessage.textContent = 'Vui lòng chọn camera muốn sử dụng';
        updateStatus(`Đã tìm thấy ${videoDevices.length} camera`);
    } catch (error) {
        console.error('Error getting cameras:', error);
        updateStatus('Không thể truy cập danh sách camera', true);
    }
}

// Request camera permission
async function requestCameraPermission() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        stream.getTracks().forEach(track => track.stop()); // Stop the stream after getting permission
        getCameras();
    } catch (error) {
        console.error('Error requesting camera permission:', error);
        updateStatus('Không thể truy cập camera. Vui lòng kiểm tra quyền truy cập.', true);
    }
}

// Setup selected camera
async function setupCamera(deviceId) {
    try {
        if (currentStream) {
            currentStream.getTracks().forEach(track => track.stop());
        }

        const constraints = {
            video: {
                deviceId: deviceId ? { exact: deviceId } : undefined,
                width: 640,
                height: 480
            }
        };

        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        currentStream = stream;
        video.srcObject = stream;
        
        return new Promise((resolve) => {
            video.onloadedmetadata = () => {
                resolve(video);
            };
        });
    } catch (error) {
        console.error('Error setting up camera:', error);
        updateStatus('Không thể khởi động camera đã chọn', true);
        throw error;
    }
}

// Send frame for detection
async function detect() {
    try {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const imageData = canvas.toDataURL('image/jpeg');
        
        const response = await fetch('/detect', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ image: imageData })
        });
        
        const result = await response.json();
        
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        
        if (result.detections) {
            detectionCount.textContent = result.detections.length;
            result.detections.forEach(detection => {
                const [x1, y1, x2, y2] = detection.box;
                
                ctx.strokeStyle = '#00FF00';
                ctx.lineWidth = 2;
                ctx.strokeRect(x1, y1, x2 - x1, y2 - y1);
                
                ctx.fillStyle = '#00FF00';
                ctx.font = '16px Arial';
                ctx.fillText(`${detection.class} (${(detection.confidence * 100).toFixed(1)}%)`, x1, y1 - 5);
            });
        } else {
            detectionCount.textContent = '0';
        }
    } catch (error) {
        console.error('Detection error:', error);
        updateStatus('Lỗi trong quá trình detection', true);
    }
}

// Stop detection
function stopDetection() {
    if (detectionInterval) {
        clearInterval(detectionInterval);
        detectionInterval = null;
    }
    if (currentStream) {
        currentStream.getTracks().forEach(track => track.stop());
        currentStream = null;
    }
    video.srcObject = null;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    detectionCount.textContent = '0';
    fpsCounter.textContent = '0';
}

// Event listeners
cameraSelect.addEventListener('change', async () => {
    if (cameraSelect.value) {
        startButton.disabled = false;
        updateStatus('Camera đã được chọn, nhấn nút Bắt đầu để bắt đầu detection');
    } else {
        startButton.disabled = true;
        updateStatus('Vui lòng chọn camera');
    }
});

startButton.addEventListener('click', async () => {
    try {
        if (detectionInterval) {
            stopDetection();
            startButton.innerHTML = '<span class="button-text">Bắt đầu Detection</span><span class="button-icon">▶</span>';
            cameraSelect.disabled = false;
            updateStatus('Đã dừng detection');
            return;
        }

        await setupCamera(cameraSelect.value);
        video.play();
        startButton.innerHTML = '<span class="button-text">Dừng Detection</span><span class="button-icon">⏹</span>';
        cameraSelect.disabled = true;
        updateStatus('Đang chạy detection...');
        
        // Start detection loop
        detectionInterval = setInterval(() => {
            detect();
            updateFPS();
        }, 100);
    } catch (error) {
        console.error('Error starting detection:', error);
        updateStatus('Không thể bắt đầu detection', true);
    }
});

// Initialize
requestCameraPermission(); 