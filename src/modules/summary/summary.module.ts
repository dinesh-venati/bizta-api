import { Module } from '@nestjs/common';
import { SummaryService } from './summary.service';
import { SummaryScheduler } from './summary.scheduler';
import { SummaryController } from './summary.controller';
import { PrismaModule } from '../../common/prisma/prisma.module';
import { LlmModule } from '../llm/llm.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [PrismaModule, LlmModule, NotificationsModule],
  controllers: [SummaryController],
  providers: [SummaryService, SummaryScheduler],
  exports: [SummaryService, SummaryScheduler],
})
export class SummaryModule {}
