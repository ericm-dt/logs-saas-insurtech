# Testing Guide - DynaClaimz Microservices

This guide provides step-by-step instructions for testing all microservices.

## Prerequisites

```bash
# Start all services
docker-compose up --build

# Wait for all services to be healthy
# Check logs: docker-compose logs -f
```

## Base URL
All requests go through the API Gateway: `http://localhost:3000`

## 1. Authentication (Auth Service)

### Register a New User
```bash
curl -X POST http://localhost:3000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "john.doe@example.com",
    "password": "SecurePass123",
    "firstName": "John",
    "lastName": "Doe"
  }'
```

**Expected Response**:
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "uuid",
      "email": "john.doe@example.com",
      "firstName": "John",
      "lastName": "Doe",
      "role": "customer"
    },
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

### Login
```bash
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "john.doe@example.com",
    "password": "SecurePass123"
  }'
```

**Save the token** from the response - you'll need it for all subsequent requests!

```bash
# Export token for easy use
export TOKEN="your-jwt-token-here"
```

## 2. Customer Service

### Create a Customer
```bash
curl -X POST http://localhost:3000/api/v1/customers \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "firstName": "Jane",
    "lastName": "Smith",
    "email": "jane.smith@example.com",
    "phone": "555-0123",
    "addressLine1": "123 Main St",
    "city": "Springfield",
    "state": "IL",
    "zipCode": "62701",
    "country": "USA"
  }'
```

**Expected Response**:
```json
{
  "success": true,
  "data": {
    "id": "customer-uuid",
    "firstName": "Jane",
    "lastName": "Smith",
    ...
  }
}
```

**Save the customer ID**:
```bash
export CUSTOMER_ID="customer-uuid-from-response"
```

### Get All Customers
```bash
curl http://localhost:3000/api/v1/customers \
  -H "Authorization: Bearer $TOKEN"
```

### Get Customer by ID
```bash
curl http://localhost:3000/api/v1/customers/$CUSTOMER_ID \
  -H "Authorization: Bearer $TOKEN"
```

### Update Customer
```bash
curl -X PUT http://localhost:3000/api/v1/customers/$CUSTOMER_ID \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "phone": "555-9999"
  }'
```

## 3. Policy Service

### Create a Policy
```bash
curl -X POST http://localhost:3000/api/v1/policies \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "customerId": "'$CUSTOMER_ID'",
    "policyNumber": "POL-2024-001",
    "type": "AUTO",
    "startDate": "2024-01-01T00:00:00Z",
    "endDate": "2025-01-01T00:00:00Z",
    "premium": 1200.00,
    "coverageAmount": 50000.00,
    "status": "ACTIVE"
  }'
```

**Save the policy ID**:
```bash
export POLICY_ID="policy-uuid-from-response"
```

### Get All Policies
```bash
curl http://localhost:3000/api/v1/policies \
  -H "Authorization: Bearer $TOKEN"
```

### Get Policy by ID
```bash
curl http://localhost:3000/api/v1/policies/$POLICY_ID \
  -H "Authorization: Bearer $TOKEN"
```

### Update Policy Status
```bash
curl -X PUT http://localhost:3000/api/v1/policies/$POLICY_ID \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "status": "ACTIVE"
  }'
```

## 4. Claims Service

### Create a Claim
```bash
curl -X POST http://localhost:3000/api/v1/claims \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "customerId": "'$CUSTOMER_ID'",
    "policyId": "'$POLICY_ID'",
    "claimNumber": "CLM-2024-001",
    "incidentDate": "2024-06-15T10:30:00Z",
    "description": "Vehicle collision on Highway 101",
    "claimAmount": 5000.00
  }'
```

**Save the claim ID**:
```bash
export CLAIM_ID="claim-uuid-from-response"
```

### Get All Claims
```bash
curl http://localhost:3000/api/v1/claims \
  -H "Authorization: Bearer $TOKEN"
```

