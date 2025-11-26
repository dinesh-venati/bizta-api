import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // Update followup delay to 2 minutes (0.0333 hours)
  const updated = await prisma.settings.updateMany({
    data: {
      followupDelayHours: 0.0333, // 2 minutes
    },
  });

  console.log(`✅ Updated ${updated.count} settings record(s)`);
  console.log('📅 Followup delay is now 2 minutes (0.0333 hours)');

  // Verify
  const settings = await prisma.settings.findMany({
    select: {
      orgId: true,
      followupDelayHours: true,
      autoFollowup: true,
    },
  });

  console.log('\nCurrent settings:');
  settings.forEach((s) => {
    console.log(`  Org ${s.orgId.substring(0, 8)}...: followupDelayHours = ${s.followupDelayHours}, autoFollowup = ${s.autoFollowup}`);
  });
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
