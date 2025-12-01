# InsureTech SaaS API - PostgreSQL Migration

This project has been updated to use **PostgreSQL** with **Prisma ORM** instead of in-memory storage.

## Prerequisites

- Node.js 18+
- PostgreSQL 14+ running locally or accessible remotely

## Database Setup

### 1. Install PostgreSQL

**macOS (Homebrew):**
```bash
brew install postgresql@14
brew services start postgresql@14
```

**Ubuntu/Debian:**
```bash
sudo apt-get install postgresql postgresql-contrib
sudo systemctl start postgresql
```

**Docker:**
```bash
docker run --name postgres -e POSTGRES_PASSWORD=postgres -p 5432:5432 -d postgres:14
```

### 2. Create Database

```bash
# Connect to PostgreSQL
psql -U postgres

# Create database
CREATE DATABASE insuretech_db;

# Create user (optional)
CREATE USER insuretech_user WITH PASSWORD 'your_password';
GRANT ALL PRIVILEGES ON DATABASE insuretech_db TO insuretech_user;

\q
```

### 3. Configure Environment

```bash
# Copy environment template
cp .env.example .env

# Edit .env and set DATABASE_URL
# Example: DATABASE_URL="postgresql://postgres:postgres@localhost:5432/insuretech_db"
```

### 4. Install Dependencies

```bash
npm install
```

### 5. Run Migrations

```bash
# Generate Prisma Client
npm run prisma:generate

# Run database migrations
npm run prisma:migrate

# Seed database with sample data
npm run db:seed
```

## Database Schema

The schema includes:

- **users** - Authentication with roles (admin, agent, customer)
- **customers** - Customer profiles with address (flattened for PostgreSQL)
- **policies** - Insurance policies with foreign key to customers
- **claims** - Claims linked to policies and customers
- **quotes** - Insurance quotes for customers

### Key Relationships

- Customer → Policies (1:N, cascade delete)
- Customer → Claims (1:N, cascade delete)
- Customer → Quotes (1:N, cascade delete)
- Policy → Claims (1:N, cascade delete)

### Sample Data

After running `npm run db:seed`, you'll have:

- **Admin user**: `admin@insuretech.com` / `admin123`
- **Agent user**: `agent@insuretech.com` / `agent123`
- **Sample customer**: `john.doe@example.com`
- **Sample policy**: `POL-2024-001`
- **Sample quote** for home insurance

## Development Workflow

```bash
# Start development server
npm run dev

# View database in Prisma Studio
npm run prisma:studio

# Reset database (WARNING: deletes all data)
npx prisma migrate reset

# Generate migration after schema changes
npm run prisma:migrate
```

## Model Changes

All model files in `src/models/` now use Prisma Client:

**Before (In-Memory):**
```typescript
private users: Map<string, User> = new Map();
this.users.set(user.id, user);
```

**After (PostgreSQL):**
```typescript
await prisma.user.create({ data });
await prisma.user.findUnique({ where: { id } });
```

## Testing API

Use the seeded credentials:

```bash
# Login as admin
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@insuretech.com","password":"admin123"}'

# Use the returned JWT token in Authorization header
# Authorization: Bearer <token>
```

## Troubleshooting

**Connection refused:**
- Ensure PostgreSQL is running: `brew services list` or `systemctl status postgresql`

**Migration errors:**
- Reset database: `npx prisma migrate reset`
- Check DATABASE_URL format in `.env`

**Prisma Client not found:**
- Run `npm run prisma:generate`

**Port already in use:**
- Change PostgreSQL port in DATABASE_URL or stop conflicting service
