/* eslint-disable */
// Quick script to get the first organization ID for testing
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // Try to find first organization
  const org = await prisma.organization.findFirst();
  
  if (org) {
    console.log('Found organization:', org.id);
    console.log('Update .env: PLACEHOLDER_ORG_ID=' + org.id);
  } else {
    console.log('No organizations found. Please register a user first via POST /auth/register');
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
