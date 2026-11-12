import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db } from '@/lib/db';
import { buildPuzzlePdf } from '@/lib/crossword/pdf-export';
import { puzzleFromDbFormat } from '@/lib/crossword/utils';
import { getAccessiblePuzzle } from '@/lib/puzzle-access';

export const runtime = 'nodejs';

const PDF_COSTS = {
  puzzle: 5,
  answers: 15,
} as const;

type PdfKind = keyof typeof PDF_COSTS;

function filenameFor(title: string, kind: PdfKind): string {
  const base = title
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'mots-croises';
  return `${base}${kind === 'answers' ? '-reponses' : ''}.pdf`;
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user.id) {
      return NextResponse.json({ error: 'Connectez-vous pour télécharger un PDF' }, { status: 401 });
    }

    const body = await request.json().catch(() => null) as { kind?: string } | null;
    const kind: PdfKind | null =
      body?.kind === 'answers' ? 'answers' : body?.kind === 'puzzle' ? 'puzzle' : null;
    if (!kind) return NextResponse.json({ error: 'Type de PDF invalide' }, { status: 400 });

    const { id: puzzleId } = await params;
    const puzzle = await getAccessiblePuzzle(puzzleId);
    if (!puzzle || !puzzle.published) {
      return NextResponse.json({ error: 'Puzzle introuvable ou verrouillé' }, { status: 404 });
    }

    const cost = PDF_COSTS[kind];
    // Cheap pre-check so users without enough coins never trigger generation.
    const wallet = await db.userWallet.findUnique({
      where: { userId: session.user.id },
      select: { balance: true },
    });
    if (!wallet || wallet.balance < cost) {
      return NextResponse.json({ error: `Il vous faut ${cost} pièces` }, { status: 402 });
    }

    let pdf: ArrayBuffer;
    try {
      pdf = buildPuzzlePdf(
        puzzleFromDbFormat(
          puzzle.title,
          puzzle.description,
          puzzle.difficulty,
          puzzle.rows,
          puzzle.cols,
          puzzle.gridData,
          puzzle.wordsData,
          puzzle.cluesData,
        ),
        {
          withAnswers: kind === 'answers',
          language: puzzle.language === 'en' ? 'en' : 'fr',
        },
      );
    } catch (error) {
      console.error('Error generating PDF:', error);
      return NextResponse.json({ error: 'Impossible de générer le PDF' }, { status: 500 });
    }

    // Only debit once the document exists, and debit atomically.
    const balance = await db.$transaction(async (tx) => {
      const updated = await tx.userWallet.updateMany({
        where: { userId: session.user.id, balance: { gte: cost } },
        data: { balance: { decrement: cost } },
      });
      if (updated.count !== 1) return null;

      const updatedWallet = await tx.userWallet.findUniqueOrThrow({
        where: { userId: session.user.id },
        select: { id: true, balance: true },
      });
      await tx.coinTransaction.create({
        data: {
          userId: session.user.id,
          walletId: updatedWallet.id,
          amount: -cost,
          reason: `pdf_download_${kind}`,
          referenceKey: `pdf-download:${session.user.id}:${puzzleId}:${kind}:${crypto.randomUUID()}`,
          balanceAfter: updatedWallet.balance,
        },
      });
      return updatedWallet.balance;
    });

    if (balance === null) {
      return NextResponse.json({ error: `Il vous faut ${cost} pièces` }, { status: 402 });
    }

    return new Response(pdf, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filenameFor(puzzle.title, kind)}"`,
        'Content-Length': String(pdf.byteLength),
        'Cache-Control': 'no-store',
        'X-Coin-Balance': String(balance),
      },
    });
  } catch (error) {
    console.error('Error generating PDF:', error);
    return NextResponse.json({ error: 'Impossible de préparer le téléchargement' }, { status: 500 });
  }
}
