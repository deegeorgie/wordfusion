'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { Loader2 } from 'lucide-react';
import PuzzleEditor from '@/components/crossword/PuzzleEditor';

export default function PuzzleEditorPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const role = session?.user?.role;
  const canManage = role === 'ADMIN' || role === 'CREATOR';
  const [puzzleId, setPuzzleId] = useState<string | null>(null);

  useEffect(() => {
    setPuzzleId(new URLSearchParams(window.location.search).get('puzzleId'));
  }, []);

  useEffect(() => {
    if (status === 'unauthenticated' || (status === 'authenticated' && !canManage)) {
      router.replace('/');
    }
  }, [status, canManage, router]);

  if (status === 'loading' || !canManage) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-background">
      <PuzzleEditor
        open
        onOpenChange={(open) => {
          if (!open) window.close();
        }}
        editPuzzleId={puzzleId}
        pageMode
        onSaved={() => {
          window.opener?.postMessage({ type: 'wordfusion:puzzle-saved' }, window.location.origin);
        }}
      />
    </main>
  );
}