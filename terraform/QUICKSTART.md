# DynaClaimz EKS Deployment Quick Reference

## Prerequisites Checklist

- [ ] AWS CLI configured (`aws configure`)
- [ ] Terraform installed (`terraform --version`)
- [ ] kubectl installed (`kubectl version`)
- [ ] Docker installed (`docker --version`)
- [ ] Git repository cloned
- [ ] AWS account with appropriate permissions

## Step-by-Step Deployment

### 1. Configure Terraform Variables

```bash
cd terraform
cp terraform.tfvars.example terraform.tfvars
# Edit terraform.tfvars with your settings
```

### 2. Deploy Infrastructure

```bash
# Initialize Terraform
terraform init

# Review planned changes
terraform plan -out=tfplan

# Apply infrastructure (takes 15-20 minutes)
terraform apply tfplan

# Save outputs
terraform output > ../deployment-outputs.txt
```

### 3. Configure kubectl

```bash
# Get the command from Terraform output
aws eks update-kubeconfig --region us-west-2 --name dynaclaimz-production-eks

# Verify connection
kubectl get nodes
```

### 4. Build and Push Docker Images

```bash
cd ..

# Option 1: Use the provided script
./scripts/build-and-push.sh us-west-2

# Option 2: Manual build
export AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
export AWS_REGION=us-west-2

# Authenticate with ECR
aws ecr get-login-password --region $AWS_REGION | \
  docker login --username AWS --password-stdin \
  $AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com

# Build each service
cd services/user-service
docker build -t $AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/dynaclaimz/user-service:latest .
docker push $AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/dynaclaimz/user-service:latest

# Repeat for other services...
```

### 5. Deploy to Kubernetes

```bash
# Option 1: Use deployment script
./scripts/deploy-to-eks.sh production

# Option 2: Manual deployment
kubectl apply -f k8s/namespace.yaml
kubectl apply -f k8s/secrets.yaml
kubectl apply -f k8s/services/
kubectl apply -f k8s/deployments/
kubectl apply -f k8s/jobs/database/db-init-job.yaml
kubectl apply -f k8s/ingress.yaml
```

### 6. Verify Deployment

```bash
# Check pod status
kubectl get pods -n dynaclaimz

# Check services
kubectl get svc -n dynaclaimz

# Check ingress
kubectl get ingress -n dynaclaimz

# Get API Gateway URL
kubectl get svc api-gateway -n dynaclaimz -o jsonpath='{.status.loadBalancer.ingress[0].hostname}'
```

### 7. Initialize Database (if needed)

```bash
# Check DB init job status
kubectl get jobs -n dynaclaimz

# If manual init needed, exec into a pod
kubectl exec -it deployment/user-service -n dynaclaimz -- sh
npx prisma migrate deploy
```

## Common Commands

### Monitoring

```bash
# Watch pod status
kubectl get pods -n dynaclaimz -w

# View logs
kubectl logs -f deployment/api-gateway -n dynaclaimz
kubectl logs -f deployment/user-service -n dynaclaimz

# Describe pod for troubleshooting
kubectl describe pod <pod-name> -n dynaclaimz

# Check resource usage
kubectl top nodes
kubectl top pods -n dynaclaimz
```

### Scaling

```bash
# Manual scaling
kubectl scale deployment user-service --replicas=5 -n dynaclaimz

# View HPA status
kubectl get hpa -n dynaclaimz
```

### Updates

```bash
# Update image
kubectl set image deployment/user-service \
  user-service=$AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/dynaclaimz/user-service:v2.0 \
  -n dynaclaimz

# Restart deployment
kubectl rollout restart deployment/user-service -n dynaclaimz

# Check rollout status
kubectl rollout status deployment/user-service -n dynaclaimz

# Rollback if needed
kubectl rollout undo deployment/user-service -n dynaclaimz
```

### Database Operations

```bash
# Connect to database
kubectl run -it --rm psql --image=postgres:14 --restart=Never -n dynaclaimz -- \
  psql -h <RDS_ENDPOINT> -U dynaclaimz_admin -d user_db

# Run migrations
kubectl exec -it deployment/user-service -n dynaclaimz -- npx prisma migrate deploy

# Seed database
kubectl exec -it deployment/user-service -n dynaclaimz -- npx prisma db seed
```

## Troubleshooting

### Pods Not Starting

```bash
# Check events
kubectl get events -n dynaclaimz --sort-by='.lastTimestamp'

# Check pod details
kubectl describe pod <pod-name> -n dynaclaimz

# Check logs
kubectl logs <pod-name> -n dynaclaimz --previous
```

### Database Connection Issues

```bash
# Test database connectivity from pod
kubectl exec -it deployment/user-service -n dynaclaimz -- sh
nc -zv <rds-endpoint> 5432

# Check secrets
kubectl get secret app-secrets -n dynaclaimz -o yaml
```

### Image Pull Errors

```bash
# Verify ECR repositories
aws ecr describe-repositories --region $AWS_REGION

# Check node IAM permissions
kubectl describe node <node-name>

# Verify image exists
aws ecr describe-images --repository-name dynaclaimz/user-service --region $AWS_REGION
```

## Cleanup

### Delete Kubernetes Resources

```bash
# Delete namespace (removes all resources)
kubectl delete namespace dynaclaimz

# Or delete individually
kubectl delete -f k8s/
```

### Destroy Infrastructure

```bash
cd terraform

# Review what will be destroyed
terraform plan -destroy

# Destroy all resources
terraform destroy

# Confirm: yes
```

## Cost Optimization Tips

1. **Use Spot Instances** for non-production
   - Set `enable_spot_instances = true` in terraform.tfvars
   
2. **Right-size Resources**
   - Monitor actual usage with `kubectl top`
   - Adjust CPU/memory requests/limits
   
3. **Reduce Node Count** for dev/staging
   - Set `node_desired_size = 1` for development
   
4. **Use Smaller RDS Instance** for testing
   - Use `db.t3.small` instead of `db.t3.medium`
   
5. **Enable Autoscaling**
   - Let HPA scale pods based on load
   - Let Cluster Autoscaler manage nodes

## Security Best Practices

1. **Secrets Management**
   - Use AWS Secrets Manager
   - Enable encryption at rest
   - Rotate credentials regularly
   
2. **Network Security**
   - Use private subnets for pods
   - Implement Network Policies
   - Restrict security group rules
   
3. **RBAC**
   - Create service accounts with minimal permissions
   - Use Pod Security Standards
   
4. **Image Security**
   - Enable ECR image scanning
   - Use specific image tags (not latest)
   - Scan for vulnerabilities
   
5. **Monitoring**
   - Enable CloudWatch Container Insights
   - Set up alarms for critical metrics
   - Use AWS GuardDuty

## Next Steps

1. Set up CI/CD pipeline (GitHub Actions example in `.github/workflows/`)
2. Configure custom domain and SSL certificate
3. Implement monitoring and alerting
4. Set up database backups and disaster recovery
5. Configure auto-scaling policies
6. Implement Network Policies for pod security
