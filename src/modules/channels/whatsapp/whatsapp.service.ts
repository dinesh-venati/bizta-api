import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventsService } from '@/modules/events/events.service';
import { EventType } from '@prisma/client';
import { WhatsAppWebhookDto } from './dto/whatsapp-message.dto';

@Injectable()
export class WhatsAppService {
  private readonly logger = new Logger(WhatsAppService.name);

  constructor(
    private readonly eventsService: EventsService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Process incoming WhatsApp webhook
   * Normalizes Meta's payload and creates BiztaEvent
   */
  async processWebhook(webhookData: WhatsAppWebhookDto): Promise<void> {
    this.logger.log(`Processing WhatsApp webhook with ${webhookData.entry.length} entries`);

    for (const entry of webhookData.entry) {
      for (const change of entry.changes) {
        if (change.field === 'messages') {
          const messages = change.value.messages || [];

          for (const message of messages) {
            await this.processMessage(message, entry.id);
          }
        }
      }
    }
  }

  /**
   * Process a single message and create event
   */
  private async processMessage(message: any, businessAccountId: string): Promise<void> {
    // Extract message details
    const from = message.from;
    const messageId = message.id;
    const timestamp = message.timestamp;
    const messageType = message.type;

    // For now, only handle text messages
    if (messageType !== 'text') {
      this.logger.warn(`Unsupported message type: ${messageType} from ${from}`);
      return;
    }

    const text = message.text?.body || '';

    // TODO: In future, map businessAccountId to orgId via Channel lookup
    // For now, use placeholder (will wire multi-org routing later)
    const orgId = await this.getOrgIdFromBusinessAccount(businessAccountId);

    // Create normalized event
    await this.eventsService.createEvent({
      orgId,
      type: EventType.MESSAGE_RECEIVED,
      payload: {
        source: 'whatsapp',
        from,
        text,
        messageId,
        timestamp,
        businessAccountId,
      },
      metadata: {
        raw: message,
      },
    });

    this.logger.log(`Created MESSAGE_RECEIVED event for WhatsApp message from ${from}`);
  }

  /**
   * Map WhatsApp business account ID to organization ID
   * TODO: Query Channel table to find orgId by phoneNumber or externalId
   * For now, return first org or placeholder
   */
  private async getOrgIdFromBusinessAccount(businessAccountId: string): Promise<string> {
    // Placeholder: In production, you would:
    // 1. Query Channel table: WHERE type = 'WHATSAPP' AND externalId = businessAccountId
    // 2. Return channel.orgId
    // For now, we'll use a hardcoded value or environment variable
    const placeholderOrgId = this.configService.get<string>(
      'PLACEHOLDER_ORG_ID',
      'placeholder-org-id',
    );

    this.logger.debug(
      `Mapping business account ${businessAccountId} to org ${placeholderOrgId} (placeholder)`,
    );

    return placeholderOrgId;
  }

  /**
   * Verify webhook token for webhook verification handshake
   */
  verifyWebhookToken(token: string): boolean {
    const expectedToken = this.configService.get<string>('WHATSAPP_WEBHOOK_VERIFY_TOKEN');
    return token === expectedToken;
  }
}
