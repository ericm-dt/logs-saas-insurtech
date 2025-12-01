# Database Seeding Strategy

## Overview
Simplified seeding approach that combines static foundation data (organizations & users) with dynamic synthetic load generation for realistic observability scenarios.

## Architecture Decision

### ✅ What We Seed (Static Foundation)
**Auth/User Service Only** - Organizations and Users
- Provides stable tenant and user identities
- Enables immediate load testing without waiting for user registration
- Supports multi-tenant isolation testing

### 🔄 What We Generate (Dynamic via Load Testing)
**Policy, Claims, Quotes Services** - All business entities
- Created through actual API calls during load generation
- Generates realistic distributed traces
- Creates time-series data with real timestamps
- Exercises actual workflow endpoints

## Why This Approach?

### Benefits of Synthetic Data Generation

1. **Realistic Observability Data**
   - Full distributed traces from API gateway → auth → quotes → policy → claims
   - Real HTTP metrics (latency, errors, throughput)
   - Actual database query patterns and performance metrics
   - Service-to-service communication traces

2. **Temporal Realism**
   - Data created over time, not all at once
   - Realistic creation timestamps
   - Natural workflow progression (quote created → converted → claim filed)
   - Time-based patterns visible in metrics

3. **Workflow Validation**
   - Tests actual endpoint implementations
   - Validates cross-service communication
   - Exercises authentication/authorization
   - Tests error handling and retry logic

4. **Simplified Maintenance**
   - No cross-database seeding complexity
   - No dependency ordering (policy needs users, claims need policies)
   - Easy to reset - just reseed auth and regenerate load

5. **Flexibility**
   - Control data volume through load generation parameters
   - Adjust distribution (more claims, fewer policies, etc.)
   - Simulate different traffic patterns (spikes, steady-state, etc.)
   - Test different tenant behaviors

---

## Implementation

### 1. Auth Service Seeding ✅
**File**: `services/auth-service/prisma/seed.ts`

**What it creates**:
- 30 organizations (insurance companies)
- 61 users (1-3 per organization)
- Role distribution: ADMIN, AGENT, CUSTOMER
- Realistic user data: names, emails, addresses, phones

**Run command**:
```bash
docker exec -it logs-saas-uc1-user-service-1 npm run seed
```

**Output**:
```
✅ Seed completed successfully!
Created 30 organizations
Created 61 users
Default password for all users: password123
```

---

### 2. Load Generation (Replaces Seeding)

**Recommended Tool**: [k6](https://k6.io/) for load testing with observability

**Sample Load Script** (`load-tests/realistic-workflows.js`):

```javascript
import http from 'k6/http';
import { check, sleep } from 'k6';
import { SharedArray } from 'k6/data';

// Load seeded users from API or file
const users = new SharedArray('users', function() {
  // Fetch from auth API after seeding
  const response = http.get('http://localhost:3001/api/users/all');
  return JSON.parse(response.body);
});

export const options = {
  stages: [
    { duration: '2m', target: 10 },  // Ramp up to 10 VUs
    { duration: '5m', target: 10 },  // Stay at 10 VUs
    { duration: '2m', target: 0 },   // Ramp down
  ],
};

export default function() {
  const user = users[Math.floor(Math.random() * users.length)];
  
  // 1. Login to get JWT
  const loginRes = http.post('http://localhost:3000/api/v1/auth/login', {
    email: user.email,
    password: 'password123',
  });
  const token = loginRes.json('data.token');
  
  const headers = {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
  
  // 2. Create a quote (40% of requests)
  if (Math.random() < 0.4) {
    const quoteRes = http.post('http://localhost:3000/api/v1/quotes', 
      JSON.stringify({
        type: ['AUTO', 'HOME', 'LIFE'][Math.floor(Math.random() * 3)],
        coverageAmount: Math.floor(Math.random() * 400000) + 100000,
      }),
      { headers }
    );
    
    check(quoteRes, { 'quote created': (r) => r.status === 201 });
    
    // 3. Convert quote to policy (30% of quotes)
    if (Math.random() < 0.3) {
      const quoteId = quoteRes.json('data.id');
      sleep(1); // Simulate user decision time
      
      const policyRes = http.post(
        `http://localhost:3000/api/v1/quotes/${quoteId}/convert`,
        null,
        { headers }
      );
      
      check(policyRes, { 'policy created': (r) => r.status === 201 });
      
      // 4. File a claim (10% of policies)
      if (Math.random() < 0.1) {
        const policyId = policyRes.json('data.id');
        sleep(2);
        
        const claimRes = http.post(
          `http://localhost:3000/api/v1/policies/${policyId}/file-claim`,
          JSON.stringify({
            description: 'Accident claim',
            incidentDate: new Date().toISOString(),
            claimAmount: Math.floor(Math.random() * 50000) + 5000,
          }),
          { headers }
        );
        
        check(claimRes, { 'claim filed': (r) => r.status === 201 });
      }
    }
  }
  
  sleep(1);
}
```

**Run command**:
```bash
k6 run --vus 10 --duration 30s load-tests/realistic-workflows.js
```

---

### 3. Alternative: Custom Load Generator

**File**: `scripts/generate-load.ts`

```typescript
import axios from 'axios';

