-- AlterEnum
ALTER TYPE "AgentActionType" ADD VALUE 'DAILY_SUMMARY_SENT';

-- AlterTable
ALTER TABLE "settings" ADD COLUMN     "dailySummaryEmail" TEXT;
