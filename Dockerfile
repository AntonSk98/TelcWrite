FROM node:20-alpin

WORKDIR /app

# Copy package files
COPY backend/package*.json ./

# Install dependencies
RUN npm install --production

# Copy application files
COPY backend/ ./
COPY generator/ ./generator/

# Create data directory for persistent storage
RUN mkdir -p /app/data

# Expose port
EXPOSE 3000

# Set default DB path for Docker (can be overridden)
ENV DB_PATH=/app/data/telcwrite_db.json
ENV BASE_PATH=/app

# Environment variable validation script
RUN echo '#!/bin/sh' > /app/entrypoint.sh && \
    echo 'set -e' >> /app/entrypoint.sh && \
    echo 'if [ -z "$OPENAI_TOKEN" ]; then echo "ERROR: OPENAI_TOKEN is required"; exit 1; fi' >> /app/entrypoint.sh && \
    echo 'if [ -z "$MODEL" ]; then echo "ERROR: MODEL is required"; exit 1; fi' >> /app/entrypoint.sh && \
    echo 'exec node server.js' >> /app/entrypoint.sh && \
    chmod +x /app/entrypoint.sh

ENTRYPOINT ["/app/entrypoint.sh"]
