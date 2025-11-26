import { Module } from '@nestjs/common';
import { BusinessFaqService } from './business-faq.service';
import { PrismaModule } from '@/common/prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  providers: [BusinessFaqService],
  exports: [BusinessFaqService],
})
export class BusinessFaqModule {}
