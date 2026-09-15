"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";

import {
  Languages,
  FolderOpen,
  Package,
  Coins,
  Grid2X2,
  Grid3X3,
  LayoutGrid,
  Search,
  BookOpen,
  Lightbulb,
  Sparkles,
  Bookmark,
  BookmarkCheck,
  ChevronDown,
  ChevronUp,
  Pencil,
  Trash2,
  Save,
  X,
} from "lucide-react";

import type {
  CrosswordCell,
  CrosswordPuzzleData,
  WordPlacement,
  Clue,
} from "@/lib/crossword/types";

// ── Props ─────────────────────────────────────────────────────────────

interface PuzzleEditorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editPuzzleId?: string | null;
  onSaved?: () => void;
}

// ── Types ─────────────────────────────────────────────────────────────

interface EditorClue extends Clue {
  word: string;
  row: number;
  col: number;
}

interface CategoryOption {
  id: string;
  name: string;
  slug: string;
  language: string;
  icon?: string;
}

interface PackOption {
  id: string;
  name: string;
  icon: string;
  language: string;
}

interface WordAssistantResult {
  term: string;
  definitions: { partOfSpeech?: string; definition: string; example?: string }[];
  synonyms: string[];
  acronym: { title: string; extract: string } | null;
  source: string;
  glossaryEntryId?: string;
  savedClue?: string | null;
}

interface GlossaryEntry {
  id: string;
  term: string;
  language: string;
  definition: string;
  example: string | null;
  clue: string | null;
}

const noneCategory = "__none__";
const nonePack = "__none__";

const gridSizePresets = [
  { id: '5x5', label: '5×5', icon: Grid2X2 },
  { id: '8x8', label: '8×8', icon: Grid2X2 },
  { id: '10x10', label: '10×10', icon: Grid3X3 },
  { id: '13x13', label: '13×13', icon: Grid3X3 },
  { id: '15x15', label: '15×15', icon: LayoutGrid },
  { id: '20x20', label: '20×20', icon: LayoutGrid },
];

// ── Helpers ───────────────────────────────────────────────────────────

/** Create an empty grid of all-black cells */
function createEmptyGrid(rows: number, cols: number): CrosswordCell[][] {
  const grid: CrosswordCell[][] = [];
  for (let r = 0; r < rows; r++) {
    grid[r] = [];
    for (let c = 0; c < cols; c++) {
      grid[r][c] = { letter: "", number: null, isBlack: true, row: r, col: c };
    }
  }
  return grid;
}

/** Deep-clone a grid */
function cloneGrid(grid: CrosswordCell[][]): CrosswordCell[][] {
  return grid.map((row) => row.map((cell) => ({ ...cell })));
}

/** Detect all words (2+ consecutive non-black cells with at least one letter) and assign numbers */
function detectWordsAndNumbers(
  grid: CrosswordCell[][]
): { words: WordPlacement[]; clues: EditorClue[] } {
  const rows = grid.length;
  const cols = grid[0]?.length ?? 0;

  // First pass: assign numbers
  let clueNum = 1;
  const numberMap = new Map<string, number>();

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (grid[r][c].isBlack) continue;
      const key = `${r},${c}`;
      if (numberMap.has(key)) continue;

      const startsAcross =
        (c === 0 || grid[r][c - 1].isBlack) &&
        c + 1 < cols &&
        !grid[r][c + 1].isBlack;
      const startsDown =
        (r === 0 || grid[r - 1][c].isBlack) &&
        r + 1 < rows &&
        !grid[r + 1][c].isBlack;

      if (startsAcross || startsDown) {
        numberMap.set(key, clueNum);
        clueNum++;
      }
    }
  }

  // Build number grid for quick lookup
  const numGrid: (number | null)[][] = [];
  for (let r = 0; r < rows; r++) {
    numGrid[r] = [];
    for (let c = 0; c < cols; c++) {
      numGrid[r][c] = grid[r][c].isBlack ? null : (numberMap.get(`${r},${c}`) ?? null);
    }
  }

  const words: WordPlacement[] = [];
  const clues: EditorClue[] = [];

  // Detect across words
  for (let r = 0; r < rows; r++) {
    let c = 0;
    while (c < cols) {
      if (grid[r][c].isBlack) {
        c++;
        continue;
      }
      // Start of a horizontal run
      const startC = c;
      let wordStr = "";
      while (c < cols && !grid[r][c].isBlack) {
        wordStr += grid[r][c].letter;
        c++;
      }
      if (wordStr.length >= 2) {
        const num = numGrid[r][startC];
        if (num !== null) {
          words.push({
            word: wordStr,
            clueNumber: num,
            direction: "across",
            row: r,
            col: startC,
            length: wordStr.length,
          });
          clues.push({
            number: num,
            direction: "across",
            text: "",
            word: wordStr,
            row: r,
            col: startC,
          });
        }
      }
    }
  }

  // Detect down words
  for (let c = 0; c < cols; c++) {
    let r = 0;
    while (r < rows) {
      if (grid[r][c].isBlack) {
        r++;
        continue;
      }
      const startR = r;
      let wordStr = "";
      while (r < rows && !grid[r][c].isBlack) {
        wordStr += grid[r][c].letter;
        r++;
      }
      if (wordStr.length >= 2) {
        const num = numGrid[startR][c];
        if (num !== null) {
          words.push({
            word: wordStr,
            clueNumber: num,
            direction: "down",
            row: startR,
            col: c,
            length: wordStr.length,
          });
          clues.push({
            number: num,
            direction: "down",
            text: "",
            word: wordStr,
            row: startR,
            col: c,
          });
        }
      }
    }
  }

  return { words, clues };
}

/** Update grid numbers from numberMap */
function applyNumbersToGrid(
  grid: CrosswordCell[][],
  words: WordPlacement[]
): CrosswordCell[][] {
  const newGrid = cloneGrid(grid);
  // Clear all numbers
  for (let r = 0; r < newGrid.length; r++) {
    for (let c = 0; c < newGrid[0].length; c++) {
      newGrid[r][c].number = null;
    }
  }
  // Set numbers from word placements
  for (const w of words) {
    if (newGrid[w.row]?.[w.col]) {
      newGrid[w.row][w.col].number = w.clueNumber;
    }
  }
  return newGrid;
}

// ── Component ──────────────────────────────────────────────────────────

