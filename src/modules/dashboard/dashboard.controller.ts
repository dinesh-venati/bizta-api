import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  ParseIntPipe,
  ParseBoolPipe,
} from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { CurrentOrg } from '@/common/decorators/user.decorator';
import { ConversationIntent } from '@prisma/client';
import {
  DashboardSummaryDto,
  ConversationListResponseDto,
  ConversationDetailDto,
  SendReplyDto,
  ReplyResponseDto,
  HandoffResponseDto,
} from './dto';

@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  /**
   * GET /api/v1/dashboard/summary/today
   * Get dashboard summary stats for a specific date
   */
  @Get('summary/today')
  async getTodaySummary(
    @CurrentOrg() orgId: string,
    @Query('date') date?: 'today' | 'yesterday' | 'dayBeforeYesterday',
  ): Promise<DashboardSummaryDto> {
    return this.dashboardService.getTodaySummary(orgId, date || 'today');
  }

  /**
   * GET /api/v1/dashboard/conversations
   * Get paginated list of conversations with filters
   */
  @Get('conversations')
  async getConversations(
    @CurrentOrg() orgId: string,
    @Query('page', new ParseIntPipe({ optional: true })) page?: number,
    @Query('pageSize', new ParseIntPipe({ optional: true })) pageSize?: number,
    @Query('intent') intent?: ConversationIntent,
    @Query('requiresHuman', new ParseBoolPipe({ optional: true })) requiresHuman?: boolean,
    @Query('hotOnly', new ParseBoolPipe({ optional: true })) hotOnly?: boolean,
  ): Promise<ConversationListResponseDto> {
    return this.dashboardService.getConversations(
      orgId,
      page,
      pageSize,
      intent,
      requiresHuman,
      hotOnly,
    );
  }

  /**
   * GET /api/v1/dashboard/conversations/:id
   * Get conversation detail with messages
   */
  @Get('conversations/:id')
  async getConversationDetail(
    @CurrentOrg() orgId: string,
    @Param('id') conversationId: string,
  ): Promise<ConversationDetailDto> {
    return this.dashboardService.getConversationDetail(orgId, conversationId);
  }

  /**
   * POST /api/v1/dashboard/conversations/:id/reply
   * Send a manual reply as human
   */
  @Post('conversations/:id/reply')
  async sendReply(
    @CurrentOrg() orgId: string,
    @Param('id') conversationId: string,
    @Body() dto: SendReplyDto,
  ): Promise<ReplyResponseDto> {
    return this.dashboardService.sendReply(orgId, conversationId, dto.message);
  }

  /**
   * POST /api/v1/dashboard/conversations/:id/takeover
   * Task 10: Take over conversation as human (pause AI)
   */
  @Post('conversations/:id/takeover')
  async takeoverConversation(
    @CurrentOrg() orgId: string,
    @Param('id') conversationId: string,
  ): Promise<HandoffResponseDto> {
    return this.dashboardService.takeoverConversation(orgId, conversationId);
  }

  /**
   * POST /api/v1/dashboard/conversations/:id/release
   * Task 10: Release conversation back to AI
   */
  @Post('conversations/:id/release')
  async releaseConversation(
    @CurrentOrg() orgId: string,
    @Param('id') conversationId: string,
  ): Promise<HandoffResponseDto> {
    return this.dashboardService.releaseConversation(orgId, conversationId);
  }
}
