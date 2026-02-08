#!/bin/bash
# Deploy DynaClaimz to EKS
# Usage: ./deploy-to-eks.sh [environment]

set -e

ENVIRONMENT="${1:-production}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

# Check prerequisites
log_info "Checking prerequisites..."

if ! command -v kubectl &> /dev/null; then
    echo "kubectl not found. Please install kubectl."
    exit 1
fi

if ! command -v aws &> /dev/null; then
    echo "AWS CLI not found. Please install AWS CLI."
    exit 1
fi

# Get Terraform outputs
log_info "Fetching Terraform outputs..."
cd "$PROJECT_ROOT/terraform"

CLUSTER_NAME=$(terraform output -raw eks_cluster_name 2>/dev/null || echo "")
AWS_REGION=$(terraform output -raw aws_region 2>/dev/null || echo "us-west-2")
RDS_ENDPOINT=$(terraform output -raw rds_endpoint 2>/dev/null || echo "")
RDS_SECRET_ARN=$(terraform output -raw rds_secret_arn 2>/dev/null || echo "")
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)

if [ -z "$CLUSTER_NAME" ]; then
    echo "Error: Could not get EKS cluster name from Terraform. Have you run 'terraform apply'?"
    exit 1
fi

# Configure kubectl
log_info "Configuring kubectl for cluster: $CLUSTER_NAME"
aws eks update-kubeconfig --region "$AWS_REGION" --name "$CLUSTER_NAME"

# Create namespace
log_info "Creating namespace..."
kubectl apply -f "$PROJECT_ROOT/k8s/namespace.yaml"

# Get database credentials from Secrets Manager
log_info "Fetching database credentials..."
DB_CREDS=$(aws secretsmanager get-secret-value --secret-id "$RDS_SECRET_ARN" --query SecretString --output text)

USER_DB_URL=$(echo "$DB_CREDS" | jq -r '.user_db_url')
POLICY_DB_URL=$(echo "$DB_CREDS" | jq -r '.policy_db_url')
CLAIMS_DB_URL=$(echo "$DB_CREDS" | jq -r '.claims_db_url')
QUOTES_DB_URL=$(echo "$DB_CREDS" | jq -r '.quotes_db_url')

# Generate JWT secret if not exists
JWT_SECRET=$(openssl rand -base64 32)

# Create secrets
log_info "Creating Kubernetes secrets..."
kubectl create secret generic app-secrets \
    --from-literal=JWT_SECRET="$JWT_SECRET" \
    --from-literal=JWT_EXPIRES_IN="7d" \
    --from-literal=USER_DB_URL="$USER_DB_URL" \
    --from-literal=POLICY_DB_URL="$POLICY_DB_URL" \
    --from-literal=CLAIMS_DB_URL="$CLAIMS_DB_URL" \
    --from-literal=QUOTES_DB_URL="$QUOTES_DB_URL" \
    --namespace=dynaclaimz \
    --dry-run=client -o yaml | kubectl apply -f -

# Apply ConfigMaps
log_info "Creating ConfigMaps..."
kubectl apply -f "$PROJECT_ROOT/k8s/secrets.yaml"

# Update deployment manifests with ECR image URLs
log_info "Updating deployment manifests with ECR URLs..."
for file in "$PROJECT_ROOT/k8s/deployments"/*.yaml; do
    sed -i.bak \
        -e "s|<ACCOUNT_ID>|$ACCOUNT_ID|g" \
        -e "s|<REGION>|$AWS_REGION|g" \
        "$file"
    rm "${file}.bak"
done

# Deploy services
log_info "Deploying services..."
kubectl apply -f "$PROJECT_ROOT/k8s/services/"

# Deploy applications
log_info "Deploying applications..."
kubectl apply -f "$PROJECT_ROOT/k8s/deployments/"

# Wait for deployments
log_info "Waiting for deployments to be ready..."
kubectl wait --for=condition=available --timeout=300s \
    deployment/user-service \
    deployment/policy-service \
    deployment/claims-service \
    deployment/quotes-service \
    deployment/api-gateway \
    -n dynaclaimz

# Run database migrations
log_info "Running database migrations..."
kubectl apply -f "$PROJECT_ROOT/k8s/jobs/database/db-init-job.yaml"
kubectl wait --for=condition=complete --timeout=300s job/db-init -n dynaclaimz || log_warn "DB init job may need manual intervention"

# Deploy ingress
log_info "Deploying ingress..."
kubectl apply -f "$PROJECT_ROOT/k8s/ingress.yaml"

# Get service URLs
log_info ""
log_info "==================================="
log_info "Deployment Complete!"
log_info "==================================="
log_info ""
log_info "Namespace: dynaclaimz"
log_info "Region: $AWS_REGION"
log_info "Cluster: $CLUSTER_NAME"
log_info ""
log_info "To check status:"
log_info "  kubectl get pods -n dynaclaimz"
log_info "  kubectl get svc -n dynaclaimz"
log_info "  kubectl get ingress -n dynaclaimz"
log_info ""
log_info "To get API Gateway URL:"
log_info "  kubectl get svc api-gateway -n dynaclaimz -o jsonpath='{.status.loadBalancer.ingress[0].hostname}'"
log_info ""
log_info "To view logs:"
log_info "  kubectl logs -f deployment/api-gateway -n dynaclaimz"
log_info ""
