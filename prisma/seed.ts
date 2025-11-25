import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Starting database seed...');

  // Create admin user
  const adminPassword = await bcrypt.hash('admin123', 10);
  const admin = await prisma.user.upsert({
    where: { email: 'admin@insuretech.com' },
    update: {},
    create: {
      email: 'admin@insuretech.com',
      password: adminPassword,
      firstName: 'Admin',
      lastName: 'User',
      role: 'ADMIN',
    },
  });
  console.log('Created admin user:', admin.email);

  // Create agent user
  const agentPassword = await bcrypt.hash('agent123', 10);
  const agent = await prisma.user.upsert({
    where: { email: 'agent@insuretech.com' },
    update: {},
    create: {
      email: 'agent@insuretech.com',
      password: agentPassword,
      firstName: 'Agent',
      lastName: 'Smith',
      role: 'AGENT',
    },
  });
  console.log('Created agent user:', agent.email);

  // Create sample customer
  const customer = await prisma.customer.upsert({
    where: { email: 'john.doe@example.com' },
    update: {},
    create: {
      email: 'john.doe@example.com',
      firstName: 'John',
      lastName: 'Doe',
      dateOfBirth: new Date('1985-06-15'),
      phone: '+1-555-0123',
      street: '123 Main St',
      city: 'New York',
      state: 'NY',
      zipCode: '10001',
      country: 'USA',
    },
  });
  console.log('Created customer:', customer.email);

  // Create sample policy
  const policy = await prisma.policy.upsert({
    where: { policyNumber: 'POL-2024-001' },
    update: {},
    create: {
      policyNumber: 'POL-2024-001',
      customerId: customer.id,
      type: 'AUTO',
      status: 'ACTIVE',
      premium: 1200.00,
      coverage: 50000.00,
      startDate: new Date('2024-01-01'),
      endDate: new Date('2025-01-01'),
    },
  });
  console.log('Created policy:', policy.policyNumber);

  // Create sample quote
  const quote = await prisma.quote.create({
    data: {
      customerId: customer.id,
      type: 'HOME',
      coverage: 300000.00,
      estimatedPremium: 4500.00,
      status: 'ACTIVE',
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
    },
  });
  console.log('Created quote:', quote.id);

  console.log('Database seed completed successfully!');
}

main()
  .catch((e) => {
    console.error('Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
