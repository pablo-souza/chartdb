# Stage 1: Build Frontend
FROM node:24-alpine AS builder

ARG VITE_OPENAI_API_KEY
ARG VITE_OPENAI_API_ENDPOINT
ARG VITE_LLM_MODEL_NAME
ARG VITE_HIDE_CHARTDB_CLOUD
ARG VITE_DISABLE_ANALYTICS

WORKDIR /usr/src/app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .

RUN echo "VITE_OPENAI_API_KEY=${VITE_OPENAI_API_KEY}" > .env && \
    echo "VITE_OPENAI_API_ENDPOINT=${VITE_OPENAI_API_ENDPOINT}" >> .env && \
    echo "VITE_LLM_MODEL_NAME=${VITE_LLM_MODEL_NAME}" >> .env && \
    echo "VITE_HIDE_CHARTDB_CLOUD=${VITE_HIDE_CHARTDB_CLOUD}" >> .env && \
    echo "VITE_DISABLE_ANALYTICS=${VITE_DISABLE_ANALYTICS}" >> .env

RUN npm run build

# Stage 2: Backend Dependencies
FROM node:24-alpine AS backend-builder

# Instala ferramentas de compilação necessárias para módulos nativos (como better-sqlite3)
RUN apk add --no-cache build-base python3

WORKDIR /usr/src/app/backend
COPY backend/package.json ./
RUN npm install

# Stage 3: Final Production Image
FROM nginx:stable-alpine AS production

# Install Node.js and Git (required for the backend)
RUN apk add --no-cache nodejs npm git

WORKDIR /app

# Copy Frontend
COPY --from=builder /usr/src/app/dist /usr/share/nginx/html
# Copy Backend
COPY --from=backend-builder /usr/src/app/backend/node_modules /app/backend/node_modules
COPY backend /app/backend

# Config Nginx
COPY ./default.conf.template /etc/nginx/conf.d/default.conf.template
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

# Expose ports for Frontend (80) and Backend (3001)
EXPOSE 80 3001

ENTRYPOINT ["/entrypoint.sh"]
