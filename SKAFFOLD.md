# Skaffold Development Workflow

Skaffold provides automated build, push, and deploy workflows for DynaClaimz microservices.

## Prerequisites

```bash
# Install Skaffold
brew install skaffold

# Or download from: https://skaffold.dev/docs/install/
```

## Profiles

### 1. Default (Docker Compose - Local Development)

Use for local development with Docker Compose (default setup).

```bash
# Start all services with hot reload
skaffold dev

# Build and deploy once
skaffold run

# Clean up
skaffold delete
```

**Features:**
- Uses existing `docker-compose.yml`
- No Kubernetes required
- Port 3000 forwarded to API Gateway
- Fast rebuilds with BuildKit

---

### 2. Local Kubernetes (`local-k8s`)

Use with Docker Desktop Kubernetes or minikube.

```bash
# Start with hot reload
skaffold dev -p local-k8s

# Deploy once
skaffold run -p local-k8s

# Clean up
skaffold delete -p local-k8s
```

**Features:**
- Deploys to local Kubernetes
- File sync for TypeScript hot reload
- Port forwarding: 3000 (API Gateway), 3001 (User Service)
- Images stay local (no push to registry)

**Setup:**
```bash
# Enable Kubernetes in Docker Desktop
# Or start minikube
minikube start

# Verify
kubectl get nodes
```

---

### 3. EKS Development (`eks-dev`)

Use for development on AWS EKS cluster.

```bash
# Configure kubectl for EKS
aws eks update-kubeconfig --region us-west-2 --name dynaclaimz-production-eks

# Start development
skaffold dev -p eks-dev

# Or deploy and exit
skaffold run -p eks-dev

# Clean up
skaffold delete -p eks-dev
```

**Features:**
- Builds and pushes to ECR
- Auto-login to ECR before build
- Tags with git commit SHA
- Deploys all manifests including db-init-job
- Port forwards API Gateway to localhost:3000

**Before first use:**
```bash
# Ensure Terraform infrastructure is deployed
cd terraform
terraform apply

# Skaffold will automatically:
# - Get your AWS account ID
# - Get ECR registry from Terraform outputs
# - Login to ECR
# - Tag images appropriately
```

---

### 4. EKS Production (`eks-prod`)

Use for production deployments to EKS.

```bash
# Deploy to production
skaffold run -p eks-prod

# Clean up (careful!)
skaffold delete -p eks-prod
```

**Features:**
- Production-optimized builds (`NODE_ENV=production`)
- Tags with git tags (not commit SHAs)
- Pushes to ECR
- No file sync or hot reload
- Use `run` not `dev` for production

**Best Practice:**
```bash
# Tag your release
git tag -a v1.0.0 -m "Release 1.0.0"
git push origin v1.0.0

# Deploy with proper version tag
skaffold run -p eks-prod
```

---

## Common Commands

### Development Loop

```bash
# Watch and rebuild on file changes
skaffold dev -p local-k8s

# Ctrl+C to stop (cleans up automatically)
```

### One-time Deploy

```bash
# Build, push, deploy
skaffold run -p eks-dev

# Check what's deployed
kubectl get pods -n dynaclaimz
```

### Build Only

```bash
# Build images without deploying
skaffold build -p eks-dev

# Build and output image tags
skaffold build -p eks-dev --quiet
```

### Debugging

```bash
# Verbose output
skaffold dev -p local-k8s -v info

# Debug mode
skaffold dev -p local-k8s -v debug

# Dry run (show what would happen)
skaffold run -p eks-dev --dry-run
```

### Logs

```bash
# Stream logs during dev
skaffold dev -p local-k8s  # logs automatically shown

# View logs of deployed services
kubectl logs -n dynaclaimz deployment/user-service -f
```

---

## Image Tagging Strategy

| Profile | Tag Strategy | Example |
|---------|-------------|---------|
| `local-k8s` | No tag (local only) | `dynaclaimz/user-service:latest` |
| `eks-dev` | Git commit SHA | `123456.dkr.ecr.us-west-2.amazonaws.com/dynaclaimz/user-service:abc1234` |
| `eks-prod` | Git tags | `123456.dkr.ecr.us-west-2.amazonaws.com/dynaclaimz/user-service:v1.0.0` |

---

## File Sync (Hot Reload)

In `local-k8s` profile, TypeScript files sync to pods without rebuild:

```yaml
sync:
  manual:
  - src: "src/**/*.ts"
    dest: /app/src
```

**How it works:**
1. Edit `services/user-service/src/routes/auth.routes.ts`
2. Skaffold detects change
3. File synced to pod
4. `ts-node-dev` restarts service automatically
5. Changes live in ~2 seconds

---

## CI/CD Integration

### GitHub Actions Example

```yaml
- name: Deploy to EKS
  run: |
    aws eks update-kubeconfig --region us-west-2 --name dynaclaimz-production-eks
    skaffold run -p eks-prod --default-repo=${{ secrets.ECR_REGISTRY }}
```

### Manual ECR Override

```bash
# Override ECR registry
skaffold run -p eks-dev --default-repo=123456789.dkr.ecr.us-west-2.amazonaws.com/dynaclaimz
```

---

## Troubleshooting

### ECR Login Fails

```bash
# Manually login
aws ecr get-login-password --region us-west-2 | \
  docker login --username AWS --password-stdin 123456.dkr.ecr.us-west-2.amazonaws.com
```

### Wrong Kubernetes Context

```bash
# Check current context
kubectl config current-context

# Switch to EKS
aws eks update-kubeconfig --region us-west-2 --name dynaclaimz-production-eks

# Or switch to Docker Desktop
kubectl config use-context docker-desktop
```

### Port Already in Use

```bash
# Find and kill process on port 3000
lsof -ti:3000 | xargs kill -9
```

### Skaffold Cache Issues

```bash
# Clear Skaffold cache
rm -rf ~/.skaffold/cache

# Force rebuild
skaffold dev -p local-k8s --cache-artifacts=false
```

---

## Comparison with Shell Scripts

| Task | Skaffold | Shell Scripts |
|------|----------|---------------|
| Local dev | `skaffold dev` | `docker compose up` |
| Build images | `skaffold build` | `./scripts/build-and-push.sh` |
| Deploy to EKS | `skaffold run -p eks-prod` | `./scripts/deploy-to-eks.sh` |
| Hot reload | ✅ Built-in | ❌ Manual restart |
| CI/CD | ✅ Can use | ✅ Preferred |
| Port forwarding | ✅ Automatic | ❌ Manual `kubectl port-forward` |
| Learning curve | Medium | Low |

**Recommendation:** Use Skaffold for daily development, shell scripts for CI/CD and production deployments.

---

## Next Steps

1. **Try local development:**
   ```bash
   skaffold dev -p local-k8s
   ```

2. **Deploy to EKS:**
   ```bash
   # After running terraform apply
   skaffold run -p eks-dev
   ```

3. **Set up CI/CD:**
   - Use shell scripts in GitHub Actions/Jenkins
   - Or integrate Skaffold into your pipeline

4. **Customize:**
   - Edit `skaffold.yaml` to add file sync patterns
   - Add custom build args
   - Configure additional port forwards
