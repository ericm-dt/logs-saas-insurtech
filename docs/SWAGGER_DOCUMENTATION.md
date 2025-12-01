# Swagger API Documentation

## Overview

The InsureTech SaaS API is fully documented using OpenAPI 3.0 (Swagger) specification. The interactive API documentation is available through Swagger UI.

## Accessing Documentation

### Local Development

Once the services are running, access the Swagger UI at:

```
http://localhost:3000/api-docs
```

### Documentation Formats

- **Interactive UI**: `http://localhost:3000/api-docs` - Full interactive documentation with "Try it out" functionality
- **JSON Spec**: `http://localhost:3000/api-docs.json` - Raw OpenAPI 3.0 JSON specification

## Features

### Interactive Testing

The Swagger UI allows you to:

1. **Explore all endpoints** - Browse all available API endpoints organized by service
2. **View request/response schemas** - See detailed information about request parameters and response structures
3. **Try it out** - Execute API calls directly from the browser
4. **Authenticate** - Use the "Authorize" button to add your JWT token for protected endpoints

### Authentication

Most endpoints require JWT authentication:

1. Click the "Authorize" 🔒 button at the top of the Swagger UI
2. Enter your JWT token in the format: `Bearer <your-token-here>`
3. Click "Authorize" to save
4. Your token will now be included in all API requests

To get a token:
1. Use the `/api/v1/auth/register` endpoint to create an account
2. Or use `/api/v1/auth/login` to authenticate
3. Copy the `token` from the response
4. Use it in the Authorize dialog

## API Organization

The API is organized into the following sections:

### Authentication (`/api/v1/auth`)
- User registration
- User login
- Get current user profile

### Customers (`/api/v1/customers`)
- List all customers
- Get customer by ID
- Create new customer
- Update customer information
- Delete customer

### Policies (`/api/v1/policies`)
- List all insurance policies
- Get policy by ID
- Create new policy
- Update policy details
- Delete policy

### Claims (`/api/v1/claims`)
- List all insurance claims
- Get claim by ID
- Submit new claim
- Update claim status
- Delete claim

### Quotes (`/api/v1/quotes`)
- List all insurance quotes
- Get quote by ID
- Generate new quote
- Update quote
- Delete quote
- Expire old quotes

## Schema Definitions

All request and response schemas are fully documented including:

- **Data types** - String, number, boolean, date, UUID, etc.
- **Validation rules** - Required fields, format constraints, enum values
- **Examples** - Sample values for all properties
- **Descriptions** - Clear explanations of each field

## Microservices Architecture

The API Gateway (port 3000) routes requests to the following microservices:

- **Auth Service**: Port 3001 - User authentication and authorization
- **Customer Service**: Port 3002 - Customer management
- **Policy Service**: Port 3003 - Insurance policy management
- **Claims Service**: Port 3004 - Claims processing
- **Quotes Service**: Port 3005 - Quote generation

All services can be accessed through the API Gateway at `/api/v1/*` or directly via their respective ports.

## Development

### Adding New Endpoints

To add new endpoints to the documentation:

1. Create or update YAML files in `services/api-gateway/src/swagger/`
2. Follow the OpenAPI 3.0 specification format
3. Use `$ref` to reference common schemas from `swagger.ts`
4. Restart the API Gateway to see changes

### Swagger Configuration

The Swagger configuration is located in:
- **Main config**: `services/api-gateway/src/swagger.ts`
- **Endpoint definitions**: `services/api-gateway/src/swagger/*.yaml`

### Updating Schemas

Common schemas (User, Customer, Policy, Claim, Quote) are defined in `swagger.ts` under `components.schemas`. Update these if your data models change.

## Best Practices

1. **Always authenticate** - Use the Authorize button for protected endpoints
2. **Check examples** - Each field includes example values to guide your requests
3. **Validate UUIDs** - Most IDs are UUIDs (e.g., `123e4567-e89b-12d3-a456-426614174000`)
4. **Review responses** - Check the response schemas to understand what data you'll receive
5. **Test incrementally** - Start with authentication, then move to other endpoints

## Troubleshooting

### Common Issues

**401 Unauthorized**
- Ensure you've clicked "Authorize" and entered a valid JWT token
- Token format must be: `Bearer <token>` (the "Bearer " prefix is added automatically)
- Tokens expire based on `JWT_EXPIRES_IN` environment variable (default: 7 days)

**400 Bad Request**
- Check required fields are provided
- Verify data types match the schema (e.g., dates in YYYY-MM-DD format)
- Ensure UUIDs are valid format

**404 Not Found**
- Verify the resource ID exists
- Check you're using the correct UUID

**403 Forbidden**
- Your user role doesn't have permission for this operation
- Some operations are restricted to ADMIN or AGENT roles

## Production Deployment

For production deployments:

1. Update the server URLs in `swagger.ts` to match your production domains
2. Enable HTTPS for secure token transmission
3. Consider implementing API rate limiting (already configured in the gateway)
4. Restrict Swagger UI access in production environments if needed
5. Keep documentation synchronized with API changes

## Additional Resources

- [OpenAPI Specification](https://swagger.io/specification/)
- [Swagger UI Documentation](https://swagger.io/tools/swagger-ui/)
- [InsureTech API Architecture](./MICROSERVICES_ARCHITECTURE.md)
