import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { ScheduleModule } from '@nestjs/schedule';
import { BullModule } from '@nestjs/bullmq';
import { APP_GUARD } from '@nestjs/core';

import { PrismaModule } from './common/prisma/prisma.module';
import { EncryptionModule } from './common/services/encryption.module';
import { HealthModule } from './modules/health/health.module';
import { AuthModule } from './modules/auth/auth.module';
import { JwtAuthGuard } from './modules/auth/guards/jwt-auth.guard';
import { RolesGuard } from './modules/auth/guards/roles.guard';
import { UsersModule } from './modules/users/users.module';
import { OrgsModule } from './modules/orgs/orgs.module';
import { ChannelsModule } from './modules/channels/channels.module';
import { ConversationsModule } from './modules/conversations/conversations.module';
import { MessagesModule } from './modules/messages/messages.module';
import { EventsModule } from './modules/events/events.module';
import { AgentModule } from './modules/agent/agent.module';
import { SkillsModule } from './modules/skills/skills.module';
import { SettingsModule } from './modules/settings/settings.module';
import { AuditModule } from './modules/audit/audit.module';
import { WhatsAppModule } from './modules/channels/whatsapp/whatsapp.module';
import { AgentEventsProcessor } from './queues/agent-events.processor';

@Module({
  imports: [
    // Configuration
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),

    // Rate limiting
    ThrottlerModule.forRoot([
      {
        ttl: 60000, // 1 minute
        limit: 100,
      },
    ]),

    // Scheduling
    ScheduleModule.forRoot(),

    // BullMQ (Redis queues)
    BullModule.forRoot({
      connection: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379'),
        password: process.env.REDIS_PASSWORD || undefined,
        db: parseInt(process.env.REDIS_DB || '0'),
        tls: process.env.REDIS_TLS === 'true' ? {} : undefined,
      },
    }),

    // Core modules
    PrismaModule,
    EncryptionModule,
    HealthModule,

    // Feature modules
    AuthModule,
    UsersModule,
    OrgsModule,
    ChannelsModule,
    ConversationsModule,
    MessagesModule,
    EventsModule,
    AgentModule,
    SkillsModule,
    SettingsModule,
    AuditModule,
    WhatsAppModule,
  ],
  providers: [
    // Queue processors
    AgentEventsProcessor,
    // Global JWT guard - all routes protected by default
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    // Global roles guard
    {
      provide: APP_GUARD,
      useClass: RolesGuard,
    },
  ],
})
export class AppModule {}
