-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Draft" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ideaId" TEXT,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "tags" TEXT NOT NULL,
    "charCount" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "generatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "publishedAt" DATETIME,
    "noteUrl" TEXT,
    "rejectReason" TEXT,
    "llmModel" TEXT NOT NULL,
    "promptVersion" TEXT NOT NULL,
    CONSTRAINT "Draft_ideaId_fkey" FOREIGN KEY ("ideaId") REFERENCES "Idea" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Draft" ("body", "charCount", "generatedAt", "id", "ideaId", "llmModel", "noteUrl", "promptVersion", "publishedAt", "rejectReason", "status", "tags", "title") SELECT "body", "charCount", "generatedAt", "id", "ideaId", "llmModel", "noteUrl", "promptVersion", "publishedAt", "rejectReason", "status", "tags", "title" FROM "Draft";
DROP TABLE "Draft";
ALTER TABLE "new_Draft" RENAME TO "Draft";
CREATE INDEX "Draft_status_generatedAt_idx" ON "Draft"("status", "generatedAt");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
