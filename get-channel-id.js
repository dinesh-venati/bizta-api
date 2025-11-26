const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function getWhatsAppChannel() {
  const channel = await prisma.channel.findFirst({
    where: { type: 'WHATSAPP' },
  });
  console.log(JSON.stringify(channel, null, 2));
  await prisma.$disconnect();
}

getWhatsAppChannel().catch((e) => {
  console.error(e);
  prisma.$disconnect();
});
