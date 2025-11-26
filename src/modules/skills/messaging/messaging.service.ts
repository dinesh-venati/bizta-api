import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosError } from 'axios';

export interface SendWhatsAppTextParams {
  to: string; // WhatsApp number in international format (no +)
  text: string;
  orgId: string;
  metadata?: Record<string, unknown>;
}

@Injectable()
export class MessagingService {
  private readonly logger = new Logger(MessagingService.name);
  private readonly apiUrl: string;
  private readonly phoneNumberId: string;
  private readonly accessToken: string;

  constructor(private readonly configService: ConfigService) {
    this.apiUrl = this.configService.get<string>('WHATSAPP_API_URL') || '';
    this.phoneNumberId =
      this.configService.get<string>('WHATSAPP_PHONE_NUMBER_ID') || '';
    this.accessToken =
      this.configService.get<string>('WHATSAPP_ACCESS_TOKEN') || '';

    if (!this.apiUrl || !this.phoneNumberId || !this.accessToken) {
      this.logger.warn(
        'WhatsApp API configuration incomplete - messaging will fail',
      );
    }
  }

  /**
   * Send a text message via WhatsApp Cloud API
   */
  async sendWhatsAppText(params: SendWhatsAppTextParams): Promise<{ messageId: string }> {
    const { to, text, orgId, metadata } = params;

    this.logger.log(
      `Sending WhatsApp text to ${to} (org: ${orgId}): ${text.substring(0, 50)}...`,
    );

    try {
      const url = `${this.apiUrl}/${this.phoneNumberId}/messages`;

      const payload = {
        messaging_product: 'whatsapp',
        to: to,
        type: 'text',
        text: {
          body: text,
        },
      };

      const response = await axios.post(url, payload, {
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json',
        },
        timeout: 10000, // 10 second timeout
      });

      if (response.status !== 200 && response.status !== 201) {
        throw new Error(
          `WhatsApp API returned status ${response.status}: ${JSON.stringify(response.data)}`,
        );
      }

      const messageId = response.data.messages?.[0]?.id || 'unknown';

      this.logger.log(
        `✅ WhatsApp message sent successfully to ${to} (messageId: ${messageId})`,
      );

      return { messageId };
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const axiosError = error as AxiosError;
        this.logger.error(
          `Failed to send WhatsApp message: ${axiosError.message}`,
          {
            status: axiosError.response?.status,
            data: axiosError.response?.data,
            to,
            orgId,
          },
        );
      } else {
        this.logger.error(
          `Failed to send WhatsApp message: ${error.message}`,
          error.stack,
        );
      }

      throw new Error(`WhatsApp send failed: ${error.message}`);
    }
  }
}
