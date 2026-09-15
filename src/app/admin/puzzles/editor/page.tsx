import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { authOptions } from '@/lib/auth';
import PuzzleEditorPageClient from './PuzzleEditorPageClient';

interface PuzzleEditorPageProps {
  searchParams: Promise<{ puzzleId?: string }>;
}

export default async function PuzzleEditorPage({ searchParams }: PuzzleEditorPageProps) {
  const session = await getServerSession(authOptions);
  const role = session?.user?.role;
  if (role !== 'ADMIN' && role !== 'CREATOR') redirect('/');

  const { puzzleId } = await searchParams;
  return <PuzzleEditorPageClient puzzleId={puzzleId ?? null} />;
}