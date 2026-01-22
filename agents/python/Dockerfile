FROM python:3.12-slim

WORKDIR /app

# Install uv for faster dependency installation
RUN pip install --no-cache-dir uv

# Copy dependency files
COPY requirements.txt .
COPY pyproject.toml .

# Install dependencies using uv (much faster than pip)
# Use --system to install globally in the container
RUN uv pip install --system --no-cache -r requirements.txt

# Copy source code
COPY . .

# Expose port
EXPOSE 8080

# Run the app
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8080"]
