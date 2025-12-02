# User Journey Workflows for Observability Demo

This document outlines realistic multi-step workflows that can be scripted for generating observability data.

## Journey 1: Quote to Policy (Happy Path)

**Scenario**: Customer gets a quote and converts it to an active policy

```bash
# Step 1: Login as customer
POST /api/v1/auth/login
{
  "email": "customer@example.com",
  "password": "password123"
}
# Returns: { token, user }

# Step 2: Calculate premium (pre-quote)
POST /api/v1/quotes/calculate
Authorization: Bearer {token}
{
  "type": "AUTO",
  "coverageAmount": 50000
}
# Returns: { estimatedPremium: 750 }

# Step 3: Create quote
POST /api/v1/quotes
Authorization: Bearer {token}
{
  "userId": "{userId}",
  "quoteNumber": "QUO-12345",
  "type": "AUTO",
  "coverageAmount": 50000
}
# Returns: { quote with id, premium, expiresAt }

# Step 4: View my quotes
GET /api/v1/quotes/my/quotes
Authorization: Bearer {token}
# Returns: { data: [quotes], pagination }

# Step 5: Convert quote to policy
POST /api/v1/quotes/{quoteId}/convert
Authorization: Bearer {token}
# Returns: { quote: CONVERTED, policy: ACTIVE }

# Step 6: View my policies
GET /api/v1/policies/my/policies
Authorization: Bearer {token}
# Returns: { data: [policies], pagination }
```

**Observability Signals**:
- 6 HTTP requests across 2 services (user-service, quotes-service, policy-service)
- Cross-service call: quotes-service → policy-service
- Database writes: 1 quote, 1 policy, 1 quote status history
- Trace spans: auth validation, premium calculation, quote creation, policy creation

---

## Journey 2: File and Approve Claim (Agent Workflow)

**Scenario**: Customer files claim, agent reviews and approves it

```bash
# Step 1: Login as customer
POST /api/v1/auth/login
{
  "email": "customer@example.com",
  "password": "password123"
}

# Step 2: Get my active policies
GET /api/v1/policies/my/policies?status=ACTIVE
Authorization: Bearer {token}
# Returns: { data: [policies] }

# Step 3: File claim from policy
POST /api/v1/policies/{policyId}/file-claim
Authorization: Bearer {token}
{
  "incidentDate": "2025-11-20",
  "description": "Rear-end collision at stoplight",
  "claimAmount": 3500
}
# Returns: { claim: SUBMITTED }

# Step 4: View my claims
GET /api/v1/claims/my/claims
Authorization: Bearer {token}
# Returns: { data: [claims] }

# --- Agent logs in ---

# Step 5: Login as agent
POST /api/v1/auth/login
{
  "email": "agent@example.com",
  "password": "password123"
}

# Step 6: Get all submitted claims
GET /api/v1/claims?status=SUBMITTED
Authorization: Bearer {agentToken}
# Returns: { data: [claims], pagination }

# Step 7: Update claim to under review
PUT /api/v1/claims/{claimId}/status
Authorization: Bearer {agentToken}
{
  "status": "UNDER_REVIEW"
}

# Step 8: Approve claim
POST /api/v1/claims/{claimId}/approve
Authorization: Bearer {agentToken}
{
  "approvedAmount": 3200,
  "reason": "Valid claim, approved with deductible"
}
# Returns: { claim: APPROVED, approvedAmount: 3200 }

# Step 9: View claim history
GET /api/v1/claims/{claimId}/history
Authorization: Bearer {agentToken}
# Returns: { data: [SUBMITTED→UNDER_REVIEW→APPROVED] }
```

**Observability Signals**:
- 9 HTTP requests across 3 services (auth, policy, claims)
- Cross-service calls: policy-service → claims-service, claims-service → user-service
- Database writes: 1 claim, 3 claim status history entries
- Multi-user trace: customer → agent workflow handoff
- State machine transitions: SUBMITTED → UNDER_REVIEW → APPROVED

---

## Journey 3: Denied Claim (Failure Path)

**Scenario**: Customer files claim that gets denied

```bash
# Step 1-4: Same as Journey 2 (login, get policies, file claim)

# Step 5: Agent denies claim
POST /api/v1/claims/{claimId}/deny
Authorization: Bearer {agentToken}
{
  "reason": "Incident occurred before policy start date"
}
# Returns: { claim: DENIED, denialReason }

# Step 6: Customer checks claim status
GET /api/v1/claims/my/claims
Authorization: Bearer {customerToken}
# Returns: { data: [claim with status DENIED] }
```

