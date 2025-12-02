#!/bin/bash
# Build and Push Docker Images to ECR
# Usage: ./build-and-push.sh <aws-region> <aws-account-id>

set -e

# Configuration
AWS_REGION="${1:-us-west-2}"
AWS_ACCOUNT_ID="${2}"
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
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

# ECR Login
log_info "Authenticating with ECR..."
aws ecr get-login-password --region "$AWS_REGION" | \
    docker login --username AWS --password-stdin \
    "${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com"

# Services to build
SERVICES=(
    "api-gateway"
    "user-service"
    "policy-service"
    "claims-service"
    "quotes-service"
)

# Build and push each service
for SERVICE in "${SERVICES[@]}"; do
    log_info "Building and pushing $SERVICE..."
    
    ECR_REPO="${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/dynaclaimz/${SERVICE}"
    SERVICE_DIR="${PROJECT_ROOT}/services/${SERVICE}"
    
    if [ ! -d "$SERVICE_DIR" ]; then
        log_warn "Directory not found: $SERVICE_DIR. Skipping..."
        continue
    fi
    
    # Build image
    log_info "Building Docker image for $SERVICE..."
    docker build -t "${SERVICE}:latest" "$SERVICE_DIR"
    
    # Tag image
    docker tag "${SERVICE}:latest" "${ECR_REPO}:latest"
    docker tag "${SERVICE}:latest" "${ECR_REPO}:$(git rev-parse --short HEAD 2>/dev/null || echo 'manual')"
    
    # Push image
    log_info "Pushing $SERVICE to ECR..."
    docker push "${ECR_REPO}:latest"
    docker push "${ECR_REPO}:$(git rev-parse --short HEAD 2>/dev/null || echo 'manual')"
    
    log_info "✓ Successfully pushed $SERVICE"
    echo ""
done

log_info "All services built and pushed successfully!"
log_info ""
log_info "Next steps:"
log_info "1. Update Kubernetes deployment manifests with image tags"
log_info "2. Apply Kubernetes manifests: kubectl apply -f k8s/"
log_info "3. Check deployment status: kubectl get pods -n dynaclaimz"
