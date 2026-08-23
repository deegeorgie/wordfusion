'use client';

import React, { useState } from 'react';
import { signIn } from 'next-auth/react';
import { toast } from 'sonner';
import { LogIn, UserPlus, Loader2, Eye, EyeOff } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';

interface AuthModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AuthModal({ open, onOpenChange }: AuthModalProps) {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Login fields
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  // Register fields
  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');

  const resetForm = () => {
    setLoginEmail('');
    setLoginPassword('');
    setRegName('');
    setRegEmail('');
    setRegPassword('');
    setShowPassword(false);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginEmail.trim() || !loginPassword) {
      toast.error('Veuillez remplir tous les champs');
      return;
    }
    setLoading(true);
    try {
      const result = await signIn('credentials', {
        email: loginEmail.trim().toLowerCase(),
        password: loginPassword,
        redirect: false,
      });
      if (result?.error) {
        toast.error('Email ou mot de passe incorrect');
      } else {
        toast.success('Connexion réussie !');
        resetForm();
        onOpenChange(false);
      }
    } catch {
      toast.error('Erreur de connexion');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!regName.trim() || !regEmail.trim() || !regPassword) {
      toast.error('Veuillez remplir tous les champs');
      return;
    }
    if (regPassword.length < 6) {
      toast.error('Le mot de passe doit contenir au moins 6 caractères');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: regName.trim(),
          email: regEmail.trim().toLowerCase(),
          password: regPassword,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || 'Erreur lors de l\'inscription');
        return;
      }
      toast.success('Compte créé ! Connexion en cours…');
      // Auto-login
      const result = await signIn('credentials', {
        email: regEmail.trim().toLowerCase(),
        password: regPassword,
        redirect: false,
      });
      if (result?.error) {
        toast.error('Compte créé. Veuillez vous connecter.');
      } else {
        toast.success('Bienvenue ! 🎉');
        resetForm();
        onOpenChange(false);
      }
    } catch {
      toast.error('Erreur lors de l\'inscription');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-xl">Bienvenue</DialogTitle>
          <DialogDescription>
            Connectez-vous ou créez un compte pour accéder à toutes les fonctionnalités.
          </DialogDescription>
        </DialogHeader>

        <Tabs value={mode} onValueChange={(v) => setMode(v as 'login' | 'register')} className="mt-2">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="login" className="gap-1.5 text-xs sm:text-sm">
              <LogIn className="size-3.5" />
              Connexion
            </TabsTrigger>
            <TabsTrigger value="register" className="gap-1.5 text-xs sm:text-sm">
              <UserPlus className="size-3.5" />
              Inscription
            </TabsTrigger>
          </TabsList>

          {/* ── LOGIN TAB ──────────────────────────────────────── */}
          <TabsContent value="login">
            <form onSubmit={handleLogin} className="space-y-4 mt-4">
              <div className="space-y-1.5">
                <Label htmlFor="login-email" className="text-xs text-muted-foreground">Email</Label>
                <Input
                  id="login-email"
                  type="email"
                  placeholder="vous@exemple.com"
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  disabled={loading}
                  autoComplete="email"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="login-password" className="text-xs text-muted-foreground">Mot de passe</Label>
                <div className="relative">
                  <Input
                    id="login-password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="••••••••"
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    disabled={loading}
                    className="pr-10"
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? (
                  <><Loader2 className="size-4 animate-spin mr-2" /> Connexion…</>
                ) : (
                  <><LogIn className="size-4 mr-2" /> Se connecter</>
                )}
              </Button>
            </form>
          </TabsContent>

          {/* ── REGISTER TAB ──────────────────────────────────── */}
          <TabsContent value="register">
            <form onSubmit={handleRegister} className="space-y-4 mt-4">
              <div className="space-y-1.5">
                <Label htmlFor="reg-name" className="text-xs text-muted-foreground">Nom complet</Label>
                <Input
                  id="reg-name"
                  type="text"
                  placeholder="Georges BODIONG"
                  value={regName}
                  onChange={(e) => setRegName(e.target.value)}
                  disabled={loading}
                  autoComplete="name"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="reg-email" className="text-xs text-muted-foreground">Email</Label>
                <Input
                  id="reg-email"
                  type="email"
                  placeholder="vous@exemple.com"
                  value={regEmail}
                  onChange={(e) => setRegEmail(e.target.value)}
                  disabled={loading}
                  autoComplete="email"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="reg-password" className="text-xs text-muted-foreground">
                  Mot de passe <span className="text-muted-foreground/60">(min. 6 caractères)</span>
                </Label>
                <div className="relative">
                  <Input
                    id="reg-password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="••••••••"
                    value={regPassword}
                    onChange={(e) => setRegPassword(e.target.value)}
                    disabled={loading}
                    className="pr-10"
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? (
                  <><Loader2 className="size-4 animate-spin mr-2" /> Inscription…</>
                ) : (
                  <><UserPlus className="size-4 mr-2" /> Créer mon compte</>
                )}
              </Button>
              <p className="text-[11px] text-center text-muted-foreground">
                Les nouveaux comptes sont créés avec le rôle <span className="font-medium">Joueur</span>.
                Un administrateur peut vous promouvoir en Créateur ou Administrateur.
              </p>
            </form>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
