CREATE TABLE "PuzzleCategory" (
    "puzzleId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,

    CONSTRAINT "PuzzleCategory_pkey" PRIMARY KEY ("puzzleId", "categoryId")
);

CREATE TABLE "PuzzleCollection" (
    "puzzleId" TEXT NOT NULL,
    "packId" TEXT NOT NULL,

    CONSTRAINT "PuzzleCollection_pkey" PRIMARY KEY ("puzzleId", "packId")
);

INSERT INTO "PuzzleCategory" ("puzzleId", "categoryId")
SELECT "id", "categoryId"
FROM "CrosswordPuzzle"
WHERE "categoryId" IS NOT NULL;

INSERT INTO "PuzzleCollection" ("puzzleId", "packId")
SELECT "id", "packId"
FROM "CrosswordPuzzle"
WHERE "packId" IS NOT NULL;

CREATE INDEX "PuzzleCategory_categoryId_idx" ON "PuzzleCategory"("categoryId");
CREATE INDEX "PuzzleCollection_packId_idx" ON "PuzzleCollection"("packId");

ALTER TABLE "PuzzleCategory"
ADD CONSTRAINT "PuzzleCategory_puzzleId_fkey"
FOREIGN KEY ("puzzleId") REFERENCES "CrosswordPuzzle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PuzzleCategory"
ADD CONSTRAINT "PuzzleCategory_categoryId_fkey"
FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PuzzleCollection"
ADD CONSTRAINT "PuzzleCollection_puzzleId_fkey"
FOREIGN KEY ("puzzleId") REFERENCES "CrosswordPuzzle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PuzzleCollection"
ADD CONSTRAINT "PuzzleCollection_packId_fkey"
FOREIGN KEY ("packId") REFERENCES "Pack"("id") ON DELETE CASCADE ON UPDATE CASCADE;