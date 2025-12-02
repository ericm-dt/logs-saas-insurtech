# DynaClaimz Microservices - Deployment Guide

## Quick Start with Docker Compose

### Prerequisites
- Docker and Docker Compose installed
- At least 4GB RAM allocated to Docker

### Running All Services

```bash
# 1. Set environment variables (optional)
export JWT_SECRET=your-super-secret-key

# 2. Start all services
docker-compose up --build

# 3. Wait for all services to be healthy (check logs)
# You should see messages like:
#   - Auth Service running on port 3001
#   - Customer Service running on port 3002
#   - API Gateway running on port 3000

# 4. Test the API Gateway
curl http://localhost:3000/health
```

### Service Endpoints

- **API Gateway**: http://localhost:3000
- **Auth Service**: http://localhost:3001
- **Customer Service**: http://localhost:3002
- **Policy Service**: http://localhost:3003
- **Claims Service**: http://localhost:3004
- **Quotes Service**: http://localhost:3005

### Access Through API Gateway

All client requests should go through the API Gateway:

```bash
# Register user
curl -X POST http://localhost:3000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "password123",
    "firstName": "John",
    "lastName": "Doe"
  }'

# Login
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "password123"
  }'

# Use the returned token for authenticated requests
curl http://localhost:3000/api/v1/customers \
  -H "Authorization: Bearer <your-token>"
```

## Manual Development Setup

### Running Services Individually

Each service can be run independently for development:

```bash
# Terminal 1: Start PostgreSQL
docker run --name postgres \
  -e POSTGRES_PASSWORD=postgres \
  -p 5432:5432 \
  -d postgres:14

# Terminal 2: Create databases
psql -U postgres -h localhost <<EOF
CREATE DATABASE auth_db;
CREATE DATABASE customer_db;
CREATE DATABASE policy_db;
CREATE DATABASE claims_db;
CREATE DATABASE quotes_db;
EOF

# Terminal 3: User Service
cd services/user-service
cp .env.example .env
npm install
npm run prisma:generate
npm run prisma:migrate
npm run dev

# Terminal 4: Customer Service
cd services/customer-service
cp .env.example .env
npm install
npm run prisma:generate
npm run prisma:migrate
npm run dev

# Terminal 5: API Gateway
cd services/api-gateway
cp .env.example .env
npm install
npm run dev
```

## Service Communication

### Inter-Service Communication Pattern

1. **Client → API Gateway** (Port 3000)
2. **API Gateway → Service** (Proxies with auth headers)
3. **Service → Auth Service** (Token verification)
4. **Service → Service** (Direct HTTP calls when needed)

### Example Flow: Creating a Policy

```
Client 
  → API Gateway (:3000/api/v1/policies)
    → Policy Service (:3003)
      → Auth Service (:3001) [verify token]
      → Customer Service (:3002) [validate customer exists]
      → Database (policy_db)
    ← Response
  ← Response
← Response
```

## Database Per Service

Each microservice has its own PostgreSQL database:

- `auth_db` - User authentication data
- `customer_db` - Customer profiles
- `policy_db` - Insurance policies
- `claims_db` - Claims data
- `quotes_db` - Quote information

## Stopping Services

```bash
# Stop all services
docker-compose down

# Stop and remove volumes (clears all data)
docker-compose down -v

# Stop individual service
docker-compose stop user-service
```

## Scaling Services

```bash
# Scale a specific service
docker-compose up --scale customer-service=3

# Load balancing requires additional configuration (nginx/traefik)
```

## Monitoring

### View Logs

```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f user-service

# API Gateway
docker-compose logs -f api-gateway
```

### Health Checks

```bash
# Check all services
curl http://localhost:3000/health
curl http://localhost:3001/health
curl http://localhost:3002/health
curl http://localhost:3003/health
curl http://localhost:3004/health
curl http://localhost:3005/health
```

## Troubleshooting

### Service Won't Start
- Check logs: `docker-compose logs <service-name>`
- Verify database connection: `docker-compose logs postgres`
- Ensure no port conflicts: `lsof -i :<port>`

### Database Migration Errors
- Services auto-run migrations on startup
- Manual migration: `docker-compose exec <service-name> npx prisma migrate deploy`

### Inter-Service Communication Failures
- Verify services are on same network: `docker network inspect dynaclaimz-network`
- Check service names resolve: `docker-compose exec api-gateway ping user-service`

## Production Considerations

1. **Use environment-specific configs**: Separate .env files for dev/staging/prod
2. **Secret management**: Use Docker secrets or external secret managers
3. **Service discovery**: Implement Consul, Eureka, or Kubernetes services
4. **Load balancing**: Add nginx or use cloud load balancers
5. **Observability**: Add Prometheus, Grafana, ELK stack
6. **API versioning**: Maintain backward compatibility
7. **Circuit breakers**: Implement resilience patterns
8. **Database migrations**: Use CI/CD for automated migration management
