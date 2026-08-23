'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import {
  CalendarIcon,
  CheckCircle2,
  CircleOff,
  FolderOpen,
  Globe,
  Grid2X2,
  Grid3X3,
  LayoutGrid,
  Loader2,
  Package,
  Pencil,
  Plus,
  Save,
  Settings,
  Star,
  CalendarDays,
  EyeOff,
  Eye,
  Trash2,
  Tag,
  Languages,
  Sparkles,
  Zap,
} from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Calendar } from '@/components/ui/calendar';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

import PuzzleEditor from '@/components/crossword/PuzzleEditor';
import { cn } from '@/lib/utils';

// --- Types ---

interface CategoryItem {
  id: string;
  name: string;
  slug: string;
  icon: string;
  language: string;
  createdAt: string;
  _count: { puzzles: number };
}

interface PackItem {
  id: string;
  name: string;
  description: string | null;
  icon: string;
  language: string;
  _count: { puzzles: number };
}

interface PuzzleSummary {
  id: string;
  title: string;
  difficulty: number;
  language: string;
  categoryId: string | null;
  categoryName: string | null;
  categorySlug: string | null;
  categoryIcon?: string | null;
  packId?: string | null;
  packName?: string | null;
  packIcon?: string | null;
  rows: number;
  cols: number;
  published: boolean;
  publishDate: string | null;
  createdAt: string;
}

interface PublishingSchedule {
  id: string;
  puzzlesPerDay: number;
  isActive: boolean;
}

interface AdminData {
  puzzles: PuzzleSummary[];
  schedule: PublishingSchedule;
  categories: CategoryItem[];
  packs: PackItem[];
}

interface AdminPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isAdmin?: boolean;
  isCreator?: boolean;
}

// --- Helpers ---

function renderStars(difficulty: number) {
  const maxStars = 3;
  return (
    <span className="inline-flex items-center gap-0.5">
      {Array.from({ length: maxStars }, (_, i) => (
        <Star
          key={i}
          className={`size-3.5 ${
            i < difficulty
              ? 'fill-amber-400 text-amber-400'
              : 'fill-muted text-muted-foreground/30'
          }`}
        />
      ))}
    </span>
  );
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '—';
  try {
    return format(new Date(dateStr), 'dd MMM yyyy', { locale: fr });
  } catch {
    return '—';
  }
}

function languageLabel(lang: string) {
  return lang === 'en' ? '🇬🇧 EN' : '🇫🇷 FR';
}

// --- Skeletons ---

function TableSkeleton() {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-8 w-24" />
      </div>
      {Array.from({ length: 4 }, (_, i) => (
        <div key={i} className="flex items-center gap-4">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-5 w-20" />
          <Skeleton className="h-8 w-20" />
        </div>
      ))}
    </div>
  );
}

function CategorySkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 3 }, (_, i) => (
        <div key={i} className="flex items-center gap-4">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-5 w-12" />
          <Skeleton className="h-4 w-8" />
          <Skeleton className="h-8 w-20" />
        </div>
      ))}
    </div>
  );
}

// --- Category Management Sub-component ---

