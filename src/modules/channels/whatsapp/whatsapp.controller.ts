import {
  Controller,
  Get,
  Post,
  Query,
  Body,
  Headers,
  BadRequestException,
  Logger,
  RawBodyRequest,
  Req,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import { WhatsAppService } from './whatsapp.service';
import { WhatsAppWebhookDto } from './dto/whatsapp-message.dto';
import { verifyWhatsAppSignature } from './utils/verify-signature';
import { Public } from '@/common/decorators';

@Controller('webhooks/whatsapp')
export class WhatsAppController {
  private readonly logger = new Logger(WhatsAppController.name);

  constructor(
    private readonly whatsAppService: WhatsAppService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * GET /webhooks/whatsapp - Webhook verification
   * Meta sends this during webhook setup
   */
  @Public()
  @Get()
  verifyWebhook(
    @Query('hub.mode') mode: string,
    @Query('hub.verify_token') token: string,
    @Query('hub.challenge') challenge: string,
  ): string | { error: string } {
    this.logger.log('Webhook verification request received');

    if (mode === 'subscribe' && token) {
      const isValid = this.whatsAppService.verifyWebhookToken(token);

      if (isValid) {
        this.logger.log('✅ Webhook verification successful');
        return challenge;
      }
    }

    this.logger.warn('❌ Webhook verification failed');
    throw new BadRequestException('Invalid verification token');
  }

  /**
   * POST /webhooks/whatsapp - Receive webhook events
   * Meta sends message events here
   */
  @Public()
  @Post()
  async receiveWebhook(
    @Body() body: WhatsAppWebhookDto,
    @Headers('x-hub-signature-256') signature: string,
    @Req() req: RawBodyRequest<Request>,
  ): Promise<{ status: string }> {
    this.logger.log('Webhook event received');

    // Verify signature
    const secret = this.configService.get<string>('WHATSAPP_WEBHOOK_SECRET');
    if (!secret) {
      this.logger.error('WHATSAPP_WEBHOOK_SECRET not configured');
      throw new BadRequestException('Webhook secret not configured');
    }

    // Get raw body for signature verification
    const rawBody = req.rawBody?.toString('utf8') || JSON.stringify(body);
    verifyWhatsAppSignature(rawBody, signature, secret);

    this.logger.log('✅ Signature verified');

    // Process webhook
    await this.whatsAppService.processWebhook(body);

    return { status: 'ok' };
  }
}
