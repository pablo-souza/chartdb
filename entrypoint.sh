#!/bin/sh

# Replace placeholders in nginx.conf
envsubst '${OPENAI_API_KEY} ${OPENAI_API_ENDPOINT} ${LLM_MODEL_NAME} ${HIDE_CHARTDB_CLOUD} ${DISABLE_ANALYTICS}' < /etc/nginx/conf.d/default.conf.template > /etc/nginx/conf.d/default.conf

# Start Backend in background
echo "Starting Backend..."
cd /app/backend && node server.js &

# Start Nginx in foreground
echo "Starting Nginx..."
nginx -g "daemon off;"
