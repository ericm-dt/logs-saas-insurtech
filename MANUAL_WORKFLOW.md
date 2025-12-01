# Manual Workflow Guide

This guide walks you through the complete insurance workflow manually using curl commands.

## Architecture Overview

### Foreign Key Relationships

```
Organization (user-service)
    ↓ (1:many)
User (user-service)
    ↓ (1:many - soft reference via userId)
Quote (quotes-service)
    ↓ (convert workflow)
Policy (policy-service) ← references userId & organizationId
    ↓ (1:many - soft reference via policyId)
Claim (claims-service) ← references userId, organizationId, policyId
```

### Foreign Key Patterns

**Within-Database Relationships (Hard FKs):**
- `User.organizationId` → `Organization.id` (with Cascade delete)
- `Quote.statusHistory[]` → `Quote.id` (with Cascade delete)
- `Policy.statusHistory[]` → `Policy.id` (with Cascade delete)
- `Claim.statusHistory[]` → `Claim.id` (with Cascade delete)

**Cross-Service References (Soft FKs - no DB constraint):**
- `Quote.userId` → User ID (validated via API call)
- `Quote.organizationId` → Organization ID (for multi-tenancy)
- `Policy.userId` → User ID (validated via API call)
- `Policy.organizationId` → Organization ID (for multi-tenancy)
- `Claim.userId` → User ID (validated via API call)
- `Claim.organizationId` → Organization ID (for multi-tenancy)
- `Claim.policyId` → Policy ID (validated via API call to policy-service)

---

## Workflow Steps

### Step 1: List Available Organizations

```bash
# First, get an admin token to view organizations
# Use a pre-seeded user or create one

# List all organizations
curl -X GET http://localhost:3000/api/v1/organizations | jq
```

### Step 2: Login to Get JWT Token

```bash
# Login with a seeded user (example: an agent from Safety First Insurance)
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{
    "email": "susan.thomas@safetyfirstinsurance.com",
    "password": "SecurePass123!"
  }' | jq

# Save the token from the response
export TOKEN="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
export USER_ID="2a518544-ef35-4e42-ba19-ab4a3aff46f1"
```

### Step 3: Verify Authentication

```bash
# Test the token with the /me endpoint
curl -X GET http://localhost:3000/api/v1/auth/me \
  -H "Authorization: Bearer $TOKEN" | jq
```

### Step 4: Create a Quote

```bash
# Create an insurance quote
curl -X POST http://localhost:3000/api/v1/quotes \
  -H 'Content-Type: application/json' \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "userId": "'"$USER_ID"'",
    "quoteNumber": "QUO-2025-001",
    "type": "AUTO",
    "coverageAmount": 50000,
    "expiresAt": "2025-12-31T23:59:59Z"
  }' | jq

# Save the quote ID
export QUOTE_ID="abc123-def456-..."
```

**What happens:**
- Quote is created with status `ACTIVE`
- Premium is automatically calculated (1.5% × coverage × type multiplier)
  - AUTO: 1.0x multiplier = $750
  - HOME: 1.2x multiplier
  - LIFE: 0.8x multiplier
  - HEALTH: 1.5x multiplier
  - BUSINESS: 2.0x multiplier
- Quote is linked to the user and organization from your token
- Quote expires in 30 days (or custom expiration date)

### Step 5: View Quote Details

```bash
# Get specific quote
curl -X GET http://localhost:3000/api/v1/quotes/$QUOTE_ID \
  -H "Authorization: Bearer $TOKEN" | jq

# List all quotes for your organization
curl -X GET http://localhost:3000/api/v1/quotes?page=1&limit=50 \
  -H "Authorization: Bearer $TOKEN" | jq

# List only your quotes
curl -X GET http://localhost:3000/api/v1/quotes/my/quotes \
  -H "Authorization: Bearer $TOKEN" | jq
```

### Step 6: Convert Quote to Policy

```bash
# Convert the quote to an active policy
curl -X POST http://localhost:3000/api/v1/quotes/$QUOTE_ID/convert \
  -H "Authorization: Bearer $TOKEN" | jq

# Save the policy ID from the response
export POLICY_ID="xyz789-abc123-..."
```

