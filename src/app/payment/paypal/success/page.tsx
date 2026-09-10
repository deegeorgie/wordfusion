'use client';

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { CheckCircle2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

function PayPalSuccessContent() {
  const searchParams = useSearchParams();
  const [state, setState] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('Confirmation du paiement…');

  useEffect(() => {
    const orderId = searchParams.get('token');
    if (!orderId) {
      setState('error');
      setMessage('Identifiant de paiement manquant.');
      return;
    }

    fetch(`/api/paypal/orders/${encodeURIComponent(orderId)}/capture`, { method: 'POST' })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Paiement non confirmé');
        setState('success');
        setMessage(data.alreadyProcessed ? 'Ce paiement avait déjà été confirmé.' : 'Votre solde a été crédité.');
      })
      .catch((error: unknown) => {
        setState('error');
        setMessage(error instanceof Error ? error.message : 'Paiement non confirmé');
      });
  }, [searchParams]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-md rounded-xl border bg-card p-8 text-center shadow-sm">
        {state === 'loading' && <Loader2 className="mx-auto size-10 animate-spin text-muted-foreground" />}
        {state === 'success' && <CheckCircle2 className="mx-auto size-10 text-emerald-600" />}
        {state === 'error' && <div className="mx-auto flex size-10 items-center justify-center rounded-full bg-destructive/10 text-destructive">!</div>}
        <h1 className="mt-4 text-xl font-semibold">{state === 'success' ? 'Paiement confirmé' : state === 'error' ? 'Paiement non confirmé' : 'Paiement en cours'}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{message}</p>
        {state !== 'loading' && <Button asChild className="mt-6"><Link href="/">Retour au jeu</Link></Button>}
      </div>
    </main>
  );
}

export default function PayPalSuccessPage() {
  return <Suspense fallback={<div className="flex min-h-screen items-center justify-center"><Loader2 className="size-6 animate-spin" /></div>}><PayPalSuccessContent /></Suspense>;
}