### Update Claim Status (Workflow)
```bash
# Move to UNDER_REVIEW
curl -X PUT http://localhost:3000/api/v1/claims/$CLAIM_ID/status \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "status": "UNDER_REVIEW"
  }'

# Approve claim
curl -X PUT http://localhost:3000/api/v1/claims/$CLAIM_ID/status \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "status": "APPROVED",
    "approvedAmount": 4500.00
  }'

# Mark as paid
curl -X PUT http://localhost:3000/api/v1/claims/$CLAIM_ID/status \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "status": "PAID"
  }'
```

### Test Invalid Workflow Transition
```bash
# This should fail - can't go directly from SUBMITTED to PAID
curl -X PUT http://localhost:3000/api/v1/claims/$CLAIM_ID/status \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "status": "PAID"
  }'
```

**Expected Error**:
```json
{
  "success": false,
  "message": "Invalid status transition from SUBMITTED to PAID"
}
```

## 5. Quotes Service

### Create a Quote (with automatic premium calculation)
```bash
curl -X POST http://localhost:3000/api/v1/quotes \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "customerId": "'$CUSTOMER_ID'",
    "quoteNumber": "QTE-2024-001",
    "type": "AUTO",
    "coverageAmount": 50000.00
  }'
```

**Note**: Premium is calculated automatically based on coverage amount and type!

**Expected Response**:
```json
{
  "success": true,
  "data": {
    "id": "quote-uuid",
    "premium": 750.00,
    "expiresAt": "2024-12-25T..." // 30 days from now
  },
  "message": "Quote created with calculated premium: $750"
}
```

**Save the quote ID**:
```bash
export QUOTE_ID="quote-uuid-from-response"
```

### Get All Quotes
```bash
curl http://localhost:3000/api/v1/quotes \
  -H "Authorization: Bearer $TOKEN"
```

### Convert Quote to Policy
```bash
curl -X PUT http://localhost:3000/api/v1/quotes/$QUOTE_ID/status \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "status": "CONVERTED"
  }'
```

### Expire Old Quotes (Utility)
```bash
curl -X POST http://localhost:3000/api/v1/quotes/expire-old \
  -H "Authorization: Bearer $TOKEN"
```

## 6. Service Health Checks

### Check API Gateway
```bash
curl http://localhost:3000/health
```

### Check Individual Services
```bash
# Auth Service
curl http://localhost:3001/health

# Customer Service
curl http://localhost:3002/health

# Policy Service
curl http://localhost:3003/health

# Claims Service
curl http://localhost:3004/health

# Quotes Service
curl http://localhost:3005/health
```

## 7. Error Scenarios to Test

### Invalid Customer ID
```bash
curl -X POST http://localhost:3000/api/v1/policies \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "customerId": "invalid-uuid",
    "policyNumber": "POL-TEST",
    "type": "AUTO",
    "startDate": "2024-01-01T00:00:00Z",
    "endDate": "2025-01-01T00:00:00Z",
    "premium": 1200.00,
    "coverageAmount": 50000.00
  }'
```

**Expected**: `Customer not found`

### Claim on Inactive Policy
```bash
# First, cancel the policy
curl -X PUT http://localhost:3000/api/v1/policies/$POLICY_ID \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{ "status": "CANCELLED" }'

# Then try to create a claim
curl -X POST http://localhost:3000/api/v1/claims \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "customerId": "'$CUSTOMER_ID'",
    "policyId": "'$POLICY_ID'",
    "claimNumber": "CLM-FAIL",
    "incidentDate": "2024-06-15T10:30:00Z",
    "description": "Test",
    "claimAmount": 1000.00
  }'
```

**Expected**: `Policy not found or not active`

### Unauthorized Access (No Token)
```bash
curl http://localhost:3000/api/v1/customers
```

**Expected**: `No token provided`

