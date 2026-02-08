# Dynatrace Lookup Data Sync Job

This Kubernetes job exports user and organization data from PostgreSQL to Dynatrace Grail as lookup tables, enabling you to enrich observability data with business context.

## Overview

The job performs the following steps:
1. Connects to the PostgreSQL `user_db` database
2. Exports `User` and `Organization` tables to CSV format
3. Uploads the CSV files to Dynatrace Grail as lookup tables
4. Makes the data available for DQL queries

## Prerequisites

### 1. Dynatrace Configuration

#### Create API Token

1. Log into your Dynatrace environment
2. Navigate to **Settings → Access tokens**
3. Click **Generate new token**
4. Configure the token:
   - **Name**: `Lookup Data Sync`
   - **Scopes**:
     - ✓ `storage:files:write`
     - ✓ `storage:files:delete` (optional, for cleanup)
5. Click **Generate token**
6. **Copy the token immediately** (it won't be shown again)

#### Configure Lookup Permissions

During the preview phase, you need to manually add permissions:

1. Navigate to **Account Management → Identity & access management → Policy management**
2. Click **Create policy**
3. Add the following statements:
   ```
   ALLOW storage:files:read WHERE storage:file-path startsWith "/lookups/";
   ALLOW storage:files:write WHERE storage:file-path startsWith "/lookups/";
   ALLOW storage:files:delete WHERE storage:file-path startsWith "/lookups/";
   ```
4. Assign the policy to your user group or the API token

### 2. Kubernetes Configuration

#### Create Dynatrace Secrets

```bash
# Copy the example file
cp k8s/jobs/lookup-sync/dynatrace-secrets.yaml.example k8s/jobs/lookup-sync/dynatrace-secrets.yaml

# Edit with your actual credentials
# DYNATRACE_URL: https://your-environment.live.dynatrace.com
# DYNATRACE_API_TOKEN: dt0c01.YOUR_TOKEN_HERE...
vim k8s/jobs/lookup-sync/dynatrace-secrets.yaml

# Apply the secret
kubectl apply -f k8s/jobs/lookup-sync/dynatrace-secrets.yaml
```

#### Deploy ConfigMap and Job

```bash
# Deploy the script as a ConfigMap
kubectl apply -f k8s/jobs/lookup-sync/lookup-sync-configmap.yaml

# Run the job
kubectl apply -f k8s/jobs/lookup-sync/lookup-sync-job.yaml
```

## Usage

### Run the Job Manually

```bash
# Delete any previous job
kubectl delete job dynatrace-lookup-sync -n dynaclaimz

# Create new job
kubectl apply -f k8s/jobs/lookup-sync/lookup-sync-job.yaml

# Watch job progress
kubectl logs -f job/dynatrace-lookup-sync -n dynaclaimz
```

### Check Job Status

```bash
# View job status
kubectl get jobs -n dynaclaimz

# View job logs
kubectl logs job/dynatrace-lookup-sync -n dynaclaimz

# View pod details if job fails
kubectl describe job dynatrace-lookup-sync -n dynaclaimz
```

## Lookup Tables Created

The job creates two lookup tables in Dynatrace Grail:

### 1. Users Lookup (`/lookups/dynaclaimz/users`)

| Field | Type | Description |
|-------|------|-------------|
| `id` | UUID | User ID (primary key) |
| `email` | string | User email address |
| `firstName` | string | User first name |
| `lastName` | string | User last name |
| `role` | string | User role (admin/agent/customer) |
| `organizationId` | UUID | Organization ID (foreign key) |
| `createdAt` | timestamp | User creation timestamp |

### 2. Organizations Lookup (`/lookups/dynaclaimz/organizations`)

| Field | Type | Description |
|-------|------|-------------|
| `id` | UUID | Organization ID (primary key) |
| `name` | string | Organization name |
| `createdAt` | timestamp | Organization creation timestamp |

## Using Lookup Data in DQL Queries

### View Lookup Data

```dql
// List all stored lookup files
fetch dt.system.files

// View users lookup data
load "/lookups/dynaclaimz/users"

// View organizations lookup data
load "/lookups/dynaclaimz/organizations"
```

### Enrich Logs with User Information

```dql
fetch logs
| filter contains(content, "user")
| parse content, "LD 'user':SPACE? PUNCT 'id':SPACE? PUNCT LD:userId PUNCT"
| lookup [ load "/lookups/dynaclaimz/users" ],
    sourcefield: userId,
    lookupField: id,
    prefix: "user."
| fields timestamp, content, user.email, user.firstName, user.lastName, user.role
```

### Enrich Logs with Organization Information

```dql
fetch logs
| filter contains(content, "organizationId")
| parse content, "LD 'organizationId':SPACE? PUNCT LD:orgId PUNCT"
| lookup [ load "/lookups/dynaclaimz/organizations" ],
    sourcefield: orgId,
    lookupField: id,
    prefix: "org."
| fields timestamp, content, org.name, org.createdAt
```

### Join Users and Organizations

```dql
fetch logs
| filter contains(content, "user")
| parse content, "LD 'userId':SPACE? PUNCT LD:userId PUNCT"
| lookup [ load "/lookups/dynaclaimz/users" ],
    sourcefield: userId,
    lookupField: id,
    prefix: "user."
| lookup [ load "/lookups/dynaclaimz/organizations" ],
    sourcefield: user.organizationId,
    lookupField: id,
    prefix: "org."
| fields timestamp, user.email, user.role, org.name
```

### Analyze Claims by User Role

```dql
fetch logs
| filter matchesValue(dt.source_entity, "PROCESS_GROUP_INSTANCE-*")
| filter contains(content, "claim")
| parse content, "LD 'userId':SPACE? PUNCT LD:userId PUNCT"
| lookup [ load "/lookups/dynaclaimz/users" ],
    sourcefield: userId,
    lookupField: id,
    prefix: "user."
| summarize count(), by: {user.role}
```

## Scheduling Regular Syncs

To keep lookup data up-to-date, you can create a CronJob:

```yaml
apiVersion: batch/v1
kind: CronJob
metadata:
  name: dynatrace-lookup-sync
  namespace: dynaclaimz
spec:
  # Run every 6 hours
  schedule: "0 */6 * * *"
  jobTemplate:
    spec:
      template:
        # ... same spec as lookup-sync-job.yaml
```

## Troubleshooting

### Job Fails with Database Connection Error

```bash
# Check if database secret is configured correctly
kubectl get secret app-secrets -n dynaclaimz -o yaml

# Verify database connectivity
kubectl run -it --rm debug --image=postgres:15 --restart=Never -- \
  psql "$USER_DB_URL"
```

### Job Fails with Dynatrace API Error

```bash
# Check Dynatrace secret
kubectl get secret dynatrace-secrets -n dynaclaimz -o yaml

# Verify API token has correct permissions
# Go to Dynatrace UI → Settings → Access tokens
# Check that token has storage:files:write scope

# Test API endpoint manually
curl -X GET \
  "https://your-environment.live.dynatrace.com/api/v2/files/dt.system.files" \
  -H "Authorization: Api-Token YOUR_TOKEN"
```

### Check API Response Details

```bash
# View full job logs including API responses
kubectl logs job/dynatrace-lookup-sync -n dynaclaimz | grep -A 10 "Response:"
```

### Verify Uploaded Files

```bash
# Use DQL in Dynatrace to check uploaded files
fetch dt.system.files
| filter startsWith(path, "/lookups/dynaclaimz")
| fields path, size, lastModified
```

## File Size Limits

- **Maximum file size**: 100 MB
- **Maximum number of files**: 100 (during preview)
- **Maximum fields per file**: 128

Current exports are typically:
- Users: ~50KB for 1000 users
- Organizations: ~5KB for 100 organizations

## API Documentation

- [Lookup Data in Grail](https://docs.dynatrace.com/docs/platform/grail/lookup-data)
- [Resource Store API](https://docs.dynatrace.com/docs/dynatrace-api/environment-api)
- [Dynatrace Query Language (DQL)](https://docs.dynatrace.com/docs/platform/grail/dynatrace-query-language)

## Job Cleanup

### Automatic Cleanup

The one-time job automatically deletes itself **2 hours** after completion (success or failure) via `ttlSecondsAfterFinished`. This keeps your cluster clean without manual intervention.

```yaml
ttlSecondsAfterFinished: 7200  # 2 hours
```

The CronJob keeps the last 3 successful and 1 failed job for debugging:

```yaml
successfulJobsHistoryLimit: 3
failedJobsHistoryLimit: 1
```

### Manual Cleanup

If you need immediate cleanup:

```bash
# Delete a specific job run
kubectl delete job dynatrace-lookup-sync -n dynaclaimz

# Delete all completed jobs
kubectl delete job -n dynaclaimz --field-selector status.successful=1

# Delete all failed jobs
kubectl delete job -n dynaclaimz --field-selector status.failed=1

# View job history (from CronJob)
kubectl get jobs -n dynaclaimz -l app=dynatrace-lookup-sync
```

### Delete Lookup Data from Dynatrace

To remove the lookup files from Dynatrace Grail:

```bash
# Via API
curl -X DELETE \
  "https://your-environment.live.dynatrace.com/api/v2/files/lookups/dynaclaimz/users" \
  -H "Authorization: Api-Token YOUR_TOKEN"

curl -X DELETE \
  "https://your-environment.live.dynatrace.com/api/v2/files/lookups/dynaclaimz/organizations" \
  -H "Authorization: Api-Token YOUR_TOKEN"

# Via DQL (check files exist)
fetch dt.system.files
| filter startsWith(path, "/lookups/dynaclaimz")
```
