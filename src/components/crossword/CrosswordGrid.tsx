'use client';

import React, { useCallback, useMemo, useRef, useEffect } from 'react';
import type { CrosswordPuzzleData } from '@/lib/crossword/types';

type CellKey = `${number},${number}`;

interface CrosswordGridProps {
  puzzle: CrosswordPuzzleData;
  userInputs: (string | null)[][];
  onCellChange: (row: number, col: number, value: string) => void;
  selectedCell: { row: number; col: number } | null;
  onSelectCell: (row: number, col: number) => void;
  direction: 'across' | 'down';
  onToggleDirection: () => void;
  activeWordCells: { row: number; col: number }[];
  revealedCells: Set<string>;
  correctCells: Set<string>;
  incorrectCells: Set<string>;
}

function toCellKey(row: number, col: number): CellKey {
  return `${row},${col}`;
}

/**
 * CrosswordGrid — interactive crossword puzzle grid component.
 *
 * Renders a CSS Grid of cells with keyboard navigation, visual
 * highlighting for the active word / selected cell, and status
 * colouring for revealed / correct / incorrect cells.
 */
export default function CrosswordGrid({
  puzzle,
  userInputs,
  onCellChange,
  selectedCell,
  onSelectCell,
  direction,
  onToggleDirection,
  activeWordCells,
  revealedCells,
  correctCells,
  incorrectCells,
}: CrosswordGridProps) {
  const gridRef = useRef<HTMLDivElement>(null);

  // ── Derived sets for fast O(1) look-ups ───────────────────────────
  const activeWordSet = useMemo<Set<CellKey>>(() => {
    const s = new Set<CellKey>();
    for (const c of activeWordCells) s.add(toCellKey(c.row, c.col));
    return s;
  }, [activeWordCells]);

  const selectedKey = useMemo<CellKey | null>(
    () => (selectedCell ? toCellKey(selectedCell.row, selectedCell.col) : null),
    [selectedCell],
  );

  // ── Helpers ────────────────────────────────────────────────────────
  const isWhiteCell = useCallback(
    (row: number, col: number) => {
      return !puzzle.grid[row]?.[col]?.isBlack;
    },
    [puzzle.grid],
  );

  /** Move one step in the current direction, skipping black cells. */
  const nextCell = useCallback(
    (row: number, col: number): { row: number; col: number } | null => {
      const { rows, cols } = puzzle;
      if (direction === 'across') {
        let c = col + 1;
        while (c < cols) {
          if (isWhiteCell(row, c)) return { row, col: c };
          c++;
        }
      } else {
        let r = row + 1;
        while (r < rows) {
          if (isWhiteCell(r, col)) return { row: r, col };
          r++;
        }
      }
      return null;
    },
    [direction, puzzle, isWhiteCell],
  );

  /** Move one step backwards in the current direction, skipping black cells. */
  const prevCell = useCallback(
    (row: number, col: number): { row: number; col: number } | null => {
      if (direction === 'across') {
        let c = col - 1;
        while (c >= 0) {
          if (isWhiteCell(row, c)) return { row, col: c };
          c--;
        }
      } else {
        let r = row - 1;
        while (r >= 0) {
          if (isWhiteCell(r, col)) return { row: r, col };
          r--;
        }
      }
      return null;
    },
    [direction, puzzle, isWhiteCell],
  );

  // ── Focus management ───────────────────────────────────────────────
  useEffect(() => {
    if (selectedCell && gridRef.current) {
      gridRef.current.focus({ preventScroll: true });
    }
  }, [selectedCell]);

  // ── Keyboard handling ──────────────────────────────────────────────
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (!selectedCell) return;

      const { row, col } = selectedCell;
      const key = e.key;

      // Letter input (single character, A-Z or accented French chars)
      if (/^[a-zA-ZÀ-ÿ]$/.test(key)) {
        e.preventDefault();
        const letter = key.toUpperCase();
        onCellChange(row, col, letter);
        // Auto-advance to next white cell
        const next = nextCell(row, col);
        if (next) onSelectCell(next.row, next.col);
        return;
      }

      // Backspace
      if (key === 'Backspace') {
        e.preventDefault();
        const currentVal = userInputs[row]?.[col];
        if (currentVal) {
          // Clear current cell first
          onCellChange(row, col, '');
        } else {
          // Move back and clear
          const prev = prevCell(row, col);
          if (prev) {
            onSelectCell(prev.row, prev.col);
            onCellChange(prev.row, prev.col, '');
          }
        }
        return;
      }

      // Delete
      if (key === 'Delete') {
        e.preventDefault();
        onCellChange(row, col, '');
        return;
      }

      // Arrow keys
      if (key === 'ArrowRight') {
        e.preventDefault();
        let c = col + 1;
        while (c < puzzle.cols) {
          if (isWhiteCell(row, c)) {
            onSelectCell(row, c);
            break;
          }
          c++;
        }
        return;
      }
      if (key === 'ArrowLeft') {
        e.preventDefault();
        let c = col - 1;
        while (c >= 0) {
          if (isWhiteCell(row, c)) {
            onSelectCell(row, c);
            break;
          }
          c--;
        }
        return;
      }
      if (key === 'ArrowDown') {
        e.preventDefault();
        let r = row + 1;
        while (r < puzzle.rows) {
          if (isWhiteCell(r, col)) {
            onSelectCell(r, col);
            break;
          }
          r++;
        }
        return;
      }
      if (key === 'ArrowUp') {
        e.preventDefault();
        let r = row - 1;
        while (r >= 0) {
          if (isWhiteCell(r, col)) {
            onSelectCell(r, col);
            break;
          }
          r--;
        }
        return;
      }

      // Tab — toggle direction (prevent default tab behaviour)
      if (key === 'Tab') {
        e.preventDefault();
        onToggleDirection();
        return;
      }
    },
    [
      selectedCell,
      userInputs,
      onCellChange,
      onSelectCell,
      onToggleDirection,
      nextCell,
      prevCell,
      isWhiteCell,
      puzzle,
    ],
  );

  // ── Cell click handler ─────────────────────────────────────────────
  const handleCellClick = useCallback(
    (row: number, col: number) => {
      if (!isWhiteCell(row, col)) return;

      // If clicking the already-selected cell, toggle direction
      if (
        selectedCell &&
        selectedCell.row === row &&
        selectedCell.col === col
      ) {
        onToggleDirection();
      } else {
        onSelectCell(row, col);
      }

      // Ensure the grid retains focus for keyboard input
      gridRef.current?.focus({ preventScroll: true });
    },
    [selectedCell, onSelectCell, onToggleDirection, isWhiteCell],
  );

  // ── Compute grid template ──────────────────────────────────────────
  const gridTemplate = useMemo(
    () => `repeat(${puzzle.cols}, 1fr)`,
    [puzzle.cols],
  );

  // ── Render ─────────────────────────────────────────────────────────
  return (
    <div
      className="w-full flex items-start justify-center"
    >
      <div
        ref={gridRef}
        role="grid"
        tabIndex={0}
        aria-label={
          puzzle.title
            ? `Grille de mots croisés : ${puzzle.title}`
            : 'Grille de mots croisés'
        }
        onKeyDown={handleKeyDown}
        className="
          outline-none
          focus-visible:ring-2
          focus-visible:ring-primary
          focus-visible:ring-offset-2
          rounded-md
          overflow-x-auto
          max-w-full
        "
        style={{
          display: 'inline-grid',
          gridTemplateColumns: gridTemplate,
          gap: '1px',
          backgroundColor: 'hsl(var(--border))',
          border: '2px solid hsl(var(--border))',
          borderRadius: '4px',
        }}
      >
        {puzzle.grid.map((gridRow, rowIdx) =>
          gridRow.map((cell, colIdx) => {
            const key = toCellKey(rowIdx, colIdx);
            const isSelected = selectedKey === key;
            const isActiveWord = activeWordSet.has(key);
            const isRevealed = revealedCells.has(key);
            const isCorrect = correctCells.has(key);
            const isIncorrect = incorrectCells.has(key);
            const userInput = userInputs[rowIdx]?.[colIdx] ?? '';

            // ── Black cell ──
            if (cell.isBlack) {
              return (
                <div
                  key={key}
                  role="presentation"
                  className="
                    bg-gray-900
                    dark:bg-gray-950
                    w-8 h-8
                    sm:w-10 sm:h-10
                    md:w-10 md:h-10
                  "
                  style={{ minWidth: '32px', minHeight: '32px' }}
                />
              );
            }

            // ── White cell styling ──
            let cellBg = 'bg-white dark:bg-gray-50';
            let cellText = 'text-gray-900 dark:text-gray-900';

            // Status colours (highest priority)
            if (isIncorrect) {
              cellBg = 'bg-red-100 dark:bg-red-950';
              cellText = 'text-red-700 dark:text-red-400';
            } else if (isCorrect) {
              cellBg = 'bg-emerald-50 dark:bg-emerald-950';
              cellText = 'text-emerald-700 dark:text-emerald-400';
            } else if (isRevealed) {
              cellBg = 'bg-sky-50 dark:bg-sky-950';
            }
            // Active word highlight (below status)
            else if (!isSelected && isActiveWord) {
              cellBg = 'bg-primary/10 dark:bg-primary/15';
            }

            // Selected cell (highest visual priority on top of active word)
            if (isSelected) {
              cellBg = 'bg-primary/25 dark:bg-primary/30';
              cellText = 'text-primary-foreground font-bold';
            }

            return (
              <div
                key={key}
                role="gridcell"
                aria-selected={isSelected}
                aria-label={
                  cell.number
                    ? `Case ${rowIdx + 1}-${colIdx + 1}, numéro ${cell.number}${userInput ? `, lettre ${userInput}` : ', vide'}`
                    : `Case ${rowIdx + 1}-${colIdx + 1}${userInput ? `, lettre ${userInput}` : ', vide'}`
                }
                onClick={() => handleCellClick(rowIdx, colIdx)}
                className={`
                  ${cellBg}
                  ${cellText}
                  relative
                  w-8 h-8
                  sm:w-10 sm:h-10
                  md:w-10 md:h-10
                  cursor-pointer
                  select-none
                  flex
                  items-center
                  justify-center
                  transition-colors
                  duration-100
                  border border-gray-300
                  dark:border-gray-600
                  hover:brightness-95
                  dark:hover:brightness-110
                  ${isSelected ? 'ring-2 ring-primary ring-inset' : ''}
                `}
                style={{ minWidth: '32px', minHeight: '32px' }}
              >
                {/* Clue number */}
                {cell.number != null && (
                  <span
                    className="
                      absolute
                      top-px left-0.5
                      leading-none
                      font-semibold
                      pointer-events-none
                    "
                    style={{
                      fontSize: '10px',
                      lineHeight: 1,
                      color: isSelected
                        ? 'hsl(var(--primary-foreground))'
                        : 'hsl(var(--muted-foreground))',
                    }}
                  >
                    {cell.number}
                  </span>
                )}

                {/* User-entered letter */}
                {userInput && (
                  <span
                    className="
                      font-bold
                      pointer-events-none
                      select-none
                      transition-transform
                      duration-75
                    "
                    style={{
                      fontSize: 'clamp(14px, 2.5vw, 18px)',
                      lineHeight: 1,
                    }}
                    aria-hidden
                  >
                    {userInput}
                  </span>
                )}
              </div>
            );
          }),
        )}
      </div>
    </div>
  );
}
