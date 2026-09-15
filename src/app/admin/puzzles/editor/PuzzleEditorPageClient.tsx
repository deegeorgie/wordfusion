'use client';

import PuzzleEditor from '@/components/crossword/PuzzleEditor';

export default function PuzzleEditorPageClient({ puzzleId }: { puzzleId: string | null }) {
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