const API_BASE = 'http://localhost:3000/api/v1';

interface User {
  id: string;
  email: string;
  organizationId: string;
  role: string;
}

async function fetchSeededUsers(): Promise<User[]> {
  // In real scenario, export users from auth seed or query API
  // For now, use known credentials
  return [/* users from seed */];
}

async function login(email: string): Promise<string> {
  const res = await axios.post(`${API_BASE}/auth/login`, {
    email,
    password: 'password123',
  });
  return res.data.data.token;
}

async function createQuote(token: string) {
  const res = await axios.post(
    `${API_BASE}/quotes`,
    {
      type: ['AUTO', 'HOME', 'LIFE'][Math.floor(Math.random() * 3)],
      coverageAmount: Math.floor(Math.random() * 400000) + 100000,
    },
    { headers: { Authorization: `Bearer ${token}` } }
  );
  return res.data.data;
}

async function convertQuote(token: string, quoteId: string) {
  const res = await axios.post(
    `${API_BASE}/quotes/${quoteId}/convert`,
    {},
    { headers: { Authorization: `Bearer ${token}` } }
  );
  return res.data.data;
}

async function fileClaim(token: string, policyId: string) {
  const res = await axios.post(
    `${API_BASE}/policies/${policyId}/file-claim`,
    {
      description: 'Sample claim',
      incidentDate: new Date().toISOString(),
      claimAmount: Math.floor(Math.random() * 50000) + 5000,
    },
    { headers: { Authorization: `Bearer ${token}` } }
  );
  return res.data.data;
}

