#!/usr/bin/env bash
# =============================================================================
# first-deploy.sh — Run from your LOCAL machine after `cdk deploy`.
#
# Prerequisites:
#   - AWS CLI configured
#   - CDK deployed (run: cd infra && npm install && npx cdk deploy)
#   - EC2 key pair created and .pem file available
#
# Usage:
#   bash scripts/first-deploy.sh <EC2_IP> <PATH_TO_KEY.pem>
#
# Example:
#   bash scripts/first-deploy.sh 54.123.45.67 ~/.ssh/my-key.pem
# =============================================================================
set -euo pipefail

EC2_IP="${1:?Usage: $0 <EC2_IP> <KEY.pem>}"
KEY_FILE="${2:?Usage: $0 <EC2_IP> <KEY.pem>}"
REMOTE="ec2-user@${EC2_IP}"
SSH="ssh -i $KEY_FILE -o StrictHostKeyChecking=no"

echo "==> Waiting for EC2 to be ready..."
until $SSH "$REMOTE" "echo ok" 2>/dev/null; do sleep 5; done

echo "==> Copying project files to EC2..."
rsync -az --exclude node_modules --exclude .git --exclude dist \
  -e "ssh -i $KEY_FILE -o StrictHostKeyChecking=no" \
  . "$REMOTE:/opt/app/"

echo "==> Running deploy script on EC2..."
$SSH "$REMOTE" "
  export AWS_REGION=${AWS_REGION:-us-east-1}
  export S3_BUCKET_NAME=${S3_BUCKET_NAME:?Set S3_BUCKET_NAME env var}
  export DB_HOST=${DB_HOST:?Set DB_HOST env var (from CDK output DbEndpoint)}
  bash /opt/app/scripts/deploy.sh
"

echo ""
echo "✅  First deploy complete! Visit: http://${EC2_IP}"
