# ============================================================================
# Metadata Quality Platform - Atlan App Framework
# Multi-stage Docker build for React frontend + FastAPI backend
# ============================================================================

# ============================================================================
# Stage 1: Build React Frontend
# ============================================================================
FROM node:20-alpine AS frontend-builder

WORKDIR /build

# Copy frontend package files for dependency caching
COPY package.json package-lock.json ./

# Install frontend dependencies
RUN npm ci --prefer-offline --no-audit

# Copy frontend source code
COPY src/ ./src/
COPY public/ ./public/
COPY index.html ./
COPY vite.config.ts tsconfig.json tsconfig.app.json tsconfig.node.json ./
COPY eslint.config.js ./

# Build production frontend bundle
# Output will be in /build/dist/
RUN npm run build

# ============================================================================
# Stage 2: Python Runtime with FastAPI + Application SDK
# ============================================================================
FROM python:3.11-slim AS runtime

WORKDIR /app

# Install system dependencies needed for Python packages and health checks
RUN apt-get update && apt-get install -y \
    gcc \
    g++ \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copy backend requirements
COPY atlan-metadata-designer/backend/requirements.txt ./requirements.txt

# Install Python dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend application code
COPY atlan-metadata-designer/backend/app ./app

# Copy built frontend from Stage 1
COPY --from=frontend-builder /build/dist ./app/static

# Create non-root user for security
RUN useradd -m -u 1000 appuser && \
    chown -R appuser:appuser /app

USER appuser

# Expose port for FastAPI (Atlan App Framework standard)
EXPOSE 8080

# Health check for Kubernetes readiness/liveness probes
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD curl -f http://localhost:8080/health || exit 1

# Run FastAPI with uvicorn
# --host 0.0.0.0: Listen on all interfaces for container networking
# --port 8080: Standard Atlan App Framework port
# --workers 1: Single worker for Dapr sidecar pattern (scale via replicas, not workers)
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8080", "--workers", "1"]
