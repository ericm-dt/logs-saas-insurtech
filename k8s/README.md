# Kubernetes Configuration

## Setup Instructions

### Secrets Configuration

The `secrets.yaml` file contains sensitive information and is not tracked in git.

To create your own secrets file:

1. Copy the template:
   ```bash
   cp secrets.yaml.template secrets.yaml
   ```

2. Edit `secrets.yaml` and replace the placeholder values:
   - `JWT_SECRET`: Strong random secret for JWT signing
   - Database URLs: Your PostgreSQL connection strings
   - `PUBLIC_URL`: Your LoadBalancer or ingress URL

3. Apply to cluster:
   ```bash
   kubectl apply -f secrets.yaml
   ```

### Production Deployment

For production, consider using:
- AWS Secrets Manager with External Secrets Operator
- HashiCorp Vault
- Sealed Secrets for encrypted secrets in git
