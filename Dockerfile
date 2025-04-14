FROM python:3.11-slim

# Install system dependencies
RUN apt-get update && apt-get install -y \
    libgl1-mesa-glx \
    libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy requirements first to leverage Docker cache
COPY requirements.txt .

# Install Python dependencies with memory optimization
RUN pip install --no-cache-dir -r requirements.txt

# Copy the rest of the application
COPY . .

# Create gunicorn config file with optimized settings
RUN echo "timeout = 300" > gunicorn.conf.py
RUN echo "workers = 1" >> gunicorn.conf.py
RUN echo "worker_class = 'sync'" >> gunicorn.conf.py
RUN echo "worker_connections = 100" >> gunicorn.conf.py
RUN echo "keepalive = 2" >> gunicorn.conf.py
RUN echo "max_requests = 1000" >> gunicorn.conf.py
RUN echo "max_requests_jitter = 50" >> gunicorn.conf.py
RUN echo "preload_app = True" >> gunicorn.conf.py

# Expose port
EXPOSE 8080

# Set environment variables for memory optimization
ENV PYTHONUNBUFFERED=1
ENV OMP_NUM_THREADS=1
ENV MKL_NUM_THREADS=1

# Command to run the application with gunicorn config
CMD ["gunicorn", "--config", "gunicorn.conf.py", "--bind", "0.0.0.0:8080", "app:app"] 