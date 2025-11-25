# InsureTech Microservices Platform

A production-ready microservices architecture for an InsureTech SaaS platform built with Node.js, TypeScript, Express, and PostgreSQL.

## 🏗️ Architecture

This application has been decomposed into **6 independent microservices**:

### Services

1. **API Gateway** (Port 3000) - Entry point for all client requests
   - Request routing & load balancing
   - Authentication & rate limiting
   - CORS & security headers
   - Request/response logging

2. **Auth Service** (Port 3001) - User authentication & authorization
   - User registration & login
   - JWT token generation & validation
   - Password management with bcrypt
   - Database: `auth_db`

3. **Customer Service** (Port 3002) - Customer profile management
   - Customer CRUD operations
   - Profile data management
   - Database: `customer_db`

4. **Policy Service** (Port 3003) - Insurance policy management
   - Policy lifecycle management
   - Multiple policy types (Auto, Home, Life, Health, Business)
   - Database: `policy_db`

5. **Claims Service** (Port 3004) - Claims processing workflow
   - Claims submission & tracking
   - Status workflow management
   - Database: `claims_db`

6. **Quotes Service** (Port 3005) - Quote generation & management
   - Premium calculation
   - Quote expiration handling
   - Database: `quotes_db`

## 🚀 Quick Start with Docker

### Prerequisites
- Docker & Docker Compose
- 4GB+ RAM for Docker

### One-Command Deployment

```bash
# Start all services with one command
docker-compose up --build

# Or run in background
docker-compose up -d --build
```

That's it! All 6 microservices + PostgreSQL will start automatically.

### Verify Deployment

```bash
# Check API Gateway
curl http://localhost:3000/health

# Test registration
curl -X POST http://localhost:3000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"test123","firstName":"Test","lastName":"User"}'
```

## 📦 Manual Development Setup

For development without Docker:

```bash
# 1. Start PostgreSQL
docker run --name postgres -e POSTGRES_PASSWORD=postgres -p 5432:5432 -d postgres:14

# 2. Create databases
psql -U postgres -h localhost -f scripts/init-databases.sql

# 3. Install dependencies for each service
cd services/auth-service && npm install && npm run prisma:generate && npm run prisma:migrate
cd ../customer-service && npm install && npm run prisma:generate && npm run prisma:migrate
cd ../api-gateway && npm install

# 4. Start services in separate terminals
cd services/auth-service && npm run dev          # Terminal 1
cd services/customer-service && npm run dev      # Terminal 2
cd services/api-gateway && npm run dev           # Terminal 3
# ... repeat for other services
```

## 🔌 API Usage

All requests go through the **API Gateway** at `http://localhost:3000`:

### Authentication

```bash
# Register
POST /api/v1/auth/register
Body: { "email": "...", "password": "...", "firstName": "...", "lastName": "..." }

# Login
POST /api/v1/auth/login
Body: { "email": "...", "password": "..." }
# Returns: { "success": true, "data": { "user": {...}, "token": "..." }}
```

### Protected Resources

Include JWT token in Authorization header:

```bash
# Get customers
curl http://localhost:3000/api/v1/customers \
  -H "Authorization: Bearer <your-jwt-token>"

# Create policy
curl -X POST http://localhost:3000/api/v1/policies \
  -H "Authorization: Bearer <your-jwt-token>" \
  -H "Content-Type: application/json" \
  -d '{"policyNumber":"POL-001",...}'
```

## 📁 Project Structure

