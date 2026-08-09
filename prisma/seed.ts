import { db } from '@/lib/db';
import { getPrebuiltPuzzles, puzzleToDbFormat } from '@/lib/crossword/puzzles-data';

async function seed() {
  console.log('🌱 Seeding crossword puzzles...');

  const puzzles = getPrebuiltPuzzles();

  for (let i = 0; i < puzzles.length; i++) {
    const puzzle = puzzles[i];
    const dbFormat = puzzleToDbFormat(puzzle);

    // Stagger publish dates: starting from today, 3 puzzles per day
    const puzzlesPerDay = 3;
    const dayOffset = Math.floor(i / puzzlesPerDay);
    const publishDate = new Date();
    publishDate.setDate(publishDate.getDate() + dayOffset);
    publishDate.setHours(8, 0, 0, 0); // Publish at 8 AM

    await db.crosswordPuzzle.create({
      data: {
        title: puzzle.title,
        description: puzzle.description || null,
        difficulty: puzzle.difficulty,
        rows: puzzle.rows,
        cols: puzzle.cols,
        gridData: dbFormat.gridData,
        wordsData: dbFormat.wordsData,
        cluesData: dbFormat.cluesData,
        publishDate,
        published: dayOffset === 0, // Publish today's puzzles immediately
      },
    });

    console.log(`  ✅ Puzzle "${puzzle.title}" seeded (day ${dayOffset + 1})`);
  }

  // Set up default publishing schedule
  await db.publishingSchedule.upsert({
    where: { id: 'default' },
    update: { puzzlesPerDay: 3, isActive: true },
    create: { id: 'default', puzzlesPerDay: 3, isActive: true },
  });

  console.log('✨ Seeding complete!');
}

seed()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(() => {
    void db.$disconnect();
  });
