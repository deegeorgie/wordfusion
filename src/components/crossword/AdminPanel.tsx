'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import {
  CalendarIcon,
  CheckCircle2,
  CircleOff,
  Loader2,
  Pencil,
  Plus,
  Save,
  Star,
  CalendarDays,
  EyeOff,
  Eye,
  Trash2,
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
import { Separator } from '@/components/ui/separator';

import PuzzleEditor from '@/components/crossword/PuzzleEditor';

// --- Types ---

interface PuzzleSummary {
  id: string;
  title: string;
  difficulty: number;
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
}

interface AdminPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
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

// --- Skeleton ---

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

function ScheduleSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-5 w-48" />
      <div className="flex items-center justify-between">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-5 w-9" />
      </div>
      <div className="flex items-center gap-3">
        <Skeleton className="h-4 w-28" />
        <Skeleton className="h-9 w-16" />
      </div>
    </div>
  );
}

// --- Component ---

export default function AdminPanel({ open, onOpenChange }: AdminPanelProps) {
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

  // --- Render ---

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto p-0 gap-0">
          <DialogHeader className="p-6 pb-0">
            <DialogTitle className="text-xl font-bold">Gestion des Puzzles</DialogTitle>
            <DialogDescription>
              Gérez la publication et le programme de vos mots croisés.
            </DialogDescription>
          </DialogHeader>

          <div className="p-6 space-y-6">
            {/* --- Publishing Schedule Section --- */}
            <section className="rounded-lg border bg-muted/30 p-4">
              <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
                <CalendarDays className="size-4 text-muted-foreground" />
                Programme de Publication
              </h3>

              {loading && !data ? (
                <ScheduleSkeleton />
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="schedule-active" className="text-sm font-medium">
                      Actif
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
              )}
            </section>

            <Separator />

            {/* --- Puzzle List Section --- */}
            <section>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold flex items-center gap-2">
                  <CalendarIcon className="size-4 text-muted-foreground" />
                  Tous les Puzzles
                  {data && (
                    <Badge variant="secondary" className="ml-1">
                      {data.puzzles.length}
                    </Badge>
                  )}
                </h3>

                <Button size="sm" className="h-8 text-xs gap-1.5" onClick={() => openEditor()}>
                  <Plus className="size-3.5" />
                  Créer un puzzle
                </Button>
              </div>

              {loading && !data ? (
                <TableSkeleton />
              ) : data && data.puzzles.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground text-sm">
                  Aucun puzzle disponible.
                </div>
              ) : data ? (
                <div className="rounded-md border max-h-96 overflow-y-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="hover:bg-transparent">
                        <TableHead className="pl-3">Titre</TableHead>
                        <TableHead>Difficulté</TableHead>
                        <TableHead>Taille</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead>Statut</TableHead>
                        <TableHead className="text-right pr-3">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.puzzles.map((puzzle) => {
                        const isToggling = togglingPuzzleIds.has(puzzle.id);
                        const isDatePicking = datePickerPuzzleId === puzzle.id;

                        return (
                          <TableRow key={puzzle.id}>
                            <TableCell className="font-medium pl-3 max-w-[180px] truncate">
                              {puzzle.title}
                            </TableCell>

                            <TableCell>{renderStars(puzzle.difficulty)}</TableCell>

                            <TableCell className="text-muted-foreground text-xs">
                              {puzzle.rows}×{puzzle.cols}
                            </TableCell>

                            <TableCell className="text-sm text-muted-foreground">
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
                                        Enregistrer
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
                                  Publié
                                </Badge>
                              ) : (
                                <Badge variant="secondary" className="gap-1 text-muted-foreground">
                                  <CircleOff className="size-3" />
                                  Non publié
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
                                  title="Modifier le puzzle"
                                >
                                  <Pencil className="size-3" />
                                  <span className="hidden sm:inline">Modifier</span>
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
                                  {puzzle.published ? 'Dépublier' : 'Publier'}
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 text-xs gap-1.5"
                                  onClick={() => handleOpenDatePicker(puzzle)}
                                  disabled={isToggling || isDatePicking}
                                >
                                  <CalendarDays className="size-3" />
                                  Date
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
              ) : null}
            </section>
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