export default function PuzzleEditor({
  open,
  onOpenChange,
  editPuzzleId,
  onSaved,
}: PuzzleEditorProps) {
  // ── State ────────────────────────────────────────────────────────
  const [description, setDescription] = useState("");
  const [difficulty, setDifficulty] = useState<string>("2");
  const [language, setLanguage] = useState<string>("fr");
  const [categoryId, setCategoryId] = useState<string>(noneCategory);
  const [packId, setPackId] = useState<string>(nonePack);
  const [isPremium, setIsPremium] = useState(false);
  const [unlockCost, setUnlockCost] = useState("25");
  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const [packs, setPacks] = useState<PackOption[]>([]);
  const [rowsInput, setRowsInput] = useState(10);
  const [colsInput, setColsInput] = useState(10);
  const [grid, setGrid] = useState<CrosswordCell[][]>(createEmptyGrid(10, 10));
  const [selectedCell, setSelectedCell] = useState<{ row: number; col: number } | null>(null);
  const [words, setWords] = useState<WordPlacement[]>([]);
  const [clues, setClues] = useState<EditorClue[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [autosaveStatus, setAutosaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [activeClueTab, setActiveClueTab] = useState<string>("across");
  const [assistantTerm, setAssistantTerm] = useState("");
  const [assistantResult, setAssistantResult] = useState<WordAssistantResult | null>(null);
  const [assistantLoading, setAssistantLoading] = useState(false);
  const [assistantError, setAssistantError] = useState<string | null>(null);
  const [assistantClue, setAssistantClue] = useState<Pick<EditorClue, "number" | "direction"> | null>(null);
  const [assistantOpen, setAssistantOpen] = useState(false);
  const [clueSuggestion, setClueSuggestion] = useState<{ index: number; text: string } | null>(null);
  const [clueSuggestionLoading, setClueSuggestionLoading] = useState<number | null>(null);
  const [glossarySaving, setGlossarySaving] = useState(false);
  const [glossaryOpen, setGlossaryOpen] = useState(false);
  const [glossaryEntries, setGlossaryEntries] = useState<GlossaryEntry[]>([]);
  const [glossarySearch, setGlossarySearch] = useState("");
  const [glossaryLanguage, setGlossaryLanguage] = useState("all");
  const [editingGlossaryId, setEditingGlossaryId] = useState<string | null>(null);
  const [editingGlossary, setEditingGlossary] = useState({ definition: "", example: "", clue: "" });
  const autosaveReady = useRef(false);

  const gridRef = useRef<HTMLDivElement>(null);
  const isEditing = !!editPuzzleId;

  // ── Load categories & packs ─────────────────────────────────────
  useEffect(() => {
    if (!open) return;
    fetch('/api/categories')
      .then((res) => res.json())
      .then((data) => {
        setCategories(data.categories ?? []);
      })
      .catch(() => {});
    fetch('/api/packs')
      .then((res) => res.json())
      .then((data) => {
        setPacks(data.packs ?? []);
      })
      .catch(() => {});
  }, [open]);

  const loadGlossary = useCallback(async () => {
    try {
      const response = await fetch("/api/word-assistant/glossary");
      if (!response.ok) return;
      const data = await response.json();
      setGlossaryEntries(data.entries ?? []);
    } catch {
      // The assistant remains usable if the glossary request fails.
    }
  }, []);

  useEffect(() => {
    if (open) void loadGlossary();
  }, [open, loadGlossary]);

  // ── Derived: number grid for display ─────────────────────────────
  const numberGrid = useMemo(() => {
    const ng: (number | null)[][] = [];
    for (let r = 0; r < grid.length; r++) {
      ng[r] = [];
      for (let c = 0; c < (grid[0]?.length ?? 0); c++) {
        ng[r][c] = grid[r][c].number;
      }
    }
    return ng;
  }, [grid]);

  const acrossClues = useMemo(
    () => clues.filter((c) => c.direction === "across").sort((a, b) => a.number - b.number),
    [clues]
  );
  const downClues = useMemo(
    () => clues.filter((c) => c.direction === "down").sort((a, b) => a.number - b.number),
    [clues]
  );

  // ── Recompute words/clues from grid ──────────────────────────────
  const recomputeWords = useCallback(
    (g: CrosswordCell[][], preserveClueTexts: boolean = true) => {
      const { words: newWords, clues: newClues } = detectWordsAndNumbers(g);
      setWords(newWords);
      if (preserveClueTexts) {
        // Merge existing clue texts into new clues
        const clueMap = new Map<string, string>();
        for (const c of clues) {
          clueMap.set(`${c.number}-${c.direction}`, c.text);
        }
        const merged = newClues.map((nc) => ({
          ...nc,
          text: clueMap.get(`${nc.number}-${nc.direction}`) ?? "",
        }));
        setClues(merged);
      } else {
        setClues(newClues);
      }
      // Update grid numbers
      const updatedGrid = applyNumbersToGrid(g, newWords);
      setGrid(updatedGrid);
    },
    [clues]
  );

  // ── Load puzzle for editing ──────────────────────────────────────
  useEffect(() => {
    if (!open) return;
    if (!editPuzzleId) {
      // New puzzle: reset everything
      autosaveReady.current = false;
      setAutosaveStatus('idle');
      setDescription("");
      setDifficulty("2");
      setLanguage("fr");
      setCategoryId(noneCategory);
      setPackId(nonePack);
      setIsPremium(false);
      setUnlockCost("25");
      setRowsInput(10);
      setColsInput(10);
      const emptyGrid = createEmptyGrid(10, 10);
      setGrid(emptyGrid);
      setSelectedCell(null);
      setWords([]);
      setClues([]);
      setLoading(false);
      return;
    }

    // Fetch puzzle data
    let cancelled = false;
    setLoading(true);
    fetch(`/api/puzzles/${editPuzzleId}`)
      .then((res) => {
        if (!res.ok) throw new Error("Erreur de chargement");
        return res.json();
      })
      .then((data) => {
        if (cancelled) return;
        const p: CrosswordPuzzleData = data.puzzle;
        setDescription(p.description ?? "");
        setDifficulty(String(p.difficulty));
        // Load language and category from puzzle metadata
        if (data.language) setLanguage(data.language);
        if (data.categoryId) setCategoryId(data.categoryId);
        else setCategoryId(noneCategory);
        if (data.packId) setPackId(data.packId);
        else setPackId(nonePack);
        setIsPremium(data.isPremium === true);
        setUnlockCost(String(data.unlockCost || 25));
        setRowsInput(p.rows);
        setColsInput(p.cols);
        setGrid(cloneGrid(p.grid));
        setSelectedCell(null);
        // Build words and clues from loaded data
        const editorClues: EditorClue[] = p.clues.map((cl) => {
          const w = p.words.find(
            (pw) => pw.clueNumber === cl.number && pw.direction === cl.direction
          );
          return {
            ...cl,
            word: w?.word ?? "",
            row: w?.row ?? 0,
            col: w?.col ?? 0,
          };
        });
        setWords(p.words);
        setClues(editorClues);
        setLoading(false);
        autosaveReady.current = true;
        setAutosaveStatus('saved');
      })
      .catch((err) => {
        if (cancelled) return;
        console.error(err);
        toast.error("Erreur lors du chargement du puzzle");
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open, editPuzzleId]);

  // ── Grid cell click ──────────────────────────────────────────────
  const handleCellClick = useCallback(
    (r: number, c: number) => {
      const cell = grid[r]?.[c];
      if (!cell) return;

      // If clicking the SAME selected cell again, toggle black/white
      if (
        selectedCell &&
        selectedCell.row === r &&
        selectedCell.col === c
      ) {
        if (!cell.isBlack && cell.letter === "") {
          // White empty cell → toggle to black
          const newGrid = cloneGrid(grid);
          newGrid[r][c] = { ...newGrid[r][c], isBlack: true, letter: "" };
          recomputeWords(newGrid);
          setSelectedCell(null);
          return;
        }
        if (cell.isBlack) {
          // Black cell → toggle to white
          const newGrid = cloneGrid(grid);
          newGrid[r][c] = { ...newGrid[r][c], isBlack: false, letter: "" };
          recomputeWords(newGrid);
          // Keep it selected so user can start typing
          return;
        }
        // Has a letter — just keep selected
        return;
      }

      // Clicking an unselected BLACK cell → toggle to white and select (draw mode)
      if (cell.isBlack) {
        const newGrid = cloneGrid(grid);
        newGrid[r][c] = { ...newGrid[r][c], isBlack: false, letter: "" };
        recomputeWords(newGrid);
        setSelectedCell({ row: r, col: c });
        return;
      }

      // Otherwise just select the cell
      setSelectedCell({ row: r, col: c });
    },
    [grid, selectedCell, recomputeWords]
  );

  // ── Keyboard handler ─────────────────────────────────────────────
  useEffect(() => {
    if (!selectedCell) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const { row, col } = selectedCell;
      const maxRow = grid.length - 1;
      const maxCol = (grid[0]?.length ?? 1) - 1;

      // Prevent default for keys we handle
      if (
        e.key.startsWith("Arrow") ||
        e.key === "Backspace" ||
        e.key === "Delete" ||
        (/^[a-zA-ZéèêëàâùûîïôçÉÈÊËÀÂÙÛÎÏÔÇ]$/.test(e.key))
      ) {
        e.preventDefault();
      }

      if (e.key === "ArrowUp") {
        setSelectedCell((prev) =>
          prev && prev.row > 0 ? { row: prev.row - 1, col: prev.col } : prev
        );
      } else if (e.key === "ArrowDown") {
        setSelectedCell((prev) =>
          prev && prev.row < maxRow ? { row: prev.row + 1, col: prev.col } : prev
        );
      } else if (e.key === "ArrowLeft") {
        setSelectedCell((prev) =>
          prev && prev.col > 0 ? { row: prev.row, col: prev.col - 1 } : prev
        );
      } else if (e.key === "ArrowRight") {
        setSelectedCell((prev) =>
          prev && prev.col < maxCol ? { row: prev.row, col: prev.col + 1 } : prev
        );
      } else if (e.key === "Backspace" || e.key === "Delete") {
        const cell = grid[row]?.[col];
        if (cell && !cell.isBlack && cell.letter !== "") {
          const newGrid = cloneGrid(grid);
          newGrid[row][col] = { ...newGrid[row][col], letter: "" };
          recomputeWords(newGrid);
        } else if (e.key === "Backspace") {
          // Move back
          if (col > 0) {
            setSelectedCell({ row, col: col - 1 });
          } else if (row > 0) {
            setSelectedCell({ row: row - 1, col: maxCol });
          }
        }
      } else if (/^[a-zA-Z]$/.test(e.key)) {
        const cell = grid[row]?.[col];
        if (cell && !cell.isBlack) {
          const newGrid = cloneGrid(grid);
          newGrid[row][col] = {
            ...newGrid[row][col],
            letter: e.key.toUpperCase(),
          };
          recomputeWords(newGrid);
          // Auto-advance
          if (col < maxCol && !newGrid[row][col + 1].isBlack) {
            setSelectedCell({ row, col: col + 1 });
          } else if (row < maxRow) {
            // Try to move to next row
            setSelectedCell({ row: row + 1, col: 0 });
          }
        }
      } else if (e.key === "Escape") {
        setSelectedCell(null);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedCell, grid, recomputeWords]);

  // ── Resize grid ──────────────────────────────────────────────────
  const applyGridSize = useCallback((rows: number, cols: number) => {
    const r = Math.max(2, Math.min(20, rows));
    const c = Math.max(2, Math.min(20, cols));
    const newGrid = createEmptyGrid(r, c);
    // Preserve existing data
    for (let row = 0; row < Math.min(r, grid.length); row++) {
      for (let col = 0; col < Math.min(c, (grid[0]?.length ?? 0)); col++) {
        newGrid[row][col] = { ...grid[row][col], row, col };
      }
    }
    setRowsInput(r);
    setColsInput(c);
    setGrid(newGrid);
    setSelectedCell(null);
    recomputeWords(newGrid);
  }, [grid, recomputeWords]);

  const handleResizeGrid = useCallback(() => {
    applyGridSize(rowsInput, colsInput);
  }, [rowsInput, colsInput, applyGridSize]);

  const handlePresetGridSize = useCallback((presetId: string) => {
    const [rows, cols] = presetId.split('x').map(Number);
    applyGridSize(rows, cols);
  }, [applyGridSize]);

  // ── Clear all ────────────────────────────────────────────────────
  const handleClearAll = useCallback(() => {
    const newGrid = createEmptyGrid(grid.length, grid[0]?.length ?? 0);
    setGrid(newGrid);
    setSelectedCell(null);
    setWords([]);
    setClues([]);
  }, [grid]);

  // ── Clear letters only ───────────────────────────────────────────
  const handleClearLetters = useCallback(() => {
    const newGrid = cloneGrid(grid);
    for (let r = 0; r < newGrid.length; r++) {
      for (let c = 0; c < newGrid[0].length; c++) {
        newGrid[r][c].letter = "";
      }
    }
    setGrid(newGrid);
    recomputeWords(newGrid);
  }, [grid, recomputeWords]);

  // ── Update clue text ─────────────────────────────────────────────
  const handleClueTextChange = useCallback(
    (number: number, direction: "across" | "down", text: string) => {
      setClues((prev) =>
        prev.map((c) =>
          c.number === number && c.direction === direction ? { ...c, text } : c
        )
      );
    },
    []
  );

  const lookupWord = useCallback(async (term: string, clue?: EditorClue) => {
    const normalizedTerm = term.trim();
    if (!normalizedTerm) return;

    setAssistantTerm(normalizedTerm);
    setAssistantClue(clue ? { number: clue.number, direction: clue.direction } : null);
    setAssistantOpen(true);
    setAssistantLoading(true);
    setAssistantError(null);
    setAssistantResult(null);

    try {
      const response = await fetch(
        `/api/word-assistant?term=${encodeURIComponent(normalizedTerm)}&language=${language}`
      );
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Recherche impossible");
      setAssistantResult(data);
    } catch (error) {
      setAssistantError(error instanceof Error ? error.message : "Recherche impossible");
    } finally {
      setAssistantLoading(false);
    }
  }, [language]);

  const insertAssistantDefinition = useCallback((definition: string) => {
    if (!assistantClue) return;
    handleClueTextChange(assistantClue.number, assistantClue.direction, definition);
  }, [assistantClue, handleClueTextChange]);

  const suggestClue = useCallback(async (definition: string, index: number) => {
    if (!assistantResult) return;
    setClueSuggestionLoading(index);
    try {
      const response = await fetch("/api/word-assistant/clue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          term: assistantResult.term,
          definition,
          language,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Indice indisponible");
      setClueSuggestion({ index, text: data.clue });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Indice indisponible");
    } finally {
      setClueSuggestionLoading(null);
    }
  }, [assistantResult, language]);

  const saveToGlossary = useCallback(async (definition: string, example?: string) => {
    if (!assistantResult) return;
    setGlossarySaving(true);
    try {
      const response = await fetch("/api/word-assistant/glossary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          term: assistantResult.term,
          language,
          definition,
          example,
          clue: assistantClue ? clues.find(
            (clue) => clue.number === assistantClue.number && clue.direction === assistantClue.direction
          )?.text : undefined,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Glossaire indisponible");
      setAssistantResult((previous) => previous ? {
        ...previous,
        glossaryEntryId: data.entry.id,
        savedClue: data.entry.clue,
      } : previous);
      await loadGlossary();
      toast.success("Ajouté au glossaire personnel");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Glossaire indisponible");
    } finally {
      setGlossarySaving(false);
    }
  }, [assistantClue, assistantResult, clues, language, loadGlossary]);

  const filteredGlossaryEntries = useMemo(() => {
    const search = glossarySearch.trim().toLowerCase();
    return glossaryEntries.filter((entry) => {
      const matchesLanguage = glossaryLanguage === "all" || entry.language === glossaryLanguage;
      const matchesSearch = !search || [entry.term, entry.definition, entry.clue ?? ""]
        .some((value) => value.toLowerCase().includes(search));
      return matchesLanguage && matchesSearch;
    });
  }, [glossaryEntries, glossaryLanguage, glossarySearch]);

  const startGlossaryEdit = useCallback((entry: GlossaryEntry) => {
    setEditingGlossaryId(entry.id);
    setEditingGlossary({
      definition: entry.definition,
      example: entry.example ?? "",
      clue: entry.clue ?? "",
    });
  }, []);

  const cancelGlossaryEdit = useCallback(() => {
    setEditingGlossaryId(null);
    setEditingGlossary({ definition: "", example: "", clue: "" });
  }, []);

  const updateGlossaryEntry = useCallback(async (entry: GlossaryEntry) => {
    if (!editingGlossary.definition.trim()) return;
    setGlossarySaving(true);
    try {
      const response = await fetch("/api/word-assistant/glossary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          term: entry.term,
          language: entry.language,
          definition: editingGlossary.definition,
          example: editingGlossary.example,
          clue: editingGlossary.clue,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Impossible de modifier l'entrée");
      setGlossaryEntries((previous) => previous.map((item) => item.id === entry.id ? data.entry : item));
      cancelGlossaryEdit();
      toast.success("Entrée mise à jour");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Impossible de modifier l'entrée");
    } finally {
      setGlossarySaving(false);
    }
  }, [cancelGlossaryEdit, editingGlossary,]);

  const deleteGlossaryEntry = useCallback(async (entry: GlossaryEntry) => {
    if (!window.confirm(`Supprimer « ${entry.term} » du glossaire ?`)) return;
    try {
      const response = await fetch("/api/word-assistant/glossary", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: entry.id }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Impossible de supprimer l'entrée");
      setGlossaryEntries((previous) => previous.filter((item) => item.id !== entry.id));
      if (editingGlossaryId === entry.id) cancelGlossaryEdit();
      if (assistantResult?.glossaryEntryId === entry.id) {
        setAssistantResult((previous) => previous ? { ...previous, glossaryEntryId: undefined } : previous);
      }
      toast.success("Entrée supprimée");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Impossible de supprimer l'entrée");
    }
  }, [assistantResult, cancelGlossaryEdit, editingGlossaryId]);

  // ── Update word text → update grid cells ─────────────────────────
  const handleWordChange = useCallback(
    (
      number: number,
      direction: "across" | "down",
      newWord: string,
      row: number,
      col: number
    ) => {
      const newGrid = cloneGrid(grid);
      const oldWord = words.find(
        (w) => w.clueNumber === number && w.direction === direction
      );
      const oldLen = oldWord?.length ?? newWord.length;

      // Update grid cells
      for (let i = 0; i < Math.max(oldLen, newWord.length); i++) {
        const r = direction === "across" ? row : row + i;
        const c = direction === "across" ? col + i : col;
        if (r < newGrid.length && c < (newGrid[0]?.length ?? 0)) {
          if (i < newWord.length) {
            newGrid[r][c] = {
              ...newGrid[r][c],
              letter: newWord[i].toUpperCase(),
              isBlack: false,
            };
          } else if (i >= newWord.length && i < oldLen) {
            // Clear extra letters but keep cell white
            newGrid[r][c] = { ...newGrid[r][c], letter: "" };
          }
        }
      }

      setGrid(newGrid);
      recomputeWords(newGrid);
    },
    [grid, words, recomputeWords]
  );

  // ── Save ─────────────────────────────────────────────────────────
  const savePuzzle = useCallback(async (options?: { closeAfterSave?: boolean; silent?: boolean }) => {
    const finalClues: Clue[] = clues.map(({ number, direction, text }) => ({
      number,
      direction,
      text,
    }));

    setSaving(true);
    if (isEditing) setAutosaveStatus('saving');
    try {
      const body = {
        description: description.trim() || undefined,
        difficulty: Number(difficulty),
        language,
        categoryId: categoryId === noneCategory ? null : categoryId,
        packId: packId === nonePack ? null : packId,
        isPremium,
        unlockCost: isPremium ? Number(unlockCost) : 0,
        rows: grid.length,
        cols: grid[0]?.length ?? 0,
        grid,
        words,
        clues: finalClues,
      };

      const url = isEditing ? "/api/puzzles/admin" : "/api/puzzles/admin";
      const method = isEditing ? "PUT" : "POST";
      const payload = isEditing ? { ...body, id: editPuzzleId } : body;

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Erreur lors de la sauvegarde");
      }

      if (!options?.silent) {
        toast.success(isEditing ? "Puzzle mis à jour avec succès" : "Puzzle créé avec succès");
      }
      if (isEditing) setAutosaveStatus('saved');

      onSaved?.();

      if (isEditing && options?.closeAfterSave) {
        onOpenChange(false);
      } else if (!isEditing) {
        // Reset for new puzzle
        setDescription("");
        setDifficulty("2");
        setLanguage("fr");
        setCategoryId(noneCategory);
        setPackId(nonePack);
        setIsPremium(false);
        setUnlockCost("25");
        setRowsInput(10);
        setColsInput(10);
        setGrid(createEmptyGrid(10, 10));
        setSelectedCell(null);
        setWords([]);
        setClues([]);
      }
    } catch (err) {
      if (isEditing) setAutosaveStatus('error');
      if (!options?.silent) toast.error(err instanceof Error ? err.message : "Erreur inconnue");
    } finally {
      setSaving(false);
    }
  }, [description, difficulty, language, categoryId, packId, isPremium, unlockCost, grid, words, clues, isEditing, editPuzzleId, onSaved, onOpenChange]);

  const handleSave = useCallback(() => {
    void savePuzzle();
  }, [savePuzzle]);

  useEffect(() => {
    if (!open || !isEditing || loading || !autosaveReady.current) return;

    const timeout = window.setTimeout(() => {
      void savePuzzle({ silent: true });
    }, 900);

    return () => window.clearTimeout(timeout);
  }, [open, isEditing, loading, description, difficulty, language, categoryId, packId, isPremium, unlockCost, grid, words, clues, savePuzzle]);

  // ── Render helpers ───────────────────────────────────────────────
  const cellSize = "w-9 h-9 sm:w-10 sm:h-10 text-base sm:text-lg";

  const renderGrid = () => {
    if (loading) {
      return (
        <div className="flex flex-col items-center gap-1">
          {Array.from({ length: Math.min(rowsInput, 8) }).map((_, r) => (
            <div key={r} className="flex gap-1">
              {Array.from({ length: Math.min(colsInput, 8) }).map((_, c) => (
                <Skeleton key={c} className="w-9 h-9 sm:w-10 sm:h-10 rounded-sm" />
              ))}
            </div>
          ))}
        </div>
      );
    }

    return (
      <div
        ref={gridRef}
        className="inline-grid gap-px bg-border rounded-md overflow-hidden"
        style={{
          gridTemplateColumns: `repeat(${grid[0]?.length ?? 0}, minmax(0, 1fr))`,
        }}
        tabIndex={0}
        onClick={() => gridRef.current?.focus()}
      >
        {grid.map((row, r) =>
          row.map((cell, c) => {
            const isSelected =
              selectedCell?.row === r && selectedCell?.col === c;
            return (
              <div
                key={`${r}-${c}`}
                className={[
                  cellSize,
                  "relative flex items-center justify-center select-none cursor-pointer transition-colors",
                  cell.isBlack
                    ? "bg-black/90 hover:bg-black/80"
                    : "bg-white hover:bg-gray-50",
                  isSelected && !cell.isBlack && "ring-2 ring-blue-500 ring-inset z-10",
                  isSelected && cell.isBlack && "ring-2 ring-blue-500 ring-inset z-10",
                ].join(" ")}
                onClick={() => handleCellClick(r, c)}
                onMouseEnter={() => {
                  // Hover preview for future drag-to-paint
                }}
              >
                {cell.number !== null && (
                  <span className="absolute top-0 left-0.5 text-[9px] sm:text-[10px] font-bold text-gray-500 leading-none">
                    {cell.number}
                  </span>
                )}
                {cell.letter && (
                  <span className="font-bold text-black">{cell.letter}</span>
                )}
              </div>
            );
          })
        )}
      </div>
    );
  };

  const renderClueList = (
    direction: "across" | "down",
    list: EditorClue[]
  ) => {
    if (list.length === 0) {
      return (
        <p className="text-sm text-muted-foreground italic py-4">
          Aucun mot détecté. Entrez des lettres sur la grille pour former des mots de 2+ lettres.
        </p>
      );
    }
    return (
      <div className="space-y-3">
        {list.map((clue) => (
          <div
            key={`${clue.number}-${clue.direction}`}
            className="space-y-1.5 p-3 rounded-lg border bg-card"
            onClick={() => {
              setAssistantTerm(clue.word);
              setAssistantClue({ number: clue.number, direction: clue.direction });
            }}
          >
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="shrink-0 text-xs">
                {clue.number}
              </Badge>
              <span className="text-xs text-muted-foreground">
                ({clue.row + 1},{clue.col + 1})
              </span>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Mot</Label>
              <Input
                value={clue.word}
                onChange={(e) =>
                  handleWordChange(
                    clue.number,
                    clue.direction,
                    e.target.value,
                    clue.row,
                    clue.col
                  )
                }
                placeholder="Entrez le mot"
                className="h-8 text-sm font-mono uppercase"
                maxLength={20}
              />
            </div>
            <div className="space-y-1">
              <div className="flex items-center justify-between gap-2">
                <Label className="text-xs text-muted-foreground">Indice</Label>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-6 px-1.5 text-[11px]"
                  disabled={!clue.word.trim()}
                  onClick={() => void lookupWord(clue.word, clue)}
                  title="Chercher la définition"
                >
                  <Search className="size-3" />
                  Chercher
                </Button>
              </div>
              <Textarea
                value={clue.text}
                onChange={(e) =>
                  handleClueTextChange(clue.number, clue.direction, e.target.value)
                }
                placeholder="Entrez l'indice"
                className="text-sm min-h-[60px] resize-y"
                rows={2}
              />
            </div>
          </div>
        ))}
      </div>
    );
  };

  // ── Main render ──────────────────────────────────────────────────
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="
          max-w-[calc(100vw-1rem)] sm:max-w-[calc(100vw-2rem)] md:max-w-[95vw] lg:max-w-[90vw]
          h-[calc(100vh-1rem)] sm:h-[calc(100vh-2rem)]
          flex flex-col p-0 gap-0 overflow-hidden
        "
        showCloseButton
      >
        <DialogHeader className="px-4 pt-4 pb-2 shrink-0">
          <DialogTitle>
            {isEditing ? "Modifier le puzzle" : "Nouveau puzzle"}
          </DialogTitle>
          <DialogDescription>
            {isEditing
              ? "Modifiez la grille, les mots et les indices du puzzle."
              : "Le numéro du puzzle sera attribué automatiquement à la sauvegarde."}
          </DialogDescription>
        </DialogHeader>

        {/* ── Puzzle settings ─────────────────────────────────────── */}
        <div className="px-4 pb-2 shrink-0 space-y-2">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-2">
            <div className="space-y-1">
              <Label htmlFor="puzzle-desc" className="text-xs">
                Description
              </Label>
              <Input
                id="puzzle-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Description optionnelle"
                className="h-8 text-sm"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Langue</Label>
              <Select value={language} onValueChange={setLanguage}>
                <SelectTrigger className="h-8 text-sm w-full">
                  <Languages className="size-3 mr-1" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="fr">🇫🇷 Français</SelectItem>
                  <SelectItem value="en">🇬🇧 English</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Catégorie</Label>
              <Select value={categoryId} onValueChange={setCategoryId}>
                <SelectTrigger className="h-8 text-sm w-full">
                  <FolderOpen className="size-3 mr-1" />
                  <SelectValue placeholder="Sans catégorie" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={noneCategory}>Sans catégorie</SelectItem>
                  {categories.map((cat) => (
                    <SelectItem key={cat.id} value={cat.id}>
                      {cat.icon || "🏷️"} {cat.language === "en" ? "🇬🇧" : "🇫🇷"} {cat.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Collection</Label>
              <Select value={packId} onValueChange={setPackId}>
                <SelectTrigger className="h-8 text-sm w-full">
                  <Package className="size-3 mr-1" />
                  <SelectValue placeholder="Sans collection" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={nonePack}>Sans collection</SelectItem>
                  {packs.map((pack) => (
                    <SelectItem key={pack.id} value={pack.id}>
                      {pack.icon || "📦"} {pack.language === "en" ? "🇬🇧" : "🇫🇷"} {pack.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Difficulté</Label>
              <Select value={difficulty} onValueChange={setDifficulty}>
                <SelectTrigger className="h-8 text-sm w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">Facile</SelectItem>
                  <SelectItem value="2">Moyen</SelectItem>
                  <SelectItem value="3">Difficile</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Accès premium</Label>
              <div className="flex h-8 items-center gap-2 rounded-md border px-2">
                <input
                  id="puzzle-premium"
                  type="checkbox"
                  checked={isPremium}
                  onChange={(event) => {
                    setIsPremium(event.target.checked);
                    if (!event.target.checked) setUnlockCost("0");
                    else if (unlockCost === "0") setUnlockCost("25");
                  }}
                  className="accent-amber-500"
                />
                <label htmlFor="puzzle-premium" className="flex items-center gap-1 text-xs cursor-pointer">
                  <Coins className="size-3 text-amber-500" /> Payant
                </label>
                {isPremium && (
                  <Input
                    aria-label="Coût en pièces"
                    type="number"
                    min="1"
                    value={unlockCost}
                    onChange={(event) => setUnlockCost(event.target.value)}
                    className="h-6 w-16 px-1 text-xs"
                  />
                )}
              </div>
            </div>
          </div>
        </div>

        <Separator className="shrink-0" />

        {/* ── Grid size + toolbar ────────────────────────────────── */}
        <div className="px-4 py-2 shrink-0 space-y-2">
          {/* Grid size presets */}
          <div className="flex flex-wrap items-center gap-1.5">
            {gridSizePresets.map((preset) => {
              const Icon = preset.icon;
              const isActive = rowsInput === parseInt(preset.id.split('x')[0], 10) && colsInput === parseInt(preset.id.split('x')[1], 10);
              return (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => handlePresetGridSize(preset.id)}
                  className={`flex items-center gap-1 border rounded-md px-2 py-1 text-[11px] font-medium transition-colors ${
                    isActive
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'bg-background text-muted-foreground hover:bg-muted hover:text-foreground'
                  }`}
                >
                  <Icon className="size-3" />
                  {preset.label}
                </button>
              );
            })}
            <div className="flex items-center gap-1.5 ml-auto">
              <Label className="text-xs whitespace-nowrap">Lignes</Label>
              <Input
                type="number"
                min={2}
                max={20}
                value={rowsInput}
                onChange={(e) => setRowsInput(Number(e.target.value))}
                className="h-7 w-14 text-sm text-center"
              />
            </div>
            <div className="flex items-center gap-1.5">
              <Label className="text-xs whitespace-nowrap">Colonnes</Label>
              <Input
                type="number"
                min={2}
                max={20}
                value={colsInput}
                onChange={(e) => setColsInput(Number(e.target.value))}
                className="h-7 w-14 text-sm text-center"
              />
            </div>
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs"
              onClick={handleResizeGrid}
            >
              Appliquer
            </Button>
          </div>
          {/* Action buttons */}
          <div className="flex items-center gap-1.5">
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs"
              onClick={handleClearLetters}
            >
              Grille vide
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs text-destructive hover:text-destructive"
              onClick={handleClearAll}
            >
              Effacer tout
            </Button>
            <Button
              size="sm"
              className="h-7 text-xs"
              disabled={saving || words.length === 0}
              onClick={handleSave}
            >
              {saving ? "Sauvegarde…" : "Sauvegarder"}
            </Button>
            {isEditing && autosaveStatus !== 'idle' && (
              <span className={`ml-2 text-[11px] ${
                autosaveStatus === 'error'
                  ? 'text-destructive'
                  : 'text-muted-foreground'
              }`}>
                {autosaveStatus === 'saving' && 'Enregistrement…'}
                {autosaveStatus === 'saved' && 'Enregistré'}
                {autosaveStatus === 'error' && 'Échec de l’enregistrement'}
              </span>
            )}
          </div>
        </div>

        <Separator className="shrink-0" />

        {/* ── Main content: grid + clues ──────────────────────────── */}
        <div className="flex-1 overflow-hidden flex flex-col lg:flex-row min-h-0">
          {/* Grid area */}
          <div className="flex-1 overflow-auto p-4 flex items-start justify-center">
            <div className="shrink-0">
              {renderGrid()}
            </div>
          </div>

          {/* Clue editor sidebar (right on desktop, below on mobile) */}
          <div className="lg:w-[360px] xl:w-[400px] border-t lg:border-t-0 lg:border-l overflow-hidden flex flex-col min-h-0">
            <div className={`shrink-0 border-b bg-muted/20 ${assistantOpen ? "p-3 space-y-2" : "px-3 py-2"}`}>
              <div className="flex items-center gap-2">
                <BookOpen className="size-4 text-primary" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">Assistant de mots</p>
                  {assistantOpen && (
                    <p className="text-[11px] text-muted-foreground">Définitions, synonymes et acronymes</p>
                  )}
                </div>
                {assistantResult && !assistantOpen && (
                  <span className="truncate text-[11px] text-muted-foreground">{assistantResult.term}</span>
                )}
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-7 shrink-0"
                  onClick={() => setAssistantOpen((openState) => !openState)}
                  aria-expanded={assistantOpen}
                  aria-label={assistantOpen ? "Réduire l'assistant" : "Ouvrir l'assistant"}
                  title={assistantOpen ? "Réduire l'assistant" : "Ouvrir l'assistant"}
                >
                  {assistantOpen ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
                </Button>
              </div>
              {assistantOpen && (
                <>
                  <form
                    className="flex gap-2"
                    onSubmit={(event) => {
                      event.preventDefault();
                      void lookupWord(assistantTerm);
                    }}
                  >
                    <Input
                      value={assistantTerm}
                      onChange={(event) => setAssistantTerm(event.target.value)}
                      placeholder={language === "fr" ? "Ex. maison ou NASA" : "E.g. house or NASA"}
                      className="h-8 text-sm"
                      aria-label="Mot à rechercher"
                    />
                    <Button type="submit" size="sm" className="h-8 px-2.5" disabled={assistantLoading || !assistantTerm.trim()}>
                      <Search className="size-3.5" />
                      Chercher
                    </Button>
                  </form>
                  {assistantLoading && <p className="text-xs text-muted-foreground">Recherche en cours…</p>}
                  {assistantError && <p className="text-xs text-destructive">{assistantError}</p>}
                </>
              )}
              {assistantOpen && assistantResult && !assistantLoading && (
                <div className="max-h-48 overflow-y-auto space-y-2 pr-1 text-xs">
                  {assistantResult.acronym && (
                    <div className="rounded-md border bg-background p-2">
                      <p className="font-medium">{assistantResult.acronym.title}</p>
                      <p className="mt-1 text-muted-foreground">{assistantResult.acronym.extract}</p>
                    </div>
                  )}
                  {assistantResult.definitions.map((definition, index) => (
                    <div key={`${definition.definition}-${index}`} className="rounded-md border bg-background p-2">
                      <div className="flex items-start justify-between gap-2">
                        <p>
                          {definition.partOfSpeech && <span className="font-medium text-primary">{definition.partOfSpeech}: </span>}
                          {definition.definition}
                        </p>
                        <div className="flex shrink-0 items-center gap-0.5">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="size-6"
                            disabled={glossarySaving}
                            onClick={() => void saveToGlossary(definition.definition, definition.example)}
                            title={assistantResult.glossaryEntryId ? "Déjà enregistré" : "Enregistrer dans le glossaire"}
                          >
                            {assistantResult.glossaryEntryId ? <BookmarkCheck className="size-3.5 text-primary" /> : <Bookmark className="size-3.5" />}
                          </Button>
                        {assistantClue && (
                          <div className="flex shrink-0 items-center gap-0.5">
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="size-6"
                              onClick={() => insertAssistantDefinition(definition.definition)}
                              title="Utiliser comme indice"
                            >
                              <Lightbulb className="size-3.5" />
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="size-6"
                              disabled={clueSuggestionLoading !== null}
                              onClick={() => void suggestClue(definition.definition, index)}
                              title="Suggérer un indice"
                            >
                              <Sparkles className="size-3.5" />
                            </Button>
                          </div>
                        )}
                        </div>
                      </div>
                      {definition.example && <p className="mt-1 italic text-muted-foreground">“{definition.example}”</p>}
                      {clueSuggestionLoading === index && (
                        <p className="mt-1 text-[11px] text-muted-foreground">Génération en cours…</p>
                      )}
                      {clueSuggestion?.index === index && (
                        <div className="mt-2 flex items-center gap-2 rounded-md bg-muted/50 p-1.5">
                          <p className="min-w-0 flex-1">{clueSuggestion.text}</p>
                          <Button
                            type="button"
                            size="sm"
                            className="h-6 shrink-0 px-2 text-[11px]"
                            onClick={() => insertAssistantDefinition(clueSuggestion.text)}
                          >
                            Utiliser
                          </Button>
                        </div>
                      )}
                    </div>
                  ))}
                  {assistantResult.synonyms.length > 0 && (
                    <p className="text-muted-foreground">Liés : {assistantResult.synonyms.join(", ")}</p>
                  )}
                  {assistantResult.definitions.length === 0 && !assistantResult.acronym && assistantResult.synonyms.length === 0 && (
                    <p className="text-muted-foreground">Aucun résultat trouvé.</p>
                  )}
                  {assistantResult.definitions.length === 0 && (assistantResult.acronym || assistantResult.synonyms.length > 0) && (
                    <p className="text-muted-foreground">Définition indisponible pour ce terme.</p>
                  )}
                  <p className="text-[10px] text-muted-foreground">Source : {assistantResult.source}</p>
                </div>
              )}
              {assistantOpen && (
                <div className="border-t pt-2">
                  <button
                    type="button"
                    className="flex w-full items-center justify-between text-xs font-medium"
                    onClick={() => setGlossaryOpen((openState) => !openState)}
                    aria-expanded={glossaryOpen}
                  >
                    <span>Glossaire personnel ({glossaryEntries.length})</span>
                    {glossaryOpen ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
                  </button>
                  {glossaryOpen && (
                    <div className="mt-2 space-y-2">
                      <div className="flex gap-2">
                        <Input
                          value={glossarySearch}
                          onChange={(event) => setGlossarySearch(event.target.value)}
                          placeholder="Rechercher dans le glossaire"
                          className="h-7 text-xs"
                          aria-label="Rechercher dans le glossaire"
                        />
                        <Select value={glossaryLanguage} onValueChange={setGlossaryLanguage}>
                          <SelectTrigger className="h-7 w-[82px] text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">Toutes</SelectItem>
                            <SelectItem value="fr">Français</SelectItem>
                            <SelectItem value="en">English</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="max-h-52 space-y-1.5 overflow-y-auto pr-1">
                        {filteredGlossaryEntries.length === 0 && (
                          <p className="py-2 text-[11px] text-muted-foreground">Aucune entrée enregistrée.</p>
                        )}
                        {filteredGlossaryEntries.map((entry) => (
                          <div key={entry.id} className="rounded-md border bg-background p-2 text-xs">
                            {editingGlossaryId === entry.id ? (
                              <div className="space-y-1.5">
                                <p className="font-medium">{entry.term} · {entry.language.toUpperCase()}</p>
                                <Textarea
                                  value={editingGlossary.definition}
                                  onChange={(event) => setEditingGlossary((previous) => ({ ...previous, definition: event.target.value }))}
                                  className="min-h-12 text-xs"
                                  rows={2}
                                  placeholder="Définition"
                                />
                                <Input
                                  value={editingGlossary.example}
                                  onChange={(event) => setEditingGlossary((previous) => ({ ...previous, example: event.target.value }))}
                                  className="h-7 text-xs"
                                  placeholder="Exemple (optionnel)"
                                />
                                <Input
                                  value={editingGlossary.clue}
                                  onChange={(event) => setEditingGlossary((previous) => ({ ...previous, clue: event.target.value }))}
                                  className="h-7 text-xs"
                                  placeholder="Indice préféré (optionnel)"
                                />
                                <div className="flex justify-end gap-1">
                                  <Button type="button" variant="ghost" size="icon" className="size-6" onClick={cancelGlossaryEdit} title="Annuler">
                                    <X className="size-3.5" />
                                  </Button>
                                  <Button type="button" size="sm" className="h-6 px-2 text-[11px]" disabled={glossarySaving} onClick={() => void updateGlossaryEntry(entry)}>
                                    <Save className="size-3" />
                                    Enregistrer
                                  </Button>
                                </div>
                              </div>
                            ) : (
                              <div className="flex items-start gap-2">
                                <div className="min-w-0 flex-1">
                                  <p className="font-medium">{entry.term} · {entry.language.toUpperCase()}</p>
                                  <p className="mt-0.5 text-muted-foreground">{entry.definition}</p>
                                  {entry.clue && <p className="mt-0.5 italic text-muted-foreground">Indice : {entry.clue}</p>}
                                </div>
                                <div className="flex shrink-0 gap-0.5">
                                  <Button type="button" variant="ghost" size="icon" className="size-6" onClick={() => startGlossaryEdit(entry)} title="Modifier">
                                    <Pencil className="size-3.5" />
                                  </Button>
                                  <Button type="button" variant="ghost" size="icon" className="size-6 text-destructive hover:text-destructive" onClick={() => void deleteGlossaryEntry(entry)} title="Supprimer">
                                    <Trash2 className="size-3.5" />
                                  </Button>
                                </div>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
            <Tabs
              value={activeClueTab}
              onValueChange={setActiveClueTab}
              className="flex flex-col h-full"
            >
              <div className="shrink-0 px-2 pt-2">
                <TabsList className="w-full">
                  <TabsTrigger value="across" className="flex-1 text-xs">
                    Horizontal ({acrossClues.length})
                  </TabsTrigger>
                  <TabsTrigger value="down" className="flex-1 text-xs">
                    Vertical ({downClues.length})
                  </TabsTrigger>
                </TabsList>
              </div>
              <TabsContent value="across" className="flex-1 overflow-auto mt-0 p-2">
                <ScrollArea className="h-full max-h-[calc(100vh-22rem)] lg:max-h-[calc(100vh-22rem)]">
                  {renderClueList("across", acrossClues)}
                </ScrollArea>
              </TabsContent>
              <TabsContent value="down" className="flex-1 overflow-auto mt-0 p-2">
                <ScrollArea className="h-full max-h-[calc(100vh-22rem)] lg:max-h-[calc(100vh-22rem)]">
                  {renderClueList("down", downClues)}
                </ScrollArea>
              </TabsContent>
            </Tabs>
          </div>
        </div>

        {/* ── Help text ───────────────────────────────────────────── */}
        <div className="px-4 py-2 shrink-0 border-t">
          <p className="text-[10px] sm:text-xs text-muted-foreground">
            Cliquez sur une case noire pour la blanchir, ou sur une case blanche pour la sélectionner.
            Tapez une lettre pour la remplir. Recliquez sur la case sélectionnée pour la rendre noire.
            Utilisez les flèches pour naviguer, Retour pour effacer.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
