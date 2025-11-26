-- AlterTable
ALTER TABLE "settings" ADD COLUMN     "hoursText" TEXT,
ADD COLUMN     "locationText" TEXT,
ADD COLUMN     "schedulingNote" TEXT,
ADD COLUMN     "servicesText" TEXT;

-- CreateTable
CREATE TABLE "business_faqs" (
    "id" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "answer" TEXT NOT NULL,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "orgId" TEXT NOT NULL,

    CONSTRAINT "business_faqs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "business_faqs_orgId_idx" ON "business_faqs"("orgId");

-- CreateIndex
CREATE INDEX "business_faqs_orgId_isActive_idx" ON "business_faqs"("orgId", "isActive");

-- AddForeignKey
ALTER TABLE "business_faqs" ADD CONSTRAINT "business_faqs_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
