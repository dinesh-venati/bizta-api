import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import { DailyStats } from '../summary/interfaces/daily-stats.interface';

export interface GenerateReplyParams {
  orgId: string;
  messageText: string;
  channel: 'whatsapp' | 'webchat';
  businessContext?: {
    agentName?: string;
    agentPersonality?: string;
    businessName?: string;
    businessDescription?: string;
    servicesText?: string;
    hoursText?: string;
    locationText?: string;
    schedulingNote?: string;
    faqs?: Array<{ question: string; answer: string; tags: string[] }>;
    conversationHistory?: Array<{ from: 'customer' | 'bizta'; text: string }>;
    requiresHuman?: boolean;
    leadScore?: number;
    intent?: string;
    subIntent?: string;
    [key: string]: unknown;
  };
}

export interface GenerateDailySummaryParams {
  orgName: string;
  date: Date;
  stats: DailyStats;
}

export interface ClassifyConversationParams {
  orgName: string;
  businessDescription?: string;
  recentMessages: Array<{ from: 'customer' | 'bizta'; text: string }>;
}

export interface ConversationClassification {
  intent: 'lead' | 'support' | 'spam' | 'greeting' | 'other';
  subIntent?: string;
  leadScore?: number;
  requiresHuman?: boolean;
  reasoning?: string;
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