```
services/
├── api-gateway/          # API Gateway service
│   ├── src/
│   ├── Dockerfile
│   └── package.json
├── auth-service/         # Authentication service
│   ├── src/
│   ├── prisma/
│   ├── Dockerfile
│   └── package.json
├── customer-service/     # Customer management service
│   ├── src/
│   ├── prisma/
│   ├── Dockerfile
│   └── package.json
├── policy-service/       # Policy management service
│   ├── src/
│   ├── prisma/
│   ├── Dockerfile
│   └── package.json
├── claims-service/       # Claims processing service
│   ├── src/
│   ├── prisma/
│   ├── Dockerfile
│   └── package.json
├── quotes-service/       # Quote generation service
│   ├── src/
│   ├── prisma/
│   ├── Dockerfile
│   └── package.json
└── shared/               # Shared types and utilities
    ├── types.ts
    ├── errors.ts
    └── service-client.ts

scripts/
└── init-databases.sql    # Database initialization

docker-compose.yml        # Multi-service orchestration
DEPLOYMENT.md             # Detailed deployment guide
MICROSERVICES_ARCHITECTURE.md  # Architecture documentation
```

## 🗄️ Database Architecture

- **Database per Service** pattern
- Each service owns its data
- PostgreSQL for all services
- Prisma ORM for type-safe queries
- Automated migrations on service startup

## 🔐 Security Features

- JWT-based authentication
- Bcrypt password hashing (10 rounds)
- Helmet.js security headers
- CORS configuration
- Rate limiting (100 req/15min)
- Service-to-service auth validation

## 🔄 Inter-Service Communication

- **Synchronous**: REST APIs over HTTP
- **Authentication**: JWT tokens forwarded through headers
- **Service Discovery**: Direct service URLs (Docker network)
- **Error Handling**: Standardized error responses

## 📊 Monitoring & Logging

```bash
# View all logs
docker-compose logs -f

# View specific service
docker-compose logs -f auth-service

# Health checks
curl http://localhost:3000/health  # Gateway
curl http://localhost:3001/health  # Auth
curl http://localhost:3002/health  # Customer
```

## 🛠️ Development Commands

```bash
# Start all services
docker-compose up --build

# Stop all services
docker-compose down

# Remove all data
docker-compose down -v

# Scale a service
docker-compose up --scale customer-service=3

# View service logs
docker-compose logs -f <service-name>

# Rebuild specific service
docker-compose up --build --force-recreate <service-name>
```

## 📚 Documentation

- [Deployment Guide](./DEPLOYMENT.md) - Comprehensive deployment instructions
- [Architecture Overview](./MICROSERVICES_ARCHITECTURE.md) - System design & patterns
- [Monolith Version](./README_MONOLITH.md) - Original monolithic implementation

## 🎯 Microservices Benefits

✅ **Independent Deployment** - Deploy services separately  
✅ **Technology Flexibility** - Different tech stacks per service  
✅ **Scalability** - Scale services independently based on load  
✅ **Fault Isolation** - Service failures don't cascade  
✅ **Team Autonomy** - Teams own services end-to-end  
✅ **Database per Service** - No shared database bottlenecks

## ✅ All Services Implemented

All 6 microservices are fully implemented and ready to deploy:
- ✅ **API Gateway** (Port 3000) - Routing and security
- ✅ **Auth Service** (Port 3001) - Authentication & JWT
- ✅ **Customer Service** (Port 3002) - Customer management
- ✅ **Policy Service** (Port 3003) - Policy lifecycle
- ✅ **Claims Service** (Port 3004) - Claims workflow
- ✅ **Quotes Service** (Port 3005) - Quote generation

## 🔮 Production Enhancements

- [x] Implement all core microservices (policy, claims, quotes)
- [ ] Add message queue (RabbitMQ/Kafka) for async communication
- [ ] Implement circuit breakers (Hystrix pattern)
- [ ] Add service mesh (Istio/Linkerd)
- [ ] Set up Kubernetes deployment
- [ ] Add distributed tracing (Jaeger/Zipkin)
- [ ] Implement API versioning
- [ ] Add centralized logging (ELK stack)
- [ ] Set up monitoring (Prometheus + Grafana)
- [ ] Implement event sourcing for audit trail

## 📄 License

MIT

---

**From Monolith to Microservices**: This project evolved from a monolithic application to a microservices architecture, demonstrating both architectural approaches for educational purposes.