async function generateLoad() {
  const users = await fetchSeededUsers();
  
  console.log(`Starting load generation with ${users.length} users...`);
  
  for (let i = 0; i < 100; i++) {
    const user = users[Math.floor(Math.random() * users.length)];
    const token = await login(user.email);
    
    // Create quote
    const quote = await createQuote(token);
    console.log(`Created quote ${quote.id}`);
    
    // 30% chance to convert
    if (Math.random() < 0.3) {
      const policy = await convertQuote(token, quote.id);
      console.log(`Converted to policy ${policy.id}`);
      
      // 10% chance to file claim
      if (Math.random() < 0.1) {
        const claim = await fileClaim(token, policy.id);
        console.log(`Filed claim ${claim.id}`);
      }
    }
    
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  console.log('Load generation complete!');
}

generateLoad();
```

---

## Workflow Comparison

### Old Approach (Full Seeding)
```
1. Seed auth DB (30 orgs, 61 users)
2. Seed policy DB (query auth, create 150-300 policies)
   ❌ Cross-database dependencies
   ❌ No traces generated
   ❌ All created at same timestamp
3. Seed claims DB (query policies, create 100-200 claims)
   ❌ Complex orchestration
   ❌ No actual API validation
4. Seed quotes DB (query auth, create 150-300 quotes)
   ❌ Static data

Total: 900+ records, zero observability data
```

### New Approach (Seed + Generate)
```
1. Seed auth DB (30 orgs, 61 users)
   ✅ Foundation data only
   
2. Run load generator:
   - Login (auth-service) → JWT
   - Create quote (quotes-service) → Distributed trace
   - Convert quote (quotes→policy cross-service) → Full trace
   - File claim (policy→claims cross-service) → Full trace
   
   ✅ Real distributed traces
   ✅ Actual API validation
   ✅ Time-series metrics
   ✅ Workflow exercised end-to-end

Total: 60 users + dynamic data with full observability
```

---

## Data Volume Control

### Seed Once, Generate Multiple Times

```bash
# Initial setup (once)
docker compose up -d
docker exec -it logs-saas-uc1-user-service-1 npm run seed

# Generate small dataset
k6 run --vus 5 --duration 1m load-tests/workflows.js
# Result: ~50 quotes, ~15 policies, ~1-2 claims

# Generate larger dataset
k6 run --vus 20 --duration 5m load-tests/workflows.js
# Result: ~500 quotes, ~150 policies, ~15 claims

# Simulate spike traffic
k6 run --stage 1m:10,30s:50,1m:5 load-tests/workflows.js
# Result: Variable load with observable spike patterns
```

### Reset and Regenerate

```bash
# Clear all business data (keep users)
docker exec -it logs-saas-uc1-postgres-1 psql -U postgres -d policy_db -c "TRUNCATE \"Policy\" CASCADE;"
docker exec -it logs-saas-uc1-postgres-1 psql -U postgres -d claims_db -c "TRUNCATE \"Claim\" CASCADE;"
docker exec -it logs-saas-uc1-postgres-1 psql -U postgres -d quotes_db -c "TRUNCATE \"Quote\" CASCADE;"

# Regenerate with different patterns
k6 run --vus 10 --duration 3m load-tests/workflows.js
```

---

## Observability Benefits

### What You Get from Generated Load

1. **Distributed Traces**
   - Full request path: Gateway → Auth → Quotes → Policy → Claims
   - Service latency breakdown
   - Error propagation visibility
   - Cross-service correlation IDs

2. **Metrics Time-Series**
   - Request rate per endpoint
   - Error rate trends
   - Latency percentiles (p50, p95, p99)
   - Database query performance

3. **Logs with Context**
   - Correlated logs across services
   - Error stack traces from real failures
   - Business event logs (quote created, policy activated, claim filed)

4. **Real Behavior Patterns**
   - Multi-tenant isolation (different orgs making requests)
   - Role-based access patterns (ADMIN vs CUSTOMER behavior)
   - Workflow completion rates
   - Conversion funnels (quote → policy → claim)

---

## Execution Steps

### Quick Start

```bash
# 1. Start all services
docker compose up -d

# 2. Seed foundation data (30 orgs, 61 users)
docker exec -it logs-saas-uc1-user-service-1 npm run seed

# 3. Verify seed
docker exec -it logs-saas-uc1-postgres-1 psql -U postgres -d user_db -c \
  "SELECT COUNT(*) as orgs FROM \"Organization\";"
# Expected: 30

docker exec -it logs-saas-uc1-postgres-1 psql -U postgres -d user_db -c \
  "SELECT COUNT(*) as users FROM \"User\";"
# Expected: 61

# 4. Generate load (choose one):

# Option A: Manual API calls
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"margaret.davis@acme-insurance-co.com","password":"password123"}'

# Option B: k6 load test
k6 run load-tests/realistic-workflows.js

# Option C: Custom script
npm run load:generate

# 5. Check generated data
docker exec -it logs-saas-uc1-postgres-1 psql -U postgres -d quotes_db -c \
  "SELECT COUNT(*) FROM \"Quote\";"

