import { Module } from '@nestjs/common';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';
import { PrismaModule } from '@/common/prisma/prisma.module';
import { MessagingModule } from '@/modules/skills/messaging/messaging.module';

@Module({
  imports: [PrismaModule, MessagingModule],
  controllers: [DashboardController],
  providers: [DashboardService],
  exports: [DashboardService],
})
export class DashboardModule {}
