FROM python:3.11-slim

WORKDIR /app

# Install locust
RUN pip install --no-cache-dir locust==2.31.8 requests==2.31.0

# Copy the entire load-tests directory structure
COPY locustfile.py .
COPY config.py .
COPY behaviors/ ./behaviors/
COPY utils/ ./utils/

# Expose Locust web UI port
EXPOSE 8089

# Run Locust
ENTRYPOINT ["locust"]
