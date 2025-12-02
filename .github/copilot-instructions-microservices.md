# Copilot Instructions for DynaClaimz Microservices

## Project Overview
A microservices-based Insurance SaaS platform with 5 independent services communicating via REST APIs. Each service has its own database, codebase, and can be deployed independently.

**Services**: API Gateway, User Service (auth + organizations), Policy Service, Claims Service, Quotes Service

## Architecture Overview

### Service Boundaries

**API Gateway (Port 3000)**
- Entry point for all client requests
- Routes to backend services
- Handles CORS, rate limiting (1000 requests/min), security headers
- No database
- Aggregates Swagger documentation from all services

**User Service (Port 3001)** - Built from auth-service directory
- User authentication & JWT management
- Organization management (multi-tenancy)
- Database: `user_db` (users, organizations tables)
- Exposes: `/api/auth/*` and `/api/organizations/*` endpoints

**Policy Service (Port 3003)**
- Policy management and status tracking
- Database: `policy_db` (policies, policy_status_history tables)
- Depends on: User Service (token validation)

**Claims Service (Port 3004)**
- Claims processing and workflow
- Database: `claims_db` (claims, claim_status_history tables)
- Depends on: User Service (auth), Policy Service (validation)

**Quotes Service (Port 3005)**
- Quote generation and conversion to policies
- Database: `quotes_db` (quotes table)
- Depends on: User Service (auth), Policy Service (conversion)

### Communication Patterns

```
Client → API Gateway → Service → Auth Service (verify token)
                      → Other Services (validate data)
                      → Database
```

**Key Principles:**
- Services communicate via HTTP REST
- JWT tokens passed through `Authorization` header
- Each service validates tokens with Auth Service
- No direct database sharing between services
- Each service has own Prisma schema

## Directory Structure

```
services/
├── api-gateway/           # Routes requests, no DB
├── user-service/          # User service (users + organizations + user_db)
├── policy-service/        # Policies + policy_db
├── claims-service/        # Claims + claims_db
├── quotes-service/        # Quotes + quotes_db
└── shared/                # Shared types & utilities
```

Each service directory contains:
```
service/
├── src/
│   ├── server.ts          # Express app entry point
│   ├── routes/            # Route definitions
│   ├── services/          # Business logic (for some services)
│   └── middleware/        # Auth middleware
├── prisma/
│   └── schema.prisma      # Service-specific schema
├── Dockerfile             # Container definition
├── package.json           # Service dependencies
└── .env.example           # Environment template
```

## Development Workflow

### Running with Docker (Recommended)

```bash
# Start all services
docker-compose up --build

# Stop all services
docker-compose down

# View logs
docker-compose logs -f <service-name>
```

### Running Manually (Development)

```bash
# Each service in separate terminal
cd services/user-service
npm install
npm run prisma:generate
npm run prisma:migrate
npm run dev  # Starts on port 3001

# Repeat for each service
```

### Adding a New Service

1. **Create service directory** in `services/`
2. **Copy structure** from existing service (e.g., customer-service)
3. **Update package.json** with service name and dependencies
4. **Create Prisma schema** for service-specific database
5. **Implement routes** in `src/routes/`
6. **Add auth middleware** for protected endpoints
7. **Create Dockerfile** following existing pattern
8. **Add to docker-compose.yml**:
   ```yaml
   new-service:
     build: ./services/new-service
     ports: ["3006:3006"]
     environment:
       DATABASE_URL: postgresql://postgres:postgres@postgres:5432/service_db
       USER_SERVICE_URL: http://user-service:3001
     depends_on: [postgres, auth-service]
   ```
9. **Update API Gateway** proxy routes

## Key Patterns

### Authentication Middleware (Every Service)

```typescript
// src/middleware/auth.middleware.ts
import axios from 'axios';

export interface AuthRequest extends Request {
  user?: {
    userId: string;
    email: string;
    role: 'admin' | 'agent' | 'customer';
    organizationId: string;  // Critical for multi-tenancy
  };
}

export async function authenticate(req: AuthRequest, res, next) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  
  if (!token) {
    return res.status(401).json({ success: false, message: 'No token provided' });
  }
  
  // Call User Service to verify (in production, could verify JWT locally)
  const userServiceUrl = process.env.USER_SERVICE_URL;
  try {
    const response = await axios.post(`${userServiceUrl}/api/auth/verify`, { token });
    
    if (response.data.success) {
      req.user = response.data.data;  // { userId, email, role, organizationId }
      next();
    } else {
      res.status(401).json({ success: false, message: 'Invalid token' });
    }
  } catch (error) {
    res.status(401).json({ success: false, message: 'Token verification failed' });
  }
}
```

### Service-to-Service Calls

```typescript
import axios from 'axios';

// Validate customer exists before creating policy
const userServiceUrl = process.env.USER_SERVICE_URL;
const response = await axios.get(
  `${userServiceUrl}/api/customers/${customerId}`,
  { headers: { Authorization: `Bearer ${token}` } }
);

if (!response.data.success) {
  throw new Error('Customer not found');
}
```

### Multi-Tenant Data Filtering

**Critical pattern**: Always filter by organizationId for tenant isolation:

```typescript
// Good - filters by organization
const policies = await prisma.policy.findMany({
  where: {
    organizationId: (req as AuthRequest).user!.organizationId
  }
});

// Bad - would leak data across tenants
const policies = await prisma.policy.findMany({});
```

**Security**: Services validate organizationId matches between related entities:
```typescript
// Example from claims service - validate policy belongs to same org
if (policy.organizationId !== req.user!.organizationId) {
  return res.status(403).json({ 
    success: false, 
    message: 'Policy belongs to a different organization' 
  });
}
```

