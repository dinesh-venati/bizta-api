import * as crypto from 'crypto';
import { UnauthorizedException } from '@nestjs/common';

/**
 * Verify WhatsApp webhook signature
 * @param payload - Raw request body (string)
 * @param signature - X-Hub-Signature-256 header value
 * @param secret - WhatsApp webhook secret
 * @throws UnauthorizedException if signature is invalid
 */
export function verifyWhatsAppSignature(
  payload: string,
  signature: string | undefined,
  secret: string,
): void {
  if (!signature) {
    throw new UnauthorizedException('Missing signature header');
  }

  // Remove 'sha256=' prefix if present
  const signatureHash = signature.startsWith('sha256=') ? signature.slice(7) : signature;

  // Generate expected signature
  const expectedHash = crypto.createHmac('sha256', secret).update(payload).digest('hex');

  // Constant-time comparison to prevent timing attacks
  const isValid = crypto.timingSafeEqual(Buffer.from(signatureHash), Buffer.from(expectedHash));

  if (!isValid) {
    throw new UnauthorizedException('Invalid signature');
  }
}
