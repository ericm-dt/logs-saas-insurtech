import { PrismaClient, UserRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

const organizationNames = [
  'Beacon Shield Insurance',
  'Trustway Coverage Group',
  'Keystone Protection Partners',
  'BlueRiver Risk Management',
  'Silverline Assurance Co',
  'Clearview Insurance Group',
  'Redwood Coverage Solutions',
  'Pathway Protection Services',
  'Crestmont Insurance Corp',
  'Brightstone Risk Advisors',
  'Lakeside Coverage Network',
  'Summit Horizon Insurance',
  'Ridgeline Protection Co',
  'Riverside Shield Group',
  'Oakmont Assurance Partners',
  'Westbrook Coverage Corp',
  'Highpoint Risk Solutions',
  'Greenfield Insurance Co',
  'Ironbridge Protection Group',
  'Cornerstone Shield Partners',
  'Fairway Coverage Services',
  'Maple Grove Insurance Corp',
  'Skyline Protection Network',
  'Heartland Risk Advisors',
  'Bayshore Coverage Group',
  'Crossroads Insurance Partners',
  'Timberline Shield Solutions',
  'Everbridge Protection Co',
  'Windstone Coverage Corp',
  'Harborview Risk Management'
];

const firstNames = [
  'James', 'Mary', 'John', 'Patricia', 'Robert', 'Jennifer', 'Michael', 'Linda',
  'William', 'Barbara', 'David', 'Elizabeth', 'Richard', 'Susan', 'Joseph', 'Jessica',
  'Thomas', 'Sarah', 'Charles', 'Karen', 'Christopher', 'Nancy', 'Daniel', 'Lisa',
  'Matthew', 'Margaret', 'Anthony', 'Betty', 'Mark', 'Sandra'
];

const lastNames = [
  'Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis',
  'Rodriguez', 'Martinez', 'Hernandez', 'Lopez', 'Gonzalez', 'Wilson', 'Anderson', 'Thomas',
  'Taylor', 'Moore', 'Jackson', 'Martin', 'Lee', 'Perez', 'Thompson', 'White',
  'Harris', 'Sanchez', 'Clark', 'Ramirez', 'Lewis', 'Robinson'
];

type PlanType = 'free' | 'starter' | 'professional' | 'enterprise';
type OrgRoleType = 'MEMBER' | 'ADMIN' | 'OWNER';

const plans: PlanType[] = ['free', 'starter', 'professional', 'enterprise'];

function getRandomElement<T>(array: T[]): T {
  return array[Math.floor(Math.random() * array.length)];
}

function generateEmail(firstName: string, lastName: string, orgName: string): string {
  const slug = orgName.toLowerCase().replace(/[^a-z0-9]+/g, '');
  return `${firstName.toLowerCase()}.${lastName.toLowerCase()}@${slug}.com`;
}

async function seed() {
  console.log('Starting database seed...');

  // Clear existing data
  await prisma.user.deleteMany();
  await prisma.organization.deleteMany();

  const hashedPassword = await bcrypt.hash('password123', 10);

  // Create organizations with users
  for (let i = 0; i < organizationNames.length; i++) {
    const orgName = organizationNames[i];
    const slug = orgName.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    const plan = getRandomElement(plans);

    console.log(`Creating organization: ${orgName}`);

    const organization = await prisma.organization.create({
      data: {
        name: orgName,
        slug,
        plan,
        status: 'active',
      },
    });

    // Create 1-3 users per organization
    const userCount = Math.floor(Math.random() * 3) + 1;
    const usedNames = new Set<string>();

    for (let j = 0; j < userCount; j++) {
      let firstName: string, lastName: string, email: string;
      let attempts = 0;

      // Ensure unique name combinations within the organization
      do {
        firstName = getRandomElement(firstNames);
        lastName = getRandomElement(lastNames);
        email = generateEmail(firstName, lastName, orgName);
        attempts++;
      } while (usedNames.has(email) && attempts < 50);

      usedNames.add(email);

      // First user is owner, second is admin, rest are customers/agents
      const role: UserRole = j === 0 ? 'ADMIN' : j === 1 ? 'AGENT' : getRandomElement(['CUSTOMER', 'AGENT']) as UserRole;
      const orgRole: OrgRoleType = j === 0 ? 'OWNER' : j === 1 ? 'ADMIN' : 'MEMBER';

      await prisma.user.create({
        data: {
          email,
          password: hashedPassword,
          firstName,
          lastName,
          role,
          orgRole,
          organizationId: organization.id,
          dateOfBirth: new Date(1970 + Math.floor(Math.random() * 35), Math.floor(Math.random() * 12), Math.floor(Math.random() * 28) + 1),
          phone: `+1-555-${String(Math.floor(Math.random() * 9000) + 1000).padStart(4, '0')}-${String(Math.floor(Math.random() * 9000) + 1000).padStart(4, '0')}`,
          street: `${Math.floor(Math.random() * 9999) + 1} ${getRandomElement(['Main', 'Oak', 'Maple', 'Cedar', 'Pine', 'Elm'])} ${getRandomElement(['St', 'Ave', 'Blvd', 'Ln', 'Dr'])}`,
          city: getRandomElement(['New York', 'Los Angeles', 'Chicago', 'Houston', 'Phoenix', 'Philadelphia', 'San Antonio', 'San Diego', 'Dallas', 'Austin']),
          state: getRandomElement(['NY', 'CA', 'IL', 'TX', 'AZ', 'PA', 'FL', 'OH', 'GA', 'NC']),
          zipCode: String(Math.floor(Math.random() * 90000) + 10000),
          country: 'USA',
        },
      });

      console.log(`  Created user: ${firstName} ${lastName} (${role}, ${orgRole})`);
    }
  }

  const totalOrgs = await prisma.organization.count();
  const totalUsers = await prisma.user.count();

  console.log('\n✅ Seed completed successfully!');
  console.log(`Created ${totalOrgs} organizations`);
  console.log(`Created ${totalUsers} users`);
  console.log('\nDefault password for all users: password123');
}

seed()
  .catch((e) => {
    console.error('Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
