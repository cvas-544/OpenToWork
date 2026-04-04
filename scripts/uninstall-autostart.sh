#!/bin/bash
# Remove OpenToWork auto-start services
# Run: bash scripts/uninstall-autostart.sh

LAUNCHD_DIR="$HOME/Library/LaunchAgents"

echo "=== Uninstalling OpenToWork Auto-start ==="

launchctl unload "$LAUNCHD_DIR/com.opentowork.tunnel.plist" 2>/dev/null && echo "  Stopped tunnel" || true
launchctl unload "$LAUNCHD_DIR/com.opentowork.api.plist" 2>/dev/null && echo "  Stopped API" || true
launchctl unload "$LAUNCHD_DIR/com.opentowork.dashboard.plist" 2>/dev/null && echo "  Stopped dashboard" || true

rm -f "$LAUNCHD_DIR/com.opentowork.tunnel.plist"
rm -f "$LAUNCHD_DIR/com.opentowork.api.plist"
rm -f "$LAUNCHD_DIR/com.opentowork.dashboard.plist"

echo "=== Done — auto-start removed ==="
