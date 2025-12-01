# Service Consolidation - Auth + Customer → User Service

## Overview
Successfully merged the `auth-service` and `customer-service` into a single `user-service` to eliminate data redundancy and simplify the microservices architecture.

## Architectural Changes

### Before
- **6 Microservices**: auth-service, customer-service, policy-service, claims-service, quotes-service, api-gateway
- **5 Databases**: auth_db, customer_db, policy_db, claims_db, quotes_db
- **Redundant Data**: User and Customer entities stored email, firstName, lastName separately
- **No Relationship**: Authentication user (auth_db) had no direct link to business customer (customer_db)

### After
- **5 Microservices**: user-service, policy-service, claims-service, quotes-service, api-gateway
- **4 Databases**: user_db, policy_db, claims_db, quotes_db
- **Single Source of Truth**: User model contains both auth and customer data
- **Direct Relationships**: Policies, claims, and quotes reference `userId` directly

## Changes Made

### 1. Database Schema Updates

#### User Service (`services/auth-service/prisma/schema.prisma`)
```prisma
model User {
  id             String    @id @default(uuid())
  email          String    @unique
  password       String
  firstName      String
  lastName       String
  role           UserRole  @default(CUSTOMER)
  
  // Customer-specific fields (optional for ADMIN/AGENT roles)
  dateOfBirth    DateTime?
  phone          String?
  street         String?
  city           String?
  state          String?
  zipCode        String?
  country        String    @default("USA")
  
  createdAt      DateTime  @default(now())
  updatedAt      DateTime  @updatedAt

  @@map("users")
}
```

#### Policy/Claims/Quotes Services
Changed all references from `customerId` → `userId`:
- `services/policy-service/prisma/schema.prisma`
- `services/claims-service/prisma/schema.prisma`
- `services/quotes-service/prisma/schema.prisma`

### 2. API Endpoints

#### New User Endpoints (`/api/v1/users`)
- `GET /api/v1/users` - List all users (Admin/Agent only)
- `GET /api/v1/users/:id` - Get user by ID
- `PUT /api/v1/users/:id` - Update user profile (includes customer data)
- `DELETE /api/v1/users/:id` - Delete user (Admin only)

#### Authentication Endpoints (unchanged)
- `POST /api/v1/auth/register` - Register new user (now accepts optional customer data)
- `POST /api/v1/auth/login` - Login and get JWT
- `GET /api/v1/auth/me` - Get current user profile

### 3. Service Route Updates

All services updated to use `USER_SERVICE_URL` instead of `CUSTOMER_SERVICE_URL`:
- **Policy Service**: Validates `userId` via `USER_SERVICE_URL/api/users/${userId}`
- **Claims Service**: Validates `userId` and policy ownership
- **Quotes Service**: Validates `userId` before creating quotes

### 4. Docker Configuration

#### Removed Services
- `customer-service` (port 3002)
- `prisma-studio-customer` (old port 5556)
- `prisma-studio-auth` (old port 5555)

#### Renamed Services
- `auth-service` → `user-service` (port 3001, database: user_db)

#### Prisma Studio Ports
- `prisma-studio-user`: http://localhost:5555 (user_db)
- `prisma-studio-policy`: http://localhost:5556 (policy_db)
- `prisma-studio-claims`: http://localhost:5557 (claims_db)
- `prisma-studio-quotes`: http://localhost:5558 (quotes_db)

### 5. Environment Variables

Updated all services to use:
```bash
USER_SERVICE_URL=http://user-service:3001
# Removed: CUSTOMER_SERVICE_URL
```

### 6. API Gateway Updates

Updated routing in `services/api-gateway/src/server.ts`:
```typescript
const USER_SERVICE_URL = process.env.USER_SERVICE_URL || 'http://localhost:3001';

// Removed CUSTOMER_SERVICE_URL
// Changed /api/v1/customers → /api/v1/users
app.use('/api/v1/auth', createProxyMiddleware({ target: USER_SERVICE_URL }));
app.use('/api/v1/users', createProxyMiddleware({ target: USER_SERVICE_URL }));
```

### 7. Swagger Documentation

Updated OpenAPI documentation:
- **Renamed**: `customers.yaml` → `users.yaml`
- **Updated Paths**: All `/api/v1/customers` → `/api/v1/users`
- **Updated Schemas**: User schema now includes customer fields
- **Updated References**: All `customerId` → `userId` in Policy/Claim/Quote schemas
- **Removed Server**: Customer Service (port 3002) removed from server list

### 8. Root Package.json Scripts

Updated to remove customer-service references:
```json
{
  "scripts": {
    "install:services": "cd services/auth-service && npm install && cd ../policy-service && npm install ...",
    "dev:user": "cd services/auth-service && npm run dev",
    // Removed: "dev:customer"
  }
}
```

