#!/bin/bash
# OpenToWork — Stop all local dev processes

echo "=== Stopping OpenToWork Local Dev ==="

kill $(cat /tmp/opentowork-api.pid 2>/dev/null) 2>/dev/null && echo "  FastAPI stopped" || echo "  FastAPI not running"
kill $(cat /tmp/opentowork-dashboard.pid 2>/dev/null) 2>/dev/null && echo "  Dashboard stopped" || echo "  Dashboard not running"
lsof -ti:15432 | xargs kill -9 2>/dev/null && echo "  SSH tunnel stopped" || echo "  Tunnel not running"
lsof -ti:8000 | xargs kill -9 2>/dev/null && echo "  Port 8000 cleared" || true

rm -f /tmp/opentowork-api.pid /tmp/opentowork-dashboard.pid

echo "=== Done ==="
