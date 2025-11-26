-- AlterTable
ALTER TABLE "Policy" ADD COLUMN "organizationId" TEXT NOT NULL DEFAULT 'default-org-id';

-- CreateIndex
CREATE INDEX "Policy_organizationId_idx" ON "Policy"("organizationId");
