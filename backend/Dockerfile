FROM python:3.10-slim

WORKDIR /app

# Install system dependencies for ML libraries and PDF tools
RUN apt-get update && apt-get install -y \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# We copy the rest of the code, though the compose file 
# will mount it as a volume for hot-reloading.
COPY . .

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]