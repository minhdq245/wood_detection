from flask import Flask, render_template, request, jsonify
import cv2
import numpy as np
from ultralytics import YOLO
import base64
import io
from PIL import Image
import os

app = Flask(__name__)

# Load YOLO model with optimized settings
model_path = os.path.join(os.path.dirname(__file__), 'best.pt')
print(f"Loading model from: {model_path}")

# Initialize model with optimized settings
model = YOLO(model_path)

# Configure model parameters
model.conf = 0.5  # Confidence threshold - increased from 0.25 to 0.5
model.iou = 0.45  # IOU threshold for NMS - increased from 0.45 to 0.45
model.agnostic_nms = True  # Class-agnostic NMS
model.max_det = 100  # Maximum number of detections per image

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
        
        # Convert to numpy array
        nparr = np.frombuffer(image_bytes, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        
        # Resize image if too large to reduce memory usage
        max_size = 1280
        height, width = img.shape[:2]
        if max(height, width) > max_size:
            scale = max_size / max(height, width)
            img = cv2.resize(img, (int(width * scale), int(height * scale)))
        
        # Run YOLO detection
        results = model(img, verbose=False)
        
        # Process results
        detections = []
        for result in results:
            boxes = result.boxes
            for box in boxes:
                # Only include high confidence detections
                if box.conf.item() > 0.5:  # Additional confidence check
                    x1, y1, x2, y2 = box.xyxy[0].tolist()
                    conf = box.conf.item()
                    cls = int(box.cls.item())
                    
                    detections.append({
                        'bbox': [x1, y1, x2, y2],
                        'confidence': conf,
                        'class': cls
                    })
        
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
    app.run(host='0.0.0.0', port=5000, debug=True) 