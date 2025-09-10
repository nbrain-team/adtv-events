-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Campaign" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "ownerName" TEXT NOT NULL,
    "ownerEmail" TEXT NOT NULL,
    "ownerPhone" TEXT,
    "city" TEXT,
    "state" TEXT,
    "videoLink" TEXT,
    "eventLink" TEXT,
    "eventType" TEXT NOT NULL,
    "eventDate" DATETIME NOT NULL,
    "launchDate" DATETIME,
    "hotelName" TEXT,
    "hotelAddress" TEXT,
    "calendlyLink" TEXT,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "totalContacts" INTEGER NOT NULL DEFAULT 0,
    "enrichedContacts" INTEGER NOT NULL DEFAULT 0,
    "emailsGenerated" INTEGER NOT NULL DEFAULT 0,
    "templateId" TEXT,
    "senderUserId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Campaign_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "Template" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Campaign_senderUserId_fkey" FOREIGN KEY ("senderUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Campaign" ("calendlyLink", "city", "createdAt", "emailsGenerated", "enrichedContacts", "eventDate", "eventLink", "eventType", "hotelAddress", "hotelName", "id", "launchDate", "name", "ownerEmail", "ownerName", "ownerPhone", "state", "status", "templateId", "totalContacts", "updatedAt", "videoLink") SELECT "calendlyLink", "city", "createdAt", "emailsGenerated", "enrichedContacts", "eventDate", "eventLink", "eventType", "hotelAddress", "hotelName", "id", "launchDate", "name", "ownerEmail", "ownerName", "ownerPhone", "state", "status", "templateId", "totalContacts", "updatedAt", "videoLink" FROM "Campaign";
DROP TABLE "Campaign";
ALTER TABLE "new_Campaign" RENAME TO "Campaign";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