docker exec -it logs-saas-uc1-postgres-1 psql -U postgres -d policy_db -c \
  "SELECT COUNT(*) FROM \"Policy\";"

docker exec -it logs-saas-uc1-postgres-1 psql -U postgres -d claims_db -c \
  "SELECT COUNT(*) FROM \"Claim\";"
```

---

## Next Steps for Load Generation

### 1. Create Load Test Script (TODO)
**File**: `load-tests/realistic-workflows.js`
- Implement k6 script with user journeys from `USER_JOURNEYS.md`
- Add scenario weights (40% quotes, 30% conversions, 10% claims)
- Include error scenarios (expired quotes, invalid claims)

### 2. Add Load Generator to Docker Compose (Optional)
```yaml
load-generator:
  image: grafana/k6:latest
  volumes:
    - ./load-tests:/scripts
  command: run --vus 10 --duration 5m /scripts/realistic-workflows.js
  depends_on:
    - api-gateway
    - user-service
```

### 3. Export Seeded Users for Load Tests
**File**: `services/auth-service/prisma/seed.ts` (modify)
```typescript
// After seeding, export users to JSON for load tests
const users = await prisma.user.findMany({
  select: { id: true, email: true, organizationId: true, role: true }
});
fs.writeFileSync('../../load-tests/seeded-users.json', JSON.stringify(users, null, 2));
```

### 4. Create Multiple Load Profiles
- `load-tests/steady-state.js` - Constant low traffic
- `load-tests/spike.js` - Sudden traffic spike
- `load-tests/soak.js` - Long-running test for memory leaks
- `load-tests/stress.js` - Find breaking point

---

## Summary

**Foundation Data (Seeded)**:
- ✅ 30 organizations
- ✅ 61 users (distributed across orgs with proper roles)

**Business Data (Generated)**:
- 🔄 Quotes - Created via `POST /api/v1/quotes`
- 🔄 Policies - Created via `POST /api/v1/quotes/:id/convert`
- 🔄 Claims - Created via `POST /api/v1/policies/:id/file-claim`

**Result**: Full observability stack with realistic traffic patterns, distributed traces, and time-series metrics - perfect for demonstrating monitoring/logging/tracing capabilities!

## Completed Work

### 1. Auth Service Seeding ✅
**File**: `services/auth-service/prisma/seed.ts`

**Features**:
- 30 realistic organization names (Acme Insurance, Guardian Life, SafetyFirst Insurance, etc.)
- 1-3 users per organization (total: 61 users created)
- Role distribution:
  - First user: ADMIN (OWNER role in org)
  - Second user: AGENT (ADMIN role in org)
  - Additional users: CUSTOMER or AGENT (MEMBER role in org)
- Realistic data generation:
  - Email: `firstname.lastname@orgslug.com`
  - Phone: `+1-555-XXXX-XXXX` format
  - Address: Random street, city, state, ZIP
  - DOB: Between 1970-2005
  - Password: `password123` (bcrypt hashed)

**Run Command**:
```bash
docker exec -it logs-saas-uc1-user-service-1 npm run seed
```

**Status**: ✅ **WORKING** - Successfully creates 30 orgs and 61 users

---

### 2. Policy Service Seeding ⏳
**File**: `services/policy-service/prisma/seed.ts`

**Features**:
- Queries auth database for all users via PostgreSQL client (`pg`)
- Creates 3-10 policies per organization
- Policy distribution:
  - 70% ACTIVE
  - 20% PENDING
  - 5% CANCELLED
  - 5% EXPIRED
- Policy types: AUTO, HOME, LIFE, HEALTH, BUSINESS
- Realistic coverage amounts based on type:
  - AUTO: $100k-$500k
  - HOME: $100k-$1M
  - LIFE: $100k-$2M
  - HEALTH: $10k-$100k
  - BUSINESS: $100k-$5M
- Premium calculation: `coverageAmount × 1.5% × typeMultiplier`
- Start date: Random date in past year
- End date: 1 year after start date
- Creates `PolicyStatusHistory` for non-PENDING policies

**Run Command**:
```bash
docker exec -it logs-saas-uc1-policy-service-1 npm run seed
```

**Status**: ⏳ **IN PROGRESS** - Code complete but needs auth database to be populated first

**Current Issue**: 
- Error: `relation "User" does not exist` when querying auth DB
- **Cause**: Auth service may not have pushed schema or seeded data yet
- **Solution**: Ensure auth service is running and has been seeded before running policy seed

---

## Remaining Work

### 3. Claims Service Seeding 📝
**File**: `services/claims-service/prisma/seed.ts` (NOT YET CREATED)

**Requirements**:
- Query policy database to get ACTIVE policies
- Create 0-2 claims per ACTIVE policy (not all policies should have claims)
- Claim status distribution:
  - 40% SUBMITTED
  - 30% UNDER_REVIEW
  - 20% APPROVED
  - 5% DENIED
  - 5% PAID
- Realistic claim amounts: 10%-80% of policy `coverageAmount`
- Approved amounts: 80%-100% of claim amount (for APPROVED status)
- Incident dates: Within policy coverage period (`startDate` to `endDate`)
- Denial reasons for DENIED claims
- Create `ClaimStatusHistory` with workflow progression:
  - SUBMITTED → UNDER_REVIEW → APPROVED/DENIED → PAID

**Expected Output**: ~100-200 claims total

**Pattern to Follow** (similar to policy-service):
```typescript
import { PrismaClient } from '@prisma/client';
import { Client } from 'pg';

