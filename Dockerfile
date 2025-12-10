# =================================
# Stage 1: Build
# =================================
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY tsconfig*.json ./

# Install dependencies
RUN npm ci

# Copy source code (including .env file)
COPY . .

# Load .env file and build with environment variables baked in
# The .env file is copied above and will be used by Vite during build
RUN if [ -f .env ]; then \
      echo "Loading .env file for build..."; \
      export $(grep -v '^#' .env | grep -v '^$' | xargs); \
    fi && \
    # Override API URL for production (same origin)
    export VITE_API_URL=/api && \
    npm run build && \
    npm run build:server

# =================================
# Stage 2: Production
# =================================
FROM node:20-alpine

WORKDIR /app

# Copy package files for production dependencies
COPY package*.json ./

# Install ONLY production dependencies
RUN npm ci --only=production

# Copy built assets from builder
COPY --from=builder /app/dist ./dist

# Copy .env for runtime (backend server needs it)
COPY --from=builder /app/.env ./.env

# Expose port
ENV PORT=5000
EXPOSE 5000

# Start server (will load .env at runtime for backend)
CMD ["node", "--env-file=.env", "dist/server.js"]