### Prisma Schema (Per Service)

Each service owns its data - no foreign keys to other service databases.
**All entities include `organizationId` for multi-tenant isolation**:

```prisma
// policy-service/prisma/schema.prisma
model Policy {
  id              String   @id @default(uuid())
  organizationId  String   // Multi-tenant isolation - REQUIRED
  userId          String   // Creator reference (not FK)
  policyNumber    String   @unique
  status          String   // ACTIVE, CANCELLED, EXPIRED
  // ... fields
  
  @@index([organizationId])  // Critical for query performance
  @@index([organizationId, status])
}

model PolicyStatusHistory {
  id              String   @id @default(uuid())
  policyId        String
  organizationId  String   // Denormalized for filtering
  oldStatus       String
  newStatus       String
  changedBy       String   // userId reference
  // ... fields
  
  @@index([organizationId])
  @@index([policyId])
}
```

### Docker Compose Services

Pattern for adding services:

```yaml
service-name:
  build:
    context: ./services/service-name
  ports: ["PORT:PORT"]
  environment:
    DATABASE_URL: postgresql://postgres:postgres@postgres:5432/service_db
    USER_SERVICE_URL: http://user-service:3001
    OTHER_SERVICE_URL: http://other-service:3002
  depends_on:
    postgres: { condition: service_healthy }
    user-service: { condition: service_started }
```

## Database Management

### Creating Databases

Add to `scripts/init-databases.sql`:
```sql
CREATE DATABASE user_db;
CREATE DATABASE policy_db;
CREATE DATABASE claims_db;
CREATE DATABASE quotes_db;
```

### Migrations

Each service runs migrations independently:
```bash
cd services/user-service
npm run prisma:migrate
```

In Docker, migrations run automatically on startup via Dockerfile:
```dockerfile
CMD npx prisma migrate deploy && npm start
```

## API Gateway Routing

Add proxy routes in `services/api-gateway/src/server.ts`:

```typescript
import { createProxyMiddleware } from 'http-proxy-middleware';

const NEW_SERVICE_URL = process.env.NEW_SERVICE_URL || 'http://localhost:3006';

app.use('/api/v1/new-resource', createProxyMiddleware({
  target: NEW_SERVICE_URL,
  changeOrigin: true,
  pathRewrite: { '^/api/v1': '/api' },
  onProxyReq: (proxyReq, req) => {
    if (req.headers.authorization) {
      proxyReq.setHeader('authorization', req.headers.authorization);
    }
  },
}));
```

## Code Conventions

### Service Naming
- Kebab-case for directories: `user-service`, `policy-service`
- Port numbers: Gateway=3000, Services=3001-3009
- Database names: `<service>_db` (e.g., `auth_db`)

### Environment Variables
Every service needs:
```env
PORT=300X
DATABASE_URL=postgresql://...
USER_SERVICE_URL=http://user-service:3001
NODE_ENV=development
```

### Response Format
All services use consistent response:
```typescript
{ success: true, data: {...} }           // Success
{ success: false, message: "Error" }     // Error
```

## Testing

```bash
# Test API Gateway
curl http://localhost:3000/health

# Test individual service
curl http://localhost:3001/health

# Test with auth
TOKEN=$(curl -X POST http://localhost:3000/api/v1/auth/login \
  -d '{"email":"test@test.com","password":"test"}' | jq -r '.data.token')

curl http://localhost:3000/api/v1/customers \
  -H "Authorization: Bearer $TOKEN"
```

## Common Pitfalls

1. **Service can't reach other service**: Check `docker-compose.yml` network (`dynaclaimz-network`) and service names
2. **Database migration fails**: Ensure PostgreSQL is healthy before services start
3. **Auth token not forwarded**: Verify proxy middleware forwards Authorization header
4. **Port conflicts**: Each service needs unique port in docker-compose
5. **Circular dependencies**: Don't create dependency loops in `depends_on`
6. **Multi-tenant data leak**: Always filter queries by `organizationId` from JWT
7. **Wrong validation in claims**: Validate `organizationId` match, NOT `userId` (allows agents to work on org policies)
8. **Decimal fields from Prisma**: Convert to `float()` before math operations (e.g., `claimAmount`)
9. **Network name change**: After changing network name in docker-compose, must run `docker compose down && docker compose up`

## Migration from Monolith

If migrating from monolithic version:
1. **Extract domain** into separate service directory
2. **Create Prisma schema** with only domain tables
3. **Replace model imports** with HTTP calls to other services
4. **Update foreign keys** to be string references (not actual FKs)
5. **Add auth middleware** to verify tokens
6. **Test independently** before adding to docker-compose

## Production Considerations

- **Service Discovery**: Replace hardcoded URLs with Consul/Eureka
- **Load Balancing**: Add nginx or cloud load balancer
- **Circuit Breakers**: Implement Hystrix/resilience4j patterns
- **Distributed Tracing**: Add Jaeger or Zipkin
- **Centralized Logging**: Use ELK stack or cloud solution
- **Secret Management**: Use Vault or cloud secret managers
- **Health Checks**: Implement liveness/readiness probes
- **Auto-scaling**: Configure based on metrics

## Debugging

```bash
# View service logs
docker-compose logs -f user-service

# Exec into service container
docker-compose exec user-service sh

# Check network connectivity
docker-compose exec api-gateway ping user-service

# Restart service
docker-compose restart customer-service

# View all running services
docker-compose ps
```
