# Copilot Instructions for DynaClaimz SaaS API

## Project Overview
This is a RESTful API service for an Insurance SaaS platform built with Node.js, TypeScript, and Express. It provides core insurance operations including policy management, claims processing, customer management, and quote generation.

## Architecture

### Domain-Driven Structure
The codebase follows a layered architecture pattern:

```
src/
├── controllers/     # HTTP request handlers - thin layer that delegates to services
├── services/       # Business logic (e.g., authService handles JWT, password hashing)
├── models/         # Data access layer - uses Prisma ORM for PostgreSQL
├── routes/         # Express route definitions with middleware composition
├── middleware/     # Cross-cutting concerns (auth, validation, error handling, logging)
├── types/          # TypeScript interfaces and enums for type safety
├── utils/          # Shared utilities (logger, response helpers, error classes)
└── config/         # Environment-based configuration and Prisma client
prisma/
├── schema.prisma   # Database schema with models, relations, and indexes
└── seed.ts         # Database seeding script for development/testing
```

### Key Architectural Patterns

**1. PostgreSQL Database with Prisma ORM**
- All models use Prisma Client for type-safe database access
- Pattern: Each model class wraps Prisma queries (e.g., `prisma.user.create()`)
- Database: PostgreSQL with full relational integrity
- Singleton Prisma client in `src/config/database.ts` prevents connection leaks
- Schema location: `prisma/schema.prisma` defines all tables, relations, indexes

**Database Relationships:**
- Customer → Policies (one-to-many) with cascade delete
- Customer → Claims (one-to-many) with cascade delete  
- Customer → Quotes (one-to-many) with cascade delete
- Policy → Claims (one-to-many) with cascade delete

**Prisma Commands:**
```bash
npm run prisma:generate    # Generate Prisma Client after schema changes
npm run prisma:migrate     # Create and apply migrations
npm run db:push            # Push schema changes without migration (dev only)
npm run db:seed            # Seed database with sample data
npm run prisma:studio      # Open Prisma Studio GUI for database browsing
```

**2. Authentication Flow**
- JWT-based authentication using `jsonwebtoken` library
- `authService.register()` → hashes password with bcrypt → creates user → returns JWT
- `authService.login()` → validates credentials → returns JWT
- `authenticate` middleware extracts JWT from `Authorization: Bearer <token>` header
- Adds `user` payload to request object: `(req as AuthRequest).user`

**3. Role-Based Access Control (RBAC)**
- Three roles: `admin`, `agent`, `customer` (defined in `UserRole` enum)
- `authorize(...roles)` middleware checks `req.user.role` against allowed roles
- Example: Only admins can delete policies, agents and admins can create them

**4. Error Handling Strategy**
- Custom `ApiError` class extends Error with `statusCode` and `isOperational` properties
- Controllers catch errors and use `sendError(res, message, statusCode)`
- Global `errorHandler` middleware logs all errors via Winston
- Validation errors use `express-validator` with custom `validate()` middleware wrapper

**5. Response Standardization**
- All responses use `ApiResponse<T>` interface: `{ success, data?, message?, errors? }`
- Helper functions: `sendSuccess(res, data, message)` and `sendError(res, message, statusCode)`
- Consistent error format for client consumption

## Development Workflow

### Initial Setup
```bash
npm install
cp .env.example .env
# Edit .env with your JWT_SECRET and DATABASE_URL

# Set up PostgreSQL database (ensure PostgreSQL is running)
# Example DATABASE_URL: postgresql://username:password@localhost:5432/dynaclaimz_db

# Generate Prisma Client
npm run prisma:generate

# Run database migrations
npm run prisma:migrate

# Optional: Seed with sample data
npm run db:seed
```

### Development Commands
```bash
npm run dev          # Start with hot reload (ts-node-dev)
npm run build        # Compile TypeScript to dist/
npm start            # Run compiled JS from dist/
npm test             # Run Jest tests
npm run lint         # ESLint check
npm run lint:fix     # Auto-fix linting issues
npm run format       # Prettier formatting

# Database commands
npm run prisma:generate    # Generate Prisma Client
npm run prisma:migrate     # Create and run migrations
npm run db:push            # Push schema without migration (dev)
npm run db:seed            # Seed database
npm run prisma:studio      # Open database GUI
```

### Making Changes

**Adding New Routes:**
1. Create controller in `src/controllers/` with methods returning `Promise<void>`
2. Create route file in `src/routes/` - apply middleware (auth, validation)
3. Register route in `src/routes/index.ts`
4. Controllers should use `sendSuccess()` and `sendError()` helpers

**Adding New Models:**
1. Define Prisma model in `prisma/schema.prisma` with proper relations and indexes
2. Run `npm run prisma:migrate` to create database migration
3. Define TypeScript interface in `src/types/` (often auto-generated from Prisma)
4. Create model class in `src/models/` wrapping Prisma queries
5. Import prisma client: `import { prisma } from '../config/database'`

