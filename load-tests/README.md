# Load Testing with Locust

This directory contains Locust load testing scripts for the DynaClaimz SaaS API.

## Overview

The load testing simulates insurance agents/professionals performing typical workflow tasks:

1. **Quote Agents (50%)**: Create quotes, convert to policies, manage policies
2. **Claims Agents (50%)**: File claims, update claim status, review claims

**Note**: All simulated users are insurance professionals acting on behalf of customers, not end customers themselves.

## Project Structure

```
load-tests/
├── locustfile.py          # Entry point - HttpUser classes and initialization
├── config.py              # Configuration constants (GROUP_A_PERCENTAGE, rotation settings)
├── behaviors/             # Behavior classes (TaskSet implementations)
│   ├── __init__.py        # Module exports
│   ├── base.py            # BaseAgentBehavior (shared authentication & rotation)
│   ├── quote_behavior.py  # QuoteManagementBehavior (4 tasks)
│   └── claims_behavior.py # ClaimsManagementBehavior (3 tasks)
├── utils/                 # Helper functions and decorators
│   ├── __init__.py        # Module exports
│   └── helpers.py         # get_user_group(), get_user_agent(), @with_rotation
├── Dockerfile             # Container image definition
└── README.md              # This file
```

This modular structure provides:
- **Separation of Concerns**: Each behavior in its own file
- **Maintainability**: Easy to find and modify specific workflows
- **Extensibility**: Simple to add new agent types
- **Testability**: Individual modules can be unit tested
- **Clean Entry Point**: locustfile.py is ~130 lines vs ~685 lines monolithic

## Features

- **Realistic Workflows**: Multi-step user journeys that mirror actual usage patterns
- **User Segmentation**: Organization-based A/B grouping (configurable percentage split)
- **User Rotation**: Automatic re-login as different users after 5-15 tasks for variety
- **Random Delays**: Sleep statements (1-7 seconds) between steps for realistic timing
- **User-Agent Headers**: Group-A and Group-B identification in all requests
- **Dynamic Data**: Loads existing organizations and users on startup
- **Weighted Distribution**: Quote and Claims agents at 50/50 split
- **Configurable Wait Times**: Realistic delays between task executions
- **Decorator Pattern**: Clean @with_rotation decorator for automatic user rotation
- **Comprehensive Coverage**: Tests all major API endpoints

## Building and Deploying

### Build and Push to ECR

Use the provided script to build and push the Locust Docker image:

```bash
cd load-tests

# Build and push (auto-detects AWS account ID)
./build-and-push.sh

# With custom region
./build-and-push.sh us-west-2

# Build, push, and restart Kubernetes deployment
./build-and-push.sh us-east-1 --restart

# Specify all parameters
./build-and-push.sh us-east-1 446130280781 --restart
```

**Script features:**
- Auto-detects AWS account ID if not provided
- Builds for `linux/amd64` (EKS compatibility)
- Tags with both `latest` and git commit SHA
- Pushes to ECR repository: `dynaclaimz/locust`
- Optional `--restart` flag to automatically restart Kubernetes deployment
- Color-coded output for easy monitoring
- Validates kubectl availability before attempting restart

**Manual deployment steps:**
```bash
# After pushing image
kubectl rollout restart deployment -n load-testing

# Check rollout status
kubectl rollout status deployment/locust-master -n load-testing
kubectl rollout status deployment/locust-worker -n load-testing

# View pods
kubectl get pods -n load-testing
```

## Running Load Tests

### Using Docker Compose

```bash
# Start all services including Locust
docker compose up -d

# Access Locust web UI
open http://localhost:8089
```

### Standalone Locust

```bash
# Install dependencies
pip install locust requests

# Run Locust
cd load-tests
locust --host=http://localhost:3000
```

### Running Headless Tests

```bash
# Run with specific user count and spawn rate
locust --host=http://localhost:3000 \
  --headless \
  --users 50 \
  --spawn-rate 5 \
  --run-time 5m
```

## Configuration

### User Segmentation (A/B Testing)

Control the percentage split between Group A and Group B:

```python
# In locustfile.py (lines 25-28)
GROUP_A_PERCENTAGE = 50  # 50% Group A, 50% Group B

MIN_TASKS_BEFORE_ROTATION = 5   # Minimum tasks before user rotation
MAX_TASKS_BEFORE_ROTATION = 15  # Maximum tasks before user rotation
```

- **GROUP_A_PERCENTAGE**: Percentage of organizations in Group A (0-100)
- All users in the same organization get the same group assignment (hash-based)
- User-Agent headers identify group: "DynaClaimz-API-Client/2.1.0 (Group-A/B)"
- Set rotation min/max to 0 to disable automatic user rotation

### User Distribution

Edit `locustfile.py` to adjust user type weights:

