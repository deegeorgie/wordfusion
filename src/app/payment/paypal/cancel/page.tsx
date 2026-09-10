import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default function PayPalCancelPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-md rounded-xl border bg-card p-8 text-center shadow-sm">
        <h1 className="text-xl font-semibold">Paiement annulé</h1>
        <p className="mt-2 text-sm text-muted-foreground">Aucune pièce n’a été débitée.</p>
        <Button asChild className="mt-6"><Link href="/">Retour au jeu</Link></Button>
      </div>
    </main>
  );
}
