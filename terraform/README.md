# DynaClaimz AWS EKS Deployment with Terraform

This Terraform configuration deploys the DynaClaimz microservices application to AWS EKS.

## Infrastructure Components

- **VPC**: Custom VPC with public and private subnets across 3 availability zones
- **EKS Cluster**: Managed Kubernetes cluster with autoscaling node groups
- **RDS PostgreSQL**: Multi-AZ database instance with automated backups
- **ECR**: Container registries for each microservice
- **Load Balancer**: Application Load Balancer for ingress
- **Security Groups**: Network security controls
- **IAM Roles**: Service accounts and permissions

## Prerequisites

1. **AWS CLI** configured with appropriate credentials
   ```bash
   aws configure
   ```

2. **Terraform** installed (version >= 1.0)
   ```bash
   brew install terraform  # macOS
   ```

3. **kubectl** installed
   ```bash
   brew install kubectl
   ```

4. **Docker** for building and pushing images

## Quick Start

### 1. Initialize Terraform

```bash
cd terraform
terraform init
```

### 2. Review and Customize Variables

Edit `terraform.tfvars`:

```hcl
project_name = "dynaclaimz"
environment  = "production"
aws_region   = "us-west-2"

# Database
db_instance_class = "db.t3.medium"
db_username      = "dynaclaimz_admin"

# EKS
eks_cluster_version = "1.28"
node_instance_types = ["t3.medium"]
node_desired_size   = 3
node_min_size       = 2
node_max_size       = 10
```

### 3. Plan Deployment

```bash
terraform plan -out=tfplan
```

### 4. Apply Infrastructure

```bash
terraform apply tfplan
```

This will take ~15-20 minutes to create all resources.

### 5. Configure kubectl

```bash
aws eks update-kubeconfig --region us-west-2 --name dynaclaimz-production-eks
```

### 6. Build and Push Docker Images

```bash
# Authenticate with ECR
aws ecr get-login-password --region us-west-2 | docker login --username AWS --password-stdin <account-id>.dkr.ecr.us-west-2.amazonaws.com

# Get ECR URLs from Terraform output
terraform output ecr_repositories

# Build and push each service
cd ../services/user-service
docker build -t <ecr-url>/user-service:latest .
docker push <ecr-url>/user-service:latest

# Repeat for other services...
```

Or use the provided script:
```bash
./scripts/build-and-push.sh
```

### 7. Deploy Kubernetes Resources

```bash
kubectl apply -f k8s/namespace.yaml
kubectl apply -f k8s/secrets.yaml
kubectl apply -f k8s/configmaps.yaml
kubectl apply -f k8s/deployments/
kubectl apply -f k8s/services/
kubectl apply -f k8s/ingress.yaml
```

### 6. Verify Deployment

```bash
# Check pods
kubectl get pods -n dynaclaimz

# Check services
kubectl get svc -n dynaclaimz

# Get load balancer URL
kubectl get ingress -n dynaclaimz
```

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                          AWS Cloud                          │
│                                                             │
│  ┌───────────────────────────────────────────────────────┐ │
│  │                    VPC (10.0.0.0/16)                  │ │
│  │                                                       │ │
│  │  ┌──────────────┐  ┌──────────────┐  ┌────────────┐ │ │
│  │  │  Public      │  │  Public      │  │  Public    │ │ │
│  │  │  Subnet      │  │  Subnet      │  │  Subnet    │ │ │
│  │  │  AZ-1        │  │  AZ-2        │  │  AZ-3      │ │ │
│  │  │              │  │              │  │            │ │ │
│  │  │  ┌─────────┐ │  │              │  │            │ │ │
│  │  │  │   ALB   │ │  │              │  │            │ │ │
│  │  │  └────┬────┘ │  │              │  │            │ │ │
│  │  └───────┼──────┘  └──────────────┘  └────────────┘ │ │
│  │          │                                           │ │
│  │  ┌───────┼──────┐  ┌──────────────┐  ┌────────────┐ │ │
│  │  │  Private     │  │  Private     │  │  Private   │ │ │
│  │  │  Subnet      │  │  Subnet      │  │  Subnet    │ │ │
│  │  │  AZ-1        │  │  AZ-2        │  │  AZ-3      │ │ │
│  │  │              │  │              │  │            │ │ │
│  │  │  ┌─────────┐ │  │ ┌─────────┐ │  │ ┌────────┐ │ │ │
│  │  │  │ EKS Pod │ │  │ │ EKS Pod │ │  │ │EKS Pod │ │ │ │
│  │  │  │ (API GW)│ │  │ │(Services)│ │  │ │(...)   │ │ │ │
│  │  │  └─────────┘ │  │ └─────────┘ │  │ └────────┘ │ │ │
│  │  └──────────────┘  └──────────────┘  └────────────┘ │ │
│  │                                                       │ │
│  │  ┌──────────────┐  ┌──────────────┐                 │ │
│  │  │  DB Subnet   │  │  DB Subnet   │                 │ │
│  │  │  AZ-1        │  │  AZ-2        │                 │ │
│  │  │              │  │              │                 │ │
│  │  │  ┌─────────┐ │  │ ┌─────────┐ │                 │ │
│  │  │  │   RDS   │ │  │ │RDS(Stby)│ │                 │ │
│  │  │  │PostgreSQL│ │  │ │         │ │                 │ │
│  │  │  └─────────┘ │  │ └─────────┘ │                 │ │
│  │  └──────────────┘  └──────────────┘                 │ │
│  └───────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