**What happens:**
- Validates quote is `ACTIVE` and not expired
- Calls policy-service to create a new policy with:
  - Same coverage amount and premium as quote
  - Same policy type (AUTO, HOME, etc.)
  - Start date: today
  - End date: 1 year from today
  - Status: `ACTIVE`
- Updates quote status from `ACTIVE` → `CONVERTED`
- Creates a `QuoteStatusHistory` record
- Returns both the updated quote and new policy

### Step 7: View Policy Details

```bash
# Get specific policy
curl -X GET http://localhost:3000/api/v1/policies/$POLICY_ID \
  -H "Authorization: Bearer $TOKEN" | jq

# List all policies
curl -X GET http://localhost:3000/api/v1/policies \
  -H "Authorization: Bearer $TOKEN" | jq

# Filter policies by user
curl -X GET http://localhost:3000/api/v1/policies?userId=$USER_ID \
  -H "Authorization: Bearer $TOKEN" | jq

# Filter by status
curl -X GET http://localhost:3000/api/v1/policies?status=ACTIVE \
  -H "Authorization: Bearer $TOKEN" | jq
```

### Step 8: File a Claim Against the Policy

```bash
# Create a claim for the policy
curl -X POST http://localhost:3000/api/v1/claims \
  -H 'Content-Type: application/json' \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "userId": "'"$USER_ID"'",
    "policyId": "'"$POLICY_ID"'",
    "claimNumber": "CLM-2025-001",
    "incidentDate": "2025-11-15T10:00:00Z",
    "description": "Vehicle collision at intersection of Main St and 5th Ave",
    "claimAmount": 5000
  }' | jq

# Save the claim ID
export CLAIM_ID="claim123-abc456-..."
```

**What happens:**
- Claim is created with status `SUBMITTED`
- Validates that the policy exists (calls policy-service)
- Links claim to user, organization, and policy
- Records incident date and claim amount

### Step 9: Process the Claim (Status Updates)

```bash
# Step 9a: Move claim to under review
curl -X PUT http://localhost:3000/api/v1/claims/$CLAIM_ID/status \
  -H 'Content-Type: application/json' \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "status": "UNDER_REVIEW",
    "statusChangeReason": "Claim assigned to adjuster John Smith"
  }' | jq

# Step 9b: Approve the claim
curl -X PUT http://localhost:3000/api/v1/claims/$CLAIM_ID/status \
  -H 'Content-Type: application/json' \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "status": "APPROVED",
    "statusChangeReason": "Damage confirmed - repair estimate validated"
  }' | jq

# Step 9c: Mark claim as paid
curl -X PUT http://localhost:3000/api/v1/claims/$CLAIM_ID/status \
  -H 'Content-Type: application/json' \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "status": "PAID",
    "statusChangeReason": "Payment of $5,000 processed via ACH"
  }' | jq
```

**Claim Status Workflow:**
- `SUBMITTED` → Initial state when claim is filed
- `UNDER_REVIEW` → Claim being investigated by adjuster
- `APPROVED` → Claim validated and approved for payment
- `DENIED` → Claim rejected (alternative path)
- `PAID` → Payment sent to customer

Each status change creates a `ClaimStatusHistory` record with:
- Old status
- New status
- Changed by (userId from token)
- Timestamp
- Reason for change

### Step 10: View Claim History

```bash
# Get claim details
curl -X GET http://localhost:3000/api/v1/claims/$CLAIM_ID \
  -H "Authorization: Bearer $TOKEN" | jq

# Get complete status change history
curl -X GET http://localhost:3000/api/v1/claims/$CLAIM_ID/history \
  -H "Authorization: Bearer $TOKEN" | jq

# List all claims
curl -X GET http://localhost:3000/api/v1/claims \
  -H "Authorization: Bearer $TOKEN" | jq

# Filter claims by status
curl -X GET http://localhost:3000/api/v1/claims?status=APPROVED \
  -H "Authorization: Bearer $TOKEN" | jq
```

---

## Additional Workflow Features

### Calculate Premium (Without Creating Quote)

