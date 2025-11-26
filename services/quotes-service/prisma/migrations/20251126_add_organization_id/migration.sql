-- AlterTable
ALTER TABLE "Quote" ADD COLUMN "organizationId" TEXT NOT NULL DEFAULT 'default-org-id';

-- CreateIndex
CREATE INDEX "Quote_organizationId_idx" ON "Quote"("organizationId");
