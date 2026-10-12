#!/bin/bash

set -e

cd "$(dirname "$0")"

echo "=== Restarting Services & Tunnel ==="

# 1. Stop existing services
if [ -f "stop.sh" ]; then
    bash stop.sh
else
    pkill -f "intrasudo26" 2>/dev/null || true
    pkill -f "bot.py" 2>/dev/null || true
    lsof -ti :8080 | xargs kill -9 2>/dev/null || true
    lsof -ti :5555 | xargs kill -9 2>/dev/null || true
fi

# Ensure port 8080 is released
if lsof -ti :8080 >/dev/null 2>&1; then
    echo "Force killing remaining process on port 8080..."
    lsof -ti :8080 | xargs kill -9 2>/dev/null || true
fi

# 2. Restart Cloudflare Tunnel (refreshes gateway/tunnel connections)
echo "Restarting cloudflared tunnel..."
pkill -f "cloudflared tunnel" 2>/dev/null || true
sleep 1

CLOUDFLARED_BIN="$(command -v cloudflared || echo "/opt/homebrew/bin/cloudflared")"
if [ -x "$CLOUDFLARED_BIN" ]; then
    nohup "$CLOUDFLARED_BIN" tunnel --config /Users/vpun215/.cloudflared/config.yml run deciphers26 > .run/tunnel.log 2>&1 &
    echo "cloudflared tunnel restarted (PID: $!)."
else
    echo "cloudflared binary not found; skipping tunnel restart."
fi

# 3. Source .env again to refresh environment variables
if [ -f ".env" ]; then
    echo "Refreshing .env variables..."
    set -a
    source .env
    set +a
else
    echo "Warning: .env file not found."
fi

# 4. Start backend and bot via run.sh in background
echo "Starting services via run.sh..."
mkdir -p .run
nohup bash run.sh > .run/run.log 2>&1 &
RUN_PID=$!
echo "run.sh launched (PID: $RUN_PID)."

sleep 3

echo "=== Restart Complete ==="
echo "Backend: http://127.0.0.1:8080/"
echo "Logs: .run/run.log and .run/tunnel.log"
