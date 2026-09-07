'use client';

import { useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import AdminPanel from '@/components/crossword/AdminPanel';

export default function AdminPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const role = session?.user?.role;
  const canManage = role === 'ADMIN' || role === 'CREATOR';

  useEffect(() => {
    if (status === 'unauthenticated' || (status === 'authenticated' && !canManage)) {
      router.replace('/');
    }
  }, [status, canManage, router]);

  if (status === 'loading' || !canManage) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <AdminPanel
      open
      onOpenChange={(open) => {
        if (!open) router.push('/');
      }}
      isAdmin={role === 'ADMIN'}
      isCreator={canManage}
      fullPage
    />
  );
}
