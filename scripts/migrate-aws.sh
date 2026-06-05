#!/usr/bin/env bash
set -euo pipefail

# ── Config ─────────────────────────────────────────────────────────────────
OLD_PROFILE="old-account"
NEW_PROFILE="new-account"
OLD_ACCOUNT="017077702435"
NEW_ACCOUNT="150105760014"
REGION="eu-north-1"
INSTANCE_ID="i-0a3280401c416ebd3"
RDS_ID="finsense-db"
KEY_NAME="FinsenseKey"
KEY_PATH="/Users/vasuchukka/FinsenseKey.pem"
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
AMI_NAME="opentowork-migration-${TIMESTAMP}"
SNAP_NAME="finsense-db-migration-${TIMESTAMP}"

log() { echo "[$(date '+%H:%M:%S')] $*"; }
wait_for() {
  local desc=$1; shift
  log "Waiting: $desc..."
  "$@"
  log "Done: $desc"
}

# ── Phase 1: EC2 — Create & Share AMI ──────────────────────────────────────
log "=== PHASE 1: EC2 AMI ==="

log "Creating AMI from $INSTANCE_ID..."
AMI_ID=$(aws ec2 create-image \
  --instance-id "$INSTANCE_ID" \
  --name "$AMI_NAME" \
  --no-reboot \
  --region "$REGION" \
  --profile "$OLD_PROFILE" \
  --query "ImageId" --output text)
log "AMI created: $AMI_ID"

wait_for "AMI available" aws ec2 wait image-available \
  --image-ids "$AMI_ID" \
  --region "$REGION" \
  --profile "$OLD_PROFILE"

log "Sharing AMI with new account $NEW_ACCOUNT..."
aws ec2 modify-image-attribute \
  --image-id "$AMI_ID" \
  --launch-permission "Add=[{UserId=${NEW_ACCOUNT}}]" \
  --region "$REGION" \
  --profile "$OLD_PROFILE"

# Share underlying snapshot too
SNAP_ID=$(aws ec2 describe-images \
  --image-ids "$AMI_ID" \
  --region "$REGION" \
  --profile "$OLD_PROFILE" \
  --query "Images[0].BlockDeviceMappings[0].Ebs.SnapshotId" --output text)
log "Sharing snapshot $SNAP_ID..."
aws ec2 modify-snapshot-attribute \
  --snapshot-id "$SNAP_ID" \
  --attribute createVolumePermission \
  --operation-type add \
  --user-ids "$NEW_ACCOUNT" \
  --region "$REGION" \
  --profile "$OLD_PROFILE"

log "Copying AMI into new account..."
NEW_AMI_ID=$(aws ec2 copy-image \
  --source-image-id "$AMI_ID" \
  --source-region "$REGION" \
  --name "$AMI_NAME" \
  --region "$REGION" \
  --profile "$NEW_PROFILE" \
  --query "ImageId" --output text)
log "New AMI: $NEW_AMI_ID"

wait_for "New AMI available" aws ec2 wait image-available \
  --image-ids "$NEW_AMI_ID" \
  --region "$REGION" \
  --profile "$NEW_PROFILE"

# ── Phase 2: Key Pair — Import into new account ────────────────────────────
log "=== PHASE 2: Key Pair ==="

PUB_KEY=$(ssh-keygen -y -f "$KEY_PATH")
aws ec2 import-key-pair \
  --key-name "$KEY_NAME" \
  --public-key-material "$(echo "$PUB_KEY" | base64)" \
  --region "$REGION" \
  --profile "$NEW_PROFILE" 2>/dev/null && log "Key pair imported" || log "Key pair already exists — skipping"

# ── Phase 3: Security Group ────────────────────────────────────────────────
log "=== PHASE 3: Security Group ==="

SG_ID=$(aws ec2 create-security-group \
  --group-name "opentowork-sg" \
  --description "OpenToWork security group" \
  --region "$REGION" \
  --profile "$NEW_PROFILE" \
  --query "GroupId" --output text)
log "Security group: $SG_ID"

aws ec2 authorize-security-group-ingress \
  --group-id "$SG_ID" \
  --region "$REGION" \
  --profile "$NEW_PROFILE" \
  --ip-permissions \
    "IpProtocol=tcp,FromPort=22,ToPort=22,IpRanges=[{CidrIp=0.0.0.0/0}]" \
    "IpProtocol=tcp,FromPort=8000,ToPort=8000,IpRanges=[{CidrIp=0.0.0.0/0}]" \
    "IpProtocol=tcp,FromPort=5678,ToPort=5678,IpRanges=[{CidrIp=0.0.0.0/0}]" \
    "IpProtocol=tcp,FromPort=5432,ToPort=5432,IpRanges=[{CidrIp=0.0.0.0/0}]"
log "Inbound rules added (22, 8000, 5678, 5432)"