```bash
# Get premium estimate before creating quote
curl -X POST http://localhost:3000/api/v1/quotes/calculate \
  -H 'Content-Type: application/json' \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "type": "AUTO",
    "coverageAmount": 50000
  }' | jq
```

### Expire Old Quotes

```bash
# Utility endpoint to expire quotes past their expiration date
curl -X POST http://localhost:3000/api/v1/quotes/expire-old \
  -H "Authorization: Bearer $TOKEN" | jq
```

### Update Policy Status

```bash
# Cancel a policy
curl -X PUT http://localhost:3000/api/v1/policies/$POLICY_ID/status \
  -H 'Content-Type: application/json' \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "status": "CANCELLED",
    "statusChangeReason": "Customer requested cancellation"
  }' | jq

# Renew an expired policy
curl -X PUT http://localhost:3000/api/v1/policies/$POLICY_ID/status \
  -H 'Content-Type: application/json' \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "status": "ACTIVE",
    "statusChangeReason": "Policy renewed for another year"
  }' | jq
```

---

## Multi-Tenant Data Isolation

Every API request is scoped to your organization:

- **organizationId** is automatically extracted from your JWT token
- All queries are filtered by `organizationId`
- You can only see data belonging to your organization
- Cross-tenant access is prevented by middleware

**Example:**
- User from "Safety First Insurance" cannot see quotes/policies/claims from "Mountain View Insurance"
- Each organization's data is completely isolated

---

## Distributed Tracing Workflow

The complete workflow creates traces across all 4 microservices:

1. **user-service**: Authentication (login, verify token)
2. **quotes-service**: Create quote, calculate premium
3. **quotes-service → policy-service**: Convert quote to policy
4. **claims-service → policy-service**: Validate policy when filing claim
5. **claims-service**: Process claim through status changes

This distributed trace demonstrates:
- Service-to-service communication
- Multi-database transactions
- Cross-service data validation
- Status workflow state machines
- Audit trail via status history tables

Perfect for observability demos showing spans, dependencies, and data flow!

---

## Policy Types and Premium Multipliers

| Type | Multiplier | Example Premium (on $50k coverage) |
|------|------------|-----------------------------------|
| AUTO | 1.0x | $750 |
| HOME | 1.2x | $900 |
| LIFE | 0.8x | $600 |
| HEALTH | 1.5x | $1,125 |
| BUSINESS | 2.0x | $1,500 |

Base calculation: `premium = coverageAmount × 0.015 × multiplier`

---

## Common Query Patterns

### Filter by Date Range

```bash
# Policies expiring soon
curl -X GET "http://localhost:3000/api/v1/policies?endDateBefore=2026-01-31" \
  -H "Authorization: Bearer $TOKEN" | jq

# Recent claims
curl -X GET "http://localhost:3000/api/v1/claims?incidentAfter=2025-11-01" \
  -H "Authorization: Bearer $TOKEN" | jq
```

### Filter by Amount

```bash
# High-value policies
curl -X GET "http://localhost:3000/api/v1/policies?minCoverage=100000" \
  -H "Authorization: Bearer $TOKEN" | jq

# Large claims
curl -X GET "http://localhost:3000/api/v1/claims?minAmount=10000" \
  -H "Authorization: Bearer $TOKEN" | jq
```

### Pagination

```bash
# Get page 2 with 25 results per page
curl -X GET "http://localhost:3000/api/v1/quotes?page=2&limit=25" \
  -H "Authorization: Bearer $TOKEN" | jq
```

---

## Troubleshooting

### Token Expired
If you get 401 errors, your token may have expired (default: 7 days). Login again to get a fresh token.

### User Not Found
Ensure the `userId` in your request matches a user in your organization.

### Policy Not Found (when filing claim)
Verify the policy exists and is `ACTIVE`:
```bash
curl -X GET http://localhost:3000/api/v1/policies/$POLICY_ID \
  -H "Authorization: Bearer $TOKEN" | jq
```

### Quote Already Expired
Quotes expire 30 days after creation. Check the `expiresAt` field before converting.

### Authentication Failed
Ensure `AUTH_SERVICE_URL` environment variable is set for all services in docker-compose.yml.
