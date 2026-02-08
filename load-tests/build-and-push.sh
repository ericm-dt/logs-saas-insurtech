#!/bin/bash
# Build and Push Locust Load Testing Image to ECR
# Usage: ./build-and-push.sh [aws-region] [aws-account-id] [--restart]
#   aws-region: AWS region (default: us-east-1)
#   aws-account-id: AWS account ID (auto-detected if not provided)
#   --restart: Optional flag to restart Locust deployment after push

set -e

# Parse arguments
AWS_REGION="${1:-us-east-1}"
AWS_ACCOUNT_ID="${2}"
RESTART_DEPLOYMENT=false

# Check for --restart flag in any position
for arg in "$@"; do
    if [ "$arg" == "--restart" ]; then
        RESTART_DEPLOYMENT=true
    fi
done

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_step() {
    echo -e "${BLUE}[STEP]${NC} $1"
}

# Check if AWS_ACCOUNT_ID is provided
if [ -z "$AWS_ACCOUNT_ID" ]; then
    log_info "Fetching AWS Account ID..."
    AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
    if [ -z "$AWS_ACCOUNT_ID" ]; then
        log_error "Failed to get AWS Account ID. Please provide it as argument."
        exit 1
    fi
fi

log_info "AWS Account ID: $AWS_ACCOUNT_ID"
log_info "AWS Region: $AWS_REGION"
log_info "Restart after push: $RESTART_DEPLOYMENT"
echo ""

# ECR repository details
ECR_REPO="${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/dynaclaimz/locust"
GIT_SHA=$(git rev-parse --short HEAD 2>/dev/null || echo 'manual')

# Step 1: ECR Login
log_step "1/5 - Authenticating with ECR..."
aws ecr get-login-password --region "$AWS_REGION" | \
    docker login --username AWS --password-stdin \
    "${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com"
echo ""

# Step 2: Build Docker image
log_step "2/5 - Building Locust Docker image..."
log_info "Building for platform: linux/amd64 (EKS compatibility)"
docker build --platform linux/amd64 -t "locust:latest" "$SCRIPT_DIR"

if [ $? -ne 0 ]; then
    log_error "Docker build failed"
    exit 1
fi
echo ""

# Step 3: Tag image
log_step "3/5 - Tagging Docker image..."
docker tag "locust:latest" "${ECR_REPO}:latest"
docker tag "locust:latest" "${ECR_REPO}:${GIT_SHA}"
log_info "Tagged as: ${ECR_REPO}:latest"
log_info "Tagged as: ${ECR_REPO}:${GIT_SHA}"
echo ""

# Step 4: Push to ECR
log_step "4/5 - Pushing to ECR..."
docker push "${ECR_REPO}:latest"
docker push "${ECR_REPO}:${GIT_SHA}"

if [ $? -ne 0 ]; then
    log_error "Docker push failed"
    exit 1
fi
echo ""

# Step 5: Restart deployment (optional)
if [ "$RESTART_DEPLOYMENT" = true ]; then
    log_step "5/5 - Restarting Locust deployment..."
    
    # Check if kubectl is available
    if ! command -v kubectl &> /dev/null; then
        log_warn "kubectl not found. Skipping deployment restart."
        log_warn "Run manually: kubectl rollout restart deployment -n load-testing"
    else
        kubectl rollout restart deployment -n load-testing
        
        if [ $? -eq 0 ]; then
            log_info "Waiting for rollout to complete..."
            kubectl rollout status deployment/locust-master -n load-testing --timeout=120s
            kubectl rollout status deployment/locust-worker -n load-testing --timeout=120s
            echo ""
            log_info "Deployment restarted successfully!"
            
            # Show pod status
            echo ""
            log_info "Current pod status:"
            kubectl get pods -n load-testing
        else
            log_warn "Deployment restart failed. You may need to restart manually."
        fi
    fi
else
    log_step "5/5 - Skipping deployment restart (use --restart flag to enable)"
fi

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}✓ Locust image built and pushed successfully!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
log_info "Image: ${ECR_REPO}:latest"
log_info "Image: ${ECR_REPO}:${GIT_SHA}"
echo ""

if [ "$RESTART_DEPLOYMENT" = false ]; then
    log_info "Next steps:"
    log_info "1. Restart Locust deployment: kubectl rollout restart deployment -n load-testing"
    log_info "2. Check pod status: kubectl get pods -n load-testing"
    log_info "3. View logs: kubectl logs -n load-testing -l app=locust -f"
    echo ""
    log_info "Or run this script with --restart flag to automate deployment restart"
fi
