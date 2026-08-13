'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import {
  ArrowLeft,
  Clock,
  CheckCircle2,
  Eye,
  Trash2,
  Trophy,
  Star,
  Grid3X3,
  Play,
  Lightbulb,
  Settings,
  Globe,
  FolderOpen,
  Layers,
  Package,
  Share2,
} from 'lucide-react';

import CrosswordGrid from '@/components/crossword/CrosswordGrid';
import ClueList from '@/components/crossword/ClueList';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardAction,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

import AdminPanel from '@/components/crossword/AdminPanel';
import type {
  CrosswordPuzzleData,
  WordPlacement,
  Clue,
} from '@/lib/crossword/types';

// ── Types ───────────────────────────────────────────────────────────────

interface CategoryInfo {
  id: string;
  name: string;
  slug: string;
  language: string;
}

interface PuzzleSummary {
  id: string;
  title: string;
  difficulty: number;
  description?: string;
  rows: number;
  cols: number;
  publishDate: string;
  language: string;
  categoryId?: string | null;
  categoryName?: string | null;
  categoryIcon?: string | null;
  packId?: string | null;
  packName?: string | null;
  packIcon?: string | null;
  completed?: boolean;
  timeSpent?: number;
}

interface PackInfo {
  id: string;
  name: string;
  description?: string;
  icon?: string;
  language: string;
  _count: { puzzles: number };
}

interface StreakCompletion {
  date: string;
  puzzleId: string;
  time: number;
  difficulty: number;
  title: string;
  language: string;
}

// ── Helpers ─────────────────────────────────────────────────────────────

function toCellKey(row: number, col: number): string {
  return `${row},${col}`;
}

function clueKey(number: number, direction: 'across' | 'down'): string {
  return `${number}-${direction}`;
}

