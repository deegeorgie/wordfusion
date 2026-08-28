-- V4 PostgreSQL baseline migration.
-- This migration creates the production schema. Existing SQLite data must be
-- migrated separately before production cut-over.

CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT,
    "role" TEXT NOT NULL DEFAULT 'USER',
    "provider" TEXT,
    "providerAccountId" TEXT,
    "phone" TEXT,
    "dateOfBirth" TEXT,
    "gender" TEXT,
    "country" TEXT,
    "city" TEXT,
    "occupation" TEXT,
    "education" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Pack" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "icon" TEXT NOT NULL DEFAULT '📦',
    "language" TEXT NOT NULL DEFAULT 'fr',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Pack_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Category" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "icon" TEXT NOT NULL DEFAULT '🏷️',
    "language" TEXT NOT NULL DEFAULT 'fr',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Category_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CrosswordPuzzle" (
    "id" TEXT NOT NULL,
    "puzzleNumber" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "difficulty" INTEGER NOT NULL DEFAULT 1,
    "language" TEXT NOT NULL DEFAULT 'fr',
    "categoryId" TEXT,
    "packId" TEXT,
    "creatorId" TEXT,
    "gridData" TEXT NOT NULL,
    "wordsData" TEXT NOT NULL,
    "cluesData" TEXT NOT NULL,
    "rows" INTEGER NOT NULL,
    "cols" INTEGER NOT NULL,
    "publishDate" TIMESTAMP(3),
    "firstPublishedAt" TIMESTAMP(3),
    "published" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CrosswordPuzzle_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "UserProgress" (
    "id" TEXT NOT NULL,
    "puzzleId" TEXT NOT NULL,
    "userId" TEXT NOT NULL DEFAULT 'anonymous',
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "timeSpent" INTEGER NOT NULL DEFAULT 0,
    "hintsUsed" INTEGER NOT NULL DEFAULT 0,
    "progress" TEXT NOT NULL DEFAULT '{}',
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "UserProgress_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PublishingSchedule" (
    "id" TEXT NOT NULL,
    "puzzlesPerDay" INTEGER NOT NULL DEFAULT 1,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PublishingSchedule_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE UNIQUE INDEX "Category_name_key" ON "Category"("name");
CREATE UNIQUE INDEX "Category_slug_key" ON "Category"("slug");
CREATE UNIQUE INDEX "CrosswordPuzzle_puzzleNumber_key" ON "CrosswordPuzzle"("puzzleNumber");
CREATE UNIQUE INDEX "UserProgress_puzzleId_userId_key" ON "UserProgress"("puzzleId", "userId");
CREATE INDEX "CrosswordPuzzle_publishDate_idx" ON "CrosswordPuzzle"("publishDate");
CREATE INDEX "CrosswordPuzzle_firstPublishedAt_idx" ON "CrosswordPuzzle"("firstPublishedAt");
CREATE INDEX "CrosswordPuzzle_published_idx" ON "CrosswordPuzzle"("published");

ALTER TABLE "CrosswordPuzzle" ADD CONSTRAINT "CrosswordPuzzle_categoryId_fkey"
  FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CrosswordPuzzle" ADD CONSTRAINT "CrosswordPuzzle_packId_fkey"
  FOREIGN KEY ("packId") REFERENCES "Pack"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CrosswordPuzzle" ADD CONSTRAINT "CrosswordPuzzle_creatorId_fkey"
  FOREIGN KEY ("creatorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
