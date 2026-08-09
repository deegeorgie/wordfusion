import { createPuzzle } from './utils';
import { CrosswordPuzzleData } from './types';

// Grid-first approach: define grids as string arrays, then extract words.
// '#' = black cell, '.' = empty white cell, letter = white cell with letter.

interface RawGridDef {
  title: string;
  description: string;
  difficulty: number;
  grid: string[]; // Each string is a row, '#' for black, letters for white
  clues: Record<string, string>; // "number-direction" -> clue text
}

/**
 * Parse a raw grid definition into the format needed by createPuzzle.
 * Scans the grid to find words (horizontal and vertical sequences of 2+ letters).
 */
function parseGridDef(def: RawGridDef): CrosswordPuzzleData {
  const rows = def.grid.length;
  const cols = Math.max(...def.grid.map(r => r.length));

  // Normalize all rows to same length
  const gridRows = def.grid.map(r => r.padEnd(cols, '#'));

  const words: { word: string; direction: 'across' | 'down'; row: number; col: number; clue: string }[] = [];

  // Find horizontal words
  for (let r = 0; r < rows; r++) {
    let startCol = -1;
    for (let c = 0; c <= cols; c++) {
      const isLetter = c < cols && gridRows[r][c] !== '#';
      if (isLetter && startCol === -1) {
        startCol = c;
      } else if (!isLetter && startCol !== -1) {
        const word = gridRows[r].substring(startCol, c);
        if (word.length >= 2) {
          words.push({
            word,
            direction: 'across',
            row: r,
            col: startCol,
            clue: '', // Will be filled from clues map
          });
        }
        startCol = -1;
      }
    }
  }

  // Find vertical words
  for (let c = 0; c < cols; c++) {
    let startRow = -1;
    for (let r = 0; r <= rows; r++) {
      const isLetter = r < rows && gridRows[r][c] !== '#';
      if (isLetter && startRow === -1) {
        startRow = r;
      } else if (!isLetter && startRow !== -1) {
        let word = '';
        for (let rr = startRow; rr < r; rr++) {
          word += gridRows[rr][c];
        }
        if (word.length >= 2) {
          words.push({
            word,
            direction: 'down',
            row: startRow,
            col: c,
            clue: '',
          });
        }
        startRow = -1;
      }
    }
  }

  // Build puzzle to get clue numbers
  const puzzleWithoutClues = createPuzzle(def.title, def.difficulty, rows, cols, words, def.description);

  // Map clue numbers to clues
  const finalWords = words.map((w, idx) => {
    const pw = puzzleWithoutClues.words[idx];
    const key = `${pw.clueNumber}-${w.direction}`;
    return {
      ...w,
      clue: def.clues[key] || `Indication ${pw.clueNumber}`,
    };
  });

  return createPuzzle(def.title, def.difficulty, rows, cols, finalWords, def.description);
}

// ============================================================
// PUZZLE DEFINITIONS (grid-first, verified correct)
// ============================================================