# ── Phase 4: Launch EC2 ────────────────────────────────────────────────────
log "=== PHASE 4: Launch EC2 ==="

NEW_INSTANCE_ID=$(aws ec2 run-instances \
  --image-id "$NEW_AMI_ID" \
  --instance-type "t3.small" \
  --key-name "$KEY_NAME" \
  --security-group-ids "$SG_ID" \
  --region "$REGION" \
  --profile "$NEW_PROFILE" \
  --tag-specifications "ResourceType=instance,Tags=[{Key=Name,Value=opentowork}]" \
  --query "Instances[0].InstanceId" --output text)
log "Instance launched: $NEW_INSTANCE_ID"

wait_for "EC2 running" aws ec2 wait instance-running \
  --instance-ids "$NEW_INSTANCE_ID" \
  --region "$REGION" \
  --profile "$NEW_PROFILE"

NEW_IP=$(aws ec2 describe-instances \
  --instance-ids "$NEW_INSTANCE_ID" \
  --region "$REGION" \
  --profile "$NEW_PROFILE" \
  --query "Reservations[0].Instances[0].PublicIpAddress" --output text)
log "New EC2 IP: $NEW_IP"

# ── Phase 5: RDS — Snapshot & Share ───────────────────────────────────────
log "=== PHASE 5: RDS Snapshot ==="

log "Creating RDS snapshot..."
aws rds create-db-snapshot \
  --db-instance-identifier "$RDS_ID" \
  --db-snapshot-identifier "$SNAP_NAME" \
  --region "$REGION" \
  --profile "$OLD_PROFILE" > /dev/null

wait_for "RDS snapshot available" aws rds wait db-snapshot-available \
  --db-snapshot-identifier "$SNAP_NAME" \
  --region "$REGION" \
  --profile "$OLD_PROFILE"

RDS_SNAP_ARN=$(aws rds describe-db-snapshots \
  --db-snapshot-identifier "$SNAP_NAME" \
  --region "$REGION" \
  --profile "$OLD_PROFILE" \
  --query "DBSnapshots[0].DBSnapshotArn" --output text)
log "Snapshot ARN: $RDS_SNAP_ARN"

log "Sharing RDS snapshot with new account..."
aws rds modify-db-snapshot-attribute \
  --db-snapshot-identifier "$SNAP_NAME" \
  --attribute-name restore \
  --values-to-add "$NEW_ACCOUNT" \
  --region "$REGION" \
  --profile "$OLD_PROFILE"

# ── Phase 6: Copy & Restore RDS ───────────────────────────────────────────
log "=== PHASE 6: Restore RDS ==="

log "Copying RDS snapshot to new account..."
NEW_SNAP_ID="${SNAP_NAME}-copy"
aws rds copy-db-snapshot \
  --source-db-snapshot-identifier "$RDS_SNAP_ARN" \
  --target-db-snapshot-identifier "$NEW_SNAP_ID" \
  --region "$REGION" \
  --profile "$NEW_PROFILE" > /dev/null

wait_for "Copied snapshot available" aws rds wait db-snapshot-available \
  --db-snapshot-identifier "$NEW_SNAP_ID" \
  --region "$REGION" \
  --profile "$NEW_PROFILE"

log "Restoring RDS from snapshot..."
aws rds restore-db-instance-from-db-snapshot \
  --db-instance-identifier "$RDS_ID" \
  --db-snapshot-identifier "$NEW_SNAP_ID" \
  --db-instance-class "db.t3.micro" \
  --vpc-security-group-ids "$SG_ID" \
  --publicly-accessible \
  --region "$REGION" \
  --profile "$NEW_PROFILE" > /dev/null

wait_for "RDS available" aws rds wait db-instance-available \
  --db-instance-identifier "$RDS_ID" \
  --region "$REGION" \
  --profile "$NEW_PROFILE"

NEW_RDS_ENDPOINT=$(aws rds describe-db-instances \
  --db-instance-identifier "$RDS_ID" \
  --region "$REGION" \
  --profile "$NEW_PROFILE" \
  --query "DBInstances[0].Endpoint.Address" --output text)
log "New RDS endpoint: $NEW_RDS_ENDPOINT"

# ── Summary ────────────────────────────────────────────────────────────────
echo ""
echo "============================================"
echo "  MIGRATION COMPLETE"
echo "============================================"
echo "  New EC2 IP:       $NEW_IP"
echo "  New RDS endpoint: $NEW_RDS_ENDPOINT"
echo ""
echo "  Next steps:"
echo "  1. SSH: ssh -i $KEY_PATH ubuntu@$NEW_IP"
echo "  2. Update .env DATABASE_URL → $NEW_RDS_ENDPOINT"
echo "  3. Update start-local.sh SSH target → $NEW_IP"
echo "  4. Delete root access keys from both accounts"
echo "============================================"
