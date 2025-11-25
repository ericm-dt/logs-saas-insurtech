# Copilot Instructions for InsureTech Microservices

## Project Overview
A microservices-based InsureTech SaaS platform with 6 independent services communicating via REST APIs. Each service has its own database, codebase, and can be deployed independently.

## Architecture Overview

### Service Boundaries

**API Gateway (Port 3000)**
- Entry point for all client requests
- Routes to backend services
- Handles CORS, rate limiting, security headers
- No database

**Auth Service (Port 3001)**
- User authentication & JWT management
- Database: `auth_db` (users table)
- Exposes: `/api/auth/*` endpoints

**Customer Service (Port 3002)**
- Customer profile management
- Database: `customer_db` (customers table)
- Depends on: Auth Service (token validation)

**Policy/Claims/Quotes Services (Ports 3003-3005)**
- Domain-specific business logic
- Each has own database
- Follow same patterns as Customer Service

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
├── auth-service/          # Auth + users DB
├── customer-service/      # Customers + customer_db
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
cd services/auth-service
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
       DATABASE_URL: postgresql://postgres:postgres@postgres:5432/new_db
       AUTH_SERVICE_URL: http://auth-service:3001
     depends_on: [postgres, auth-service]
   ```
9. **Update API Gateway** proxy routes

## Key Patterns

### Authentication Middleware (Every Service)

```typescript
// src/middleware/auth.middleware.ts
import axios from 'axios';

export async function authMiddleware(req, res, next) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  
  // Call Auth Service to verify
  const authServiceUrl = process.env.AUTH_SERVICE_URL;
  const response = await axios.post(`${authServiceUrl}/api/auth/verify`, { token });
  
  if (response.data.success) {
    req.user = response.data.data;  // { userId, email, role }
    next();
  } else {
    res.status(401).json({ success: false, message: 'Unauthorized' });
  }
}
```

### Service-to-Service Calls

```typescript
import axios from 'axios';

// Validate customer exists before creating policy
const customerServiceUrl = process.env.CUSTOMER_SERVICE_URL;
const response = await axios.get(
  `${customerServiceUrl}/api/customers/${customerId}`,
  { headers: { Authorization: `Bearer ${token}` } }
);

if (!response.data.success) {
  throw new Error('Customer not found');
}
```

### Prisma Schema (Per Service)

Each service owns its data - no foreign keys to other service databases:

```prisma
// policy-service/prisma/schema.prisma
model Policy {
  id           String @id @default(uuid())
  customerId   String  // Reference only, not FK
  policyNumber String @unique
  // ... fields
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
    AUTH_SERVICE_URL: http://auth-service:3001
    OTHER_SERVICE_URL: http://other-service:3002
  depends_on:
    postgres: { condition: service_healthy }
    auth-service: { condition: service_started }
```

## Database Management

### Creating Databases

Add to `scripts/init-databases.sql`:
```sql
CREATE DATABASE new_service_db;
```

### Migrations

Each service runs migrations independently:
```bash
cd services/auth-service
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
- Kebab-case for directories: `auth-service`, `customer-service`
- Port numbers: Gateway=3000, Services=3001-3009
- Database names: `<service>_db` (e.g., `auth_db`)

### Environment Variables
Every service needs:
```env
PORT=300X
DATABASE_URL=postgresql://...
AUTH_SERVICE_URL=http://auth-service:3001
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

1. **Service can't reach other service**: Check `docker-compose.yml` network and service names
2. **Database migration fails**: Ensure PostgreSQL is healthy before services start
3. **Auth token not forwarded**: Verify proxy middleware forwards Authorization header
4. **Port conflicts**: Each service needs unique port in docker-compose
5. **Circular dependencies**: Don't create dependency loops in `depends_on`

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
docker-compose logs -f auth-service

# Exec into service container
docker-compose exec auth-service sh

# Check network connectivity
docker-compose exec api-gateway ping auth-service

# Restart service
docker-compose restart customer-service

# View all running services
docker-compose ps
```
