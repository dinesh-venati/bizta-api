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
import { Prisma } from '@prisma/client';
import { PrismaService } from '@/common/prisma/prisma.service';
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
    private readonly prisma: PrismaService,
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
    const startTime = Date.now();
    this.logger.log('Webhook event received');

    let statusCode = 200;
    let errorMessage: string | undefined;
    let orgId: string | undefined;

    try {
      // Extract orgId from webhook body if available
      if (body.entry?.[0]?.changes?.[0]?.value?.metadata?.phone_number_id) {
        const phoneNumberId = body.entry[0].changes[0].value.metadata.phone_number_id;
        // Look up orgId from channel
        const channel = await this.prisma.channel.findFirst({
          where: {
            type: 'WHATSAPP',
            metadata: {
              path: ['phoneNumberId'],
              equals: phoneNumberId,
            },
          },
          select: { orgId: true },
        });
        orgId = channel?.orgId;
      }

      // Verify signature
      const secret = this.configService.get<string>('WHATSAPP_WEBHOOK_SECRET');
      if (!secret) {
        this.logger.error('WHATSAPP_WEBHOOK_SECRET not configured');
        statusCode = 400;
        errorMessage = 'Webhook secret not configured';
        throw new BadRequestException('Webhook secret not configured');
      }

      // Get raw body for signature verification
      const rawBody = req.rawBody?.toString('utf8') || JSON.stringify(body);
      verifyWhatsAppSignature(rawBody, signature, secret);

      this.logger.log('✅ Signature verified');

      // Process webhook
      await this.whatsAppService.processWebhook(body);

      return { status: 'ok' };
    } catch (error) {
      statusCode = error.status || 500;
      errorMessage = error.message;
      throw error;
    } finally {
      // Log webhook (success or failure)
      const responseTime = Date.now() - startTime;
      try {
        await this.prisma.webhookLog.create({
          data: {
            orgId: orgId || null,
            source: 'whatsapp',
            method: 'POST',
            path: '/api/v1/webhooks/whatsapp',
            headers: {
              'x-hub-signature-256': signature ? 'present' : 'missing',
            } as Prisma.JsonObject,
            body: body as unknown as Prisma.JsonObject,
            statusCode,
            response: statusCode === 200 ? ({ status: 'ok' } as Prisma.JsonObject) : undefined,
            verified: statusCode === 200,
            error: errorMessage || null,
            processingTime: responseTime,
          },
        });
      } catch (logError) {
        // Don't fail webhook processing if logging fails
        this.logger.error(`Failed to log webhook: ${logError.message}`);
      }
    }
  }
}
