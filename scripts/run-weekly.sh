#!/bin/bash
# Weekly Sunday digest — Agent 5 (Reporter), Agent 6 (App Tracker), Agent 9 (Market Analysis, newest-first)
set -a
source /home/ubuntu/OpenToWork/.env
set +a

TOKEN=$(python3 -c "
import jwt, os
secret = os.environ.get('JWT_SECRET', '')
token = jwt.encode({'sub': '1', 'email': 'vasu.chukka97@gmail.com', 'role': 'admin'}, secret, algorithm='HS256')
print(token)
")

echo "[$(date -u '+%Y-%m-%d %H:%M:%S UTC')] Running weekly pipeline (Agents 5 + 6 + 9)..."
curl -s -X POST http://localhost:8000/run/pipeline/weekly \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json"
echo ""
echo "[$(date -u '+%Y-%m-%d %H:%M:%S UTC')] Weekly jobs kicked off"
