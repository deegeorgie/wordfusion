
import { db } from '@/lib/db';
import {
  getPrebuiltPuzzles,
  puzzleToDbFormat,
} from '@/lib/crossword/puzzles-data';

async function seed() {
  console.log('🌱 Seeding crossword puzzles...');

  const puzzles = getPrebuiltPuzzles();

  for (let i = 0; i < puzzles.length; i++) {
    const puzzle = puzzles[i];
    const dbFormat = puzzleToDbFormat(puzzle);

    // Each puzzle gets a unique sequential number.
    const puzzleNumber = i + 1;

    // Stagger publish dates: starting from today, 3 puzzles per day.
    const puzzlesPerDay = 3;
    const dayOffset = Math.floor(i / puzzlesPerDay);

    const publishDate = new Date();
    publishDate.setDate(publishDate.getDate() + dayOffset);
    publishDate.setHours(8, 0, 0, 0);

    // Today's puzzles are immediately published.
    const published = dayOffset === 0;

    await db.crosswordPuzzle.create({
      data: {
        puzzleNumber,
        title: puzzle.title,
        description: puzzle.description || null,
        difficulty: puzzle.difficulty,
        rows: puzzle.rows,
        cols: puzzle.cols,
        gridData: dbFormat.gridData,
        wordsData: dbFormat.wordsData,
        cluesData: dbFormat.cluesData,
        publishDate,
        published,
        firstPublishedAt: published ? publishDate : null,
      },
    });

    console.log(
      `  ✅ Puzzle #${String(puzzleNumber).padStart(3, '0')} "${puzzle.title}" seeded (day ${dayOffset + 1})`
    );
  }

  // Set up default publishing schedule.
  await db.publishingSchedule.upsert({
    where: { id: 'default' },
    update: {
      puzzlesPerDay: 3,
      isActive: true,
    },
    create: {
      id: 'default',
      puzzlesPerDay: 3,
      isActive: true,
    },
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
