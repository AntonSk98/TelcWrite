FROM node:20-alpine3.19

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install --production

# Copy application files
COPY backend/ ./backend/
COPY public/ ./public/
COPY views/ ./views/

# Create data directory for persistent storage
RUN mkdir -p /app/data

# Expose port
EXPOSE 3000

# Set default DB path for Docker (SQLite)
ENV DB_PATH=/app/data/klar.sqlite

# Environment variable validation script
RUN echo '#!/bin/sh' > /app/entrypoint.sh && \
    echo 'set -e' >> /app/entrypoint.sh && \
    echo 'if [ -z "$OPENAI_TOKEN" ]; then echo "ERROR: OPENAI_TOKEN is required"; exit 1; fi' >> /app/entrypoint.sh && \
    echo 'if [ -z "$MODEL" ]; then echo "ERROR: MODEL is required"; exit 1; fi' >> /app/entrypoint.sh && \
    echo 'exec node backend/server.js' >> /app/entrypoint.sh && \
    chmod +x /app/entrypoint.sh

ENTRYPOINT ["/app/entrypoint.sh"]
