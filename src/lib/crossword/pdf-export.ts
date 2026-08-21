import jsPDF from 'jspdf';
import type { CrosswordPuzzleData } from './types';

/**
 * Export a crossword puzzle as a professional A4 PDF.
 *
 * @param puzzle  - The full puzzle data (grid, clues, metadata)
 * @param options.withAnswers  - If true, fill in the answer letters (default: false)
 * @param options.title       - Override the puzzle title
 * @param options.showNumbers - Show clue numbers inside the grid (default: true)
 */
export function exportPuzzleToPdf(
  puzzle: CrosswordPuzzleData,
  options?: {
    withAnswers?: boolean;
    title?: string;
    showNumbers?: boolean;
  },
): void {
  const {
    withAnswers = false,
    title: titleOverride,
    showNumbers = true,
  } = options ?? {};

  // ── Document setup ──────────────────────────────────────────────────
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const PAGE_W = 210;
  const PAGE_H = 297;
  const LEFT = 20;
  const RIGHT = 20;
  const TOP = 20;
  const BOTTOM = 20;
  const FOOTER_RESERVE = 10;
  const AVAIL_W = PAGE_W - LEFT - RIGHT;
  const CONTENT_MAX_Y = PAGE_H - BOTTOM - FOOTER_RESERVE;

  const displayTitle = titleOverride || puzzle.title;

  // Difficulty label
  const difficultyLabels: Record<number, string> = {
    1: '⭐ Facile',
    2: '⭐⭐ Moyen',
    3: '⭐⭐⭐ Difficile',
  };
  const difficultyText =
    difficultyLabels[puzzle.difficulty] ||
    '⭐'.repeat(Math.min(puzzle.difficulty, 5));

  doc.setFont('helvetica');

  // ── Header ──────────────────────────────────────────────────────────
  let y = TOP;

  // Title
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text(displayTitle, PAGE_W / 2, y, { align: 'center' });
  y += 8;

  // Description (italic, centered)
  if (puzzle.description) {
    doc.setFontSize(10);
    doc.setFont('helvetica', 'italic');
    const descLines = doc.splitTextToSize(puzzle.description, AVAIL_W - 40);
    for (const line of descLines) {
      doc.text(line as string, PAGE_W / 2, y, { align: 'center' });
      y += 4;
    }
    y += 1;
  }

  // Difficulty stars + language flag (top-right)
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(120, 120, 120);
  doc.text(`${difficultyText}  🇫🇷`, PAGE_W - RIGHT, TOP + 2, { align: 'right' });
  doc.setTextColor(0, 0, 0);

  // Thin separator line
  y += 2;
  doc.setDrawColor(200, 200, 200);
  doc.setLineWidth(0.3);
  doc.line(LEFT, y, PAGE_W - RIGHT, y);
  y += 8;

  // ── Grid ────────────────────────────────────────────────────────────
  const { rows, cols, grid } = puzzle;
  const cellSize = Math.min(Math.max(AVAIL_W / cols, 22), 36);
  const gridWidth = cols * cellSize;
  const gridX = LEFT + (AVAIL_W - gridWidth) / 2;

  for (let r = 0; r < rows; r++) {
    // Page break if the next row won't fit
    if (y + cellSize > CONTENT_MAX_Y) {
      doc.addPage();
      y = TOP;
    }

    for (let c = 0; c < cols; c++) {
      const cell = grid[r][c];
      const cx = gridX + c * cellSize;

      if (cell.isBlack) {
        // Black cell
        doc.setFillColor(30, 30, 30);
        doc.rect(cx, y, cellSize, cellSize, 'F');
      } else {
        // White cell with border
        doc.setFillColor(255, 255, 255);
        doc.setDrawColor(0, 0, 0);
        doc.setLineWidth(0.2);
        doc.rect(cx, y, cellSize, cellSize, 'FD');

        // Clue number (top-left, small)
        if (showNumbers && cell.number !== null) {
          doc.setFontSize(6);
          doc.setFont('helvetica', 'normal');
          doc.text(String(cell.number), cx + 1.5, y + 3);
        }

        // Answer letter (centred, bold)
        if (withAnswers && cell.letter) {
          doc.setFontSize(cellSize * 0.4);
          doc.setFont('helvetica', 'bold');
          doc.text(
            cell.letter.toUpperCase(),
            cx + cellSize / 2,
            y + cellSize / 2 + 1.5,
            { align: 'center' },
          );
        }
      }
    }

    y += cellSize;
  }

  // ── Clues ───────────────────────────────────────────────────────────
  y += 8;
  if (y + 20 > CONTENT_MAX_Y) {
    doc.addPage();
    y = TOP;
  }

  const acrossClues = puzzle.clues
    .filter((c) => c.direction === 'across')
    .sort((a, b) => a.number - b.number);
  const downClues = puzzle.clues
    .filter((c) => c.direction === 'down')
    .sort((a, b) => a.number - b.number);

  const useTwoColumns = cols >= 8;
  const CLUE_FONT = 10;
  const LINE_SPACING = 5; // mm

  /** Ensure a given page number exists and make it the active page. */
  const ensurePage = (pageNum: number): void => {
    if (pageNum > doc.getNumberOfPages()) {
      doc.addPage();
    }
    doc.setPage(pageNum);
  };

  if (useTwoColumns) {
    // ── Two-column layout ───────────────────────────────────────────
    const gap = 10;
    const colW = (AVAIL_W - gap) / 2;
    const lx = LEFT;
    const rx = LEFT + colW + gap;

    // Column headings
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('HORIZONTAL', lx, y);
    doc.text('VERTICAL', rx, y);
    y += 7;

    let leftY = y;
    let rightY = y;
    let leftPage = doc.getNumberOfPages();
    let rightPage = doc.getNumberOfPages();

    // Across clues → left column
    for (const clue of acrossClues) {
      const text = `${clue.number}. ${clue.text}`;
      const lines = doc.splitTextToSize(text, colW);
      for (const line of lines) {
        if (leftY > CONTENT_MAX_Y) {
          leftPage++;
          ensurePage(leftPage);
          leftY = TOP;
        }
        doc.setPage(leftPage);
        doc.setFontSize(CLUE_FONT);
        doc.setFont('helvetica', 'normal');
        doc.text(line as string, lx, leftY);
        leftY += LINE_SPACING;
      }
      leftY += 1; // small gap between clues
    }

    // Down clues → right column
    for (const clue of downClues) {
      const text = `${clue.number}. ${clue.text}`;
      const lines = doc.splitTextToSize(text, colW);
      for (const line of lines) {
        if (rightY > CONTENT_MAX_Y) {
          rightPage++;
          ensurePage(rightPage);
          rightY = TOP;
        }
        doc.setPage(rightPage);
        doc.setFontSize(CLUE_FONT);
        doc.setFont('helvetica', 'normal');
        doc.text(line as string, rx, rightY);
        rightY += LINE_SPACING;
      }
      rightY += 1;
    }
  } else {
    // ── Single-column layout ────────────────────────────────────────
    // HORIZONTAL heading
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('HORIZONTAL', LEFT, y);
    y += 7;

    // Across clues
    for (const clue of acrossClues) {
      const text = `${clue.number}. ${clue.text}`;
      const lines = doc.splitTextToSize(text, AVAIL_W);
      for (const line of lines) {
        if (y > CONTENT_MAX_Y) {
          doc.addPage();
          y = TOP;
        }
        doc.setFontSize(CLUE_FONT);
        doc.setFont('helvetica', 'normal');
        doc.text(line as string, LEFT, y);
        y += LINE_SPACING;
      }
      y += 1;
    }

    // VERTICAL heading
    y += 4;
    if (y + 7 > CONTENT_MAX_Y) {
      doc.addPage();
      y = TOP;
    }
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('VERTICAL', LEFT, y);
    y += 7;

    // Down clues
    for (const clue of downClues) {
      const text = `${clue.number}. ${clue.text}`;
      const lines = doc.splitTextToSize(text, AVAIL_W);
      for (const line of lines) {
        if (y > CONTENT_MAX_Y) {
          doc.addPage();
          y = TOP;
        }
        doc.setFontSize(CLUE_FONT);
        doc.setFont('helvetica', 'normal');
        doc.text(line as string, LEFT, y);
        y += LINE_SPACING;
      }
      y += 1;
    }
  }

  // ── Footers (applied to every page) ─────────────────────────────────
  const totalPages = doc.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text('Mots Croisés — mots-croisés.app', PAGE_W / 2, PAGE_H - BOTTOM + 5, {
      align: 'center',
    });
    doc.text(String(p), PAGE_W - RIGHT, PAGE_H - BOTTOM + 5, {
      align: 'right',
    });
  }

  // Reset colour & save
  doc.setTextColor(0, 0, 0);
  doc.save('mots-croises.pdf');
}