const claimsPrisma = new PrismaClient();
const policyDbClient = new Client({
  connectionString: 'postgresql://postgres:postgres@postgres:5432/policy_db'
});

// Query policies from policy DB
const policies = await policyDbClient.query(`
  SELECT id, "userId", "organizationId", "coverageAmount", "startDate", "endDate"
  FROM "Policy"
  WHERE status = 'ACTIVE'
`);

// Create claims...
```

### 4. Quotes Service Seeding 📝
**File**: `services/quotes-service/prisma/seed.ts` (NOT YET CREATED)

**Requirements**:
- Query auth database for CUSTOMER users
- Create 2-5 quotes per CUSTOMER user
- Quote status distribution:
  - 60% ACTIVE (expires in future, within 30 days)
  - 20% CONVERTED (linked to policy - would need policy reference)
  - 15% EXPIRED (expires in past)
  - 5% REJECTED
- Quote types: AUTO, HOME, LIFE, HEALTH, BUSINESS (match policy types)
- Coverage amounts: Same realistic ranges as policies
- Premium calculation: Use same `calculatePremium()` logic
- Expiration: `expiresAt` = `createdAt` + 30 days
- Create `QuoteStatusHistory` for CONVERTED/EXPIRED/REJECTED quotes

**Expected Output**: ~150-300 quotes total

**Pattern to Follow**:
```typescript
import { PrismaClient } from '@prisma/client';
import { Client } from 'pg';

const quotesPrisma = new PrismaClient();
const authDbClient = new Client({
  connectionString: 'postgresql://postgres:postgres@postgres:5432/user_db'
});

// Query users from auth DB
const users = await authDbClient.query(`
  SELECT id, "organizationId", role
  FROM "User"
  WHERE role = 'CUSTOMER'
`);