## Kubernetes Resources

The deployment creates:

- **Namespace**: `dynaclaimz`
- **Deployments**: One per microservice (6 total)
- **Services**: ClusterIP for internal communication, LoadBalancer for API Gateway
- **ConfigMaps**: Environment-specific configuration
- **Secrets**: Database credentials
- **HPA**: Horizontal Pod Autoscalers for each service

## Database Setup

The RDS instance is created with 4 databases:
- `user_db` - User service
- `policy_db` - Policy service
- `claims_db` - Claims service
- `quotes_db` - Quotes service

Initialize schemas after deployment:

```bash
# Connect to user-service pod
kubectl exec -it deployment/user-service -n dynaclaimz -- sh

# Run migrations
npx prisma migrate deploy
```

## Monitoring and Logging

Access logs:
```bash
# Service logs
kubectl logs -f deployment/api-gateway -n dynaclaimz

# All pods in namespace
kubectl logs -f -l app.kubernetes.io/name=dynaclaimz -n dynaclaimz
```

Scale services:
```bash
kubectl scale deployment user-service --replicas=5 -n dynaclaimz
```

## Cost Optimization

**Development/Staging:**
- Use smaller instance types (`t3.small`, `db.t3.small`)
- Single AZ deployment
- Reduce node count (1-2 nodes)
- Use spot instances for worker nodes

**Production:**
- Multi-AZ for high availability
- Auto-scaling enabled
- Reserved instances for cost savings
- Regular snapshots and backups

## Estimated Monthly Costs

**Development:**
- EKS Control Plane: $73
- EC2 (2 x t3.small): ~$30
- RDS (db.t3.small): ~$30
- ALB: ~$20
- **Total: ~$153/month**

**Production:**
- EKS Control Plane: $73
- EC2 (3-10 x t3.medium): ~$100-$300
- RDS (db.t3.medium Multi-AZ): ~$120
- ALB: ~$20
- **Total: ~$313-$513/month**

## Cleanup

To destroy all resources:

```bash
# Delete Kubernetes resources first
kubectl delete namespace dynaclaimz

# Destroy Terraform infrastructure
terraform destroy
```

**Warning:** This will permanently delete all data. Ensure backups are taken before destroying.

## Troubleshooting

### Pods not starting
```bash
kubectl describe pod <pod-name> -n dynaclaimz
kubectl logs <pod-name> -n dynaclaimz
```

### Database connection issues
```bash
# Check database endpoint
terraform output rds_endpoint

# Test connection from pod
kubectl exec -it deployment/user-service -n dynaclaimz -- sh
nc -zv <rds-endpoint> 5432
```

### ECR authentication issues
```bash
# Re-authenticate
aws ecr get-login-password --region us-west-2 | docker login --username AWS --password-stdin <account-id>.dkr.ecr.us-west-2.amazonaws.com
```

## Security Best Practices

1. **Secrets Management**: Use AWS Secrets Manager or external-secrets operator
2. **Network Policies**: Implement Kubernetes network policies
3. **RBAC**: Configure role-based access control
4. **Image Scanning**: Enable ECR image scanning
5. **SSL/TLS**: Use ACM certificates for HTTPS
6. **Backup**: Regular RDS snapshots and point-in-time recovery

## CI/CD Integration

Example GitHub Actions workflow provided in `.github/workflows/deploy-eks.yml`

## Support

For issues or questions:
- Check Terraform state: `terraform show`
- Review outputs: `terraform output`
- AWS Console: Monitor CloudWatch logs and metrics
