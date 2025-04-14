from flask import Flask, render_template, request, jsonify
import cv2
import numpy as np
from ultralytics import YOLO
import os
import base64
import io
from PIL import Image
import gc
import torch

app = Flask(__name__)

# Configure torch for memory efficiency
torch.set_num_threads(1)  # Limit number of CPU threads
torch.set_num_interop_threads(1)

# Load YOLO model with optimized settings
model_path = os.path.join(os.path.dirname(__file__), 'best.pt')
print(f"Loading model from: {model_path}")

# Initialize model with optimized settings
model = YOLO(model_path)

# Configure model parameters for memory efficiency
model.conf = 0.6  # Increased confidence threshold
model.iou = 0.45  # IOU threshold for NMS
model.agnostic_nms = True  # Class-agnostic NMS
model.max_det = 10  # Further reduce maximum detections
model.verbose = False  # Disable verbose output

# Clear GPU memory if available
if torch.cuda.is_available():
    torch.cuda.empty_cache()

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/detect', methods=['POST'])
def detect():
    try:
        # Get image data from request
        data = request.json
        image_data = data['image'].split(',')[1]
        image_bytes = base64.b64decode(image_data)
        
        # Convert to numpy array with memory optimization
        nparr = np.frombuffer(image_bytes, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        
        # Resize image to reduce memory usage
        max_size = 320  # Further reduced for mobile
        height, width = img.shape[:2]
        if max(height, width) > max_size:
            scale = max_size / max(height, width)
            img = cv2.resize(img, (int(width * scale), int(height * scale)))
        
        # Run YOLO detection with memory optimization
        with torch.no_grad():  # Disable gradient calculation
            results = model(img, verbose=False)
        
        # Process results
        detections = []
        for result in results:
            boxes = result.boxes
            for box in boxes:
                if box.conf.item() > 0.6:  # Increased confidence threshold
                    x1, y1, x2, y2 = box.xyxy[0].tolist()
                    conf = box.conf.item()
                    cls = int(box.cls.item())
                    
                    detections.append({
                        'bbox': [x1, y1, x2, y2],
                        'confidence': conf,
                        'class': cls
                    })
        
        # Clean up memory
        del img, results, boxes
        gc.collect()
        if torch.cuda.is_available():
            torch.cuda.empty_cache()
        
        return jsonify({
            'success': True,
            'detections': detections
        })
        
    except Exception as e:
        print(f"Error in detection: {str(e)}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=8080, debug=True) 