// Create quotes...
```

---

## Execution Order

### Current Process (Manual)
1. **Start all services**:
   ```bash
   docker compose up -d
   ```

2. **Seed auth service** (FIRST - provides users and orgs):
   ```bash
   docker exec -it logs-saas-uc1-user-service-1 npm run seed
   ```
   **Output**: 30 organizations, 61 users

3. **Seed policy service** (SECOND - needs userIds from auth):
   ```bash
   docker exec -it logs-saas-uc1-policy-service-1 npm run seed
   ```
   **Expected**: ~150-300 policies

4. **Seed claims service** (THIRD - needs policyIds from policy service):
   ```bash
   docker exec -it logs-saas-uc1-claims-service-1 npm run seed
   ```
   **Expected**: ~100-200 claims

5. **Seed quotes service** (CAN RUN PARALLEL WITH POLICY - only needs userIds):
   ```bash
   docker exec -it logs-saas-uc1-quotes-service-1 npm run seed
   ```
   **Expected**: ~150-300 quotes

### Future: Automated Seeding on Startup

**Option A: Docker Compose Health Checks & Dependencies**
Modify `docker-compose.yml` to add seed commands to entrypoint:

```yaml
user-service:
  # ... existing config
  entrypoint: >
    sh -c "npx prisma db push --accept-data-loss && 
           npm run seed && 
           node dist/server.js"

policy-service:
  # ... existing config
  depends_on:
    postgres:
      condition: service_healthy
    user-service:
      condition: service_healthy  # Wait for user service to be ready
  entrypoint: >
    sh -c "npx prisma db push --accept-data-loss && 
           sleep 5 &&  # Wait for user seed to complete
           npm run seed && 
           node dist/server.js"
```

**Option B: Standalone Seed Orchestrator Service**
Create a new service that coordinates seeding across all databases:

```yaml
seed-orchestrator:
  build: ./services/seed-orchestrator
  depends_on:
    - user-service
    - policy-service
    - claims-service
    - quotes-service
  environment:
    USER_DB_URL: postgresql://postgres:postgres@postgres:5432/user_db
    POLICY_DB_URL: postgresql://postgres:postgres@postgres:5432/policy_db
    CLAIMS_DB_URL: postgresql://postgres:postgres@postgres:5432/claims_db
    QUOTES_DB_URL: postgresql://postgres:postgres@postgres:5432/quotes_db
  command: |
    sh -c "
      sleep 10  # Wait for all services to be healthy
      npm run seed:auth
      npm run seed:policy
      npm run seed:claims
      npm run seed:quotes
      echo 'All databases seeded successfully!'
      exit 0
    "
```

---

## Dependencies Added

### Auth Service
- `bcrypt` - Password hashing
- `@types/bcrypt` - TypeScript types
- `@types/node` - Node.js types
- `ts-node` - TypeScript execution

### Policy Service
- `pg` - PostgreSQL client for cross-database queries
- `@types/pg` - TypeScript types
- All dev dependencies installed in production image (for ts-node seeding)

### Claims Service (TODO)
- `pg` - PostgreSQL client
- `@types/pg` - TypeScript types

### Quotes Service (TODO)
- `pg` - PostgreSQL client
- `@types/pg` - TypeScript types

---

## Data Relationships

```
Organization (auth DB)
  ├── Users (auth DB)
  │   ├── Policies (policy DB) [via userId]
  │   │   └── Claims (claims DB) [via policyId]
  │   └── Quotes (quotes DB) [via userId]
  └── (All entities include organizationId for multi-tenancy)
