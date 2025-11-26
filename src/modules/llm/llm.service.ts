import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import { DailyStats } from '../summary/interfaces/daily-stats.interface';

export interface GenerateReplyParams {
  orgId: string;
  messageText: string;
  channel: 'whatsapp' | 'webchat';
  businessContext?: Record<string, unknown>;
}

export interface GenerateDailySummaryParams {
  orgName: string;
  date: Date;
  stats: DailyStats;
}

@Injectable()
export class LlmService {
  private readonly logger = new Logger(LlmService.name);
  private readonly openai: OpenAI;
  private readonly defaultModel: string;

  constructor(private readonly configService: ConfigService) {
    const apiKey = this.configService.get<string>('OPENAI_API_KEY');
    if (!apiKey) {
      this.logger.warn('OPENAI_API_KEY not configured - LLM service will fail');
    }

    this.openai = new OpenAI({
      apiKey: apiKey || 'dummy-key',
    });

    this.defaultModel = this.configService.get<string>('LLM_MODEL') || 'gpt-4o-mini';
  }

  /**
   * Generate a reply to a customer message using LLM
   */
  async generateReplyForMessage(params: GenerateReplyParams): Promise<string> {
    const { orgId, messageText, channel, businessContext } = params;

    this.logger.log(`Generating reply for org ${orgId}, channel ${channel}: "${messageText}"`);

    try {
      // Build system prompt
      const systemPrompt = this.buildSystemPrompt(businessContext);

      // Call OpenAI with timeout
      const completion = await Promise.race([
        this.openai.chat.completions.create({
          model: this.defaultModel,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: messageText },
          ],
          temperature: 0.7,
          max_tokens: 500,
        }),
        this.timeout(30000), // 30 second timeout
      ]);

      if (!completion || !completion.choices || completion.choices.length === 0) {
        throw new Error('No response from LLM');
      }

      const reply = completion.choices[0].message?.content?.trim();

      if (!reply || reply.length === 0) {
        throw new Error('Empty response from LLM');
      }

      this.logger.log(`LLM generated reply (${reply.length} chars)`);

      return reply;
    } catch (error) {
      this.logger.error(`Failed to generate LLM reply: ${error.message}`, error.stack);

      // Fallback to safe generic response
      return this.getFallbackReply(businessContext);
    }
  }

  /**
   * Build system prompt for the LLM
   */
  private buildSystemPrompt(businessContext?: GenerateReplyParams['businessContext']): string {
    const agentName = businessContext?.agentName || 'Bizta';
    const personality = businessContext?.agentPersonality || 'friendly and professional';
    const businessName = businessContext?.businessName;
    const businessDescription = businessContext?.businessDescription;

    let prompt = `You are ${agentName}, an AI business assistant. You are ${personality}.

Your role:
- Respond to customer inquiries promptly and helpfully
- Be concise but warm (aim for 2-3 sentences unless more detail is needed)
- If you don't know specific information about the business, acknowledge it and offer to help the human follow up
- Never make up facts about the business`;

    if (businessName) {
      prompt += `\n- You represent ${businessName}`;
    }

    if (businessDescription) {
      prompt += `\n\nBusiness context:\n${businessDescription}`;
    }

    // TODO: In future, add FAQs, services, business hours here

    return prompt;
  }

  /**
   * Fallback reply when LLM fails
   */
  private getFallbackReply(businessContext?: GenerateReplyParams['businessContext']): string {
    const agentName = businessContext?.agentName || 'Bizta';

    return `Hi! I'm ${agentName}, your AI assistant. I received your message but I'm having trouble generating a detailed response right now. A team member will get back to you shortly. How can I help you in the meantime?`;
  }

  /**
   * Timeout promise helper
   */
  private timeout(ms: number): Promise<never> {
    return new Promise((_, reject) =>
      setTimeout(() => reject(new Error('LLM request timeout')), ms),
    );
  }

  /**
   * Generate a daily summary for the business owner
   */
  async generateDailySummary(params: GenerateDailySummaryParams): Promise<string> {
    const { orgName, date, stats } = params;

    this.logger.log(`Generating daily summary for ${orgName} on ${date.toDateString()}`);

    try {
      // Build system prompt for COO summary
      const systemPrompt = `You are Bizta, an AI COO (Chief Operating Officer) assistant. Generate a concise daily summary for the business owner.

Guidelines:
- Use simple, professional language
- Keep it to 2-4 short paragraphs max
- Highlight key metrics and any issues that need attention
- If metrics are zero or low, still provide a brief, encouraging summary
- Include 1-2 actionable suggestions if relevant
- Never hallucinate data - only use the metrics provided
- Be concise but helpful`;

      // Build user prompt with metrics
      const dateStr = date.toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });

      const userPrompt = `Generate a daily summary report for ${orgName} for ${dateStr}.

Metrics:
- Total conversations active today: ${stats.totalConversationsToday}
- New conversations started: ${stats.newConversationsToday}
- Messages received from customers: ${stats.totalMessagesFromCustomersToday}
- Messages sent by Bizta: ${stats.totalMessagesFromBiztaToday}
- Follow-ups scheduled: ${stats.followupsScheduledToday}
- Follow-ups sent: ${stats.followupsSentToday}
- Conversations needing human attention: ${stats.conversationsNeedingHuman}

Create a helpful summary with these metrics.`;

      // Call OpenAI
      const completion = await Promise.race([
        this.openai.chat.completions.create({
          model: this.defaultModel,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
          temperature: 0.7,
          max_tokens: 800,
        }),
        this.timeout(30000),
      ]);

      if (!completion || !completion.choices || completion.choices.length === 0) {
        throw new Error('No response from LLM');
      }

      const summary = completion.choices[0].message?.content?.trim();

      if (!summary || summary.length === 0) {
        throw new Error('Empty response from LLM');
      }

      this.logger.log(`LLM generated daily summary (${summary.length} chars)`);

      return summary;
    } catch (error) {
      this.logger.error(`Failed to generate daily summary: ${error.message}`, error.stack);

      // Fallback to basic summary
      return this.getFallbackDailySummary(orgName, date, stats);
    }
  }

  /**
   * Fallback summary when LLM fails
   */
  private getFallbackDailySummary(
    orgName: string,
    date: Date,
    stats: DailyStats,
  ): string {
    const dateStr = date.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
    });

    return `Daily Summary for ${orgName} - ${dateStr}

Today's Activity:
• ${stats.totalConversationsToday} conversations active
• ${stats.newConversationsToday} new conversations started
• ${stats.totalMessagesFromCustomersToday} customer messages received
• ${stats.totalMessagesFromBiztaToday} AI responses sent
• ${stats.followupsSentToday} follow-up reminders sent

${stats.conversationsNeedingHuman > 0 ? `⚠️ ${stats.conversationsNeedingHuman} conversations may need your attention.\n\n` : ''}Keep up the great work! 🚀`;
  }
}
