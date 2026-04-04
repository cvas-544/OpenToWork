#!/bin/bash
# Install OpenToWork as macOS login services (auto-start on login)
# Run once: bash scripts/install-autostart.sh

LAUNCHD_DIR="$HOME/Library/LaunchAgents"
SCRIPTS_DIR="/Users/vasuchukka/Desktop/desktop/AI/OpenToWork/scripts"

echo "=== Installing OpenToWork Auto-start ==="

# Make wrapper scripts executable
chmod +x "$SCRIPTS_DIR/run-api.sh"
chmod +x "$SCRIPTS_DIR/run-dashboard.sh"

# Stop any running instances first
echo "[1/3] Stopping existing instances..."
lsof -ti:8000 | xargs kill -9 2>/dev/null || true
lsof -ti:15432 | xargs kill -9 2>/dev/null || true
launchctl unload "$LAUNCHD_DIR/com.opentowork.tunnel.plist" 2>/dev/null || true
launchctl unload "$LAUNCHD_DIR/com.opentowork.api.plist" 2>/dev/null || true
launchctl unload "$LAUNCHD_DIR/com.opentowork.dashboard.plist" 2>/dev/null || true

# Copy plists to LaunchAgents
echo "[2/3] Installing launch agents..."
cp "$SCRIPTS_DIR/launchd/com.opentowork.tunnel.plist" "$LAUNCHD_DIR/"
cp "$SCRIPTS_DIR/launchd/com.opentowork.api.plist" "$LAUNCHD_DIR/"
cp "$SCRIPTS_DIR/launchd/com.opentowork.dashboard.plist" "$LAUNCHD_DIR/"

# Load (start immediately + persist across reboots)
echo "[3/3] Loading services..."
launchctl load "$LAUNCHD_DIR/com.opentowork.tunnel.plist"
sleep 3
launchctl load "$LAUNCHD_DIR/com.opentowork.api.plist"
sleep 5
launchctl load "$LAUNCHD_DIR/com.opentowork.dashboard.plist"

echo ""
echo "=== Done — services will now auto-start on every login ==="
echo "  Dashboard:     http://localhost:3002"
echo "  API:           http://localhost:8000"
echo "  Tunnel log:    tail -f /tmp/opentowork-tunnel.log"
echo "  API log:       tail -f /tmp/opentowork-api.log"
echo "  Dashboard log: tail -f /tmp/opentowork-dashboard.log"
echo ""
echo "  To uninstall:  bash scripts/uninstall-autostart.sh"