### Invalid Token
```bash
curl http://localhost:3000/api/v1/customers \
  -H "Authorization: Bearer invalid-token"
```

**Expected**: `Invalid token` or `Authentication failed`

## 8. Complete End-to-End Flow

Here's a complete insurance workflow from quote to claim payment:

```bash
# 1. Register user
TOKEN=$(curl -s -X POST http://localhost:3000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@test.com","password":"test123","firstName":"Test","lastName":"User"}' \
  | jq -r '.data.token')

# 2. Create customer
CUSTOMER_ID=$(curl -s -X POST http://localhost:3000/api/v1/customers \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"firstName":"Test","lastName":"User","email":"test@test.com","phone":"555-1234","addressLine1":"123 Test St","city":"TestCity","state":"TS","zipCode":"12345","country":"USA"}' \
  | jq -r '.data.id')

# 3. Generate quote
QUOTE_ID=$(curl -s -X POST http://localhost:3000/api/v1/quotes \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"customerId":"'$CUSTOMER_ID'","quoteNumber":"QTE-001","type":"AUTO","coverageAmount":50000}' \
  | jq -r '.data.id')

# 4. Convert quote to policy
curl -X PUT http://localhost:3000/api/v1/quotes/$QUOTE_ID/status \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"status":"CONVERTED"}'

# 5. Create policy
POLICY_ID=$(curl -s -X POST http://localhost:3000/api/v1/policies \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"customerId":"'$CUSTOMER_ID'","policyNumber":"POL-001","type":"AUTO","startDate":"2024-01-01T00:00:00Z","endDate":"2025-01-01T00:00:00Z","premium":750,"coverageAmount":50000,"status":"ACTIVE"}' \
  | jq -r '.data.id')

# 6. File claim
CLAIM_ID=$(curl -s -X POST http://localhost:3000/api/v1/claims \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"customerId":"'$CUSTOMER_ID'","policyId":"'$POLICY_ID'","claimNumber":"CLM-001","incidentDate":"2024-06-15T10:30:00Z","description":"Accident","claimAmount":3000}' \
  | jq -r '.data.id')

# 7. Process claim through workflow
curl -X PUT http://localhost:3000/api/v1/claims/$CLAIM_ID/status \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"status":"UNDER_REVIEW"}'

curl -X PUT http://localhost:3000/api/v1/claims/$CLAIM_ID/status \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"status":"APPROVED","approvedAmount":2800}'

curl -X PUT http://localhost:3000/api/v1/claims/$CLAIM_ID/status \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"status":"PAID"}'

echo "Workflow complete! Check claim status:"
curl http://localhost:3000/api/v1/claims/$CLAIM_ID \
  -H "Authorization: Bearer $TOKEN" | jq
```

## Monitoring & Debugging

### View Service Logs
```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f policy-service
docker-compose logs -f claims-service
docker-compose logs -f quotes-service
```

### Check Database
```bash
# Connect to PostgreSQL
docker-compose exec postgres psql -U postgres

# List databases
\l

# Connect to a specific database
\c policy_db

# List tables
\dt

# Query data
SELECT * FROM "Policy";
```

### Check Service Status
```bash
docker-compose ps
```

## Troubleshooting

### Services won't start
```bash
# Remove containers and volumes
docker-compose down -v

# Rebuild and start
docker-compose up --build
```

### Database connection errors
- Ensure PostgreSQL is healthy: `docker-compose ps`
- Check logs: `docker-compose logs postgres`
- Migrations might need time to run on first startup

### Token expired
- Re-login to get a new token
- Tokens expire based on `JWT_EXPIRES_IN` setting

### Port conflicts
- Ensure ports 3000-3005 are available
- Stop any services using these ports
- Or modify ports in `docker-compose.yml`

## Next Steps

- Explore Prisma Studio for each service's database
- Add custom business logic to services
- Implement additional endpoints
- Add comprehensive test suites
- Set up CI/CD pipeline
