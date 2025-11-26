import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MessagingService } from './messaging.service';

@Module({
  imports: [ConfigModule],
  providers: [MessagingService],
  exports: [MessagingService],
})
export class MessagingModule {}
