# Locust Load Testing Deployment

This deploys Locust load testing framework to the `load-testing` namespace in your EKS cluster.

## Architecture

- **Namespace**: `load-testing` (isolated from application)
- **Locust Master**: 1 replica - web UI and coordination
- **Locust Workers**: 3 replicas - generate actual load
- **External Traffic**: Hits API Gateway via public LoadBalancer (simulates real users)

## Deployment Steps

### 1. Get API Gateway LoadBalancer URL

```bash
kubectl get svc api-gateway -n dynaclaimz -o jsonpath='{.status.loadBalancer.ingress[0].hostname}'
```

### 2. Update Deployment with LB URL

Edit `k8s/locust/deployment.yaml` and replace `API_GATEWAY_LB_URL` with the actual LoadBalancer hostname:

```yaml
- name: TARGET_HOST
  value: "http://a1234567890abcdef.us-west-2.elb.amazonaws.com"
```

### 3. Deploy Locust

```bash
kubectl apply -f k8s/locust/namespace.yaml
kubectl apply -f k8s/locust/configmap.yaml
kubectl apply -f k8s/locust/deployment.yaml
kubectl apply -f k8s/locust/service.yaml
```

### 4. Get Locust Web UI URL

```bash
kubectl get svc locust-master -n load-testing
```

Wait for the LoadBalancer to provision (2-3 minutes), then access:
```
http://<LOCUST_LB_HOSTNAME>:8089
```

## Running Tests

1. Open Locust web UI in your browser
2. Set number of users (e.g., 100)
3. Set spawn rate (e.g., 10 users/second)
4. Click "Start Swarming"

## Monitoring

```bash
# Watch pods
kubectl get pods -n load-testing -w

# View master logs
kubectl logs -n load-testing deployment/locust-master -f

# View worker logs
kubectl logs -n load-testing deployment/locust-worker -f

# Check resource usage
kubectl top pods -n load-testing
```

## Scaling Workers

To increase load generation capacity:

```bash
kubectl scale deployment locust-worker -n load-testing --replicas=5
```

## Test Scenarios

The `locustfile.py` includes:

- **User Registration/Login** - Authenticates and gets JWT token
- **Get Policies** (30% of requests)
- **Create Policy** (20% of requests)
- **Get Claims** (20% of requests)
- **Create Claim** (10% of requests)
- **Get Quotes** (10% of requests)
- **Health Check** (10% of requests)

## Clean Up

```bash
kubectl delete namespace load-testing
```

## Notes

- Locust hits the **external LoadBalancer**, simulating real internet traffic
- This tests the full stack including load balancer, ingress, and all services
- Workers can be scaled independently of the master
- Cost: ~$0.03/hour for 3 workers (t3.medium equivalent resources)
