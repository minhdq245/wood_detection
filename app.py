from flask import Flask, render_template, request, jsonify
import cv2
import numpy as np
from ultralytics import YOLO
import base64
import io
from PIL import Image
import os

app = Flask(__name__)

# Load model
model_path = os.path.join(os.path.dirname(__file__), 'best.pt')
model = YOLO(model_path)

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
        
        # Convert to OpenCV format
        image = Image.open(io.BytesIO(image_bytes))
        image = cv2.cvtColor(np.array(image), cv2.COLOR_RGB2BGR)
        
        # Run YOLO detection with adjusted parameters
        results = model(image, 
                       conf=0.5,
                       iou=0.45,
                       max_det=100,
                       agnostic_nms=True)
        
        # Process results
        detections = []
        for result in results:
            boxes = result.boxes
            for box in boxes:
                # Get box coordinates
                x1, y1, x2, y2 = box.xyxy[0].tolist()
                
                # Get confidence and class
                conf = float(box.conf[0])
                cls = int(box.cls[0])
                class_name = model.names[cls]
                
                # Only include detections with high confidence
                if conf > 0.5:
                    detections.append({
                        'box': [x1, y1, x2, y2],
                        'confidence': conf,
                        'class': class_name
                    })
        
        return jsonify({'detections': detections})
        
    except Exception as e:
        print(f"Error: {str(e)}")
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port) 