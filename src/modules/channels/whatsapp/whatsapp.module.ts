import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { WhatsAppController } from './whatsapp.controller';
import { WhatsAppService } from './whatsapp.service';
import { EventsModule } from '@/modules/events/events.module';
import { PrismaModule } from '@/common/prisma/prisma.module';

@Module({
  imports: [ConfigModule, EventsModule, PrismaModule],
  controllers: [WhatsAppController],
  providers: [WhatsAppService],
  exports: [WhatsAppService],
})
export class WhatsAppModule {}
