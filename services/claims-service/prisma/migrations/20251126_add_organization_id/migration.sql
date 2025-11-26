-- AlterTable
ALTER TABLE "Claim" ADD COLUMN "organizationId" TEXT NOT NULL DEFAULT 'default-org-id';

-- CreateIndex
CREATE INDEX "Claim_organizationId_idx" ON "Claim"("organizationId");
