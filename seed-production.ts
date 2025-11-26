// Create test organization in production database
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  const orgId = '590223f8-0484-485f-88ee-ec2235455533';
  
  // Check if org already exists
  const existingOrg = await prisma.organization.findUnique({
    where: { id: orgId },
  });

  if (existingOrg) {
    console.log('✅ Organization already exists:', existingOrg.name);
    return;
  }

  // Create organization
  const org = await prisma.organization.create({
    data: {
      id: orgId,
      name: 'Test Organization',
      slug: 'test-org',
      isActive: true,
    },
  });

  console.log('✅ Created organization:', org.name);

  // Create settings
  const settings = await prisma.settings.create({
    data: {
      orgId: org.id,
      agentName: 'Bizta',
      autoReply: true,
      autoFollowup: true,
      followupDelayHours: 24,
      followupMessageTemplate: "Hi! Just checking in 🙂 Let me know if you'd like to continue or have any questions.",
      businessName: 'Test Business',
    },
  });

  console.log('✅ Created settings for org');

  // Create test user
  const hashedPassword = await bcrypt.hash('testpass123', 10);
  const user = await prisma.user.create({
    data: {
      email: 'test@test.com',
      password: hashedPassword,
      firstName: 'Test',
      lastName: 'User',
      isActive: true,
    },
  });

  console.log('✅ Created test user:', user.email);

  // Create membership
  await prisma.membership.create({
    data: {
      userId: user.id,
      orgId: org.id,
      role: 'OWNER',
    },
  });

  console.log('✅ Created membership');
  console.log('\n🎉 Production database seeded successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