**Observability Signals**:
- Error scenario (business logic, not technical)
- State transition: SUBMITTED → DENIED (skips UNDER_REVIEW)
- Shows validation and workflow enforcement

---

## Journey 4: Expired Quote (Time-Based Workflow)

**Scenario**: Quote expires before conversion

```bash
# Step 1-3: Create quote (as in Journey 1)

# Step 4: Wait or simulate time passage
# (In production, run scheduled job)

# Step 5: Expire old quotes (cron job simulation)
POST /api/v1/quotes/expire-old
Authorization: Bearer {adminToken}
# Returns: { expiredCount: 5 }

# Step 6: Try to convert expired quote
POST /api/v1/quotes/{quoteId}/convert
Authorization: Bearer {customerToken}
# Returns: 400 { message: "Quote has expired" }

# Step 7: Create new quote
POST /api/v1/quotes
Authorization: Bearer {customerToken}
{
  "userId": "{userId}",
  "quoteNumber": "QUO-67890",
  "type": "AUTO",
  "coverageAmount": 50000
}
```

**Observability Signals**:
- Batch operation (expire-old updates multiple records)
- Error handling (expired quote conversion fails)
- Retry pattern (create new quote after failure)

---

## Journey 5: Multi-Tenant Isolation

**Scenario**: Two organizations operate independently

```bash
# Org A: Create organization and user
POST /api/v1/auth/organizations
{
  "name": "Acme Insurance",
  "slug": "acme-insurance",
  "plan": "professional"
}

POST /api/v1/auth/register
{
  "email": "user@acme.com",
  "password": "password",
  "organizationId": "{orgA_id}"
}

# Org B: Create organization and user
POST /api/v1/auth/organizations
{
  "name": "Beta Insurance",
  "slug": "beta-insurance",
  "plan": "enterprise"
}

POST /api/v1/auth/register
{
  "email": "user@beta.com",
  "password": "password",
  "organizationId": "{orgB_id}"
}

# Org A user creates policy
POST /api/v1/policies
Authorization: Bearer {orgA_token}
{
  "userId": "{orgA_userId}",
  "policyNumber": "POL-A-001",
  "type": "AUTO"
}

# Org B user lists policies (should not see Org A policies)
GET /api/v1/policies
Authorization: Bearer {orgB_token}
# Returns: { data: [] } (empty, tenant isolated)
```

**Observability Signals**:
- High-cardinality labels: organizationId in all queries
- Tenant isolation enforcement
- Multiple isolated trace trees (one per org)

---

## Recommended Simulation Script Pattern

```javascript
// Pseudo-code for load testing script

const workflows = [
  { name: 'quote-to-policy', weight: 40, journey: journey1 },
  { name: 'file-approve-claim', weight: 30, journey: journey2 },
  { name: 'denied-claim', weight: 10, journey: journey3 },
  { name: 'expired-quote', weight: 15, journey: journey4 },
  { name: 'multi-tenant', weight: 5, journey: journey5 }
];

// Run weighted random workflows
for (let i = 0; i < 1000; i++) {
  const workflow = selectWeighted(workflows);
  await executeWorkflow(workflow.journey);
  await sleep(randomBetween(100, 5000)); // Variable think time
}
```

---

## Key Observability Metrics Per Journey

| Journey | Services Hit | Avg Steps | DB Writes | Cross-Service Calls |
|---------|--------------|-----------|-----------|---------------------|
| Quote→Policy | 3 | 6 | 2 | 1 |
| File+Approve Claim | 3 | 9 | 4 | 2 |
| Denied Claim | 3 | 6 | 2 | 2 |
| Expired Quote | 2 | 7 | 6 (batch) | 0 |
| Multi-Tenant | 4 | 6 | 4 | 0 |

---

## Error Scenarios to Inject

1. **Validation Failures** (400s): Invalid data, missing fields
2. **Authorization Failures** (401/403): Expired tokens, cross-tenant access
3. **Not Found** (404s): Invalid IDs, deleted resources
4. **Business Logic Errors** (400s): Expired quotes, invalid state transitions
5. **Service Timeouts** (504s): Slow downstream services
6. **Rate Limiting** (429s): Too many requests

These can be injected randomly at ~5-10% rate for realistic error patterns.
