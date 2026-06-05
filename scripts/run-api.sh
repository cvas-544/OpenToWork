#!/bin/bash
# Wrapper for FastAPI — waits for SSH tunnel then starts uvicorn
# Used by launchd (com.opentowork.api)

export DATABASE_URL="postgresql://finsenseAdmin:finsense%23RDS@localhost:15432/opentowork"
PROJECT_DIR="/Users/vasuchukka/Desktop/Desktop/desktop/AI/OpenToWork"

# Wait for SSH tunnel (port 15432) to be ready — retry up to 30s
for i in $(seq 1 15); do
  if /usr/bin/nc -z localhost 15432 2>/dev/null; then
    break
  fi
  sleep 2
done

cd "$PROJECT_DIR"
exec /opt/anaconda3/bin/uvicorn server.api:app --port 8000
