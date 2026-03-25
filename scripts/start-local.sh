#!/bin/bash
# OpenToWork — Local Dev Startup
# Starts: SSH tunnel → FastAPI → Dashboard
# Usage: bash scripts/start-local.sh

set -e

PROJECT_DIR="/Users/vasuchukka/Desktop/desktop/AI/OpenToWork"
PEM="$HOME/FinsenseKey.pem"
RDS_HOST="finsense-db.cric6akgujm3.eu-north-1.rds.amazonaws.com"
EC2_IP="16.170.177.86"
DB_URL="postgresql://finsenseAdmin:finsense%23RDS@localhost:15432/opentowork"

echo "=== OpenToWork Local Dev ==="

# ── 1. Kill any stale processes ──────────────────────────────────────────────
echo "[1/4] Cleaning up stale processes..."
lsof -ti:8000 | xargs kill -9 2>/dev/null && echo "  Killed port 8000" || echo "  Port 8000 free"
lsof -ti:15432 | xargs kill -9 2>/dev/null && echo "  Killed SSH tunnel" || echo "  Tunnel not running"
sleep 1

# ── 2. SSH tunnel → RDS ──────────────────────────────────────────────────────
echo "[2/4] Starting SSH tunnel (localhost:15432 → RDS)..."
ssh -i "$PEM" -L 15432:$RDS_HOST:5432 ubuntu@$EC2_IP -N -f -o StrictHostKeyChecking=no
sleep 2
echo "  Tunnel up"

# ── 3. FastAPI server ────────────────────────────────────────────────────────
echo "[3/4] Starting FastAPI (port 8000)..."
cd "$PROJECT_DIR"
DATABASE_URL="$DB_URL" /opt/anaconda3/bin/uvicorn server.api:app --reload --port 8000 > /tmp/opentowork-api.log 2>&1 &
echo $! > /tmp/opentowork-api.pid
sleep 2
curl -s http://localhost:8000/health | grep -q "ok" && echo "  FastAPI up" || echo "  FastAPI failed — check /tmp/opentowork-api.log"

# ── 4. Switch dashboard to localhost ─────────────────────────────────────────
echo "[4/4] Switching dashboard to localhost..."
echo "VITE_API_URL=http://localhost:8000" > "$PROJECT_DIR/dashboard/.env.local"

# ── 5. Start dashboard ───────────────────────────────────────────────────────
echo "[5/5] Starting dashboard..."
cd "$PROJECT_DIR/dashboard"
npm run dev > /tmp/opentowork-dashboard.log 2>&1 &
echo $! > /tmp/opentowork-dashboard.pid
sleep 3
echo "  Dashboard up → http://localhost:3000"

echo ""
echo "=== All systems go ==="
echo "  Dashboard:  http://localhost:3000"
echo "  API:        http://localhost:8000"
echo "  API logs:   tail -f /tmp/opentowork-api.log"
echo "  Dash logs:  tail -f /tmp/opentowork-dashboard.log"
echo ""
echo "To stop everything: bash scripts/stop-local.sh"