## Benefits

1. **Eliminated Redundancy**: No more duplicate email/name fields across services
2. **Single Source of Truth**: User data lives in one place (user_db)
3. **Simplified Architecture**: 5 services instead of 6
4. **Better Data Integrity**: Direct userId foreign keys instead of separate customerId
5. **Easier Development**: One less service to manage, deploy, and maintain
6. **Reduced Database Costs**: 4 databases instead of 5
7. **Clearer Domain Model**: User represents both authentication and customer identity

## Migration Notes

### For Development
No migration needed - `prisma db push` will create the new schema on startup.

### For Production
1. Export existing customer data from `customer_db`
2. Merge with user data from `auth_db`
3. Update `userId` references in policy, claims, and quotes tables
4. Run Prisma migrations: `npx prisma migrate deploy`
5. Deploy updated services
6. Archive old `customer_db`

## Testing Checklist

- [x] Docker build successful for all services
- [x] All 10 containers running (postgres + 5 services + 4 Prisma Studios)
- [x] All 4 databases created (user_db, policy_db, claims_db, quotes_db)
- [x] Orphaned containers removed (old auth-service, customer-service)
- [ ] User registration with customer data works
- [ ] User login returns JWT correctly
- [ ] Policy creation with userId works
- [ ] Claim creation with userId works
- [ ] Quote creation with userId works
- [ ] Swagger UI loads at http://localhost:3000/api-docs
- [ ] Prisma Studio accessible for all 4 databases

## Service Endpoints

### API Gateway (http://localhost:3000)
- Swagger UI: http://localhost:3000/api-docs
- Swagger JSON: http://localhost:3000/api-docs.json

### Services (Direct Access - Not Recommended)
- User Service: http://localhost:3001
- Policy Service: http://localhost:3003
- Claims Service: http://localhost:3004
- Quotes Service: http://localhost:3005

### Prisma Studio
- User DB: http://localhost:5555
- Policy DB: http://localhost:5556
- Claims DB: http://localhost:5557
- Quotes DB: http://localhost:5558

## Files Modified

### Prisma Schemas
- ✅ `services/auth-service/prisma/schema.prisma` - Added customer fields to User
- ✅ `services/policy-service/prisma/schema.prisma` - customerId → userId
- ✅ `services/claims-service/prisma/schema.prisma` - customerId → userId
- ✅ `services/quotes-service/prisma/schema.prisma` - customerId → userId

### Service Code
- ✅ `services/auth-service/src/routes/user.routes.ts` - NEW: User CRUD routes
- ✅ `services/auth-service/src/server.ts` - Added /api/users routes
- ✅ `services/auth-service/src/services/auth.service.ts` - Accept customer data in register()
- ✅ `services/policy-service/src/routes/policy.routes.ts` - USER_SERVICE_URL, userId
- ✅ `services/claims-service/src/routes/claim.routes.ts` - USER_SERVICE_URL, userId
- ✅ `services/quotes-service/src/routes/quote.routes.ts` - USER_SERVICE_URL, userId

### Infrastructure
- ✅ `docker-compose.yml` - Removed customer-service, renamed auth → user
- ✅ `scripts/init-databases.sql` - 4 databases instead of 5
- ✅ `package.json` - Updated scripts to remove customer references

### API Gateway
- ✅ `services/api-gateway/src/server.ts` - USER_SERVICE_URL, /api/v1/users
- ✅ `services/api-gateway/src/swagger.ts` - Updated schemas and servers
- ✅ `services/api-gateway/src/swagger/users.yaml` - RENAMED from customers.yaml
- ✅ `services/api-gateway/src/swagger/policies.yaml` - userId references
- ✅ `services/api-gateway/src/swagger/claims.yaml` - userId references
- ✅ `services/api-gateway/src/swagger/quotes.yaml` - userId references

## Directory Structure

```
services/
  auth-service/          # NOW SERVES AS USER-SERVICE
    prisma/schema.prisma # User model with customer fields
    src/
      routes/
        auth.routes.ts   # /api/auth endpoints
        user.routes.ts   # /api/users endpoints (NEW)
      services/
        auth.service.ts  # Authentication + user management
  policy-service/        # References userId
  claims-service/        # References userId
  quotes-service/        # References userId
  api-gateway/           # Routes to user-service
  
  # REMOVED:
  # customer-service/   ← NO LONGER EXISTS
```

## Next Steps

1. Run end-to-end tests with Docker containers
2. Test user registration with full customer data
3. Verify policy/claim/quote creation with userId
4. Test Swagger UI documentation
5. Archive or delete `services/customer-service` directory
6. Update production deployment scripts
7. Create migration guide for production databases
