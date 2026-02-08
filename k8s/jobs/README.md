# Kubernetes Jobs

This directory contains one-time and scheduled jobs that run in the DynaClaimz Kubernetes cluster.

## Available Jobs

### [database](./database/)
Database initialization and seeding jobs for setting up PostgreSQL schemas and sample data.

**What it does:**
- `db-init-job.yaml`: Runs Prisma migrations to initialize database schemas
- `db-seed-job.yaml`: Seeds databases with sample data (dev/staging only)

**Run manually:**
```bash
# Initialize databases
kubectl apply -f database/db-init-job.yaml
kubectl wait --for=condition=complete --timeout=300s job/db-init -n dynaclaimz

# Seed with sample data (optional)
kubectl apply -f database/db-seed-job.yaml
```

### [lookup-sync](./lookup-sync/)
Exports user and organization data from PostgreSQL to Dynatrace Grail as lookup tables. This enables enriching observability data with business context in DQL queries.

**What it does:**
- Connects to `user_db` PostgreSQL database
- Exports `User` and `Organization` tables to CSV
- Uploads to Dynatrace Grail as `/lookups/dynaclaimz/users` and `/lookups/dynaclaimz/organizations`

**Run manually:**
```bash
kubectl apply -f lookup-sync/lookup-sync-configmap.yaml
kubectl apply -f lookup-sync/lookup-sync-job.yaml
```

**Schedule with CronJob:**
```bash
kubectl apply -f lookup-sync/lookup-sync-cronjob.yaml
```

See [lookup-sync/README.md](./lookup-sync/README.md) for full documentation.

## Adding New Jobs

When adding a new job, create a subdirectory with all related files:

```
k8s/jobs/
├── your-job-name/
│   ├── README.md              # Documentation
│   ├── job.yaml               # One-time job
│   ├── cronjob.yaml           # Scheduled job (optional)
│   ├── configmap.yaml         # Scripts or config
│   ├── secrets.yaml.example   # Secret template
│   └── script.py              # Job script
└── README.md                  # This file
```

## Job Naming Conventions

- **Job name**: `your-job-name` (lowercase with hyphens)
- **Files**: `your-job-name-*.yaml` for K8s resources
- **ConfigMap**: Include inline scripts or mount from ConfigMap
- **Secrets**: Always provide `.example` file with documentation
