-- CreateTable
CREATE TABLE "Idea" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "source" TEXT NOT NULL,
    "sourceUrl" TEXT,
    "title" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "rawContent" TEXT,
    "topics" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'new',
    "collectedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "usedAt" DATETIME
);

-- CreateTable
CREATE TABLE "Draft" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ideaId" TEXT NOT NULL,
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
    CONSTRAINT "Draft_ideaId_fkey" FOREIGN KEY ("ideaId") REFERENCES "Idea" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PublishLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "draftId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "detail" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE INDEX "Idea_status_collectedAt_idx" ON "Idea"("status", "collectedAt");

-- CreateIndex
CREATE INDEX "Idea_source_idx" ON "Idea"("source");

-- CreateIndex
CREATE INDEX "Draft_status_generatedAt_idx" ON "Draft"("status", "generatedAt");

-- CreateIndex
CREATE INDEX "PublishLog_draftId_idx" ON "PublishLog"("draftId");
