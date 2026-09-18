'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { useSession, signOut } from 'next-auth/react';
import {
  ArrowLeft,
  CalendarDays,
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
  Coins,
  Lock,
  Volume2,
  VolumeX,
  Share2,
  BarChart3,
  Download,
  FileText,
  Award,
  LogIn,
  LogOut,
  Shield,
  PenTool,
  User as UserIcon,
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

import { StatsPanel } from '@/components/crossword/StatsPanel';
import { BadgePanel } from '@/components/crossword/BadgePanel';
import { BadgeNotification } from '@/components/crossword/BadgeNotification';
import { AuthModal } from '@/components/crossword/AuthModal';
import { exportPuzzleToPdf } from '@/lib/crossword/pdf-export';
import { evaluateBadges, getNewBadges, type EarnedBadge } from '@/lib/crossword/badges';
import { cn } from '@/lib/utils';
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
  isPremium?: boolean;
  unlockCost?: number;
  isUnlocked?: boolean;
  completed?: boolean;
  timeSpent?: number;
  lastPlayedAt?: string | null;
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

let sharedAudioContext: AudioContext | null = null;

function playPuzzleSound(kind: 'letter' | 'correct' | 'incorrect' | 'magic' | 'completion', letter?: string): void {
  if (typeof window === 'undefined' || !window.AudioContext) return;

  sharedAudioContext ??= new window.AudioContext();
  const context = sharedAudioContext;
  if (context.state === 'suspended') void context.resume();

  const sounds = {
    letter: { frequencies: [letter ? 220 + ((letter.charCodeAt(0) - 65) % 12) * 18 : 330], duration: 0.09, type: 'sine' as OscillatorType, volume: 0.06, gap: 0 },
    correct: { frequencies: [523.25, 659.25], duration: 0.2, type: 'sine' as OscillatorType, volume: 0.12, gap: 0.08 },
    incorrect: { frequencies: [185, 146.83], duration: 0.16, type: 'triangle' as OscillatorType, volume: 0.1, gap: 0.05 },
    magic: { frequencies: [392, 523.25, 659.25, 783.99], duration: 0.24, type: 'sine' as OscillatorType, volume: 0.12, gap: 0.08 },
    completion: { frequencies: [523.25, 659.25, 783.99], duration: 0.32, type: 'sine' as OscillatorType, volume: 0.16, gap: 0.12 },
  }[kind];
  const start = context.currentTime;

  sounds.frequencies.forEach((frequency, index) => {
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    const noteStart = start + index * sounds.gap;
    oscillator.type = sounds.type;
    oscillator.frequency.value = frequency;
    gain.gain.setValueAtTime(0.0001, noteStart);
    gain.gain.exponentialRampToValueAtTime(sounds.volume, noteStart + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, noteStart + sounds.duration);
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start(noteStart);
    oscillator.stop(noteStart + sounds.duration);
  });
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

function streakDateKey(value: string): string {
  return value.slice(0, 10);
}

// ── Streak Heatmap ──────────────────────────────────────────────

function StreakHeatmap({ streakData }: { streakData: StreakCompletion[] }) {
  const days = useMemo(() => {
    const today = new Date();
    const result: { date: string; completed: boolean; count: number }[] = [];
    for (let i = 29; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().slice(0, 10);
      const completions = streakData.filter((c) => streakDateKey(c.date) === dateStr);
      result.push({
        date: dateStr,
        completed: completions.length > 0,
        count: completions.length,
      });
    }
    return result;
  }, [streakData]);

  if (streakData.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-1">
      {days.map((day) => (
        <div
          key={day.date}
          title={`${day.date}${day.completed ? ` — ${day.count} puzzle${day.count > 1 ? 's' : ''}` : ''}`}
          className={cn(
            'h-5 w-5 rounded-sm transition-colors',
            day.completed
              ? 'bg-emerald-500 dark:bg-emerald-400'
              : day.date <= new Date().toISOString().slice(0, 10)
                ? 'bg-muted'
                : 'bg-transparent',
          )}
        />
      ))}
    </div>
  );
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
  // ── Auth ───────────────────────────────────────────────────────────
  const { data: session, status } = useSession();
  const [authOpen, setAuthOpen] = useState(false);
  const userRole = (session?.user?.role as string) || null;
  const isCreator = userRole === 'CREATOR' || userRole === 'ADMIN';
  const isAdmin = userRole === 'ADMIN';

  // ── View state ──────────────────────────────────────────────────────
  const [currentView, setCurrentView] = useState<'selection' | 'playing'>('selection');
  const [statsOpen, setStatsOpen] = useState(false);
  const [badgesOpen, setBadgesOpen] = useState(false);
  const [newBadge, setNewBadge] = useState<EarnedBadge | null>(null);
  const [earnedBadgeIds, setEarnedBadgeIds] = useState<Set<string>>(new Set());
  const [dailyPuzzles, setDailyPuzzles] = useState<PuzzleSummary[]>([]);
  const [isLoadingPuzzles, setIsLoadingPuzzles] = useState(true);

  // ── Language + Category + Pack + Date filter state ─────────────────
  const [selectedLanguage, setSelectedLanguage] = useState<string>('all');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedPack, setSelectedPack] = useState<string>('all');
  const [todayOnly, setTodayOnly] = useState(true);
  const [categories, setCategories] = useState<CategoryInfo[]>([]);
  const [packs, setPacks] = useState<PackInfo[]>([]);

  // ── Puzzle data ─────────────────────────────────────────────────────
  type SelectedPuzzle = CrosswordPuzzleData & { language: 'fr' | 'en' };
  const [selectedPuzzle, setSelectedPuzzle] = useState<SelectedPuzzle | null>(null);
  const [puzzleId, setPuzzleId] = useState<string | null>(null);
  const [userInputs, setUserInputs] = useState<(string | null)[][]>([]);
  const [selectedCell, setSelectedCell] = useState<{ row: number; col: number } | null>(null);
  const [direction, setDirection] = useState<'across' | 'down'>('across');
  const [activeClueNumber, setActiveClueNumber] = useState<number | null>(null);
  const [activeClueDirection, setActiveClueDirection] = useState<'across' | 'down'>('across');

  // ── Cell status ─────────────────────────────────────────────────────
  const [revealedCells, setRevealedCells] = useState<Set<string>>(new Set());
  const [magicRevealedCells, setMagicRevealedCells] = useState<Set<string>>(new Set());
  const [correctCellsManual, setCorrectCellsManual] = useState<Set<string>>(new Set());
  const [incorrectCellsManual, setIncorrectCellsManual] = useState<Set<string>>(new Set());
  const [completedClues, setCompletedClues] = useState<Set<string>>(new Set());
  const [autoCheck, setAutoCheck] = useState(true); // Real-time letter validation

  // ── Timer / completion ──────────────────────────────────────────────
  const [timer, setTimer] = useState(0);
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [isLoadingPuzzle, setIsLoadingPuzzle] = useState(false);
  const [isUnlockingPuzzle, setIsUnlockingPuzzle] = useState<string | null>(null);

  // ── Streak ──────────────────────────────────────────────────────────
  const [streakData, setStreakData] = useState<StreakCompletion[]>([]);
  const [coinBalance, setCoinBalance] = useState(0);
  const [lastCoinReward, setLastCoinReward] = useState(0);
  const [isRevealingLetters, setIsRevealingLetters] = useState(false);
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);

  // ── Timer interval ──────────────────────────────────────────────────
  const saveTick = Math.floor(timer / 15);
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

  // ── Load authenticated coin balance ─────────────────────────────────
  useEffect(() => {
    if (status !== 'authenticated') {
      setCoinBalance(0);
      return;
    }

    fetch('/api/coins')
      .then((res) => res.json())
      .then((data) => setCoinBalance(data.balance ?? 0))
      .catch(() => {});
  }, [status]);

  useEffect(() => {
    setSoundEnabled(localStorage.getItem('crossword-sound-enabled') !== 'false');
  }, []);

  // ── Load account-scoped streak data from localStorage ────────────────
  useEffect(() => {
    if (status === 'loading') return;

    const storageKey = session?.user?.id
      ? `crossword-streak-data:${session.user.id}`
      : 'crossword-streak-data:anonymous';

    try {
      const raw = localStorage.getItem(storageKey);
      const localData = raw ? JSON.parse(raw) : [];
      const fallbackData = Array.isArray(localData) ? localData : [];

      if (!session?.user?.id) {
        setStreakData(fallbackData);
        setEarnedBadgeIds(new Set(evaluateBadges(fallbackData).map((b) => b.id)));
        return;
      }

      fetch('/api/achievements')
        .then((res) => (res.ok ? res.json() : Promise.reject(new Error())))
        .then((data) => {
          const serverData = Array.isArray(data.completions) ? data.completions : [];
          const knownPuzzleIds = new Set(serverData.map((entry: StreakCompletion) => entry.puzzleId));
          const merged = [
            ...serverData,
            ...fallbackData.filter((entry: StreakCompletion) => !knownPuzzleIds.has(entry.puzzleId)),
          ];
          localStorage.setItem(storageKey, JSON.stringify(merged));
          setStreakData(merged);
          setEarnedBadgeIds(new Set(evaluateBadges(merged).map((b) => b.id)));
        })
        .catch(() => {
          setStreakData(fallbackData);
          setEarnedBadgeIds(new Set(evaluateBadges(fallbackData).map((b) => b.id)));
        });
    } catch {}
  }, [session?.user?.id, status]);

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

  // ── Today's date string (server-agnostic) ─────────────────────────
  const todayStr = useMemo(() => new Date().toISOString().slice(0, 10), []);

  // ── Non-admins always see only today's puzzles ─────────────────────
  // Archive access is an entitlement. Today is public; admins have it now,
  // and a future ad-reward entitlement can be added here without changing
  // the filtering or card UI.
  const hasArchiveAccess = isAdmin;
  const effectiveTodayOnly = hasArchiveAccess ? todayOnly : true;

  // ── Filter puzzles by date, category and pack on client side ────────
  const filteredPuzzles = useMemo(() => {
    let puzzles = dailyPuzzles;
    if (effectiveTodayOnly) {
      puzzles = puzzles.filter((p) =>
        (p.publishDate && p.publishDate.slice(0, 10) === todayStr) ||
        p.completed ||
        p.isPremium,
      );
    }
    if (selectedCategory !== 'all') {
      puzzles = puzzles.filter((p) => p.categoryId === selectedCategory);
    }
    if (selectedPack !== 'all') {
      puzzles = puzzles.filter((p) => p.packId === selectedPack);
    }
    return puzzles;
  }, [dailyPuzzles, effectiveTodayOnly, todayStr, selectedCategory, selectedPack]);

  const dailyChallenges = useMemo(
    () => filteredPuzzles.filter((puzzle) => !puzzle.isPremium),
    [filteredPuzzles],
  );
  const expertPuzzles = useMemo(
    () => filteredPuzzles.filter((puzzle) => puzzle.isPremium && !puzzle.completed),
    [filteredPuzzles],
  );
  const personalArchives = useMemo(
    () => filteredPuzzles.filter((puzzle) => puzzle.completed),
    [filteredPuzzles],
  );

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
    const dates = [...new Set(streakData.map((c) => streakDateKey(c.date)))].sort().reverse();
    if (dates.length === 0) return 0;

    const today = new Date().toISOString().slice(0, 10);
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);

    if (dates[0] !== today && dates[0] !== yesterday) return 0;

    let count = 1;
    for (let i = 1; i < dates.length; i++) {
      const prev = new Date(`${dates[i - 1]}T00:00:00Z`);
      const curr = new Date(`${dates[i]}T00:00:00Z`);
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
      const storageKey = session?.user?.id
        ? `crossword-streak-data:${session.user.id}`
        : 'crossword-streak-data:anonymous';
      localStorage.setItem(storageKey, JSON.stringify(updated));

      // Check for newly earned badges
      const previouslyEarned = Array.from(earnedBadgeIds);
      const newBadges = getNewBadges(updated, previouslyEarned);
      if (newBadges.length > 0) {
        setEarnedBadgeIds((prev) => {
          const next = new Set(prev);
          for (const b of newBadges) next.add(b.id);
          return next;
        });
        // Show the first new badge as notification
        setNewBadge(newBadges[0]);
      }

      return updated;
    });
  }, [isCompleted, session?.user?.id]);

  // ── Fetch a specific puzzle ─────────────────────────────────────────
  const fetchPuzzle = useCallback(async (id: string, startFresh = false) => {
    setIsLoadingPuzzle(true);
    setCurrentView('playing');
    try {
      if (startFresh) {
        const resetResponse = await fetch('/api/puzzles/progress', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ puzzleId: id, reset: true }),
        });
        if (!resetResponse.ok) throw new Error();
      }

      const res = await fetch(`/api/puzzles/${id}`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      const puzzle: SelectedPuzzle = {
        ...data.puzzle,
        language: data.language === 'en' ? 'en' : 'fr',
      };

      const inputs: (string | null)[][] = Array.from({ length: puzzle.rows }, () =>
        Array.from<null>({ length: puzzle.cols }).fill(null),
      );

      if (!startFresh) {
        // Restore current matrix records, while preserving support for legacy cell lists.
        if (Array.isArray(data.progress?.progress)) {
          for (let row = 0; row < puzzle.rows; row++) {
            for (let col = 0; col < puzzle.cols; col++) {
              const value = data.progress.progress[row]?.[col];
              if (typeof value === 'string') inputs[row][col] = value;
            }
          }
        } else if (data.progress?.cells) {
          for (const cell of data.progress.cells) {
            const { row, col, letter } = cell as { row: number; col: number; letter: string };
            if (row >= 0 && row < puzzle.rows && col >= 0 && col < puzzle.cols) {
              inputs[row][col] = letter;
            }
          }
        }
      }

      const persistedReveals = Array.isArray(data.progress?.revealedCells)
        ? data.progress.revealedCells as string[]
        : [];
      for (const key of persistedReveals) {
        const [row, col] = key.split(',').map(Number);
        if (Number.isInteger(row) && Number.isInteger(col) && puzzle.grid[row]?.[col] && !puzzle.grid[row][col].isBlack) {
          inputs[row][col] = puzzle.grid[row][col].letter;
        }
      }

      setSelectedPuzzle(puzzle);
      setPuzzleId(id);
      setUserInputs(inputs);
      setSelectedCell(null);
      setDirection('across');
      setActiveClueNumber(null);
      setActiveClueDirection('across');
      setRevealedCells(new Set(persistedReveals));
      setMagicRevealedCells(new Set());
      setCorrectCellsManual(new Set());
      setIncorrectCellsManual(new Set());
      setCompletedClues(new Set());
      setTimer(startFresh ? 0 : (data.progress?.timeSpent ?? 0));
      setIsTimerRunning(false);
      setIsCompleted(false);
      setLastCoinReward(0);
      setIsChecking(false);
    } catch {
      toast.error('Impossible de charger le puzzle');
      setCurrentView('selection');
    } finally {
      setIsLoadingPuzzle(false);
    }
  }, []);

  const handleUnlockPuzzle = useCallback(async (id: string, cost: number) => {
    if (!session?.user) {
      setAuthOpen(true);
      return;
    }
    if (coinBalance < cost) {
      toast.error(`Il vous faut ${cost} pièces pour déverrouiller ce puzzle`);
      return;
    }

    setIsUnlockingPuzzle(id);
    try {
      const res = await fetch(`/api/puzzles/${id}/unlock`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || 'Impossible de déverrouiller le puzzle');
        return;
      }
      setCoinBalance(data.balance ?? coinBalance - cost);
      setDailyPuzzles((previous) => previous.map((puzzle) =>
        puzzle.id === id ? { ...puzzle, isUnlocked: true } : puzzle,
      ));
      toast.success('Puzzle déverrouillé !');
    } catch {
      toast.error('Impossible de déverrouiller le puzzle');
    } finally {
      setIsUnlockingPuzzle(null);
    }
  }, [session, coinBalance]);

  useEffect(() => {
    if (!puzzleId || !selectedPuzzle || isCompleted) return;
    if (!userInputs.some((row) => row.some(Boolean))) return;
    const timeout = window.setTimeout(() => {
      void fetch('/api/puzzles/progress', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ puzzleId, userInputs, timeSpent: saveTick * 15 }),
      });
    }, 750);
    return () => window.clearTimeout(timeout);
  }, [puzzleId, selectedPuzzle, userInputs, saveTick, isCompleted]);

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
      const cellKey = toCellKey(row, col);
      if (isCompleted || revealedCells.has(cellKey)) return;
      const currentInput = userInputs[row]?.[col];
      const answer = selectedPuzzle?.grid[row]?.[col]?.letter;
      const isConfirmedCorrect = correctCellsManual.has(cellKey) || (
        autoCheck && !!currentInput && !!answer && currentInput.toUpperCase() === answer.toUpperCase()
      );
      if (isConfirmedCorrect && value !== currentInput) {
        toast.info('Cette lettre correcte est verrouillée');
        return;
      }
      setUserInputs((prev) => {
        const next = prev.map((r) => [...r]);
        next[row][col] = value || null;
        return next;
      });
      if (soundEnabled && value) playPuzzleSound('letter', value);
      if (!isTimerRunning && value) setIsTimerRunning(true);
      // Only clear manual check highlights on new input (auto-check handles its own)
      if (!autoCheck) {
        setCorrectCellsManual(new Set());
        setIncorrectCellsManual(new Set());
      }
    },
    [isCompleted, isTimerRunning, autoCheck, revealedCells, soundEnabled, userInputs, selectedPuzzle, correctCellsManual],
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

  const handleCheck = useCallback(async (options?: { silent?: boolean }) => {
    if (!puzzleId || !selectedPuzzle || isCompleted || isChecking) return;
    setIsChecking(true);
    try {
      const res = await fetch('/api/puzzles/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ puzzleId, userInputs, timeSpent: timer }),
      });
      if (!res.ok) throw new Error();
      const data = await res.json();

      const incorrect = new Set<string>(
        (data.incorrectCells ?? []).map((c: { row: number; col: number }) => toCellKey(c.row, c.col)),
      );
      setIncorrectCellsManual(incorrect);

      const magicCells = (data.revealedCells ?? []) as { row: number; col: number; letter: string }[];
      if (magicCells.length > 0) {
        setUserInputs((previous) => {
          const next = previous.map((row) => [...row]);
          for (const cell of magicCells) next[cell.row][cell.col] = cell.letter;
          return next;
        });
        setRevealedCells((previous) => {
          const next = new Set(previous);
          for (const cell of magicCells) next.add(toCellKey(cell.row, cell.col));
          return next;
        });
        setMagicRevealedCells((previous) => {
          const next = new Set(previous);
          for (const cell of magicCells) next.add(toCellKey(cell.row, cell.col));
          return next;
        });
        toast.success(`Mot magique trouvé ! ${magicCells.length} lettre${magicCells.length > 1 ? 's' : ''} révélée${magicCells.length > 1 ? 's' : ''}`);
        if (soundEnabled) playPuzzleSound('magic');
      }

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
        if (soundEnabled) playPuzzleSound('completion');
        setLastCoinReward(data.coinReward ?? 0);
        if (data.coinReward) setCoinBalance((balance) => balance + data.coinReward);
        toast.success('Bravo ! Puzzle complété !', { duration: 6000 });
      } else if (!options?.silent && incorrect.size === 0) {
        if (soundEnabled) playPuzzleSound('correct');
        toast.success('Tout est correct pour le moment !');
      } else if (!options?.silent) {
        if (soundEnabled) playPuzzleSound('incorrect');
        toast.error(`${incorrect.size} lettre${incorrect.size > 1 ? 's' : ''} incorrecte${incorrect.size > 1 ? 's' : ''}`);
      }
    } catch {
      toast.error('Erreur lors de la vérification');
    } finally {
      setIsChecking(false);
    }
  }, [puzzleId, selectedPuzzle, userInputs, timer, isCompleted, isChecking, completedClues, soundEnabled]);

  // Check partial progress shortly after input so magic words trigger
  // without requiring the player to complete or manually check the grid.
  useEffect(() => {
    if (!puzzleId || !selectedPuzzle || isCompleted || isChecking) return;
    if (!userInputs.some((row) => row.some(Boolean))) return;
    const isFilled = selectedPuzzle.grid.every((row, rowIndex) =>
      row.every((cell, colIndex) => cell.isBlack || Boolean(userInputs[rowIndex]?.[colIndex])),
    );
    if (isFilled) return;

    const timeout = window.setTimeout(() => {
      void handleCheck({ silent: true });
    }, 350);
    return () => window.clearTimeout(timeout);
  }, [puzzleId, selectedPuzzle, userInputs, isCompleted, isChecking, handleCheck]);

  // Automatically verify once every white cell has an answer.
  useEffect(() => {
    if (!autoCheck || !puzzleId || !selectedPuzzle || isCompleted || isChecking) return;

    const isFilled = selectedPuzzle.grid.every((row, rowIndex) =>
      row.every((cell, colIndex) => cell.isBlack || Boolean(userInputs[rowIndex]?.[colIndex])),
    );

    if (!isFilled) return;
    const timeout = window.setTimeout(() => void handleCheck(), 0);
    return () => window.clearTimeout(timeout);
  }, [autoCheck, puzzleId, selectedPuzzle, userInputs, isCompleted, isChecking, handleCheck]);

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

  const handleRevealLetters = useCallback(async (count: 5 | 10) => {
    if (!puzzleId || !selectedPuzzle || isCompleted || isRevealingLetters) return;
    setIsRevealingLetters(true);
    try {
      const filledCells = userInputs.flatMap((row, rowIndex) =>
        row.flatMap((value, colIndex) => value ? [`${rowIndex},${colIndex}`] : []),
      );
      const res = await fetch('/api/puzzles/reveal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ puzzleId, count, filledCells }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || 'Révélation indisponible');
        return;
      }

      setUserInputs((previous) => {
        const next = previous.map((row) => [...row]);
        for (const cell of data.cells as { row: number; col: number; letter: string }[]) {
          next[cell.row][cell.col] = cell.letter;
        }
        return next;
      });
      setRevealedCells((previous) => {
        const next = new Set(previous);
        for (const cell of data.cells as { row: number; col: number }[]) {
          next.add(toCellKey(cell.row, cell.col));
        }
        return next;
      });
      setCoinBalance(data.balance);
      toast.success(`${data.cells.length} lettre${data.cells.length > 1 ? 's' : ''} révélée${data.cells.length > 1 ? 's' : ''} pour ${count} pièces`);
    } catch {
      toast.error('Erreur lors de la révélation');
    } finally {
      setIsRevealingLetters(false);
    }
  }, [puzzleId, selectedPuzzle, isCompleted, isRevealingLetters, userInputs]);

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
    setMagicRevealedCells(new Set());
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
    const wordCount = selectedPuzzle.clues.length;
    const hints = revealedCells.size;

    const text = [
      `🧩 Mots Croisés`,
      `${lang} ${selectedPuzzle.title}`,
      `${stars} Résolu en ${timeStr}`,
      `${wordCount} mots` + (hints > 0 ? ` • ${hints} indice${hints > 1 ? 's' : ''}` : ''),
      streak > 0 ? `🔥 Série: ${streak} jour${streak > 1 ? 's' : ''}` : '',
      ``,
      `Essaie aussi → mots-croisés.app`,
    ].filter(Boolean).join('\n');

    if (navigator.share) {
      try {
        await navigator.share({ title: 'Mots Croisés', text });
        return;
      } catch {}
    }

    await navigator.clipboard.writeText(text);
    toast.success('Résultat copié dans le presse-papiers !');
  }, [selectedPuzzle, timer, streak, revealedCells]);

  const handlePdfDownload = useCallback(async (withAnswers: boolean) => {
    if (!selectedPuzzle || !puzzleId || isDownloadingPdf) return;
    if (!session?.user) {
      setAuthOpen(true);
      return;
    }

    const cost = withAnswers ? 15 : 5;
    setIsDownloadingPdf(true);
    try {
      const res = await fetch(`/api/puzzles/${puzzleId}/pdf-access`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind: withAnswers ? 'answers' : 'puzzle' }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || `Il vous faut ${cost} pièces`);
        return;
      }

      if (typeof data.balance === 'number') setCoinBalance(data.balance);
      exportPuzzleToPdf(selectedPuzzle, { withAnswers });
      toast.success(withAnswers ? 'PDF avec réponses téléchargé !' : 'PDF téléchargé !');
    } catch {
      toast.error('Impossible de préparer le téléchargement');
    } finally {
      setIsDownloadingPdf(false);
    }
  }, [selectedPuzzle, puzzleId, isDownloadingPdf, session]);

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

  const renderPuzzleCard = (puzzle: PuzzleSummary) => (
    <div key={puzzle.id}>
      <Card className="group relative overflow-hidden border-foreground/10 bg-card/90 py-0 shadow-sm transition-all duration-200 hover:-translate-y-1 hover:border-primary/30 hover:shadow-xl hover:shadow-primary/10">
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
        <CardHeader className="gap-2 px-5 pt-5 pb-0">
          <div className="flex items-start justify-between gap-2">
            <CardTitle className="font-display text-xl leading-snug">{puzzle.title}</CardTitle>
            <div className="flex shrink-0 items-center gap-1">
              {puzzle.isPremium && (
                <Badge variant="outline" className="text-xs text-amber-700 dark:text-amber-300">
                  <Lock className="mr-1 size-3" /> {puzzle.unlockCost} <Coins className="ml-1 size-3" />
                </Badge>
              )}
              <Badge variant="outline" className="text-xs">
                {languageFlag(puzzle.language)} {languageName(puzzle.language)}
              </Badge>
            </div>
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
          {puzzle.isPremium && !puzzle.isUnlocked ? (
            <Button
              size="sm"
              className="bg-amber-600 text-white shadow-sm hover:bg-amber-700"
              onClick={() => void handleUnlockPuzzle(puzzle.id, puzzle.unlockCost ?? 0)}
              disabled={isUnlockingPuzzle === puzzle.id}
            >
              <Coins className="size-3.5" />
              {isUnlockingPuzzle === puzzle.id ? '...' : 'Déverrouiller'}
            </Button>
          ) : (
            <Button
              size="sm"
              className="bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm"
              onClick={() => void fetchPuzzle(puzzle.id, puzzle.completed)}
            >
              {puzzle.completed ? <CheckCircle2 className="size-3.5" /> : <Play className="size-3.5" />}
              {puzzle.completed ? 'Rejouer' : puzzle.timeSpent ? 'Continuer' : 'Jouer'}
            </Button>
          )}
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
  );

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
          <header className="border-b border-foreground/10 bg-background/80 backdrop-blur-md">
            <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-3 py-3 sm:px-5 lg:py-4">
              <div className="flex items-center gap-3 sm:gap-4">
                <img
                  src="/logo_WF.png"
                  alt="WordFusion logo"
                  className="h-16 w-16 object-contain sm:h-20 sm:w-20 lg:h-24 lg:w-24"
                />
                <span className="font-sans text-2xl font-bold tracking-[0.16em] text-[#123b66] sm:text-3xl lg:text-4xl dark:text-blue-200">
                  WORDFUSION
                </span>
              </div>
              <div className="flex items-center gap-1">
                {session?.user && (
                  <div className="flex items-center gap-1.5 rounded-full bg-amber-100 px-3 py-1.5 text-amber-700 shadow-sm dark:bg-amber-900/30 dark:text-amber-300" title="Votre solde de pièces">
                    <Coins className="size-4" />
                    <span className="text-sm font-bold">{coinBalance}</span>
                  </div>
                )}
                {streakData.length > 0 && (
                  <>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-xs text-muted-foreground hover:text-foreground gap-1.5"
                      onClick={() => setStatsOpen(true)}
                    >
                      <BarChart3 className="size-3.5" />
                      <span className="hidden sm:inline">Statistiques</span>
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-xs text-muted-foreground hover:text-foreground gap-1.5 relative"
                      onClick={() => setBadgesOpen(true)}
                    >
                      <Award className="size-3.5" />
                      <span className="hidden sm:inline">Badges</span>
                      {earnedBadgeIds.size > 0 && (
                        <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-amber-500 text-[9px] font-bold text-white px-1">
                          {earnedBadgeIds.size}
                        </span>
                      )}
                    </Button>
                  </>
                )}
                {/* ── Auth / User area ──────────────────────────── */}
                <div className="flex items-center gap-1.5">
                  {session?.user ? (
                    <>
                      {/* Role badge + User menu */}
                      <div className="flex items-center gap-2">
                        <div className="flex items-center gap-1.5 rounded-lg border bg-muted/30 px-2.5 py-1.5">
                          <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-primary">
                            <UserIcon className="size-3.5" />
                          </div>
                          <div className="hidden sm:flex flex-col leading-none">
                            <span className="text-xs font-medium max-w-[120px] truncate">{session.user.name}</span>
                            <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                              {isAdmin && <><Shield className="size-2.5 text-orange-500" />Administrateur</>}
                              {isCreator && !isAdmin && <><PenTool className="size-2.5 text-emerald-500" />Créateur</>}
                              {!isCreator && <><UserIcon className="size-2.5" />Joueur</>}
                            </span>
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-xs text-muted-foreground hover:text-destructive gap-1"
                          onClick={async () => {
                            await signOut({ redirect: false });
                            window.location.href = '/';
                          }}
                        >
                          <LogOut className="size-3.5" />
                          <span className="hidden sm:inline">Déconnexion</span>
                        </Button>
                      </div>
                      {(isAdmin || isCreator) && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-xs text-muted-foreground hover:text-foreground gap-1.5"
                          onClick={() => { window.location.href = '/admin'; }}
                        >
                          <Settings className="size-3.5" />
                          <span className="hidden sm:inline">{isAdmin ? 'Administration' : 'Créateur'}</span>
                        </Button>
                      )}
                    </>
                  ) : (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-xs text-muted-foreground hover:text-foreground gap-1.5"
                      onClick={() => setAuthOpen(true)}
                    >
                      <LogIn className="size-3.5" />
                      <span className="hidden sm:inline">Connexion</span>
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </header>

          {/* ── Main Content ───────────────────────────────────── */}
          <main className="flex-1 mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:py-10">
            {/* Date display */}
            <div className="mb-6">
              <p className="text-sm text-muted-foreground capitalize">
                📅 {formatFrenchDate()}
              </p>
              <h2
                className="font-display mt-2 text-xl font-semibold sm:text-2xl"
              >
                Mots Croisés
              </h2>
            </div>

            {/* ── Streak stats card ── */}
            {streakData.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                className="mb-6 rounded-lg border border-orange-200/70 bg-[oklch(0.97_0.035_55)] p-4 shadow-sm shadow-orange-900/5 sm:p-5 dark:border-orange-900/40 dark:bg-orange-950/20"
              >
                <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                  {/* Streak counter */}
                  <div className="flex items-center gap-3 shrink-0">
                    <div className="relative">
                      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-orange-400 to-red-500 text-white shadow-lg shadow-orange-500/20">
                        <span className="text-xl">🔥</span>
                      </div>
                      {streak > 0 && (
                        <motion.div
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          transition={{ type: 'spring', stiffness: 400, damping: 15 }}
                          className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-background border shadow-sm"
                        >
                          <span className="text-[10px] font-bold text-orange-600">{streak}</span>
                        </motion.div>
                      )}
                    </div>
                    <div>
                      <p className="text-sm font-semibold">
                        {streak > 0
                          ? streak === 1
                            ? 'Série de 1 jour !'
                            : `Série de ${streak} jours !`
                          : 'Reprenez votre série !'}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {streakData.length} puzzle{streakData.length !== 1 ? 's' : ''} résolu{streakData.length !== 1 ? 's' : ''} au total
                      </p>
                    </div>
                  </div>

                  {/* Heatmap */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-[10px] text-muted-foreground uppercase tracking-wide font-medium">30 derniers jours</span>
                      <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                        <span className="flex items-center gap-0.5"><div className="h-2.5 w-2.5 rounded-sm bg-muted" /><span className="hidden sm:inline">Rien</span></span>
                        <span className="flex items-center gap-0.5"><div className="h-2.5 w-2.5 rounded-sm bg-emerald-500" /><span className="hidden sm:inline">Résolu</span></span>
                      </div>
                    </div>
                    <StreakHeatmap streakData={streakData} />
                  </div>
                </div>
              </motion.div>
            )}

            {/* ── Filters (admin only) ──────────────────────────── */}
            {hasArchiveAccess && (
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

              {/* Today toggle */}
              <Button
                variant={todayOnly ? 'default' : 'outline'}
                size="sm"
                className={cn('h-9 gap-1.5 text-sm', todayOnly && 'bg-orange-600 hover:bg-orange-700')}
                onClick={() => setTodayOnly(!todayOnly)}
              >
                <CalendarDays className="size-3.5" />
                Aujourd'hui
              </Button>

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
            )}

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
                  {isAdmin && (selectedLanguage !== 'all' || selectedCategory !== 'all' || selectedPack !== 'all')
                    ? 'Essayez de modifier vos filtres pour trouver des puzzles.'
                    : isAdmin
                      ? 'Aucun puzzle publié pour le moment.'
                      : 'Revenez demain pour de nouveaux puzzles !'}
                </p>
              </div>
            )}

            {/* ── Daily challenges ── */}
            {!isLoadingPuzzles && dailyChallenges.length > 0 && (
              <section className="mb-10">
                <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold">
                  <CalendarDays className="size-5 text-orange-600" />
                  DAILY CHALLENGES
                </h2>
                <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                  {dailyChallenges.map((puzzle) => puzzle.completed ? (
                    <div key={puzzle.id} className="flex min-h-32 items-center justify-center rounded-lg border border-emerald-200 bg-emerald-50/70 dark:border-emerald-900/50 dark:bg-emerald-950/20">
                      <div className="flex flex-col items-center gap-2 text-emerald-700 dark:text-emerald-400">
                        <CheckCircle2 className="size-12" aria-label={`${puzzle.title} terminé`} />
                        <span className="text-sm font-medium">Défi terminé</span>
                      </div>
                    </div>
                  ) : renderPuzzleCard(puzzle))}
                </div>
              </section>
            )}

            {/* ── Expert puzzles ── */}
            {!isLoadingPuzzles && expertPuzzles.length > 0 && (
              <section className="mb-10">
                <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold">
                  <Lock className="size-5 text-amber-600" />
                  EXPERT PUZZLES
                </h2>
                <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                  {expertPuzzles.map(renderPuzzleCard)}
                </div>
              </section>
            )}

            {/* ── Personal archives ── */}
            {!isLoadingPuzzles && personalArchives.length > 0 && (
              <section className="mb-8">
                <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold">
                  <FolderOpen className="size-5 text-emerald-600" />
                  PERSONAL ARCHIVES
                </h2>
                <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                  {personalArchives.map(renderPuzzleCard)}
                </div>
              </section>
            )}

            {/* ── Collections section (admin only) ── */}
            {isAdmin && packs.length > 0 && (
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
            <div className="mx-auto max-w-4xl flex flex-col items-center gap-1.5 text-[11px] text-muted-foreground">
              <p className="font-medium">Mots Croisés &mdash; Un puzzle unique chaque jour</p>
              <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-0.5">
                <span>© {new Date().getFullYear()} <a href="https://deebodiong.quarto.pub" target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:text-foreground transition-colors">Georges BODIONG</a></span>
                <span className="hidden sm:inline">·</span>
                <a href="mailto:deebodiong@gmail.com" className="hover:text-foreground transition-colors">deebodiong@gmail.com</a>
                <span className="hidden sm:inline">·</span>
                <span className="hidden sm:inline">+226 74 91 15 38</span>
              </div>
            </div>
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
              {selectedPuzzle && (
                <div className="flex shrink-0 items-center gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="px-2 text-xs text-muted-foreground hover:text-foreground"
                    onClick={handleClear}
                    disabled={isCompleted}
                    title="Effacer la grille"
                    aria-label="Effacer la grille"
                  >
                    <Trash2 className="size-3.5 text-red-500" />
                    <span className="hidden sm:inline">Effacer</span>
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="px-2 text-xs text-muted-foreground hover:text-foreground"
                    onClick={() => void handlePdfDownload(false)}
                    disabled={isDownloadingPdf}
                    title="PDF : 5 pièces"
                    aria-label="Télécharger le PDF pour 5 pièces"
                  >
                    <Download className="size-3.5 text-emerald-600" />
                    <span className="hidden sm:inline">PDF · 5</span>
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="px-2 text-xs text-muted-foreground hover:text-foreground"
                    onClick={() => void handlePdfDownload(true)}
                    disabled={isDownloadingPdf}
                    title="PDF avec réponses : 15 pièces"
                    aria-label="Télécharger le PDF avec réponses pour 15 pièces"
                  >
                    <FileText className="size-3.5 text-amber-500" />
                    <span className="hidden sm:inline">Réponses · 15</span>
                  </Button>
                </div>
              )}
            </div>
          </header>

          {/* ── Main area ──────────────────────────────────────── */}
            <main className="mx-auto w-full max-w-6xl min-h-0 flex-1 px-3 py-4 pb-8 sm:px-4 sm:pb-6">
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
                <div className="flex w-full min-w-0 flex-col items-center gap-3 lg:w-auto lg:flex-1">
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
                  <div className="relative z-10 flex w-full min-w-0 shrink-0 flex-wrap items-center justify-center gap-2 rounded-md bg-background p-1">
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
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1.5"
                      onClick={() => {
                        setSoundEnabled((enabled) => {
                          const next = !enabled;
                          localStorage.setItem('crossword-sound-enabled', String(next));
                          return next;
                        });
                      }}
                      aria-label={soundEnabled ? 'Désactiver les sons' : 'Activer les sons'}
                      title={soundEnabled ? 'Désactiver les sons' : 'Activer les sons'}
                    >
                      {soundEnabled ? <Volume2 className="size-4" /> : <VolumeX className="size-4" />}
                      <span className="hidden sm:inline">Son</span>
                    </Button>
                    <Separator orientation="vertical" className="h-6 hidden sm:block" />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => void handleCheck()}
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
                      onClick={() => void handleRevealLetters(5)}
                      disabled={!session?.user || isCompleted || isRevealingLetters || coinBalance < 5}
                      title="Révéler 5 lettres pour 5 pièces"
                    >
                      <Coins className="size-4 text-amber-500" />
                      5 lettres
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => void handleRevealLetters(10)}
                      disabled={!session?.user || isCompleted || isRevealingLetters || coinBalance < 10}
                      title="Révéler 10 lettres pour 10 pièces"
                    >
                      <Coins className="size-4 text-amber-500" />
                      10 lettres
                    </Button>
                  </div>

                  {/* The crossword grid */}
                  <div className="relative z-0 w-full min-w-0 shrink-0 overflow-x-auto">
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
                      magicRevealedCells={magicRevealedCells}
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
                <div className="w-full lg:w-[340px] xl:w-[380px] lg:shrink-0 lg:min-h-0">
                  <div className="flex max-h-[calc(100vh-10rem)] flex-col overflow-hidden rounded-xl border bg-card shadow-sm lg:h-[calc(100vh-12rem)] lg:max-h-none">
                    <div className="border-b px-4 py-3">
                      <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                        Indications
                      </h3>
                    </div>
                    <div className="min-h-0 flex-1 overflow-hidden p-1.5">
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
          <footer className="mt-auto hidden border-t py-3 lg:block">
            <div className="mx-auto max-w-4xl flex flex-col items-center gap-1 text-[11px] text-muted-foreground">
              <p className="font-medium">Mots Croisés &mdash; Un puzzle unique chaque jour</p>
              <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-0.5">
                <span>© {new Date().getFullYear()} <a href="https://deebodiong.quarto.pub" target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:text-foreground transition-colors">Georges BODIONG</a></span>
                <span className="hidden sm:inline">·</span>
                <a href="mailto:deebodiong@gmail.com" className="hover:text-foreground transition-colors">deebodiong@gmail.com</a>
                <span className="hidden sm:inline">·</span>
                <span className="hidden sm:inline">+226 74 91 15 38</span>
              </div>
            </div>
          </footer>

          {/* ── Completion celebration ─────────────────────────── */}
          {isCompleted && (
            <>
              <ConfettiOverlay />
              <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 backdrop-blur-sm">
                <motion.div
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                  className="mx-4 rounded-2xl bg-card p-8 text-center shadow-2xl sm:p-12 max-w-md w-full"
                >
                  <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/40">
                    <Trophy className="size-8 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <h2
                    className="font-display text-2xl font-bold sm:text-3xl"
                  >
                    Félicitations !
                  </h2>
                  <p className="mt-2 text-muted-foreground">
                    Vous avez résolu « <span className="font-semibold text-foreground">{selectedPuzzle?.title}</span> » en{' '}
                    <span className="font-semibold text-foreground">{formatTimer(timer)}</span>.
                  </p>
                  <div className="mt-4 flex items-center justify-center gap-4 text-sm">
                    <div className="flex items-center gap-1.5">
                      <span>⭐</span>
                      <span className="text-muted-foreground">{selectedPuzzle?.clues.length} mots</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span>💡</span>
                      <span className="text-muted-foreground">{revealedCells.size} indices</span>
                    </div>
                    {streak > 0 && (
                      <div className="flex items-center gap-1.5">
                        <span>🔥</span>
                        <span className="text-muted-foreground">Série: {streak}</span>
                      </div>
                    )}
                  </div>
                  {lastCoinReward > 0 && (
                    <div className="mt-4 inline-flex items-center gap-2 rounded-full bg-amber-100 px-4 py-2 text-sm font-semibold text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
                      <Coins className="size-4" />
                      +{lastCoinReward} pièces
                    </div>
                  )}
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
                </motion.div>
              </div>
            </>
          )}
        </div>
      )}

      {/* ── Admin Panel Dialog ──────────────────────────────── */}

      {/* ── Stats Panel Dialog ────────────────────────────────── */}
      <StatsPanel open={statsOpen} onOpenChange={setStatsOpen} userId={session?.user?.id} />

      {/* ── Badge Panel Dialog ────────────────────────────────── */}
      <BadgePanel open={badgesOpen} onOpenChange={setBadgesOpen} userId={session?.user?.id} />

      {/* ── Badge Notification ────────────────────────────────── */}
      <BadgeNotification badge={newBadge} onDismiss={() => setNewBadge(null)} />

      {/* ── Auth Modal ────────────────────────────────────────── */}
      <AuthModal open={authOpen} onOpenChange={setAuthOpen} />
    </div>
  );
}
