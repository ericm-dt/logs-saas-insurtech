# DynaClaimz Microservices Architecture

## Service Boundaries

### 1. **API Gateway** (Port 3000)
- Entry point for all client requests
- Authentication/authorization
- Request routing to backend services
- Rate limiting, CORS, logging
- Response aggregation

### 2. **Auth Service** (Port 3001)
- User authentication & JWT management
- User registration and login
- Token validation
- Password management
- Database: `auth_db` (users table)

### 3. **Customer Service** (Port 3002)
- Customer profile management
- Customer CRUD operations
- Database: `customer_db` (customers table)

### 4. **Policy Service** (Port 3003) ✅
- Insurance policy management
- Policy lifecycle (create, update, cancel)
- Multiple policy types (AUTO, HOME, LIFE, HEALTH, BUSINESS)
- Policy status management (ACTIVE, EXPIRED, CANCELLED, PENDING)
- Communicates with Customer Service for validation
- Database: `policy_db` (policies table)
- **Status**: Fully implemented

### 5. **Claims Service** (Port 3004) ✅
- Claims processing and workflow
- Claims status management with enforced workflow transitions
- Status workflow: SUBMITTED → UNDER_REVIEW → APPROVED/DENIED → PAID
- Communicates with Policy Service and Customer Service
- Validates policy is ACTIVE and belongs to customer
- Database: `claims_db` (claims table)
- **Status**: Fully implemented

### 6. **Quotes Service** (Port 3005) ✅
- Quote generation and management
- Automatic premium calculation based on coverage and type
- Expiration handling (default: 30 days)
- Quote status management (ACTIVE, EXPIRED, CONVERTED)
- Batch expire old quotes endpoint
- Communicates with Customer Service
- Database: `quotes_db` (quotes table)
- **Status**: Fully implemented

## Communication Patterns

- **Synchronous**: REST APIs between services
- **Authentication**: JWT tokens passed through headers
- **Service Discovery**: Direct service URLs (can be upgraded to Consul/Eureka)
- **Database per Service**: Each service owns its data

## Data Consistency

- Foreign keys replaced with service IDs
- Services call each other to validate references
- Eventual consistency for cross-service operations

## Directory Structure

```
services/
├── api-gateway/          # API Gateway
├── user-service/         # Authentication
├── customer-service/     # Customer management
├── policy-service/       # Policy management
├── claims-service/       # Claims processing
├── quotes-service/       # Quote generation
└── shared/              # Shared utilities, types
```

Each service is independently deployable with its own:
- package.json
- Prisma schema
- Database
- Docker container

## Deployment

All services are containerized and orchestrated with Docker Compose. See [DEPLOYMENT.md](./DEPLOYMENT.md) for complete deployment instructions.

**Quick Start**:
```bash
docker-compose up --build
```

All 6 services will start, databases will be created, and migrations will run automatically.

## Key Implementation Details

### Premium Calculation (Quotes Service)
```
base_rate = 1.5% of coverage amount
type_multipliers:
  AUTO: 1.0, HOME: 1.2, LIFE: 0.8
  HEALTH: 1.5, BUSINESS: 2.0

premium = coverage_amount * base_rate * type_multiplier
```

### Claims Workflow (Claims Service)
Valid status transitions:
- SUBMITTED → UNDER_REVIEW, DENIED
- UNDER_REVIEW → APPROVED, DENIED
- APPROVED → PAID
- DENIED, PAID (terminal states)

Approvals require `approvedAmount`, denials require `denialReason`.

### Service Validation Pattern
Services validate references via HTTP calls:
```typescript
// Example: Claims service validating policy
const response = await axios.get(
  `${POLICY_SERVICE_URL}/api/policies/${policyId}`,
  { headers: { Authorization: `Bearer ${token}` } }
);

if (response.data.success && response.data.data.status === 'ACTIVE') {
  // Policy exists and is active
}
```

## Next Steps

- Implement API documentation (Swagger/OpenAPI)
- Add comprehensive test coverage
- Implement circuit breakers for resilience
- Add distributed tracing (Jaeger/Zipkin)
- Set up centralized logging (ELK stack)
- Consider message queue for async operations
