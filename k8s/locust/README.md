# Locust Continuous Load Generator

This deploys Locust to generate **continuous realistic load** for observability data generation in the `load-testing` namespace.

## Purpose

**NOT for load testing** - This runs 24/7 to simulate real user traffic and generate:
- Application metrics (request rates, latencies, errors)
- Distributed tracing data
- Log aggregation patterns
- Database query patterns

## Architecture

- **Namespace**: `load-testing` (isolated from application)
- **Locust Master**: 1 replica - web UI and coordination
- **Locust Workers**: 5 replicas - generate continuous load
- **External Traffic**: Hits API Gateway via public LoadBalancer (simulates real users)
- **Service Type**: ClusterIP (access UI via kubectl port-forward)

## Deployment Steps

### 1. Build and Push Locust Image (included in Skaffold)

The Locust image with all your custom code (behaviors/, utils/, etc.) will be built and pushed automatically when you run Skaffold.

### 2. Create ConfigMap from Template

```bash
cd k8s/locust
cp configmap.yaml.template configmap.yaml
```

### 3. Get API Gateway LoadBalancer URL and Update ConfigMap

```bash
# Get the LB URL
LB_URL=$(kubectl get svc api-gateway -n dynaclaimz -o jsonpath='{.status.loadBalancer.ingress[0].hostname}')

# Update configmap.yaml with the actual URL
sed -i '' "s|YOUR_API_GATEWAY_LOADBALANCER_URL|$LB_URL|g" configmap.yaml
```

Or manually edit `configmap.yaml` and replace `YOUR_API_GATEWAY_LOADBALANCER_URL` with your LoadBalancer URL.

### 4. Deploy Locust

```bash
kubectl apply -f namespace.yaml
kubectl apply -f configmap.yaml
kubectl apply -f deployment.yaml
kubectl apply -f service.yaml
```

### 4. Access Locust Web UI

Since we use ClusterIP (no LoadBalancer cost), access via port-forward:

```bash
kubectl port-forward -n load-testing svc/locust-master 8089:8089
```

Then open in browser:
```
http://localhost:8089
```

## Starting Continuous Load

1. Open Locust web UI: `kubectl port-forward -n load-testing svc/locust-master 8089:8089`
2. Navigate to http://localhost:8089
3. **Recommended settings for continuous load**:
   - Number of users: **50-100** (moderate sustained load)
   - Spawn rate: **5 users/second** (gradual ramp-up)
4. Click "Start Swarming"
5. **Leave running 24/7** - Locust will continuously generate traffic

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

To adjust load generation capacity:

```bash
# Increase for higher load (more observability data)
kubectl scale deployment locust-worker -n load-testing --replicas=10

# Decrease for lower load (cost savings)
kubectl scale deployment locust-worker -n load-testing --replicas=3
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

- **Runs continuously 24/7** to generate observability data
- Locust hits the **external LoadBalancer**, simulating real internet traffic
- Generates realistic traffic patterns for metrics, traces, and logs
- Workers can be scaled independently to adjust load levels
- **Cost**: ~$36/month for 5 workers running continuously (vs ~$22/month for 3 workers)
- **LoadBalancer saved**: Using ClusterIP instead of LoadBalancer saves ~$16/month
- Access UI via port-forward when needed to monitor or adjust load levels
