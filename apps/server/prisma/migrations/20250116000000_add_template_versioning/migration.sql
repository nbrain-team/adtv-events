-- CreateTable
CREATE TABLE "TemplateVersion" (
    "id" TEXT NOT NULL,
    "baseTemplateId" TEXT NOT NULL,
    "campaignId" TEXT,
    "versionName" TEXT NOT NULL,
    "description" TEXT,
    "nodesJson" TEXT NOT NULL,
    "edgesJson" TEXT NOT NULL,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TemplateVersion_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "TemplateVersion" ADD CONSTRAINT "TemplateVersion_baseTemplateId_fkey" FOREIGN KEY ("baseTemplateId") REFERENCES "Template"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TemplateVersion" ADD CONSTRAINT "TemplateVersion_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX "TemplateVersion_baseTemplateId_idx" ON "TemplateVersion"("baseTemplateId");

-- CreateIndex
CREATE INDEX "TemplateVersion_campaignId_idx" ON "TemplateVersion"("campaignId");

-- AlterTable
ALTER TABLE "Campaign" ADD COLUMN "templateVersionId" TEXT;