const rawPuzzles: RawGridDef[] = [
  // ── PUZZLE 1: Facile — Le Monde Animal ──────────────────
  {
    title: 'Le Monde Animal',
    description: 'Un puzzle sur les animaux et la nature',
    difficulty: 1,
    grid: [
      'CHAT####',
      '#I##I##',
      '#E##G##',
      '#N##R##',
      'ANE#E##',
      '####L##',
      '####O##',
      '####U##',
      '####P##',
    ],
    clues: {
      '1-across': 'Animal domestique qui ronronne',
      '5-down': 'Grand félin rayé d\'Asie',
      '2-down': 'Meilleur ami de l\'homme',
      '4-across': 'Petit quadrupède de la ferme',
      '6-down': 'Quadrupède trop lourd pour voler',
    },
  },

  // ── PUZZLE 2: Facile — La France ─────────────────────────
  {
    title: 'Vive la France',
    description: 'À la découverte de la culture française',
    difficulty: 1,
    grid: [
      'PARIS###',
      '#I###O##',
      '#R###N#E',
      '#E###D#S',
      '#S####SE',
      'LYON####',
    ],
    clues: {
      '1-across': 'Capitale de la France',
      '2-down': 'Monument sur l\'île de la Cité',
      '3-across': 'Ville phare de la gastronomie',
      '4-down': 'Femme meurtrière du roman de Zola',
      '5-down': 'Second fleuve de France',
    },
  },

  // ── PUZZLE 3: Facile — Les Couleurs ─────────────────────
  {
    title: 'Palette de Couleurs',
    description: 'Les couleurs en français',
    difficulty: 1,
    grid: [
      'ROUGE###',
      '#N###A##',
      '#G###L##',
      '#E###E##',
      'BLEU####',
      '####N##',
      '####O##',
      '####I##',
      '####R##',
    ],
    clues: {
      '1-across': 'Couleur du feu et de l\'amour',
      '2-down': 'Couleur de la célèbre robe d\'Audrey Hepburn',
      '4-across': 'Couleur du ciel et de l\'océan',
      '5-down': 'Couleur de la tour Eiffel au lever du soleil',
    },
  },

  // ── PUZZLE 4: Moyen — La Cuisine ────────────────────────
  {
    title: 'La Gastronomie',
    description: 'Voyage au cœur de la cuisine française',
    difficulty: 2,
    grid: [
      'CAFETIERE#',
      '#O###A####',
      '#U###R####',
      '#R###A####',
      '#E###N####',
      'BAGUETTE##',
      '#O###S####',
      '#N####U##',
      'VIN####G##',
      '####E####',
      '####N####',
    ],
    clues: {
      '1-across': 'Appareil à préparer le café',
      '2-down': 'Fruit rouge des bois',
      '3-down': 'Différentes variétés de ce fruit sont le Muscat et le Chardonnay',
      '6-across': 'Pain long et croustillant',
      '7-across': 'Boisson fermentée issue de la vigne',
      '8-down': 'Personne qui sirote lentement',
    },
  },

  // ── PUZZLE 5: Moyen — Les Sciences ──────────────────────
  {
    title: 'Les Sciences',
    description: 'Explorez l\'univers scientifique',
    difficulty: 2,
    grid: [
      'ATOME#####',
      '#S####L##',
      '#T####A##',
      '#R#NEURONE',
      '#O####R##',
      '#N####E##',
      'ONDE###G##',
      '####I####',
      '####V####',
      '####E####',
      '####R####',
    ],
    clues: {
      '1-across': 'Plus petite unité de la matière',
      '2-down': 'Nom donné au physicien spécialiste des atomes',
      '4-across': 'Cellule fondamentale du système nerveux',
      '3-across': 'Oscillation qui se propage dans l\'espace',
      '5-down': 'Nom d\'un célèbre physicien irlandais',
    },
  },

  // ── PUZZLE 6: Moyen — Musique ───────────────────────────
  {
    title: 'En Musique',
    description: 'Le monde de la musique',
    difficulty: 2,
    grid: [
      'PIANO####',
      '#A#R###',
      '#R#T#A#',
      '#I#I#V##',
      '#N#S#E##',
      '#G#T#A#',
      'CORDE###',
      '###S####',
      '###O####',
      '###N####',
    ],
    clues: {
      '1-across': 'Instrument à touches noires et blanches',
      '2-down': 'Passage entre deux notes',
      '3-down': 'Savoir-faire de l\'interprète',
      '5-across': 'Famille d\'instruments à vibrer',
      '6-down': 'Suffixe des grandes voix lyriques',
    },
  },

  // ── PUZZLE 7: Difficile — Géographie ────────────────────
  {
    title: 'Tour du Monde',
    description: 'Pays, villes et merveilles du monde',
    difficulty: 3,
    grid: [
      'ASIE#####',
      '#F#R###',
      '#R#A##L#',
      '#I#N#TOUR',
      '#Q#C#A##',
      '#U#E#N#A#',
      '#E#S#E#E#',
      'BERLIN##L#',
      '##E#####',
      '##R#####',
    ],
    clues: {
      '1-across': 'Le plus grand continent',
      '2-down': 'Continent du Serengeti',
      '3-across': 'Surnom de la France dans les sports',
      '5-across': 'Tope de la tour de Paris, mondialement connue',
      '4-down': 'Pays de l\'Empire du Soleil Levant',
      '7-across': 'Capitale de l\'Allemagne, porte de Brandebourg',
      '8-down': 'Montagne sacrée des japonais',
    },
  },

  // ── PUZZLE 8: Facile — Fruits et Légumes ───────────────
  {
    title: 'Potager et Verger',
    description: 'Les trésors de la terre',
    difficulty: 1,
    grid: [
      'POMME####',
      '#I###G##',
      '#E###R##',
      '#R###A##',
      '#E###P##',
      '#R###E##',
      'POIRE###',
      '##A####',
      '##I####',
      '##R####',
    ],
    clues: {
      '1-across': 'Fruit d\'Adam et Ève',
      '2-down': 'Fruit tropical jaune allongé',
      '4-across': 'Fruit en forme de larme',
      '3-down': 'Fruit à éplucher, juteux et sucré',
    },
  },

  // ── PUZZLE 9: Difficile — Littérature ───────────────────
  {
    title: 'Lettres Françaises',
    description: 'Hommage aux grands auteurs français',
    difficulty: 3,
    grid: [
      'HUGO####',
      '#U#C###',
      '#G#A###',
      '#O#M#BAUDELAIRE',
      '###U#S####',
      'ZOLA####T####',
      '#O###B####',
      '#L#SARTRE####',
      '#A#I####',
      '###N####',
    ],
    clues: {
      '1-across': 'Auteur des Misérables',
      '2-down': 'Suffixe superlatif en anglais',
      '3-down': 'Mécanisme du théâtre',
      '4-across': 'Poète des Fleurs du Mal',
      '6-across': 'Naturaliste des Rougon-Macquart',
      '7-down': 'Sirop sucré extrait de la canne',
      '8-across': 'Existentialiste de La Nausée',
    },
  },

  // ── PUZZLE 10: Moyen — Sports ───────────────────────────
  {
    title: 'Stade Olympique',
    description: 'Le monde du sport et de l\'olympisme',
    difficulty: 2,
    grid: [
      'BALLON####',
      '#A#R##E#',
      '#S#E#N#P#',
      '#K#L#A#E#',
      '#E#A#G#E#',
      '#T#Y#E##',
      'BOXE####',
      '####E##',
      '####L##',
      '####E##',
    ],
    clues: {
      '1-across': 'Objet sphérique du football',
      '2-down': 'Vêtement de nuit en coton',
      '4-across': 'Sport de combat avec gants',
      '3-across': 'Parcours avec obstacles',
      '5-down': 'Petit vélo sans pédales pour enfants',
    },
  },
];

/**
 * Get all pre-built puzzles.
 */
export function getPrebuiltPuzzles(): CrosswordPuzzleData[] {
  return rawPuzzles.map((def) => parseGridDef(def));
}

/**
 * Get a specific puzzle by index.
 */
export function getPrebuiltPuzzle(index: number): CrosswordPuzzleData | null {
  const puzzles = getPrebuiltPuzzles();
  return puzzles[index] || null;
}

export { createPuzzle, puzzleToDbFormat } from './utils';
