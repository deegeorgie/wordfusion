'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { Loader2 } from 'lucide-react';
import PuzzleEditor from '@/components/crossword/PuzzleEditor';
import { Button } from '@/components/ui/button';

export default function PuzzleEditorPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const role = session?.user?.role;
  const canManage = role === 'ADMIN' || role === 'CREATOR';
  const [puzzleId, setPuzzleId] = useState<string | null>(null);

  useEffect(() => {
    setPuzzleId(new URLSearchParams(window.location.search).get('puzzleId'));
  }, []);

  if (status === 'loading') {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </main>
    );
  }

  if (!canManage) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="max-w-md space-y-4 text-center">
          <h1 className="font-display text-2xl font-semibold">Accès créateur requis</h1>
          <p className="text-sm text-muted-foreground">
            Connectez-vous avec un compte Créateur ou Administrateur pour ouvrir l&apos;éditeur de puzzles.
          </p>
          <Button type="button" onClick={() => router.push('/')}>
            Retour à l&apos;accueil
          </Button>
        </div>
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