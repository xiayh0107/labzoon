# =================================
# Stage 1: Build
# =================================
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy source code
COPY . .

# Build the application
# Build-time env vars are baked into the bundle
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_ANON_KEY
ARG VITE_GEMINI_API_KEY
ARG VITE_OPENAI_API_KEY
ARG VITE_AI_PROVIDER
ARG VITE_AI_BASE_URL
ARG VITE_AI_TEXT_MODEL
ARG VITE_AI_IMAGE_MODEL
ARG VITE_AI_TEMPERATURE
ARG VITE_AI_TOP_P
ARG VITE_AI_TOP_K
ARG VITE_AI_MAX_OUTPUT_TOKENS

RUN npm run build

# =================================
# Stage 2: Production
# =================================
FROM nginx:alpine

# Copy custom nginx config
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf

# Copy built files from builder stage
COPY --from=builder /app/dist /usr/share/nginx/html

# Expose port 80
EXPOSE 80

# Start nginx
CMD ["nginx", "-g", "daemon off;"]
