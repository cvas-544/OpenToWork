#!/bin/bash
# Wrapper for Vite dashboard dev server
# Used by launchd (com.opentowork.dashboard)

export PATH="/Users/vasuchukka/.nvm/versions/node/v22.18.0/bin:$PATH"
DASHBOARD_DIR="/Users/vasuchukka/Desktop/desktop/AI/OpenToWork/dashboard"

# Ensure .env.local points to localhost API
echo "VITE_API_URL=http://localhost:8000" > "$DASHBOARD_DIR/.env.local"

cd "$DASHBOARD_DIR"
exec npm run dev