**Example Model Pattern:**
```typescript
import { prisma } from '../config/database';

class MyModel {
  async create(data: Omit<MyType, 'id' | 'createdAt' | 'updatedAt'>) {
    return await prisma.myModel.create({ data });
  }
  
  async findById(id: string) {
    return await prisma.myModel.findUnique({ where: { id } });
  }
}
```

**Adding Validation:**
```typescript
import { body } from 'express-validator';
import { validate } from '../middleware/validation.middleware';

const myValidation = [
  body('email').isEmail().withMessage('Valid email required'),
  body('amount').isNumeric().withMessage('Amount must be numeric'),
];

router.post('/endpoint', validate(myValidation), controller.method);
```

## Code Conventions

### TypeScript Patterns
- Use interfaces over types for object shapes (defined in `src/types/`)
- Enums for fixed sets of values (e.g., `PolicyType`, `ClaimStatus`)
- Avoid `any` - use generics or proper typing
- Controllers and services are classes with singleton exports

### Async/Await
- All async functions return `Promise<T>`
- Controllers return `Promise<void>` (they send responses, don't return values)
- Use try/catch in controllers - delegate errors to `sendError()`

### Naming Conventions
- Files: `kebab-case.ts` (e.g., `auth.controller.ts`)
- Classes: `PascalCase` (e.g., `AuthController`)
- Interfaces: `PascalCase` (e.g., `User`, `Policy`)
- Variables/functions: `camelCase`
- Constants: `UPPER_SNAKE_CASE` (in config files)

### Import Path Aliases
Configured in `tsconfig.json` and `jest.config.js`:
```typescript
import { authService } from '@services/auth.service';
import { User } from '@types/auth.types';
```
Note: Currently not working due to module resolution - use relative paths for now.

## DynaClaimz Domain Model

### Core Entities
- **User**: Authentication entity with role (admin/agent/customer)
- **Customer**: Business entity separate from User - contains insurance-specific data
- **Policy**: Insurance policy with type (auto/home/life/health/business) and status
- **Claim**: Claim against a policy with workflow status (submitted → under_review → approved/denied → paid)
- **Quote**: Temporary quote with expiration date (30 days) - can be converted to policy

### Business Logic Locations
- **Premium Calculation**: `QuoteController.create()` - simple 1.5% of coverage (replace with real actuarial logic)
- **Password Hashing**: `authService.register()` uses bcrypt with salt rounds = 10
- **JWT Generation**: `authService.generateToken()` - expires based on `JWT_EXPIRES_IN` env var
- **Claims Workflow**: Status transitions managed in `ClaimController.update()` - add business rules here

## Security & Middleware Stack

### Request Pipeline Order (from `app.ts`)
1. **Helmet** - Sets security HTTP headers
2. **CORS** - Configured via `ALLOWED_ORIGINS` env var
3. **Rate Limiting** - 100 requests per 15 minutes per IP (configurable)
4. **Morgan** - HTTP request logging piped to Winston
5. **Body Parsing** - JSON and URL-encoded
6. **Routes** - Apply authentication/authorization per route
7. **404 Handler** - Catches undefined routes
8. **Error Handler** - Global error middleware

### Authentication Usage
```typescript
// Require authentication only
router.get('/protected', authenticate, controller.method);

// Require specific roles
router.post('/admin-only', 
  authenticate, 
  authorize(UserRole.ADMIN), 
  controller.method
);
```

## Testing & Quality

### Test Structure (Jest)
- Test files: `*.test.ts` or `*.spec.ts`
- Coverage: Run `npm test -- --coverage`
- Path aliases configured in `jest.config.js` moduleNameMapper

### Logging
- Winston logger instance exported from `src/utils/logger.ts`
- Log levels: error, warn, info, debug
- Files: `logs/error.log` and `logs/combined.log`
- Use: `logger.info('message', { metadata })` not `console.log()`

## Common Pitfalls

1. **Database not running**: Ensure PostgreSQL is running before starting the app
2. **Prisma Client not generated**: Run `npm run prisma:generate` after schema changes
3. **Missing migrations**: Run `npm run prisma:migrate` to sync database with schema
4. **Forgetting authentication**: Most routes require `authenticate` middleware
5. **Password exposure**: Controllers must exclude password field: `const { password, ...user } = result`
6. **Hardcoded values**: Use environment variables from `config/index.ts`
7. **Missing validation**: Always validate user input with `express-validator`
8. **Cascade deletes**: Be aware that deleting customers cascades to policies, claims, and quotes

## Next Steps for Production

- [x] PostgreSQL database with Prisma ORM
- [ ] Add comprehensive test coverage (unit + integration)
- [ ] Implement API documentation (Swagger/OpenAPI)
- [ ] Add pagination to list endpoints
- [ ] Implement proper audit logging
- [ ] Add health checks for database connection
- [ ] Set up CI/CD pipeline with database migrations
- [ ] Add monitoring and error tracking (Sentry, DataDog)
- [ ] Implement proper claims workflow with state machine
- [ ] Add premium calculation service with actuarial tables
- [ ] Set up database backups and point-in-time recovery
- [ ] Add database indexes for common query patterns