function formatFrenchDate(): string {
  return new Date().toLocaleDateString('fr-FR', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

function formatTimer(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function difficultyLabel(d: number): string {
  if (d <= 1) return 'Facile';
  if (d <= 2) return 'Moyen';
  if (d <= 3) return 'Difficile';
  return 'Expert';
}

function difficultyColor(d: number): string {
  if (d <= 1) return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400';
  if (d <= 2) return 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400';
  if (d <= 3) return 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-400';
  return 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400';
}

function languageFlag(lang: string): string {
  return lang === 'en' ? '🇬🇧' : '🇫🇷';
}

function languageName(lang: string): string {
  return lang === 'en' ? 'English' : 'Français';
}

// ── Confetti overlay ────────────────────────────────────────────────────

function ConfettiOverlay() {
  const particles = useMemo(() => {
    const colors = ['#10b981', '#f59e0b', '#ef4444', '#3b82f6', '#8b5cf6', '#ec4899', '#14b8a6'];
    return Array.from({ length: 50 }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      y: Math.random() * -50 - 10,
      color: colors[i % colors.length],
      size: Math.random() * 8 + 4,
      delay: Math.random() * 1.2,
      duration: Math.random() * 2 + 2.5,
    }));
  }, []);

  return (
    <div className="pointer-events-none fixed inset-0 z-50 overflow-hidden">
      {particles.map((p) => (
        <motion.div
          key={p.id}
          initial={{ x: `${p.x}vw`, y: `${p.y}vh`, opacity: 1, scale: 1 }}
          animate={{ y: '110vh', opacity: 0, rotate: 540 }}
          transition={{ duration: p.duration, delay: p.delay, ease: 'easeIn' }}
          className="absolute rounded-sm"
          style={{ width: p.size, height: p.size, backgroundColor: p.color }}
        />
      ))}
    </div>
  );
}

// ── Puzzle card skeleton ────────────────────────────────────────────────

function PuzzleCardSkeleton() {
  return (
    <Card className="py-5">
      <CardHeader className="gap-1.5 px-5">
        <Skeleton className="h-5 w-3/4" />
        <Skeleton className="h-4 w-1/2" />
      </CardHeader>
      <CardContent className="px-5">
        <div className="flex items-center justify-between">
          <Skeleton className="h-6 w-16 rounded-full" />
          <Skeleton className="h-8 w-20 rounded-md" />
        </div>
      </CardContent>
    </Card>
  );
}

// ════════════════════════════════════════════════════════════════════════
// MAIN PAGE
// ════════════════════════════════════════════════════════════════════════

export default function Home() {
  // ── View state ──────────────────────────────────────────────────────
  const [currentView, setCurrentView] = useState<'selection' | 'playing'>('selection');
  const [adminOpen, setAdminOpen] = useState(false);
  const [dailyPuzzles, setDailyPuzzles] = useState<PuzzleSummary[]>([]);
  const [isLoadingPuzzles, setIsLoadingPuzzles] = useState(true);

  // ── Language + Category + Pack filter state ────────────────────────
  const [selectedLanguage, setSelectedLanguage] = useState<string>('all');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedPack, setSelectedPack] = useState<string>('all');
  const [categories, setCategories] = useState<CategoryInfo[]>([]);
  const [packs, setPacks] = useState<PackInfo[]>([]);

  // ── Puzzle data ─────────────────────────────────────────────────────
  const [selectedPuzzle, setSelectedPuzzle] = useState<CrosswordPuzzleData | null>(null);
  const [puzzleId, setPuzzleId] = useState<string | null>(null);
  const [userInputs, setUserInputs] = useState<(string | null)[][]>([]);
  const [selectedCell, setSelectedCell] = useState<{ row: number; col: number } | null>(null);
  const [direction, setDirection] = useState<'across' | 'down'>('across');
  const [activeClueNumber, setActiveClueNumber] = useState<number | null>(null);
  const [activeClueDirection, setActiveClueDirection] = useState<'across' | 'down'>('across');

  // ── Cell status ─────────────────────────────────────────────────────
  const [revealedCells, setRevealedCells] = useState<Set<string>>(new Set());
  const [correctCellsManual, setCorrectCellsManual] = useState<Set<string>>(new Set());
  const [incorrectCellsManual, setIncorrectCellsManual] = useState<Set<string>>(new Set());
  const [completedClues, setCompletedClues] = useState<Set<string>>(new Set());
  const [autoCheck, setAutoCheck] = useState(true); // Real-time letter validation

  // ── Timer / completion ──────────────────────────────────────────────
  const [timer, setTimer] = useState(0);
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const [isLoadingPuzzle, setIsLoadingPuzzle] = useState(false);

  // ── Streak ──────────────────────────────────────────────────────────
  const [streakData, setStreakData] = useState<StreakCompletion[]>([]);

  // ── Timer interval ──────────────────────────────────────────────────
  useEffect(() => {
    if (!isTimerRunning) return;
    const id = setInterval(() => setTimer((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, [isTimerRunning]);

  // ── Load categories on mount ────────────────────────────────────────
  useEffect(() => {
    fetch('/api/categories')
      .then((res) => res.json())
      .then((data) => {
        setCategories(data.categories ?? []);
      })
      .catch(() => {});
  }, []);

  // ── Load packs on mount ────────────────────────────────────────────
  useEffect(() => {
    fetch('/api/packs')
      .then((res) => res.json())
      .then((data) => {
        setPacks(data.packs ?? []);
      })
      .catch(() => {});
  }, []);

  // ── Load streak data from localStorage ──────────────────────────────
  useEffect(() => {
    try {
      const raw = localStorage.getItem('crossword-streak-data');
      if (raw) setStreakData(JSON.parse(raw));
    } catch {}
  }, []);

  // ── Load daily puzzles on mount / filter change ────────────────────
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setIsLoadingPuzzles(true);
      try {
        const params = new URLSearchParams();
        if (selectedLanguage !== 'all') params.set('language', selectedLanguage);
        const query = params.toString() ? `?${params.toString()}` : '';
        const res = await fetch(`/api/puzzles/daily${query}`);
        if (!res.ok) throw new Error();
        const data = await res.json();
        if (!cancelled) setDailyPuzzles(data.puzzles ?? []);
      } catch {
        if (!cancelled) toast.error('Impossible de charger les puzzles du jour');
      } finally {
        if (!cancelled) setIsLoadingPuzzles(false);
      }
    })();
    return () => { cancelled = true; };
  }, [selectedLanguage]);

  // ── Filter puzzles by category and pack on client side ──────────────
  const filteredPuzzles = useMemo(() => {
    let puzzles = dailyPuzzles;
    if (selectedCategory !== 'all') {
      puzzles = puzzles.filter((p) => p.categoryId === selectedCategory);
    }
    if (selectedPack !== 'all') {
      puzzles = puzzles.filter((p) => p.packId === selectedPack);
    }
    return puzzles;
  }, [dailyPuzzles, selectedCategory, selectedPack]);

  // ── Available categories for filter (based on loaded puzzles) ────────
  const activeCategoryIds = useMemo(() => {
    const ids = new Set<string>();
    for (const p of dailyPuzzles) {
      if (p.categoryId) ids.add(p.categoryId);
    }
    return ids;
  }, [dailyPuzzles]);

  // ── Calculate daily streak ───────────────────────────────────────────
  const streak = useMemo(() => {
    if (streakData.length === 0) return 0;
    const dates = [...new Set(streakData.map((c) => c.date))].sort().reverse();
    if (dates.length === 0) return 0;

    const today = new Date().toISOString().slice(0, 10);
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);

    if (dates[0] !== today && dates[0] !== yesterday) return 0;

    let count = 1;
    for (let i = 1; i < dates.length; i++) {
      const prev = new Date(dates[i - 1]);
      const curr = new Date(dates[i]);
      const diff = (prev.getTime() - curr.getTime()) / 86400000;
      if (diff === 1) count++;
      else break;
    }
    return count;
  }, [streakData]);

  // ── Save streak on puzzle completion ─────────────────────────────────
  useEffect(() => {
    if (!isCompleted || !selectedPuzzle || !puzzleId) return;
    const entry: StreakCompletion = {
      date: new Date().toISOString().slice(0, 10),
      puzzleId,
      time: timer,
      difficulty: selectedPuzzle.difficulty,
      title: selectedPuzzle.title,
      language: dailyPuzzles.find((p) => p.id === puzzleId)?.language || 'fr',
    };
    setStreakData((prev) => {
      const updated = [...prev, entry];
      localStorage.setItem('crossword-streak-data', JSON.stringify(updated));
      return updated;
    });
  }, [isCompleted]);

  // ── Fetch a specific puzzle ─────────────────────────────────────────
  const fetchPuzzle = useCallback(async (id: string) => {
    setIsLoadingPuzzle(true);
    setCurrentView('playing');
    try {
      const res = await fetch(`/api/puzzles/${id}`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      const puzzle: CrosswordPuzzleData = data.puzzle;

      const inputs: (string | null)[][] = Array.from({ length: puzzle.rows }, () =>
        Array.from<null>({ length: puzzle.cols }).fill(null),
      );

      // Restore saved progress
      if (data.progress?.cells) {
        for (const cell of data.progress.cells) {
          const { row, col, letter } = cell as { row: number; col: number; letter: string };
          if (row >= 0 && row < puzzle.rows && col >= 0 && col < puzzle.cols) {
            inputs[row][col] = letter;
          }
        }
      }

      setSelectedPuzzle(puzzle);
      setPuzzleId(id);
      setUserInputs(inputs);
      setSelectedCell(null);
      setDirection('across');
      setActiveClueNumber(null);
      setActiveClueDirection('across');
      setRevealedCells(new Set());
      setCorrectCellsManual(new Set());
      setIncorrectCellsManual(new Set());
      setCompletedClues(new Set());
      setTimer(0);
      setIsTimerRunning(false);
      setIsCompleted(false);
      setIsChecking(false);
    } catch {
      toast.error('Impossible de charger le puzzle');
      setCurrentView('selection');
    } finally {
      setIsLoadingPuzzle(false);
    }
  }, []);

  // ── Get active word cells for highlighting ──────────────────────────
  const getActiveWordCells = useCallback(
    (row: number, col: number, dir: 'across' | 'down') => {
      if (!selectedPuzzle) return [];
      const word = selectedPuzzle.words.find((w: WordPlacement) => {
        if (w.direction !== dir) return false;
        return dir === 'across'
          ? w.row === row && col >= w.col && col < w.col + w.length
          : w.col === col && row >= w.row && row < w.row + w.length;
      });
      if (!word) return [];
      return Array.from({ length: word.length }, (_, i) => ({
        row: dir === 'across' ? word.row : word.row + i,
        col: dir === 'across' ? word.col + i : word.col,
      }));
    },
    [selectedPuzzle],
  );

  // ── Resolve which clue is active for a cell ────────────────────────
  const resolveActiveClue = useCallback(
    (row: number, col: number, dir: 'across' | 'down') => {
      if (!selectedPuzzle) return;
      const otherDir: 'across' | 'down' = dir === 'across' ? 'down' : 'across';

      let found = selectedPuzzle.words.find((w: WordPlacement) => {
        if (w.direction !== dir) return false;
        return dir === 'across'
          ? w.row === row && col >= w.col && col < w.col + w.length
          : w.col === col && row >= w.row && row < w.row + w.length;
      });

      if (!found) {
        found = selectedPuzzle.words.find((w: WordPlacement) => {
          if (w.direction !== otherDir) return false;
          return otherDir === 'across'
            ? w.row === row && col >= w.col && col < w.col + w.length
            : w.col === col && row >= w.row && row < w.row + w.length;
        });
        if (found) {
          setDirection(otherDir);
          setActiveClueDirection(otherDir);
        }
      } else {
        setActiveClueDirection(dir);
      }

      if (found) setActiveClueNumber(found.clueNumber);
    },
    [selectedPuzzle],
  );

  // ── Handlers ─────────────────────────────────────────────────────────

  const handleCellChange = useCallback(
    (row: number, col: number, value: string) => {
      if (isCompleted) return;
      setUserInputs((prev) => {
        const next = prev.map((r) => [...r]);
        next[row][col] = value || null;
        return next;
      });
      if (!isTimerRunning && value) setIsTimerRunning(true);
      // Only clear manual check highlights on new input (auto-check handles its own)
      if (!autoCheck) {
        setCorrectCellsManual(new Set());
        setIncorrectCellsManual(new Set());
      }
    },
    [isCompleted, isTimerRunning, autoCheck],
  );

  const handleSelectCell = useCallback(
    (row: number, col: number) => {
      if (isCompleted) return;
      setSelectedCell({ row, col });
      resolveActiveClue(row, col, direction);
    },
    [isCompleted, direction, resolveActiveClue],
  );

  const handleToggleDirection = useCallback(() => {
    setDirection((prev) => {
      const next: 'across' | 'down' = prev === 'across' ? 'down' : 'across';
      setActiveClueDirection(next);
      if (selectedCell) resolveActiveClue(selectedCell.row, selectedCell.col, next);
      return next;
    });
  }, [selectedCell, resolveActiveClue]);

  const handleSelectClue = useCallback(
    (number: number, dir: 'across' | 'down') => {
      if (!selectedPuzzle) return;
      const word = selectedPuzzle.words.find(
        (w: WordPlacement) => w.clueNumber === number && w.direction === dir,
      );
      if (!word) return;
      setDirection(dir);
      setActiveClueNumber(number);
      setActiveClueDirection(dir);
      setSelectedCell({ row: word.row, col: word.col });
    },
    [selectedPuzzle],
  );

  const handleCheck = useCallback(async () => {
    if (!puzzleId || !selectedPuzzle || isCompleted) return;
    setIsChecking(true);
    try {
      const res = await fetch('/api/puzzles/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ puzzleId, userInputs }),
      });
      if (!res.ok) throw new Error();
      const data = await res.json();

      const incorrect = new Set<string>(
        (data.incorrectCells ?? []).map((c: { row: number; col: number }) => toCellKey(c.row, c.col)),
      );
      setIncorrectCellsManual(incorrect);

      const correct = new Set<string>();
      for (let r = 0; r < selectedPuzzle.rows; r++) {
        for (let c = 0; c < selectedPuzzle.cols; c++) {
          if (userInputs[r][c] && !incorrect.has(toCellKey(r, c))) correct.add(toCellKey(r, c));
        }
      }
      setCorrectCellsManual(correct);

      // Update completed clues
      const newCompleted = new Set<string>(completedClues);
      for (const word of selectedPuzzle.words) {
        const ok = Array.from({ length: word.length }, (_, i) => {
          const r = word.direction === 'across' ? word.row : word.row + i;
          const c = word.direction === 'across' ? word.col + i : word.col;
          return !!userInputs[r]?.[c] && !incorrect.has(toCellKey(r, c));
        }).every(Boolean);
        if (ok) newCompleted.add(clueKey(word.clueNumber, word.direction));
      }
      setCompletedClues(newCompleted);

      if (data.completionPercent === 100 && data.correct) {
        setIsCompleted(true);
        setIsTimerRunning(false);
        toast.success('Bravo ! Puzzle complété !', { duration: 6000 });
      } else if (incorrect.size === 0) {
        toast.success('Tout est correct pour le moment !');
      } else {
        toast.error(`${incorrect.size} lettre${incorrect.size > 1 ? 's' : ''} incorrecte${incorrect.size > 1 ? 's' : ''}`);
      }
    } catch {
      toast.error('Erreur lors de la vérification');
    } finally {
      setIsChecking(false);
    }
  }, [puzzleId, selectedPuzzle, userInputs, isCompleted, completedClues]);

  const handleHint = useCallback(async () => {
    if (!puzzleId || !selectedCell || !selectedPuzzle || isCompleted) return;
    try {
      const res = await fetch('/api/puzzles/hint', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ puzzleId, row: selectedCell.row, col: selectedCell.col }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast.error((err as { error?: string }).error || 'Indice indisponible');
        return;
      }
      const data = await res.json();
      const { row, col } = selectedCell;
      setUserInputs((prev) => {
        const next = prev.map((r) => [...r]);
        next[row][col] = data.letter;
        return next;
      });
      setRevealedCells((prev) => {
        const next = new Set(prev);
        next.add(toCellKey(row, col));
        return next;
      });
      toast.success(`Lettre révélée : ${data.letter}`);
    } catch {
      toast.error('Erreur lors de la révélation');
    }
  }, [puzzleId, selectedCell, selectedPuzzle, isCompleted]);

  const handleClear = useCallback(() => {
    if (!selectedPuzzle || isCompleted) return;
    setUserInputs(
      Array.from({ length: selectedPuzzle.rows }, () =>
        Array.from<null>({ length: selectedPuzzle.cols }).fill(null),
      ),
    );
    setCorrectCellsManual(new Set());
    setIncorrectCellsManual(new Set());
    setRevealedCells(new Set());
    setCompletedClues(new Set());
    toast.info('Grille effacée');
  }, [selectedPuzzle, isCompleted]);

  const handleBack = useCallback(() => {
    setIsTimerRunning(false);
    setSelectedPuzzle(null);
    setPuzzleId(null);
    setCurrentView('selection');
  }, []);

  const handleShare = useCallback(async () => {
    if (!selectedPuzzle) return;
    const stars = '⭐'.repeat(selectedPuzzle.difficulty);
    const mins = Math.floor(timer / 60);
    const secs = timer % 60;
    const timeStr = `${mins}:${String(secs).padStart(2, '0')}`;
    const lang = selectedPuzzle.language === 'en' ? '🇬🇧' : '🇫🇷';

    const text = [
      `🧩 Mots Croisés`,
      `${lang} ${selectedPuzzle.title}`,
      `${stars} Résolu en ${timeStr}`,
      `🔥 Série: ${streak} jour${streak > 1 ? 's' : ''}`,
      ``,
      `Essaie aussi → mots-croisés.app`,
    ].join('\n');

    if (navigator.share) {
      try {
        await navigator.share({ title: 'Mots Croisés', text });
        return;
      } catch {}
    }

    await navigator.clipboard.writeText(text);
    toast.success('Résultat copié dans le presse-papiers !');
  }, [selectedPuzzle, timer, streak]);

  // ── Derived values ───────────────────────────────────────────────────

  // Real-time auto-validation: compare each filled cell against the answer
  const autoCorrectCells = useMemo(() => {
    const s = new Set<string>();
    if (!selectedPuzzle || !autoCheck) return s;
    for (let r = 0; r < selectedPuzzle.rows; r++) {
      for (let c = 0; c < selectedPuzzle.cols; c++) {
        const answer = selectedPuzzle.grid[r]?.[c]?.letter;
        const input = userInputs[r]?.[c];
        if (answer && input && input.toUpperCase() === answer.toUpperCase()) {
          s.add(toCellKey(r, c));
        }
      }
    }
    return s;
  }, [selectedPuzzle, userInputs, autoCheck]);

  const autoIncorrectCells = useMemo(() => {
    const s = new Set<string>();
    if (!selectedPuzzle || !autoCheck) return s;
    for (let r = 0; r < selectedPuzzle.rows; r++) {
      for (let c = 0; c < selectedPuzzle.cols; c++) {
        const answer = selectedPuzzle.grid[r]?.[c]?.letter;
        const input = userInputs[r]?.[c];
        if (answer && input && input.toUpperCase() !== answer.toUpperCase()) {
          s.add(toCellKey(r, c));
        }
      }
    }
    return s;
  }, [selectedPuzzle, userInputs, autoCheck]);

  // Merge auto-check + manual check sets (manual takes priority if conflicting)
  const correctCells = useMemo(() => {
    if (!autoCheck) return correctCellsManual;
    return new Set([...autoCorrectCells, ...correctCellsManual]);
  }, [autoCheck, autoCorrectCells, correctCellsManual]);

  const incorrectCells = useMemo(() => {
    if (!autoCheck) return incorrectCellsManual;
    return new Set([...autoIncorrectCells, ...incorrectCellsManual]);
  }, [autoCheck, autoIncorrectCells, incorrectCellsManual]);

  const activeWordCells = useMemo(() => {
    if (!selectedCell || !selectedPuzzle) return [];
    return getActiveWordCells(selectedCell.row, selectedCell.col, direction);
  }, [selectedCell, selectedPuzzle, direction, getActiveWordCells]);

  const activeClueText = useMemo(() => {
    if (!selectedPuzzle || activeClueNumber === null) return null;
    return selectedPuzzle.clues.find(
      (c: Clue) => c.number === activeClueNumber && c.direction === activeClueDirection,
    ) ?? null;
  }, [selectedPuzzle, activeClueNumber, activeClueDirection]);

  // ══════════════════════════════════════════════════════════════════════
  // RENDER
  // ══════════════════════════════════════════════════════════════════════

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* ═════════════════ PUZZLE SELECTION VIEW ═════════════════ */}
      {currentView === 'selection' && (
        <div className="flex flex-1 flex-col">
          {/* Subtle crossword grid background */}
          <div
            className="pointer-events-none fixed inset-0 -z-10 opacity-[0.025]"
            style={{
              backgroundImage:
                'linear-gradient(90deg, hsl(var(--foreground)) 1px, transparent 1px), linear-gradient(180deg, hsl(var(--foreground)) 1px, transparent 1px)',
              backgroundSize: '28px 28px',
            }}
          />

          {/* ── Header ─────────────────────────────────────────── */}
          <header className="border-b bg-background/95 backdrop-blur-sm">
            <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-6 sm:px-6">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-md shadow-emerald-600/20">
                  <Grid3X3 className="size-6" />
                </div>
                <div>
                  <h1
                    className="text-3xl font-bold tracking-tight sm:text-4xl"
                    style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}
                  >
                    Mots Croisés
                  </h1>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    Gratuits &bull; Uniques &bull; Quotidiens
                  </p>
                </div>
              </div>
              {streak > 0 && (
                <div className="flex items-center gap-1.5 rounded-full bg-gradient-to-r from-orange-100 to-red-100 dark:from-orange-900/30 dark:to-red-900/30 px-3 py-1">
                  <span className="text-lg">🔥</span>
                  <span className="text-sm font-bold text-orange-700 dark:text-orange-400">{streak}</span>
                </div>
              )}
              <Button
                variant="ghost"
                size="sm"
                className="text-xs text-muted-foreground hover:text-foreground gap-1.5"
                onClick={() => setAdminOpen(true)}
              >
                <Settings className="size-3.5" />
                Administration
              </Button>
            </div>
          </header>

          {/* ── Main Content ───────────────────────────────────── */}
          <main className="flex-1 mx-auto w-full max-w-5xl px-4 py-8 sm:px-6">
            {/* Date display */}
            <div className="mb-6">
              <p className="text-sm text-muted-foreground capitalize">
                📅 {formatFrenchDate()}
              </p>
              <h2
                className="mt-2 text-xl font-semibold sm:text-2xl"
                style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}
              >
                Puzzles du jour
              </h2>
            </div>

            {/* ── Filters ──────────────────────────────────────── */}
            <div className="flex flex-wrap items-center gap-3 mb-6">
              {/* Language selector */}
              <div className="flex items-center gap-2">
                <Globe className="size-4 text-muted-foreground" />
                <Select value={selectedLanguage} onValueChange={(v) => {
                  setSelectedLanguage(v);
                  setSelectedCategory('all');
                  setSelectedPack('all');
                }}>
                  <SelectTrigger className="h-9 w-40 text-sm">
                    <SelectValue placeholder="Langue" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">
                      <span className="flex items-center gap-1.5">
                        🌍 Toutes les langues
                      </span>
                    </SelectItem>
                    <SelectItem value="fr">
                      <span className="flex items-center gap-1.5">
                        🇫🇷 Français
                      </span>
                    </SelectItem>
                    <SelectItem value="en">
                      <span className="flex items-center gap-1.5">
                        🇬🇧 English
                      </span>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Category selector — only show if there are categories with puzzles */}
              {activeCategoryIds.size > 0 && (
                <div className="flex items-center gap-2">
                  <FolderOpen className="size-4 text-muted-foreground" />
                  <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                    <SelectTrigger className="h-9 w-44 text-sm">
                      <SelectValue placeholder="Catégorie" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">
                        <span className="flex items-center gap-1.5">
                          📋 Toutes les catégories
                        </span>
                      </SelectItem>
                      {categories
                        .filter((c) => activeCategoryIds.has(c.id))
                        .map((cat) => (
                          <SelectItem key={cat.id} value={cat.id}>
                            <span className="flex items-center gap-1.5">
                              {languageFlag(cat.language)} {cat.name}
                            </span>
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Puzzle count */}
              <div className="ml-auto">
                <Badge variant="secondary" className="text-xs">
                  <Layers className="size-3 mr-1" />
                  {filteredPuzzles.length} puzzle{filteredPuzzles.length !== 1 ? 's' : ''}
                </Badge>
              </div>
            </div>

            {/* Loading state */}
            {isLoadingPuzzles && (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <PuzzleCardSkeleton key={i} />
                ))}
              </div>
            )}

            {/* Empty state */}
            {!isLoadingPuzzles && filteredPuzzles.length === 0 && (
              <div className="text-center py-16">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-muted mb-4">
                  <Grid3X3 className="size-8 text-muted-foreground" />
                </div>
                <h3 className="text-lg font-medium">Aucun puzzle disponible</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  {selectedLanguage !== 'all' || selectedCategory !== 'all' || selectedPack !== 'all'
                    ? 'Essayez de modifier vos filtres pour trouver des puzzles.'
                    : 'Revenez demain pour de nouveaux puzzles !'}
                </p>
              </div>
            )}

            {/* Puzzle cards grid */}
            {!isLoadingPuzzles && filteredPuzzles.length > 0 && (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {filteredPuzzles.map((puzzle) => (
                  <div key={puzzle.id}>
                    <Card className="group relative overflow-hidden py-0 transition-shadow hover:shadow-md">
                      {/* Difficulty accent bar */}
                      <div
                        className={`h-1 w-full ${
                          puzzle.difficulty <= 1
                            ? 'bg-emerald-500'
                            : puzzle.difficulty <= 2
                              ? 'bg-amber-500'
                              : puzzle.difficulty <= 3
                                ? 'bg-orange-500'
                                : 'bg-red-500'
                        }`}
                      />
                      <CardHeader className="gap-1.5 px-5 pt-5 pb-0">
                        <div className="flex items-start justify-between gap-2">
                          <CardTitle className="text-lg leading-snug">{puzzle.title}</CardTitle>
                          <Badge variant="outline" className="shrink-0 text-xs mt-0.5">
                            {languageFlag(puzzle.language)} {languageName(puzzle.language)}
                          </Badge>
                        </div>
                        <CardDescription className="line-clamp-2 min-h-[2.5rem]">
                          {puzzle.description || (puzzle.language === 'en' ? 'A crossword puzzle' : 'Un puzzle de mots croisés')}
                        </CardDescription>
                        {puzzle.categoryName && (
                          <Badge variant="secondary" className="text-xs mt-1 gap-1">
                            <span>{puzzle.categoryIcon || '🏷️'}</span>
                            {puzzle.categoryName}
                          </Badge>
                        )}
                        {puzzle.packName && (
                          <Badge variant="outline" className="text-xs mt-1 gap-1">
                            <span>{puzzle.packIcon || '📦'}</span>
                            {puzzle.packName}
                          </Badge>
                        )}
                      </CardHeader>
                      <CardContent className="flex items-center justify-between px-5 pb-5 pt-4">
                        <div className="flex items-center gap-2">
                          <Badge className={difficultyColor(puzzle.difficulty)} variant="secondary">
                            <Star className="size-3 mr-0.5" />
                            {difficultyLabel(puzzle.difficulty)}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            {puzzle.rows}×{puzzle.cols}
                          </span>
                        </div>
                        <Button
                          size="sm"
                          className="bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm"
                          onClick={() => fetchPuzzle(puzzle.id)}
                        >
                          <Play className="size-3.5" />
                          Jouer
                        </Button>
                      </CardContent>
                      {puzzle.completed && (
                        <div className="absolute top-3 right-3">
                          <Badge variant="secondary" className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400 gap-1">
                            <Trophy className="size-3" />
                            Terminé
                          </Badge>
                        </div>
                      )}
                    </Card>
                  </div>
                ))}
              </div>
            )}

            {/* ── Collections section ── */}
            {packs.length > 0 && (
              <div className="mb-8">
                <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
                  <Package className="size-5 text-muted-foreground" />
                  Collections
                </h2>
                <div className="flex flex-wrap gap-2">
                  {packs
                    .filter((p) => !selectedLanguage || selectedLanguage === 'all' || p.language === selectedLanguage)
                    .map((pack) => (
                      <Button
                        key={pack.id}
                        variant={selectedPack === pack.id ? 'default' : 'outline'}
                        size="sm"
                        className="gap-1.5 text-sm"
                        onClick={() => setSelectedPack(selectedPack === pack.id ? 'all' : pack.id)}
                      >
                        <span className="text-base">{pack.icon}</span>
                        {pack.name}
                        <Badge variant="secondary" className="ml-1 text-xs">{pack._count.puzzles}</Badge>
                      </Button>
                    ))}
                </div>
              </div>
            )}
          </main>

          {/* ── Footer ─────────────────────────────────────────── */}
          <footer className="mt-auto border-t py-4">
            <p className="text-center text-xs text-muted-foreground">
              Mots Croisés &mdash; Un puzzle unique chaque jour
            </p>
          </footer>
        </div>
      )}

      {/* ═════════════════ PUZZLE SOLVING VIEW ═══════════════════ */}
      {currentView === 'playing' && (
        <div className="flex flex-1 flex-col">
          {/* ── Top bar ───────────────────────────────────────── */}
          <header className="sticky top-0 z-20 border-b bg-background/95 backdrop-blur-sm">
            <div className="mx-auto flex max-w-6xl items-center gap-2 px-3 py-2 sm:px-4 sm:gap-3">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleBack}
                className="shrink-0 -ml-1"
              >
                <ArrowLeft className="size-4" />
                <span className="hidden sm:inline">Retour</span>
              </Button>

              <Separator orientation="vertical" className="h-5 mx-1 hidden sm:block" />

              <h2 className="min-w-0 flex-1 truncate text-sm font-semibold sm:text-base">
                {selectedPuzzle?.title ?? 'Chargement…'}
              </h2>

              {selectedPuzzle && (
                <Badge className={difficultyColor(selectedPuzzle.difficulty)} variant="secondary">
                  <Star className="size-3 mr-0.5" />
                  {difficultyLabel(selectedPuzzle.difficulty)}
                </Badge>
              )}

              {/* Timer */}
              <div className="flex items-center gap-1.5 rounded-md border bg-muted/50 px-2.5 py-1 text-sm tabular-nums">
                <Clock className="size-3.5 text-muted-foreground" />
                <span className="font-medium">{formatTimer(timer)}</span>
              </div>
            </div>
          </header>

          {/* ── Main area ──────────────────────────────────────── */}
          <main className="mx-auto w-full max-w-6xl flex-1 px-3 py-4 sm:px-4">
            {/* Loading state */}
            {isLoadingPuzzle && !selectedPuzzle && (
              <div className="flex flex-col items-center justify-center py-20 gap-4">
                <Skeleton className="h-8 w-64" />
                <Skeleton className="h-[320px] w-[320px] rounded-lg" />
              </div>
            )}

            {selectedPuzzle && (
              <div className="flex flex-col gap-4 lg:flex-row lg:gap-6">
                {/* ── Left: Grid + Controls ──────────────────── */}
                <div className="flex flex-col items-center gap-3 lg:w-auto lg:min-w-0 lg:flex-1">
                  {/* Active clue banner */}
                  {activeClueText && (
                    <div
                      key={`${activeClueText.number}-${activeClueText.direction}`}
                      className="w-full rounded-lg border bg-card px-4 py-2.5 shadow-sm"
                    >
                      <div className="flex items-start gap-2">
                        <Badge
                          variant="outline"
                          className="mt-0.5 shrink-0 text-xs font-bold"
                        >
                          {activeClueText.number}
                          {activeClueText.direction === 'across' ? 'H' : 'V'}
                        </Badge>
                        <p className="text-sm leading-relaxed">
                          {activeClueText.text}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Action buttons row */}
                  <div className="flex flex-wrap items-center justify-center gap-2">
                    {/* Auto-check toggle */}
                    <div className="flex items-center gap-1.5 rounded-md border bg-muted/30 px-2.5 py-1">
                      <Switch
                        id="auto-check"
                        checked={autoCheck}
                        onCheckedChange={setAutoCheck}
                        className="scale-90"
                      />
                      <Label htmlFor="auto-check" className="text-xs text-muted-foreground cursor-pointer select-none whitespace-nowrap">
                        Validation auto
                      </Label>
                    </div>
                    <Separator orientation="vertical" className="h-6 hidden sm:block" />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleCheck}
                      disabled={isChecking || isCompleted}
                    >
                      <CheckCircle2 className="size-4 text-emerald-600" />
                      Vérifier
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleHint}
                      disabled={!selectedCell || isCompleted}
                    >
                      <Lightbulb className="size-4 text-amber-500" />
                      Indice
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleClear}
                      disabled={isCompleted}
                    >
                      <Trash2 className="size-4 text-red-500" />
                      Effacer
                    </Button>
                  </div>

                  {/* The crossword grid */}
                  <div className="overflow-x-auto w-full flex justify-center">
                    <CrosswordGrid
                      puzzle={selectedPuzzle}
                      userInputs={userInputs}
                      onCellChange={handleCellChange}
                      selectedCell={selectedCell}
                      onSelectCell={handleSelectCell}
                      direction={direction}
                      onToggleDirection={handleToggleDirection}
                      activeWordCells={activeWordCells}
                      revealedCells={revealedCells}
                      correctCells={correctCells}
                      incorrectCells={incorrectCells}
                    />
                  </div>

                  {/* Keyboard shortcuts hint */}
                  <p className="text-center text-[11px] text-muted-foreground mt-1">
                    Tab pour changer de direction &bull; Flèches pour naviguer &bull; Backspace pour effacer
                  </p>
                </div>

                {/* ── Right: Clue panel (desktop) ──────────── */}
                <div className="w-full lg:w-[340px] xl:w-[380px] lg:shrink-0">
                  <div className="rounded-xl border bg-card shadow-sm">
                    <div className="border-b px-4 py-3">
                      <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                        Indications
                      </h3>
                    </div>
                    <div className="p-1.5">
                      <ClueList
                        clues={selectedPuzzle.clues}
                        activeClueNumber={activeClueNumber}
                        activeClueDirection={activeClueDirection}
                        onSelectClue={handleSelectClue}
                        completedClues={completedClues}
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}
          </main>

          {/* ── Footer ─────────────────────────────────────────── */}
          <footer className="mt-auto border-t py-3">
            <p className="text-center text-[11px] text-muted-foreground">
              Mots Croisés &mdash; Un puzzle unique chaque jour
            </p>
          </footer>

          {/* ── Completion celebration ─────────────────────────── */}
          {isCompleted && (
            <>
              <ConfettiOverlay />
              <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 backdrop-blur-sm">
                <div className="mx-4 rounded-2xl bg-card p-8 text-center shadow-2xl sm:p-12">
                  <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/40">
                    <Trophy className="size-8 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <h2
                    className="text-2xl font-bold sm:text-3xl"
                    style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}
                  >
                    Félicitations !
                  </h2>
                  <p className="mt-2 text-muted-foreground">
                    Vous avez résolu le puzzle en{' '}
                    <span className="font-semibold text-foreground">{formatTimer(timer)}</span>.
                  </p>
                  <div className="mt-6 flex items-center justify-center gap-3">
                    <Button variant="outline" onClick={handleShare}>
                      <Share2 className="size-4" />
                      Partager
                    </Button>
                    <Button variant="outline" onClick={handleBack}>
                      <ArrowLeft className="size-4" />
                      Retour
                    </Button>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* ── Admin Panel Dialog ──────────────────────────────── */}
      <AdminPanel open={adminOpen} onOpenChange={setAdminOpen} />
    </div>
  );
}
