import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { FollowupService } from './followup.service';
import { PrismaModule } from '../../../common/prisma/prisma.module';

@Module({
  imports: [
    PrismaModule,
    BullModule.registerQueue({
      name: 'followup-jobs',
    }),
  ],
  providers: [FollowupService],
  exports: [FollowupService],
})
export class FollowupModule {}