function CategoryManager({ categories, onRefresh }: { categories: CategoryItem[]; onRefresh: () => void }) {
  const [newName, setNewName] = useState('');
  const [newIcon, setNewIcon] = useState('🏷️');
  const [newLanguage, setNewLanguage] = useState('fr');
  const [creating, setCreating] = useState(false);

  // Edit state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editIcon, setEditIcon] = useState('');
  const [editLanguage, setEditLanguage] = useState('');
  const [saving, setSaving] = useState(false);

  // Delete state
  const [deleteTarget, setDeleteTarget] = useState<CategoryItem | null>(null);
  const [deleting, setDeleting] = useState(false);

  const handleCreate = async () => {
    if (!newName.trim()) return;
    setCreating(true);
    try {
      const res = await fetch('/api/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName.trim(), icon: newIcon, language: newLanguage }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as { error?: string }).error || 'Erreur');
      }
      toast.success(`Catégorie « ${newName.trim()} » créée`);
      setNewName('');
      setNewIcon('🏷️');
      onRefresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur inconnue');
    } finally {
      setCreating(false);
    }
  };

  const startEdit = (cat: CategoryItem) => {
    setEditingId(cat.id);
    setEditName(cat.name);
    setEditIcon(cat.icon || '🏷️');
    setEditLanguage(cat.language);
  };

  const handleSaveEdit = async () => {
    if (!editingId || !editName.trim()) return;
    setSaving(true);
    try {
      const res = await fetch('/api/categories', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: editingId, name: editName.trim(), icon: editIcon, language: editLanguage }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as { error?: string }).error || 'Erreur');
      }
      toast.success('Catégorie mise à jour');
      setEditingId(null);
      onRefresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur inconnue');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/categories?id=${deleteTarget.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Erreur lors de la suppression');
      toast.success(`Catégorie « ${deleteTarget.name} » supprimée`);
      setDeleteTarget(null);
      onRefresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur inconnue');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <>
      {/* Create new category row */}
      <div className="flex flex-col sm:flex-row items-start sm:items-end gap-2 mb-4">
        <div className="w-16 sm:w-20 space-y-1">
          <Label className="text-xs text-muted-foreground">Icône</Label>
          <Input
            placeholder="🏷️"
            value={newIcon}
            onChange={(e) => setNewIcon(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
            className="h-8 text-sm text-center"
            maxLength={4}
          />
        </div>
        <div className="flex-1 w-full sm:w-auto space-y-1">
          <Label className="text-xs text-muted-foreground">Nom de la catégorie</Label>
          <Input
            placeholder="Ex: Animaux, Sciences..."
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
            className="h-8 text-sm"
          />
        </div>
        <div className="w-full sm:w-28 space-y-1">
          <Label className="text-xs text-muted-foreground">Langue</Label>
          <Select value={newLanguage} onValueChange={setNewLanguage}>
            <SelectTrigger className="h-8 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="fr">🇫🇷 Français</SelectItem>
              <SelectItem value="en">🇬🇧 English</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button size="sm" className="h-8 text-xs gap-1.5 shrink-0" onClick={handleCreate} disabled={creating || !newName.trim()}>
          {creating ? <Loader2 className="size-3.5 animate-spin" /> : <Plus className="size-3.5" />}
          Ajouter
        </Button>
      </div>

      {/* Category list */}
      {categories.length === 0 ? (
        <div className="text-center py-6 text-muted-foreground text-sm">
          Aucune catégorie. Créez-en une ci-dessus.
        </div>
      ) : (
        <div className="rounded-md border max-h-64 overflow-y-auto">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="pl-3">Nom</TableHead>
                <TableHead>Langue</TableHead>
                <TableHead>Puzzles</TableHead>
                <TableHead className="text-right pr-3">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {categories.map((cat) => (
                <TableRow key={cat.id}>
                  <TableCell className="font-medium pl-3">
                    {editingId === cat.id ? (
                      <div className="flex items-center gap-1.5">
                        <Input
                          value={editIcon}
                          onChange={(e) => setEditIcon(e.target.value)}
                          className="h-7 text-sm w-12 text-center"
                          maxLength={4}
                          autoFocus
                        />
                        <Input
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && handleSaveEdit()}
                          className="h-7 text-sm w-full"
                        />
                      </div>
                    ) : (
                      <span className="flex items-center gap-1.5">
                        <span className="text-sm">{cat.icon || '🏷️'}</span>
                        {cat.name}
                      </span>
                    )}
                  </TableCell>
                  <TableCell>
                    {editingId === cat.id ? (
                      <Select value={editLanguage} onValueChange={setEditLanguage}>
                        <SelectTrigger className="h-7 text-xs w-24">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="fr">🇫🇷 FR</SelectItem>
                          <SelectItem value="en">🇬🇧 EN</SelectItem>
                        </SelectContent>
                      </Select>
                    ) : (
                      <Badge variant="outline" className="text-xs">
                        {languageLabel(cat.language)}
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-xs">
                    {cat._count.puzzles}
                  </TableCell>
                  <TableCell className="text-right pr-3">
                    <div className="flex items-center justify-end gap-1">
                      {editingId === cat.id ? (
                        <>
                          <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setEditingId(null)}>
                            Annuler
                          </Button>
                          <Button size="sm" className="h-7 text-xs gap-1" onClick={handleSaveEdit} disabled={saving}>
                            {saving ? <Loader2 className="size-3 animate-spin" /> : <Save className="size-3" />}
                            OK
                          </Button>
                        </>
                      ) : (
                        <>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 text-xs gap-1"
                            onClick={() => startEdit(cat)}
                          >
                            <Pencil className="size-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 text-xs gap-1 text-destructive hover:text-destructive"
                            onClick={() => setDeleteTarget(cat)}
                          >
                            <Trash2 className="size-3" />
                          </Button>
                        </>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer la catégorie</AlertDialogTitle>
            <AlertDialogDescription>
              Êtes-vous sûr de vouloir supprimer « {deleteTarget?.name} » ? Les puzzles associés ne seront pas supprimés mais seront décatégorisés.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

// --- Pack Management Sub-component ---

function PackManager({ packs, onRefresh }: { packs: PackItem[]; onRefresh: () => void }) {
  const [newName, setNewName] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newIcon, setNewIcon] = useState('📦');
  const [newLanguage, setNewLanguage] = useState('fr');
  const [creating, setCreating] = useState(false);

  // Edit state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editIcon, setEditIcon] = useState('');
  const [editLanguage, setEditLanguage] = useState('');
  const [saving, setSaving] = useState(false);

  // Delete state
  const [deleteTarget, setDeleteTarget] = useState<PackItem | null>(null);
  const [deleting, setDeleting] = useState(false);

  const handleCreate = async () => {
    if (!newName.trim()) return;
    setCreating(true);
    try {
      const res = await fetch('/api/packs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName.trim(), description: newDescription.trim() || null, icon: newIcon, language: newLanguage }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as { error?: string }).error || 'Erreur');
      }
      toast.success(`Collection « ${newName.trim()} » créée`);
      setNewName('');
      setNewDescription('');
      setNewIcon('📦');
      onRefresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur inconnue');
    } finally {
      setCreating(false);
    }
  };

  const startEdit = (pack: PackItem) => {
    setEditingId(pack.id);
    setEditName(pack.name);
    setEditDescription(pack.description || '');
    setEditIcon(pack.icon || '📦');
    setEditLanguage(pack.language);
  };

  const handleSaveEdit = async () => {
    if (!editingId || !editName.trim()) return;
    setSaving(true);
    try {
      const res = await fetch('/api/packs', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: editingId, name: editName.trim(), description: editDescription.trim() || null, icon: editIcon, language: editLanguage }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as { error?: string }).error || 'Erreur');
      }
      toast.success('Collection mise à jour');
      setEditingId(null);
      onRefresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur inconnue');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/packs?id=${deleteTarget.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Erreur lors de la suppression');
      toast.success(`Collection « ${deleteTarget.name} » supprimée`);
      setDeleteTarget(null);
      onRefresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur inconnue');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <>
      {/* Create new pack row */}
      <div className="flex flex-col sm:flex-row items-start sm:items-end gap-2 mb-4">
        <div className="w-16 sm:w-20 space-y-1">
          <Label className="text-xs text-muted-foreground">Icône</Label>
          <Input
            placeholder="📦"
            value={newIcon}
            onChange={(e) => setNewIcon(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
            className="h-8 text-sm text-center"
            maxLength={4}
          />
        </div>
        <div className="flex-1 w-full sm:w-auto space-y-1">
          <Label className="text-xs text-muted-foreground">Nom de la collection</Label>
          <Input
            placeholder="Ex: Pack Débutant, Science Quiz..."
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
            className="h-8 text-sm"
          />
        </div>
        <div className="flex-1 w-full sm:w-auto space-y-1">
          <Label className="text-xs text-muted-foreground">Description</Label>
          <Input
            placeholder="Description optionnelle"
            value={newDescription}
            onChange={(e) => setNewDescription(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
            className="h-8 text-sm"
          />
        </div>
        <div className="w-full sm:w-28 space-y-1">
          <Label className="text-xs text-muted-foreground">Langue</Label>
          <Select value={newLanguage} onValueChange={setNewLanguage}>
            <SelectTrigger className="h-8 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="fr">🇫🇷 Français</SelectItem>
              <SelectItem value="en">🇬🇧 English</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button size="sm" className="h-8 text-xs gap-1.5 shrink-0" onClick={handleCreate} disabled={creating || !newName.trim()}>
          {creating ? <Loader2 className="size-3.5 animate-spin" /> : <Plus className="size-3.5" />}
          Ajouter
        </Button>
      </div>

      {/* Pack list */}
      {packs.length === 0 ? (
        <div className="text-center py-6 text-muted-foreground text-sm">
          Aucune collection. Créez-en une ci-dessus.
        </div>
      ) : (
        <div className="rounded-md border max-h-64 overflow-y-auto">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="pl-3">Nom</TableHead>
                <TableHead>Langue</TableHead>
                <TableHead>Puzzles</TableHead>
                <TableHead className="text-right pr-3">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {packs.map((pack) => (
                <TableRow key={pack.id}>
                  <TableCell className="font-medium pl-3">
                    {editingId === pack.id ? (
                      <div className="flex items-center gap-1.5">
                        <Input
                          value={editIcon}
                          onChange={(e) => setEditIcon(e.target.value)}
                          className="h-7 text-sm w-12 text-center"
                          maxLength={4}
                          autoFocus
                        />
                        <Input
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && handleSaveEdit()}
                          className="h-7 text-sm w-full"
                        />
                      </div>
                    ) : (
                      <span className="flex items-center gap-1.5">
                        <span className="text-sm">{pack.icon || '📦'}</span>
                        {pack.name}
                      </span>
                    )}
                  </TableCell>
                  <TableCell>
                    {editingId === pack.id ? (
                      <Select value={editLanguage} onValueChange={setEditLanguage}>
                        <SelectTrigger className="h-7 text-xs w-24">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="fr">🇫🇷 FR</SelectItem>
                          <SelectItem value="en">🇬🇧 EN</SelectItem>
                        </SelectContent>
                      </Select>
                    ) : (
                      <Badge variant="outline" className="text-xs">
                        {languageLabel(pack.language)}
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-xs">
                    {pack._count.puzzles}
                  </TableCell>
                  <TableCell className="text-right pr-3">
                    <div className="flex items-center justify-end gap-1">
                      {editingId === pack.id ? (
                        <>
                          <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setEditingId(null)}>
                            Annuler
                          </Button>
                          <Button size="sm" className="h-7 text-xs gap-1" onClick={handleSaveEdit} disabled={saving}>
                            {saving ? <Loader2 className="size-3 animate-spin" /> : <Save className="size-3" />}
                            OK
                          </Button>
                        </>
                      ) : (
                        <>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 text-xs gap-1"
                            onClick={() => startEdit(pack)}
                          >
                            <Pencil className="size-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 text-xs gap-1 text-destructive hover:text-destructive"
                            onClick={() => setDeleteTarget(pack)}
                          >
                            <Trash2 className="size-3" />
                          </Button>
                        </>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer la collection</AlertDialogTitle>
            <AlertDialogDescription>
              Êtes-vous sûr de vouloir supprimer « {deleteTarget?.name} » ? Les puzzles associés ne seront pas supprimés mais seront dépubliés de la collection.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

// --- Auto Generator Sub-component ---

function PuzzleGenerator({ categories, packs, onGenerated }: {
  categories: CategoryItem[];
  packs: PackItem[];
  onGenerated: () => void;
}) {
  const [theme, setTheme] = useState('');
  const [language, setLanguage] = useState('fr');
  const [difficulty, setDifficulty] = useState('1');
  const [wordCount, setWordCount] = useState('11');
  const [gridSizePreset, setGridSizePreset] = useState('10x10');
  const [categoryId, setCategoryId] = useState('none');
  const [packId, setPackId] = useState('none');
  const [autoPublish, setAutoPublish] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState<{ id: string; title: string; rows: number; cols: number; wordsPlaced: number; wordsTotal: number } | null>(null);

  const gridSizePresets = [
    { id: '5x5', label: '5×5', icon: Grid2X2, words: 5, range: '3-6' },
    { id: '8x8', label: '8×8', icon: Grid3X3, words: 8, range: '5-10' },
    { id: '10x10', label: '10×10', icon: Grid3X3, words: 11, range: '7-14' },
    { id: '13x13', label: '13×13', icon: LayoutGrid, words: 15, range: '9-18' },
    { id: '15x15', label: '15×15', icon: LayoutGrid, words: 18, range: '10-22' },
    { id: '20x20', label: '20×20', icon: LayoutGrid, words: 24, range: '15-30' },
  ];

  const handleGridSizePreset = (presetId: string) => {
    setGridSizePreset(presetId);
    const preset = gridSizePresets.find(p => p.id === presetId);
    if (preset) setWordCount(String(preset.words));
  };

  const handleGenerate = async () => {
    if (!theme.trim()) {
      toast.error('Veuillez entrer un thème');
      return;
    }
    setGenerating(true);
    setResult(null);
    try {
      const res = await fetch('/api/puzzles/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          theme: theme.trim(),
          language,
          difficulty: parseInt(difficulty, 10),
          wordCount: parseInt(wordCount, 10),
          gridSize: { rows: parseInt(gridSizePreset.split('x')[0], 10), cols: parseInt(gridSizePreset.split('x')[1], 10) },
          categoryId: categoryId !== 'none' ? categoryId : null,
          packId: packId !== 'none' ? packId : null,
          autoPublish,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erreur lors de la génération');
      setResult(data.puzzle);
      toast.success(`Puzzle « ${data.puzzle.title} » généré avec succès !`);
      onGenerated();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur inconnue');
    } finally {
      setGenerating(false);
    }
  };

  const suggestions = language === 'fr'
    ? ['Villes africaines', 'Animaux de la savane', 'Inventions célèbres', 'Cuisine du monde', 'Sport olympique', 'Histoire de France', 'Astronomie', 'Musique classique']
    : ['World Capitals', 'African Wildlife', 'Space Exploration', 'Famous Scientists', 'Classic Literature', 'Olympic Sports', 'World Cuisine', 'Ancient History'];

  return (
    <div className="space-y-5">
      {/* Theme input */}
      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground font-medium">
          <Sparkles className="size-3.5 inline mr-1" />
          {language === 'fr' ? 'Thème du puzzle' : 'Puzzle Theme'}
        </Label>
        <Input
          placeholder={language === 'fr' ? 'Ex: Villes africaines, Sciences naturelles...'
            : 'e.g. World Capitals, Space Exploration...'}
          value={theme}
          onChange={(e) => setTheme(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleGenerate()}
          disabled={generating}
        />
        {/* Quick suggestions */}
        <div className="flex flex-wrap gap-1.5 mt-2">
          {suggestions.slice(0, 6).map((s) => (
            <button
              key={s}
              type="button"
              className="text-xs rounded-full border px-2.5 py-0.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
              onClick={() => setTheme(s)}
              disabled={generating}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Grid size preset buttons */}
      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground font-medium">Taille de la grille</Label>
        <div className="flex flex-wrap gap-1.5" role="group">
          {gridSizePresets.map((preset) => {
            const Icon = preset.icon;
            const isSelected = gridSizePreset === preset.id;
            return (
              <button
                key={preset.id}
                type="button"
                disabled={generating}
                onClick={() => handleGridSizePreset(preset.id)}
                className={`flex items-center gap-1.5 border rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors ${
                  isSelected
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'bg-background text-muted-foreground hover:bg-muted hover:text-foreground'
                } ${
                  generating ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
                }`}
              >
                <Icon className="size-3.5" />
                <span>{preset.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Settings grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Langue</Label>
          <Select value={language} onValueChange={setLanguage}>
            <SelectTrigger className="h-9 text-sm" disabled={generating}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="fr">🇫🇷 Français</SelectItem>
              <SelectItem value="en">🇬🇧 English</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Difficulté</Label>
          <Select value={difficulty} onValueChange={setDifficulty}>
            <SelectTrigger className="h-9 text-sm" disabled={generating}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1">{renderStars(1)} Facile</SelectItem>
              <SelectItem value="2">{renderStars(2)} Moyen</SelectItem>
              <SelectItem value="3">{renderStars(3)} Difficile</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Nb. mots</Label>
          <Select value={wordCount} onValueChange={setWordCount}>
            <SelectTrigger className="h-9 text-sm" disabled={generating}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,26,27,28,29,30].map(n => (
                <SelectItem key={n} value={String(n)}>{n} mots</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-[10px] text-muted-foreground">Plage : {gridSizePresets.find(p => p.id === gridSizePreset)?.range} mots</p>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Catégorie</Label>
          <Select value={categoryId} onValueChange={setCategoryId}>
            <SelectTrigger className="h-9 text-sm" disabled={generating}>
              <SelectValue placeholder="Aucune" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">— Aucune —</SelectItem>
              {categories
                .filter((c) => c.language === language)
                .map((cat) => (
                  <SelectItem key={cat.id} value={cat.id}>
                    {cat.icon} {cat.name}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Collection</Label>
          <Select value={packId} onValueChange={setPackId}>
            <SelectTrigger className="h-9 text-sm" disabled={generating}>
              <SelectValue placeholder="Aucune" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">— Aucune —</SelectItem>
              {packs
                .filter((p) => p.language === language)
                .map((pack) => (
                  <SelectItem key={pack.id} value={pack.id}>
                    {pack.icon} {pack.name}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-end gap-2">
          <div className="flex items-center gap-2 rounded-md border bg-muted/30 px-3 py-2">
            <Switch
              id="auto-publish"
              checked={autoPublish}
              onCheckedChange={setAutoPublish}
              disabled={generating}
              className="scale-90"
            />
            <Label htmlFor="auto-publish" className="text-xs text-muted-foreground cursor-pointer select-none whitespace-nowrap">
              Publier
            </Label>
          </div>
        </div>
      </div>

      {/* Generate button */}
      <div className="flex items-center gap-3">
        <Button
          onClick={handleGenerate}
          disabled={generating || !theme.trim()}
          className="gap-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white shadow-md"
        >
          {generating ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              Génération en cours…
            </>
          ) : (
            <>
              <Zap className="size-4" />
              Générer le puzzle
            </>
          )}
        </Button>
        {generating && (
          <p className="text-xs text-muted-foreground animate-pulse">
            {language === 'fr'
              ? 'L\'IA génère les mots et construit la grille…'
              : 'AI is generating words and building the grid…'}
          </p>
        )}
      </div>

      {/* Result card */}
      {result && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-lg border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/30 p-4"
        >
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle2 className="size-4 text-emerald-600" />
            <span className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">
              Puzzle généré avec succès !
            </span>
          </div>
          <div className="text-sm space-y-1">
            <p><span className="text-muted-foreground">Titre :</span> <span className="font-medium">{result.title}</span></p>
            <p><span className="text-muted-foreground">Grille :</span> <span className="font-medium">{result.rows}×{result.cols}</span></p>
            <p>
              <span className="text-muted-foreground">Mots :</span>{' '}
              <span className="font-medium">{result.wordsPlaced}/{result.wordsTotal}</span>{' '}
              <span className="text-xs text-muted-foreground">placés</span>
            </p>
            {!autoPublish && (
              <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                ⚠ Ce puzzle est en brouillon. Publiez-le depuis l\'onglet Puzzles.
              </p>
            )}
          </div>
        </motion.div>
      )}
    </div>
  );
}

// --- Main AdminPanel Component ---

export default function AdminPanel({ open, onOpenChange, isAdmin = false, isCreator = false }: AdminPanelProps) {
  // Data state
  const [data, setData] = useState<AdminData | null>(null);
  const [loading, setLoading] = useState(false);

  // Schedule editing state
  const [schedulePuzzlesPerDay, setSchedulePuzzlesPerDay] = useState(1);
  const [scheduleIsActive, setScheduleIsActive] = useState(false);
  const [savingSchedule, setSavingSchedule] = useState(false);

  // Date picker state
  const [datePickerPuzzleId, setDatePickerPuzzleId] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [savingDate, setSavingDate] = useState(false);

  // Publish/unpublish loading map
  const [togglingPuzzleIds, setTogglingPuzzleIds] = useState<Set<string>>(new Set());

  // Delete confirmation state
  const [deleteTarget, setDeleteTarget] = useState<PuzzleSummary | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Editor state
  const [editorOpen, setEditorOpen] = useState(false);
  const [editPuzzleId, setEditPuzzleId] = useState<string | null>(null);

  // Category filter for puzzle table
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [packFilter, setPackFilter] = useState<string>('all');
  const [languageFilter, setLanguageFilter] = useState<string>('all');

  // Expose fetchData for editor callback
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/puzzles/admin');
      if (!res.ok) {
        throw new Error('Erreur lors du chargement des données');
      }
      const json: AdminData = await res.json();
      setData(json);
      setSchedulePuzzlesPerDay(json.schedule.puzzlesPerDay);
      setScheduleIsActive(json.schedule.isActive);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur inconnue');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) {
      fetchData();
    }
  }, [open, fetchData]);

  // Reset state when dialog opens/closes
  useEffect(() => {
    if (!open) {
      setDatePickerPuzzleId(null);
      setSelectedDate(undefined);
    }
  }, [open]);

  // --- Handlers ---

  const handleSaveSchedule = async () => {
    setSavingSchedule(true);
    try {
      const res = await fetch('/api/puzzles/admin/schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          puzzlesPerDay: schedulePuzzlesPerDay,
          isActive: scheduleIsActive,
        }),
      });
      if (!res.ok) throw new Error('Erreur lors de la sauvegarde');
      toast.success('Programme de publication mis à jour');
      await fetchData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur inconnue');
    } finally {
      setSavingSchedule(false);
    }
  };

  const handleTogglePublish = async (puzzle: PuzzleSummary) => {
    const puzzleId = puzzle.id;
    const newPublished = !puzzle.published;

    setTogglingPuzzleIds((prev) => new Set(prev).add(puzzleId));
    setData((prev) =>
      prev
        ? {
            ...prev,
            puzzles: prev.puzzles.map((p) =>
              p.id === puzzleId
                ? {
                    ...p,
                    published: newPublished,
                    publishDate: newPublished
                      ? p.publishDate || new Date().toISOString()
                      : null,
                  }
                : p
            ),
          }
        : prev
    );

    try {
      const res = await fetch('/api/puzzles/admin/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ puzzleId, published: newPublished }),
      });
      if (!res.ok) throw new Error('Erreur lors de la modification');
      toast.success(newPublished ? 'Puzzle publié avec succès' : 'Puzzle dépublié avec succès');
      await fetchData();
    } catch (err) {
      setData((prev) =>
        prev
          ? {
              ...prev,
              puzzles: prev.puzzles.map((p) =>
                p.id === puzzleId
                  ? { ...p, published: !newPublished, publishDate: puzzle.publishDate }
                  : p
              ),
            }
          : prev
      );
      toast.error(err instanceof Error ? err.message : 'Erreur inconnue');
    } finally {
      setTogglingPuzzleIds((prev) => {
        const next = new Set(prev);
        next.delete(puzzleId);
        return next;
      });
    }
  };

  const handleOpenDatePicker = (puzzle: PuzzleSummary) => {
    setDatePickerPuzzleId(puzzle.id);
    setSelectedDate(puzzle.publishDate ? new Date(puzzle.publishDate) : undefined);
  };

  const handleSaveDate = async () => {
    if (!datePickerPuzzleId || !selectedDate) return;
    setSavingDate(true);
    try {
      const res = await fetch('/api/puzzles/admin/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          puzzleId: datePickerPuzzleId,
          published: true,
          publishDate: selectedDate.toISOString(),
        }),
      });
      if (!res.ok) throw new Error('Erreur lors de la mise à jour de la date');
      toast.success('Date de publication mise à jour');
      setDatePickerPuzzleId(null);
      setSelectedDate(undefined);
      await fetchData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur inconnue');
    } finally {
      setSavingDate(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/puzzles/admin?id=${deleteTarget.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Erreur lors de la suppression');
      toast.success(`« ${deleteTarget.title} » supprimé`);
      setDeleteTarget(null);
      await fetchData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur inconnue');
    } finally {
      setDeleting(false);
    }
  };

  const handlePuzzlesPerDayChange = (value: string) => {
    const num = parseInt(value, 10);
    if (!isNaN(num) && num >= 1 && num <= 10) {
      setSchedulePuzzlesPerDay(num);
    }
  };

  const openEditor = (puzzleId?: string) => {
    setEditPuzzleId(puzzleId ?? null);
    setEditorOpen(true);
  };

  const handleEditorSaved = () => {
    fetchData();
  };

  // Filtered puzzles
  const filteredPuzzles = useMemo(() => {
    if (!data) return [];
    let filtered = data.puzzles;
    if (categoryFilter !== 'all') {
      filtered = filtered.filter((p) => p.categoryId === categoryFilter);
    }
    if (packFilter !== 'all') {
      filtered = filtered.filter((p) => p.packId === packFilter);
    }
    if (languageFilter !== 'all') {
      filtered = filtered.filter((p) => p.language === languageFilter);
    }
    return filtered;
  }, [data, categoryFilter, packFilter, languageFilter]);

  // --- Render ---

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-5xl max-h-[90vh] overflow-y-auto p-0 gap-0">
          <DialogHeader className="p-6 pb-0">
            <DialogTitle className="text-xl font-bold flex items-center gap-2">
              <Settings className="size-5" />
              Administration
            </DialogTitle>
            <DialogDescription>
              Gérez vos catégories, collections, puzzles et programme de publication.
            </DialogDescription>
          </DialogHeader>

          <div className="p-6 space-y-6">
            <Tabs defaultValue={isCreator && !isAdmin ? 'generator' : 'categories'} className="w-full">
              <TabsList className={cn(
                'grid w-full',
                isAdmin ? 'grid-cols-5' : isCreator ? 'grid-cols-2' : 'grid-cols-1'
              )}>
                {isAdmin && (
                  <TabsTrigger value="categories" className="text-xs sm:text-sm gap-1.5">
                    <FolderOpen className="size-3.5" />
                    <span className="hidden sm:inline">Catégories</span>
                    <span className="sm:hidden">Catég.</span>
                  </TabsTrigger>
                )}
                {isAdmin && (
                  <TabsTrigger value="packs" className="text-xs sm:text-sm gap-1.5">
                    <Package className="size-3.5" />
                    <span className="hidden sm:inline">Collections</span>
                    <span className="sm:hidden">Coll.</span>
                  </TabsTrigger>
                )}
                {(isAdmin || isCreator) && (
                  <TabsTrigger value="puzzles" className="text-xs sm:text-sm gap-1.5">
                    <Grid3X3 className="size-3.5" />
                    Puzzles
                  </TabsTrigger>
                )}
                {(isAdmin || isCreator) && (
                  <TabsTrigger value="generator" className="text-xs sm:text-sm gap-1.5">
                    <Sparkles className="size-3.5" />
                    <span className="hidden sm:inline">Générateur</span>
                    <span className="sm:hidden">Gén.</span>
                  </TabsTrigger>
                )}
                {isAdmin && (
                  <TabsTrigger value="schedule" className="text-xs sm:text-sm gap-1.5">
                    <CalendarDays className="size-3.5" />
                    <span className="hidden sm:inline">Programme</span>
                    <span className="sm:hidden">Prog.</span>
                  </TabsTrigger>
                )}
              </TabsList>

              {/* ── Categories Tab ── */}
              <TabsContent value="categories" className="mt-4">
                <section className="rounded-lg border bg-muted/30 p-4">
                  <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
                    <Tag className="size-4 text-muted-foreground" />
                    Gestion des Catégories
                    <Badge variant="secondary" className="ml-1">
                      {data?.categories.length ?? 0}
                    </Badge>
                  </h3>

                  {loading && !data ? (
                    <CategorySkeleton />
                  ) : data ? (
                    <CategoryManager
                      categories={data.categories}
                      onRefresh={fetchData}
                    />
                  ) : null}
                </section>
              </TabsContent>

              {/* ── Packs Tab ── */}
              <TabsContent value="packs" className="mt-4">
                <section className="rounded-lg border bg-muted/30 p-4">
                  <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
                    <Package className="size-4 text-muted-foreground" />
                    Gestion des Collections
                    <Badge variant="secondary" className="ml-1">
                      {data?.packs.length ?? 0}
                    </Badge>
                  </h3>

                  {loading && !data ? (
                    <CategorySkeleton />
                  ) : data ? (
                    <PackManager
                      packs={data.packs}
                      onRefresh={fetchData}
                    />
                  ) : null}
                </section>
              </TabsContent>

              {/* ── Puzzles Tab ── */}
              <TabsContent value="puzzles" className="mt-4">
                <section>
                  {/* Filters and create button */}
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4">
                    <h3 className="text-sm font-semibold flex items-center gap-2">
                      <CalendarIcon className="size-4 text-muted-foreground" />
                      Tous les Puzzles
                      <Badge variant="secondary" className="ml-1">
                        {filteredPuzzles.length}
                      </Badge>
                    </h3>

                    <div className="flex items-center gap-2">
                      <Select value={languageFilter} onValueChange={setLanguageFilter}>
                        <SelectTrigger className="h-8 text-xs w-28">
                          <Languages className="size-3 mr-1" />
                          <SelectValue placeholder="Langue" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Toutes</SelectItem>
                          <SelectItem value="fr">🇫🇷 Français</SelectItem>
                          <SelectItem value="en">🇬🇧 English</SelectItem>
                        </SelectContent>
                      </Select>

                      <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                        <SelectTrigger className="h-8 text-xs w-36">
                          <FolderOpen className="size-3 mr-1" />
                          <SelectValue placeholder="Catégorie" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Toutes</SelectItem>
                          {data?.categories.map((cat) => (
                            <SelectItem key={cat.id} value={cat.id}>
                              {cat.icon || '🏷️'} {cat.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>

                      <Select value={packFilter} onValueChange={setPackFilter}>
                        <SelectTrigger className="h-8 text-xs w-36">
                          <Package className="size-3 mr-1" />
                          <SelectValue placeholder="Collection" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Toutes</SelectItem>
                          {data?.packs.map((pack) => (
                            <SelectItem key={pack.id} value={pack.id}>
                              {pack.icon || '📦'} {pack.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>

                      <Button size="sm" className="h-8 text-xs gap-1.5" onClick={() => openEditor()}>
                        <Plus className="size-3.5" />
                        Créer
                      </Button>
                    </div>
                  </div>

                  {loading && !data ? (
                    <TableSkeleton />
                  ) : filteredPuzzles.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground text-sm">
                      Aucun puzzle ne correspond aux filtres.
                    </div>
                  ) : (
                    <div className="rounded-md border max-h-96 overflow-y-auto">
                      <Table>
                        <TableHeader>
                          <TableRow className="hover:bg-transparent">
                            <TableHead className="pl-3">Titre</TableHead>
                            <TableHead>Catégorie</TableHead>
                            <TableHead>Collection</TableHead>
                            <TableHead>Langue</TableHead>
                            <TableHead>Difficulté</TableHead>
                            <TableHead className="hidden md:table-cell">Taille</TableHead>
                            <TableHead className="hidden lg:table-cell">Date</TableHead>
                            <TableHead>Statut</TableHead>
                            <TableHead className="text-right pr-3">Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {filteredPuzzles.map((puzzle) => {
                            const isToggling = togglingPuzzleIds.has(puzzle.id);
                            const isDatePicking = datePickerPuzzleId === puzzle.id;

                            return (
                              <TableRow key={puzzle.id}>
                                <TableCell className="font-medium pl-3 max-w-[140px] truncate">
                                  {puzzle.title}
                                </TableCell>

                                <TableCell>
                                  {puzzle.categoryName ? (
                                    <Badge variant="outline" className="text-xs gap-1">
                                      <span>{puzzle.categoryIcon || '🏷️'}</span>
                                      {puzzle.categoryName}
                                    </Badge>
                                  ) : (
                                    <span className="text-xs text-muted-foreground">—</span>
                                  )}
                                </TableCell>

                                <TableCell>
                                  {puzzle.packName ? (
                                    <Badge variant="outline" className="text-xs gap-1">
                                      <span>{puzzle.packIcon || '📦'}</span>
                                      {puzzle.packName}
                                    </Badge>
                                  ) : (
                                    <span className="text-xs text-muted-foreground">—</span>
                                  )}
                                </TableCell>

                                <TableCell>
                                  <Badge variant="outline" className="text-xs">
                                    {languageLabel(puzzle.language)}
                                  </Badge>
                                </TableCell>

                                <TableCell>{renderStars(puzzle.difficulty)}</TableCell>

                                <TableCell className="hidden md:table-cell text-muted-foreground text-xs">
                                  {puzzle.rows}×{puzzle.cols}
                                </TableCell>

                                <TableCell className="hidden lg:table-cell text-sm text-muted-foreground">
                                  {isDatePicking ? (
                                    <Popover open={isDatePicking} onOpenChange={(o) => !o && setDatePickerPuzzleId(null)}>
                                      <PopoverTrigger asChild>
                                        <Button variant="outline" size="sm" className="h-7 text-xs gap-1.5 font-normal">
                                          <CalendarIcon className="size-3" />
                                          {selectedDate ? format(selectedDate, 'dd MMM yyyy', { locale: fr }) : 'Choisir…'}
                                        </Button>
                                      </PopoverTrigger>
                                      <PopoverContent className="w-auto p-0" align="start">
                                        <Calendar mode="single" selected={selectedDate} onSelect={setSelectedDate} initialFocus />
                                        <div className="flex justify-end gap-2 border-t p-2">
                                          <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setDatePickerPuzzleId(null)}>
                                            Annuler
                                          </Button>
                                          <Button size="sm" className="h-7 text-xs" onClick={handleSaveDate} disabled={!selectedDate || savingDate}>
                                            {savingDate ? <Loader2 className="size-3 animate-spin" /> : <Save className="size-3" />}
                                            OK
                                          </Button>
                                        </div>
                                      </PopoverContent>
                                    </Popover>
                                  ) : (
                                    <span>{formatDate(puzzle.publishDate)}</span>
                                  )}
                                </TableCell>

                                <TableCell>
                                  {puzzle.published ? (
                                    <Badge variant="default" className="bg-emerald-600 hover:bg-emerald-700 text-white border-transparent gap-1">
                                      <CheckCircle2 className="size-3" />
                                      <span className="hidden sm:inline">Publié</span>
                                    </Badge>
                                  ) : (
                                    <Badge variant="secondary" className="gap-1 text-muted-foreground">
                                      <CircleOff className="size-3" />
                                      <span className="hidden sm:inline">Brouillon</span>
                                    </Badge>
                                  )}
                                </TableCell>

                                <TableCell className="text-right pr-3">
                                  <div className="flex items-center justify-end gap-1">
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-7 text-xs gap-1.5"
                                      onClick={() => openEditor(puzzle.id)}
                                      title="Modifier"
                                    >
                                      <Pencil className="size-3" />
                                      <span className="hidden xl:inline">Modifier</span>
                                    </Button>
                                    <Button
                                      variant={puzzle.published ? 'outline' : 'default'}
                                      size="sm"
                                      className="h-7 text-xs gap-1.5"
                                      onClick={() => handleTogglePublish(puzzle)}
                                      disabled={isToggling}
                                    >
                                      {isToggling ? (
                                        <Loader2 className="size-3 animate-spin" />
                                      ) : puzzle.published ? (
                                        <EyeOff className="size-3" />
                                      ) : (
                                        <Eye className="size-3" />
                                      )}
                                      <span className="hidden xl:inline">{puzzle.published ? 'Dépublier' : 'Publier'}</span>
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-7 text-xs gap-1.5"
                                      onClick={() => handleOpenDatePicker(puzzle)}
                                      disabled={isToggling || isDatePicking}
                                      title="Date"
                                    >
                                      <CalendarDays className="size-3" />
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-7 text-xs gap-1.5 text-destructive hover:text-destructive"
                                      onClick={() => setDeleteTarget(puzzle)}
                                    >
                                      <Trash2 className="size-3" />
                                    </Button>
                                  </div>
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </section>
              </TabsContent>

              {/* ── Generator Tab ── */}
              <TabsContent value="generator" className="mt-4">
                <section className="rounded-lg border bg-muted/30 p-4">
                  <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
                    <Sparkles className="size-4 text-emerald-500" />
                    Générateur Automatique
                    <Badge variant="secondary" className="ml-1 bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400">
                      IA
                    </Badge>
                  </h3>
                  <p className="text-xs text-muted-foreground mb-4">
                    Générez un puzzle de mots croisés automatiquement grâce à l'intelligence artificielle.
                    Entrez un thème et l'IA créera les mots et indices, puis construira la grille.
                  </p>

                  {loading && !data ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="size-6 animate-spin text-muted-foreground" />
                    </div>
                  ) : data ? (
                    <PuzzleGenerator
                      categories={data.categories}
                      packs={data.packs}
                      onGenerated={fetchData}
                    />
                  ) : null}
                </section>
              </TabsContent>

              {/* ── Schedule Tab ── */}
              <TabsContent value="schedule" className="mt-4">
                <section className="rounded-lg border bg-muted/30 p-4">
                  <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
                    <CalendarDays className="size-4 text-muted-foreground" />
                    Programme de Publication
                  </h3>

                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="schedule-active" className="text-sm font-medium">
                        Publication automatique active
                      </Label>
                      <Switch
                        id="schedule-active"
                        checked={scheduleIsActive}
                        onCheckedChange={setScheduleIsActive}
                      />
                    </div>

                    <div className="flex items-center gap-3">
                      <Label htmlFor="puzzles-per-day" className="text-sm font-medium whitespace-nowrap">
                        Puzzles par jour
                      </Label>
                      <Input
                        id="puzzles-per-day"
                        type="number"
                        min={1}
                        max={10}
                        value={schedulePuzzlesPerDay}
                        onChange={(e) => handlePuzzlesPerDayChange(e.target.value)}
                        className="w-20 h-9 text-center"
                        disabled={!scheduleIsActive}
                      />
                    </div>

                    <div className="flex justify-end pt-1">
                      <Button size="sm" onClick={handleSaveSchedule} disabled={savingSchedule}>
                        {savingSchedule ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
                        Enregistrer
                      </Button>
                    </div>
                  </div>
                </section>
              </TabsContent>
            </Tabs>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Puzzle Editor Dialog ──────────────────────────────── */}
      <PuzzleEditor
        open={editorOpen}
        onOpenChange={setEditorOpen}
        editPuzzleId={editPuzzleId}
        onSaved={handleEditorSaved}
      />

      {/* ── Delete Confirmation Dialog ────────────────────────── */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer le puzzle</AlertDialogTitle>
            <AlertDialogDescription>
              Êtes-vous sûr de vouloir supprimer « {deleteTarget?.title} » ? Cette action est irréversible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}


