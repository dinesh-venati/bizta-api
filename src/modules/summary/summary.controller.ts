import { Controller, Post, Param } from '@nestjs/common';
import { SummaryScheduler } from './summary.scheduler';
import { Public } from '../../common/decorators';

@Controller('dev/summary')
export class SummaryController {
  constructor(private readonly summaryScheduler: SummaryScheduler) {}

  /**
   * Manual trigger for daily summary (development only)
   * POST /api/v1/dev/summary/trigger/:orgId
   */
  @Public()
  @Post('trigger/:orgId')
  async triggerManualSummary(@Param('orgId') orgId: string) {
    await this.summaryScheduler.triggerManualSummary(orgId);
    return {
      status: 'ok',
      message: `Daily summary triggered for org ${orgId}`,
    };
  }

  /**
   * Trigger all organizations (development only)
   * POST /api/v1/dev/summary/trigger-all
   */
  @Public()
  @Post('trigger-all')
  async triggerAllSummaries() {
    await this.summaryScheduler.sendDailySummaries();
    return {
      status: 'ok',
      message: 'Daily summaries triggered for all organizations',
    };
  }
}