```

**Cross-Database References**:
- Policy → User: `userId` (auth_db.User.id)
- Policy → Organization: `organizationId` (auth_db.Organization.id)
- Claim → Policy: `policyId` (policy_db.Policy.id)
- Claim → User: `userId` (auth_db.User.id)
- Quote → User: `userId` (auth_db.User.id)
- Quote → Organization: `organizationId` (auth_db.Organization.id)

**Note**: These are NOT foreign key constraints (microservices pattern) - references are maintained by application logic and seeding scripts.

---

## Verification Commands

### Check Auth Data
```bash
docker exec -it logs-saas-uc1-postgres-1 psql -U postgres -d user_db -c "SELECT COUNT(*) FROM \"Organization\";"
docker exec -it logs-saas-uc1-postgres-1 psql -U postgres -d user_db -c "SELECT COUNT(*) FROM \"User\";"
docker exec -it logs-saas-uc1-postgres-1 psql -U postgres -d user_db -c "SELECT name, (SELECT COUNT(*) FROM \"User\" WHERE \"organizationId\" = \"Organization\".id) as user_count FROM \"Organization\" ORDER BY name LIMIT 10;"
```

### Check Policy Data
```bash
docker exec -it logs-saas-uc1-postgres-1 psql -U postgres -d policy_db -c "SELECT COUNT(*) FROM \"Policy\";"
docker exec -it logs-saas-uc1-postgres-1 psql -U postgres -d policy_db -c "SELECT type, status, COUNT(*) FROM \"Policy\" GROUP BY type, status;"
```

### Check Claims Data (once seeded)
```bash
docker exec -it logs-saas-uc1-postgres-1 psql -U postgres -d claims_db -c "SELECT COUNT(*) FROM \"Claim\";"
docker exec -it logs-saas-uc1-postgres-1 psql -U postgres -d claims_db -c "SELECT status, COUNT(*) FROM \"Claim\" GROUP BY status;"
```

### Check Quotes Data (once seeded)
```bash
docker exec -it logs-saas-uc1-postgres-1 psql -U postgres -d quotes_db -c "SELECT COUNT(*) FROM \"Quote\";"
docker exec -it logs-saas-uc1-postgres-1 psql -U postgres -d quotes_db -c "SELECT status, COUNT(*) FROM \"Quote\" GROUP BY status;"
```

---

## Troubleshooting

### Issue: "relation 'User' does not exist"
**Cause**: Auth service hasn't pushed schema or seeded yet.

**Solution**:
```bash
# Check if user service is running
docker ps | grep user-service

# Check logs for schema push
docker logs logs-saas-uc1-user-service-1 | grep "prisma db push"

# Manually push schema if needed
docker exec -it logs-saas-uc1-user-service-1 npx prisma db push

# Then run seed
docker exec -it logs-saas-uc1-user-service-1 npm run seed
```

### Issue: "Cannot find module 'ts-node'"
**Cause**: Production image doesn't have devDependencies.

**Solution**: Modify Dockerfile to install ALL dependencies (not just production):
```dockerfile
# Instead of:
RUN npm ci --only=production

# Use:
RUN npm ci
```

### Issue: Seed runs on every container restart
**Current Behavior**: Seed scripts must be run manually.

**To Enable Auto-Seed**: Modify Dockerfile CMD:
```dockerfile
CMD npx prisma db push --accept-data-loss && npm run seed && node dist/server.js
```

**Warning**: This will clear and re-seed databases on every restart. Consider idempotent seeding or conditional seeding (check if data exists first).

---

## Next Steps

1. ✅ Complete policy service seeding (DONE - needs testing after auth seed)
2. 📝 Create claims service seed script (`services/claims-service/prisma/seed.ts`)
3. 📝 Create quotes service seed script (`services/quotes-service/prisma/seed.ts`)
4. 🔄 Test full seeding workflow end-to-end
5. 📊 Run verification commands to validate data counts and relationships
6. 🚀 Update docker-compose.yml for automatic seeding (optional)
7. 📚 Test USER_JOURNEYS.md scenarios with seeded data
8. 🔍 Create load testing scripts that use seeded users/policies/claims for observability demo

---

## Estimated Data Volumes

| Database | Table | Count | Notes |
|----------|-------|-------|-------|
| user_db | Organization | 30 | Insurance companies |
| user_db | User | 61 | 1-3 per org, various roles |
| policy_db | Policy | 150-300 | 3-10 per org, distributed to users |
| policy_db | PolicyStatusHistory | 120-240 | For non-PENDING policies |
| claims_db | Claim | 100-200 | 0-2 per ACTIVE policy |
| claims_db | ClaimStatusHistory | 200-600 | Workflow transitions |
| quotes_db | Quote | 150-300 | 2-5 per CUSTOMER user |
| quotes_db | QuoteStatusHistory | 90-180 | For CONVERTED/EXPIRED/REJECTED |

**Total**: ~900-1,800 records across 8 tables, 4 databases

This provides enough data to generate realistic distributed traces spanning multiple services and databases for observability demonstrations.
