-- CreateEnum
CREATE TYPE "FollowupChannel" AS ENUM ('WHATSAPP', 'EMAIL', 'WEBCHAT');

-- CreateEnum
CREATE TYPE "FollowupType" AS ENUM ('CUSTOMER_REMINDER', 'OWNER_REMINDER');

-- CreateEnum
CREATE TYPE "FollowupStatus" AS ENUM ('PENDING', 'SENT', 'CANCELLED', 'FAILED');

-- AlterEnum
ALTER TYPE "AgentActionType" ADD VALUE 'FOLLOWUP_SENT';

-- AlterTable
ALTER TABLE "settings" ADD COLUMN     "followupDelayHours" INTEGER NOT NULL DEFAULT 24,
ADD COLUMN     "followupMessageTemplate" TEXT;

-- CreateTable
CREATE TABLE "followup_tasks" (
    "id" TEXT NOT NULL,
    "customerPhone" TEXT NOT NULL,
    "channel" "FollowupChannel" NOT NULL,
    "type" "FollowupType" NOT NULL,
    "status" "FollowupStatus" NOT NULL DEFAULT 'PENDING',
    "scheduledAt" TIMESTAMP(3) NOT NULL,
    "sentAt" TIMESTAMP(3),
    "messageTemplate" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "orgId" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,

    CONSTRAINT "followup_tasks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "followup_tasks_orgId_status_idx" ON "followup_tasks"("orgId", "status");

-- CreateIndex
CREATE INDEX "followup_tasks_conversationId_status_idx" ON "followup_tasks"("conversationId", "status");

-- CreateIndex
CREATE INDEX "followup_tasks_scheduledAt_status_idx" ON "followup_tasks"("scheduledAt", "status");

-- AddForeignKey
ALTER TABLE "followup_tasks" ADD CONSTRAINT "followup_tasks_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "followup_tasks" ADD CONSTRAINT "followup_tasks_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
