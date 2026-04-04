#!/bin/bash
# Restart n8n on EC2 — pulls latest code + restarts Docker containers

EC2_HOST="16.170.177.86"
EC2_USER="ubuntu"
SSH_KEY="$HOME/FinsenseKey.pem"

echo "=== EC2 n8n Restart ==="

echo "[1/3] Connecting to EC2 and pulling latest code..."
ssh -i "$SSH_KEY" "$EC2_USER@$EC2_HOST" "cd ~/OpenToWork && git pull"

echo "[2/3] Restarting Docker containers..."
ssh -i "$SSH_KEY" "$EC2_USER@$EC2_HOST" "cd ~/OpenToWork/n8n && docker compose down && docker compose up -d"

echo "[3/3] Waiting for n8n to come up..."
sleep 8
ssh -i "$SSH_KEY" "$EC2_USER@$EC2_HOST" "cd ~/OpenToWork/n8n && docker compose ps"

echo ""
echo "=== Done ==="
echo "  n8n:    http://$EC2_HOST:5678"
echo "  agents: http://$EC2_HOST:8000/health"
