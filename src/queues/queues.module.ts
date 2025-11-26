import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { FollowupJobsProcessor } from './followup-jobs.processor';
import { PrismaModule } from '../common/prisma/prisma.module';
import { MessagingModule } from '../modules/skills/messaging/messaging.module';
import { MessagesModule } from '../modules/messages/messages.module';

@Module({
  imports: [
    PrismaModule,
    MessagingModule,
    MessagesModule,
    BullModule.registerQueue({
      name: 'followup-jobs',
    }),
  ],
  providers: [FollowupJobsProcessor],
  exports: [FollowupJobsProcessor],
})
export class QueuesModule {}
