# DynaClaimz Azure Deployment

Azure infrastructure for DynaClaimz microservices platform using Terraform.

## Architecture

- **AKS (Azure Kubernetes Service)** - Managed Kubernetes cluster
- **Azure Database for PostgreSQL Flexible Server** - 4 databases (user_db, policy_db, claims_db, quotes_db)
- **Azure Container Registry (ACR)** - Private Docker registry
- **Virtual Network** - Private networking with subnets
- **Azure Key Vault** - Secure secret storage
- **Log Analytics** - Centralized logging and monitoring

## Prerequisites

1. **Azure CLI** installed and configured:
   ```bash
   az login
   az account set --subscription <subscription-id>
   ```

2. **Terraform** >= 1.0 installed

3. **kubectl** installed

## Quick Start

### 1. Initialize Terraform

```bash
cd terraform-azure
terraform init
```

### 2. Review Configuration

Edit `terraform.tfvars` if needed:
```bash
cp terraform.tfvars.example terraform.tfvars
# Edit terraform.tfvars with your preferences
```

### 3. Plan Deployment

```bash
terraform plan
```

### 4. Deploy Infrastructure

```bash
terraform apply
```

This will create:
- Resource group
- Virtual network with subnets
- AKS cluster (takes ~10-15 minutes)
- PostgreSQL Flexible Server with 4 databases
- Azure Container Registry
- Key Vault with database credentials
- Log Analytics workspace

### 5. Configure kubectl

```bash
az aks get-credentials --resource-group dynaclaimz-production-rg --name dynaclaimz-production-aks
kubectl get nodes
```

### 6. Login to ACR

```bash
az acr login --name dynaclaimzproductionacr
```

## Build and Push Images

```bash
# From project root
cd ..

# Get ACR login server
ACR_NAME=$(terraform -chdir=terraform-azure output -raw acr_login_server)

# Build and tag images
services=("api-gateway" "user-service" "policy-service" "claims-service" "quotes-service")

for service in "${services[@]}"; do
  docker build -t $ACR_NAME/$service:latest ./services/$service
  docker push $ACR_NAME/$service:latest
done
```

## Deploy to AKS

```bash
# Update Kubernetes manifests with ACR name
# Then apply
kubectl apply -f k8s/namespace.yaml
kubectl apply -f k8s/secrets.yaml
kubectl apply -f k8s/services/
kubectl apply -f k8s/deployments/
kubectl apply -f k8s/db-init-job.yaml
```

## Get Database Password

```bash
az keyvault secret show \
  --vault-name dynaclaimz-production-kv \
  --name postgres-admin-password \
  --query value -o tsv
```

## Monitoring

Access AKS monitoring:
```bash
az aks browse --resource-group dynaclaimz-production-rg --name dynaclaimz-production-aks
```

View logs in Azure Portal:
- Navigate to Log Analytics workspace
- Run queries on ContainerLogs table

## Cost Optimization

**Estimated Monthly Cost:**
- AKS cluster: ~$73/month (control plane)
- 3x Standard_D2s_v3 VMs: ~$140/month
- PostgreSQL B_Standard_B2s: ~$50/month
- ACR Basic: ~$5/month
- Storage & networking: ~$20/month
- **Total: ~$288/month**

**To reduce costs:**
- Use fewer nodes (min 2 for HA)
- Use smaller VM sizes (Standard_B2s)
- Use Dev/Test pricing if available
- Delete when not in use: `terraform destroy`

## Cleanup

```bash
terraform destroy
```

## Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `project_name` | Project name prefix | dynaclaimz |
| `environment` | Environment name | production |
| `location` | Azure region | eastus |
| `aks_version` | Kubernetes version | 1.28 |
| `node_count` | Number of AKS nodes | 3 |
| `node_vm_size` | VM size for nodes | Standard_D2s_v3 |
| `postgres_sku_name` | PostgreSQL SKU | B_Standard_B2s |
| `create_acr` | Create ACR registry | true |

## Outputs

After deployment, get outputs:
```bash
terraform output
terraform output -json > deployment-info.json
```

Key outputs:
- `configure_kubectl` - Command to configure kubectl
- `acr_login_command` - Command to login to ACR
- `postgres_fqdn` - Database server address
- `key_vault_name` - Key Vault for secrets

## Troubleshooting

**AKS permission issues:**
```bash
# Ensure you have proper RBAC role
az role assignment create --role "Azure Kubernetes Service Cluster User Role" \
  --assignee <your-email> --scope <aks-cluster-id>
```

**Can't connect to PostgreSQL:**
- Check firewall rules
- Verify private DNS zone link
- Ensure using SSL connection

**ACR pull errors:**
- Verify AKS has AcrPull role on ACR
- Check image names match ACR login server

## Security Notes

- PostgreSQL is in a private subnet (not publicly accessible)
- Database credentials stored in Azure Key Vault
- AKS uses managed identity for Azure resource access
- Network Security Groups control traffic flow
- Azure AD RBAC enabled for AKS access control
