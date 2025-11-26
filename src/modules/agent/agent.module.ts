import { Module } from '@nestjs/common';
import { AgentService } from './agent.service';
import { PrismaModule } from '@/common/prisma/prisma.module';
import { LlmModule } from '@/modules/llm/llm.module';
import { MessagingModule } from '@/modules/skills/messaging/messaging.module';
import { ConversationsModule } from '@/modules/conversations/conversations.module';
import { MessagesModule } from '@/modules/messages/messages.module';
import { FollowupModule } from '@/modules/skills/followup/followup.module';

@Module({
  imports: [
    PrismaModule,
    LlmModule,
    MessagingModule,
    ConversationsModule,
    MessagesModule,
    FollowupModule,
  ],
  providers: [AgentService],
  exports: [AgentService],
})
export class AgentModule {}