```python
class QuoteAgent(HttpUser):
    """Agent focused on quote and policy management"""
    weight = 50  # 50% of traffic

class ClaimsAgent(HttpUser):
    """Agent focused on claims processing"""
    weight = 50  # 50% of traffic
```

### Wait Times

Adjust wait times between tasks:

```python
wait_time = between(2, 5)  # Wait 2-5 seconds between tasks
```

## Test Scenarios

### Quote Agent Journey (4 Tasks)
1. **Create Quote** (weight: 5)
   - Calculate premium → Create quote → View details
   - Random sleep 1-7 seconds between steps
2. **Convert Quote to Policy** (weight: 3)
   - Find active quote → Convert → View policy details
3. **Review Quotes Workflow** (weight: 3)
   - Browse quotes → View details → Check history
4. **Update Policy Status** (weight: 2)
   - Find policy → View details → Update status

### Claims Agent Journey (3 Tasks)
1. **File Claim** (weight: 5)
   - Find active policy → File claim → View details
   - Random sleep 1-7 seconds between steps
2. **Process Claim** (weight: 3)
   - Find submitted/under_review claim → Mark under review → Approve/deny → View history
3. **Review Claims Workflow** (weight: 2)
   - Browse claims → View details → Check history

### User Rotation Feature
- Each HttpUser picks a random user on startup
- After 5-15 tasks (random threshold), automatically rotates to a different user
- Ensures good distribution across users and organizations over time
- Logs rotation events for monitoring

## Metrics

Locust provides the following metrics:

- **Request Count**: Total number of requests
- **Failure Rate**: Percentage of failed requests
- **Response Times**: Min, median, 95th percentile, max
- **Requests per Second**: Throughput
- **Users**: Number of simulated users

## Data Initialization

The script automatically loads data on startup from open (unauthenticated) backstage endpoints:

1. **Fetches all organizations** from `/api/v1/organizations` (no auth required)
2. **Fetches all users** from `/api/v1/users` (no auth required)
3. **Stores user credentials** with default password `password123` (all seeded users)
4. **Uses actual seeded data** during load testing for realistic scenarios

Note: Organization and user CRUD endpoints are intentionally open for backstage operations in this demo application.

## Example Commands

```bash
# Run 100 users, spawn 10 per second, run for 10 minutes
locust --host=http://localhost:3000 \
  --headless \
  --users 100 \
  --spawn-rate 10 \
  --run-time 10m \
  --html=report.html

# Run with CSV output
locust --host=http://localhost:3000 \
  --headless \
  --users 50 \
  --spawn-rate 5 \
  --run-time 5m \
  --csv=results

# Run distributed (master)
locust --host=http://localhost:3000 --master

# Run distributed (worker)
locust --host=http://localhost:3000 --worker --master-host=localhost
```

## Troubleshooting

### "Failed to fetch organizations/users"
- Ensure the API is running and accessible
- Check that the user-service is healthy: `docker compose ps`
- Verify the endpoints are accessible: `curl http://localhost:3000/api/v1/organizations`
- Note: These are backstage endpoints with no authentication required

### High Failure Rates
- Check API logs for errors: `docker compose logs -f api-gateway user-service`
- Reduce spawn rate or user count
- Increase wait times between requests
- Verify database can handle the load
- Ensure seeded users exist with password `password123`

### Connection Errors
- Ensure all services are running: `docker compose ps`
- Check API gateway is accessible: `curl http://localhost:3000/`
- Verify network connectivity between containers

## Best Practices

1. **Start Small**: Begin with 10-20 users and increase gradually
2. **Monitor Resources**: Watch CPU, memory, and database connections
3. **Realistic Timing**: Use appropriate wait times to simulate real users
4. **Data Cleanup**: Reset database between long test runs
5. **Distributed Testing**: Use multiple Locust workers for high load
6. **Save Reports**: Export HTML/CSV reports for analysis

## Integration with Observability

This load testing generates realistic distributed traces across:

- **user-service**: Authentication, organization management, user data
- **quotes-service**: Quote creation, premium calculation, quote conversion
- **policy-service**: Policy creation, status updates
- **claims-service**: Claim filing, status workflow

Perfect for demonstrating:
- **Service-to-service calls** (e.g., quotes → policy conversion)
- **Multi-step agent workflows** with realistic timing delays
- **Quote → Policy → Claim lifecycle** with temporal separation
- **User segmentation** via Group A/B User-Agent headers in trace data
- **User variety** through automatic rotation across organizations
- **Error handling and validation**
- **Performance under load** with realistic concurrent users
- **Trace visualization** in APM tools (Dynatrace, etc.)

### Observability Features
- **User-Agent Headers**: Every request includes group identifier for filtering traces
- **Organization-based Grouping**: All users in same org have same group (A or B)
- **User Rotation**: Traces show variety of users/orgs over time (5-15 task rotation)
- **Realistic Timing**: Sleep delays (1-7s) create natural trace spans
- **Weighted Tasks**: Higher weight tasks appear more frequently in traces
