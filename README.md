# InsureTech SaaS API

A comprehensive RESTful API for an InsureTech SaaS platform built with Node.js, TypeScript, and Express.

## Features

- **Authentication & Authorization**: JWT-based authentication with role-based access control (Admin, Agent, Customer)
- **Policy Management**: Create, read, update, and delete insurance policies (Auto, Home, Life, Health, Business)
- **Claims Processing**: Submit and manage insurance claims with status tracking
- **Customer Management**: Manage customer profiles and information
- **Quote Generation**: Generate insurance quotes with automated premium calculation
- **Security**: Helmet, CORS, rate limiting, input validation
- **Logging**: Winston-based structured logging
- **Type Safety**: Full TypeScript implementation

## Tech Stack

- **Runtime**: Node.js
- **Language**: TypeScript
- **Framework**: Express.js
- **Database**: PostgreSQL with Prisma ORM
- **Authentication**: JWT (jsonwebtoken)
- **Security**: Helmet, bcryptjs, express-rate-limit
- **Validation**: express-validator
- **Logging**: Winston, Morgan
- **Testing**: Jest
- **Code Quality**: ESLint, Prettier

## Getting Started

### Prerequisites

- Node.js 18+ and npm
- PostgreSQL 14+ (see [DATABASE_MIGRATION.md](./DATABASE_MIGRATION.md) for setup)

### Installation

```bash
# Install dependencies
npm install

# Set up PostgreSQL database
# See DATABASE_MIGRATION.md for detailed instructions

# Copy environment variables
cp .env.example .env

# Edit .env and set DATABASE_URL and JWT_SECRET
# Example: DATABASE_URL="postgresql://postgres:postgres@localhost:5432/insuretech_db"

# Generate Prisma Client
npm run prisma:generate

# Run database migrations
npm run prisma:migrate

# Seed database with sample data (optional)
npm run db:seed
```

### Running the Application

```bash
# Development mode with hot reload
npm run dev

# Production build
npm run build
npm start

# Run tests
npm test
```

## API Endpoints

### Authentication
- `POST /api/v1/auth/register` - Register a new user
- `POST /api/v1/auth/login` - Login and get JWT token
- `GET /api/v1/auth/me` - Get current user info (authenticated)

### Policies
- `POST /api/v1/policies` - Create a policy (Admin/Agent)
- `GET /api/v1/policies` - List all policies
- `GET /api/v1/policies/:id` - Get policy by ID
- `GET /api/v1/policies/customer/:customerId` - Get customer policies
- `PUT /api/v1/policies/:id` - Update policy (Admin/Agent)
- `DELETE /api/v1/policies/:id` - Delete policy (Admin)

### Claims
- `POST /api/v1/claims` - Submit a claim
- `GET /api/v1/claims` - List all claims (Admin/Agent)
- `GET /api/v1/claims/:id` - Get claim by ID
- `GET /api/v1/claims/policy/:policyId` - Get claims for a policy
- `PUT /api/v1/claims/:id` - Update claim (Admin/Agent)

### Customers
- `POST /api/v1/customers` - Create customer (Admin/Agent)
- `GET /api/v1/customers` - List all customers (Admin/Agent)
- `GET /api/v1/customers/:id` - Get customer by ID
- `PUT /api/v1/customers/:id` - Update customer
- `DELETE /api/v1/customers/:id` - Delete customer (Admin)

### Quotes
- `POST /api/v1/quotes` - Generate a quote
- `GET /api/v1/quotes` - List all quotes (Admin/Agent)
- `GET /api/v1/quotes/:id` - Get quote by ID
- `GET /api/v1/quotes/customer/:customerId` - Get customer quotes
- `PUT /api/v1/quotes/:id` - Update quote (Admin/Agent)

### Utility
- `GET /api/v1/health` - Health check endpoint

## Project Structure

```
src/
├── config/          # Configuration files
├── controllers/     # Request handlers
├── middleware/      # Express middleware (auth, validation, error handling)
├── models/          # Data models (Prisma ORM)
├── routes/          # Route definitions
├── services/        # Business logic
├── types/           # TypeScript type definitions
├── utils/           # Utility functions (logger, response helpers)
├── app.ts           # Express app setup
└── server.ts        # Application entry point

prisma/
├── schema.prisma    # Database schema
└── seed.ts          # Database seeding script
```

## Authentication

All protected endpoints require a JWT token in the Authorization header:

```
Authorization: Bearer <your-jwt-token>
```

## Role-Based Access Control

- **Admin**: Full access to all endpoints
- **Agent**: Can manage policies, claims, customers, and quotes
- **Customer**: Can view their own data and submit claims/quotes

## Data Models

### User Roles
- `admin` - Full system access
- `agent` - Insurance agent with elevated permissions
- `customer` - End user with limited access

### Policy Types
- `auto` - Auto insurance
- `home` - Home insurance
- `life` - Life insurance
- `health` - Health insurance
- `business` - Business insurance

### Policy Status
- `active` - Active policy
- `pending` - Awaiting approval
- `cancelled` - Cancelled policy
- `expired` - Expired policy

### Claim Status
- `submitted` - Newly submitted
- `under_review` - Being reviewed
- `approved` - Approved for payment
- `denied` - Claim denied
- `paid` - Payment processed

## Development

```bash
# Lint code
npm run lint

# Fix linting issues
npm run lint:fix

# Format code
npm run format

# Run tests in watch mode
npm run test:watch

# Database management
npm run prisma:studio    # Open Prisma Studio GUI
npm run prisma:generate  # Regenerate Prisma Client
npm run prisma:migrate   # Create and apply migrations
```

## Database

This project uses PostgreSQL with Prisma ORM. See [DATABASE_MIGRATION.md](./DATABASE_MIGRATION.md) for:
- PostgreSQL installation and setup
- Database creation and configuration
- Migration commands
- Seeding data
- Troubleshooting

## Notes

This is a **production-ready** application with PostgreSQL database. Key features:
- Full ACID compliance with relational integrity
- Cascade deletes for data consistency
- Database migrations for schema versioning
- Type-safe database queries with Prisma

For next steps:
- Add comprehensive input validation
- Implement proper error tracking (Sentry, etc.)
- Add API documentation (Swagger/OpenAPI)
- Implement pagination for list endpoints
- Add comprehensive test coverage
- Set up CI/CD pipeline with automated migrations
- Configure database backups

## License

MIT