      // Build messages array with conversation history if available
      const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
        { role: 'system', content: systemPrompt },
      ];

      // Add conversation history if provided
      if (
        businessContext?.conversationHistory &&
        Array.isArray(businessContext.conversationHistory)
      ) {
        for (const msg of businessContext.conversationHistory) {
          messages.push({
            role: msg.from === 'customer' ? 'user' : 'assistant',
            content: msg.text,
          });
        }
      } else {
        // No history, just add current message
        messages.push({ role: 'user', content: messageText });
      }

      // Call OpenAI with timeout
      const completion = await Promise.race([
        this.openai.chat.completions.create({
          model: this.defaultModel,
          messages,
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
    const servicesText = businessContext?.servicesText;
    const hoursText = businessContext?.hoursText;
    const locationText = businessContext?.locationText;
    const schedulingNote = businessContext?.schedulingNote;
    const faqs = businessContext?.faqs || [];
    const requiresHuman = businessContext?.requiresHuman === true;
    const leadScore =
      typeof businessContext?.leadScore === 'number' ? businessContext.leadScore : 0;
    const subIntent = businessContext?.subIntent;

    let prompt = `You are ${agentName}, an AI business assistant. You are ${personality}.

🎯 YOUR CORE MANDATE:
- You ONLY answer questions about ${businessName || 'this business'}
- You ONLY use information provided in this prompt
- You NEVER answer general knowledge, off-topic, or sensitive questions
- You NEVER make up information

✅ WHAT YOU DO:
- Answer questions about the business using provided context
- Be concise but warm (2-3 sentences unless more detail needed)
- If information is missing, acknowledge it and offer human follow-up
- Use FAQ knowledge when relevant

❌ WHAT YOU NEVER DO:
- Answer questions unrelated to this specific business
- Provide medical, legal, financial, or explicit/adult advice
- Make up business details (hours, prices, services, policies)
- Confirm appointments or bookings (only collect details)
- Discuss your AI nature, capabilities, or limitations extensively
- Engage in off-topic conversations (politics, news, science, etc.)

🚫 OFF-TOPIC REFUSAL:
If asked about anything unrelated to ${businessName || 'this business'}, respond:
"I'm here to help with questions about ${businessName || 'our business'}. For other topics, I recommend searching online or consulting appropriate experts."`;

    if (businessName) {
      prompt += `\n\n🏢 BUSINESS: ${businessName}`;
    }

    if (businessDescription) {
      prompt += `\n\n📝 ABOUT:\n${businessDescription}`;
    }

    if (servicesText) {
      prompt += `\n\n🛠️ SERVICES/PRODUCTS:\n${servicesText}`;
    }

    if (hoursText) {
      prompt += `\n\n⏰ HOURS:\n${hoursText}`;
    }

    if (locationText) {
      prompt += `\n\n📍 LOCATION:\n${locationText}`;
    }

    if (schedulingNote) {
      prompt += `\n\n📅 SCHEDULING:\n${schedulingNote}`;
    }

    // Add FAQ knowledge if available
    if (faqs.length > 0) {
      prompt += `\n\n💡 FREQUENTLY ASKED QUESTIONS:`;
      for (const faq of faqs) {
        prompt += `\n\nQ: ${faq.question}\nA: ${faq.answer}`;
      }
      prompt += `\n\nUse these FAQs to answer similar questions. If a question closely matches an FAQ, use that answer.`;
    }

    // Add context for high-priority conversations
    if (requiresHuman) {
      prompt += `\n\n⚠️ CALLBACK REQUESTED: This customer needs human attention. Acknowledge their request and assure them a team member will reach out shortly. Don't attempt to fully resolve complex issues yourself.`;
    } else if (leadScore >= 80) {
      prompt += `\n\n🔥 HOT LEAD (score: ${leadScore}/100): This customer is highly interested. Be extra helpful and thorough to convert.`;
    }

    // Add scheduling-specific guidance
    if (subIntent && ['booking', 'demo', 'appointment', 'visit'].includes(subIntent)) {
      prompt += `\n\n📅 SCHEDULING REQUEST DETECTED:
- Ask for their preferred date/time and contact details
- DO NOT confirm the appointment yourself
- Say: "Let me collect your details and our team will confirm your appointment shortly"
- Never hallucinate booking confirmations or calendar availability`;
    }

    // Add sensitive topic guards
    prompt += `\n\n🚨 SENSITIVE TOPICS - ALWAYS REFUSE:
- Medical advice → "Please consult a healthcare professional"
- Legal advice → "Please consult a lawyer or legal expert"
- Financial advice → "Please consult a financial advisor"
- Explicit/adult content → "I can't assist with that"`;

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
  private getFallbackDailySummary(orgName: string, date: Date, stats: DailyStats): string {
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

  /**
   * Classify conversation intent and qualify lead (Task 7)
   */
  async classifyConversation(
    params: ClassifyConversationParams,
  ): Promise<ConversationClassification> {
    const { orgName, businessDescription, recentMessages } = params;

    this.logger.log(
      `Classifying conversation for ${orgName} with ${recentMessages.length} messages`,
    );

    try {
      // Build system prompt for classification
      const systemPrompt = `You are Bizta's lead qualification engine for ${orgName}.
${businessDescription ? `Business: ${businessDescription}\n` : ''}
Your task: Analyze the conversation and classify it with strict JSON output.

Classification Rules:
- intent: Must be one of: "lead", "support", "spam", "greeting", "other"
  • "lead" = Customer expressing interest in products/services, asking about pricing, booking, demo
  • "support" = Existing customer needing help, asking questions about usage
  • "spam" = Promotional content, irrelevant messages, automated bots
  • "greeting" = Simple hi/hello with no clear intent yet
  • "other" = Unclear or mixed intent

- subIntent: Short snake_case tag describing specific need. Examples:
  • For leads: "pricing", "booking", "demo", "product_info", "bulk_order"
  • For support: "complaint", "refund", "onboarding", "feature_request", "bug_report"
  • For other: "chit_chat", "feedback", "question"

- leadScore: Integer 0-100 based on:
  • 0-20: Spam or irrelevant
  • 20-40: Low quality (vague interest, no budget indication)
  • 40-60: Lukewarm lead (some interest but not committed)
  • 60-80: Good lead (clear interest, asking specific questions)
  • 80-100: Hot lead (ready to buy, asking for pricing/booking, urgency)

- requiresHuman: true if:
  • Customer is angry, frustrated, or confused
  • Complex negotiation needed
  • Explicitly asks for human agent
  • Escalation keywords present

- reasoning: Brief explanation (1-2 sentences) for your classification

CRITICAL: Respond ONLY with valid JSON. No markdown, no explanations outside JSON.`;

      const messagesContext = recentMessages
        .map((msg) => `${msg.from === 'customer' ? 'Customer' : 'Bizta'}: ${msg.text}`)
        .join('\n');

      const completion = await this.openai.chat.completions.create({
        model: this.defaultModel,
        messages: [
          { role: 'system', content: systemPrompt },
          {
            role: 'user',
            content: `Classify this conversation:\n\n${messagesContext}\n\nRespond with JSON only.`,
          },
        ],
        temperature: 0.3, // Lower temp for more consistent classification
        max_tokens: 300,
      });

      const responseText = completion.choices[0]?.message?.content?.trim();

      if (!responseText) {
        throw new Error('Empty response from LLM');
      }

      this.logger.debug(`LLM classification response: ${responseText}`);

      // Parse JSON response
      let classification: ConversationClassification;

      try {
        // Try to extract JSON if wrapped in markdown
        let jsonText = responseText;
        if (responseText.includes('```json')) {
          const match = responseText.match(/```json\s*([\s\S]*?)\s*```/);
          if (match) {
            jsonText = match[1];
          }
        } else if (responseText.includes('```')) {
          const match = responseText.match(/```\s*([\s\S]*?)\s*```/);
          if (match) {
            jsonText = match[1];
          }
        }

        classification = JSON.parse(jsonText);

        // Validate and sanitize
        if (
          !classification.intent ||
          !['lead', 'support', 'spam', 'greeting', 'other'].includes(classification.intent)
        ) {
          throw new Error(`Invalid intent: ${classification.intent}`);
        }

        // Ensure leadScore is 0-100
        if (classification.leadScore !== undefined) {
          classification.leadScore = Math.max(
            0,
            Math.min(100, Math.floor(classification.leadScore)),
          );
        }

        // Default requiresHuman to false if not specified
        if (classification.requiresHuman === undefined) {
          classification.requiresHuman = false;
        }

        this.logger.log(
          `Classification: ${classification.intent} (score: ${classification.leadScore}, human: ${classification.requiresHuman})`,
        );

        return classification;
      } catch (parseError) {
        this.logger.error(`Failed to parse classification JSON: ${parseError.message}`);
        this.logger.debug(`Raw response: ${responseText}`);

        // Return safe default
        return this.getFallbackClassification();
      }
    } catch (error) {
      this.logger.error(`Failed to classify conversation: ${error.message}`, error.stack);
      return this.getFallbackClassification();
    }
  }

  /**
   * Fallback classification when LLM fails
   */
  private getFallbackClassification(): ConversationClassification {
    return {
      intent: 'other',
      subIntent: 'unknown',
      leadScore: 30,
      requiresHuman: false,
      reasoning: 'Classification failed - using safe default',
    };
  }
}
