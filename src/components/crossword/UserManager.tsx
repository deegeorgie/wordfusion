'use client';

import { useState, useEffect, useCallback } from 'react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import {
  Search,
  Shield,
  Eye,
  Pencil,
  Trash2,
  User,
  Mail,
  Phone,
  MapPin,
  Calendar,
  Building2,
  GraduationCap,
  Loader2,
  X,
} from 'lucide-react';

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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
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
import { Input } from '@/components/ui/input';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';

// --- Types ---

interface UserCount {
  puzzles: number;
}

interface UserData {
  id: string;
  name: string | null;
  email: string | null;
  role: 'USER' | 'CREATOR' | 'ADMIN';
  provider: string | null;
  phone: string | null;
  dateOfBirth: string | null;
  gender: 'male' | 'female' | 'other' | 'prefer_not_to_say' | null;
  country: string | null;
  city: string | null;
  occupation: string | null;
  education:
    | 'none'
    | 'primary'
    | 'secondary'
    | 'bachelor'
    | 'master'
    | 'doctorate'
    | 'other'
    | null;
  createdAt: string;
  _count: UserCount;
}

// --- Label maps ---

const ROLE_LABELS: Record<string, string> = {
  USER: 'Joueur',
  CREATOR: 'Créateur',
  ADMIN: 'Administrateur',
};

const GENDER_LABELS: Record<string, string> = {
  male: 'Homme',
  female: 'Femme',
  other: 'Autre',
  prefer_not_to_say: 'Non précisé',
};

const EDUCATION_LABELS: Record<string, string> = {
  none: 'Aucun',
  primary: 'Primaire',
  secondary: 'Secondaire',
  bachelor: 'Licence',
  master: 'Master',
  doctorate: 'Doctorat',
  other: 'Autre',
};

// --- Helpers ---

function getRoleBadgeClasses(role: string): string {
  switch (role) {
    case 'ADMIN':
      return 'bg-red-100 text-red-800 border-red-200 hover:bg-red-100';
    case 'CREATOR':
      return 'bg-amber-100 text-amber-800 border-amber-200 hover:bg-amber-100';
    case 'USER':
    default:
      return 'bg-emerald-100 text-emerald-800 border-emerald-200 hover:bg-emerald-100';
  }
}

function formatDate(dateStr: string): string {
  try {
    return format(new Date(dateStr), 'dd MMMM yyyy', { locale: fr });
  } catch {
    return dateStr;
  }
}

// --- Component ---

export default function UserManager() {
  const [users, setUsers] = useState<UserData[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  // Detail dialog
  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserData | null>(null);

  // Role change dialog
  const [roleDialogOpen, setRoleDialogOpen] = useState(false);
  const [roleTarget, setRoleTarget] = useState<UserData | null>(null);
  const [newRole, setNewRole] = useState<string>('');

  // Delete confirmation
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<UserData | null>(null);

  // --- Data fetching ---

  const fetchUsers = useCallback(async (query?: string) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (query && query.trim()) {
        params.set('search', query.trim());
      }
      const res = await fetch(`/api/admin/users?${params.toString()}`);
      if (!res.ok) throw new Error('Erreur de chargement');
      const data = await res.json();
      setUsers(data.users ?? []);
    } catch (err) {
      console.error('Erreur lors du chargement des utilisateurs :', err);
      setUsers([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  // --- Search with debounce ---

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchUsers(search);
    }, 400);
    return () => clearTimeout(timer);
  }, [search, fetchUsers]);

  // --- Actions ---

  function openDetail(user: UserData) {
    setSelectedUser(user);
    setDetailOpen(true);
  }

  function openRoleDialog(user: UserData) {
    setRoleTarget(user);
    setNewRole(user.role);
    setRoleDialogOpen(true);
  }

  function openDeleteDialog(user: UserData) {
    setDeleteTarget(user);
    setDeleteDialogOpen(true);
  }

  async function handleRoleChange() {
    if (!roleTarget || !newRole || newRole === roleTarget.role) {
      setRoleDialogOpen(false);
      return;
    }
    setActionLoading(true);
    try {
      const res = await fetch('/api/admin/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'updateRole',
          userId: roleTarget.id,
          role: newRole,
        }),
      });
      if (!res.ok) throw new Error('Erreur de mise à jour');
      setRoleDialogOpen(false);
      fetchUsers(search);
    } catch (err) {
      console.error('Erreur lors du changement de rôle :', err);
    } finally {
      setActionLoading(false);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setActionLoading(true);
    try {
      const res = await fetch('/api/admin/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'delete',
          userId: deleteTarget.id,
        }),
      });
      if (!res.ok) throw new Error('Erreur de suppression');
      setDeleteDialogOpen(false);
      fetchUsers(search);
    } catch (err) {
      console.error('Erreur lors de la suppression :', err);
    } finally {
      setActionLoading(false);
    }
  }

  // --- Render helpers ---

  function renderSkeleton() {
    return (
      <div className="space-y-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex items-center space-x-4">
            <Skeleton className="h-4 w-[140px]" />
            <Skeleton className="h-4 w-[180px] hidden md:block" />
            <Skeleton className="h-5 w-[80px]" />
            <Skeleton className="h-4 w-[120px] hidden lg:block" />
            <Skeleton className="h-4 w-[110px] hidden md:block" />
            <Skeleton className="h-8 w-[90px]" />
          </div>
        ))}
      </div>
    );
  }

  function renderUserInfoRow(
    icon: React.ReactNode,
    label: string,
    value: string | null | undefined
  ) {
    return (
      <div className="flex items-start gap-3 py-2">
        <span className="text-muted-foreground mt-0.5 shrink-0">{icon}</span>
        <div>
          <p className="text-xs text-muted-foreground font-medium">{label}</p>
          <p className="text-sm">{value ?? <span className="italic text-muted-foreground">Non renseigné</span>}</p>
        </div>
      </div>
    );
  }

  return (
    <TooltipProvider>
      <div className="space-y-6">
        {/* Search bar */}
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Rechercher par nom, email, ville ou pays…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 pr-9"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Table */}
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="min-w-[160px]">Nom</TableHead>
                <TableHead className="hidden md:table-cell min-w-[200px]">
                  Email
                </TableHead>
                <TableHead className="min-w-[120px]">Rôle</TableHead>
                <TableHead className="hidden lg:table-cell min-w-[140px]">
                  Pays / Ville
                </TableHead>
                <TableHead className="hidden md:table-cell min-w-[140px]">
                  Inscription
                </TableHead>
                <TableHead className="text-right min-w-[120px]">
                  Actions
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={6}>{renderSkeleton()}</TableCell>
                </TableRow>
              ) : users.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-32 text-center text-muted-foreground">
                    Aucun utilisateur trouvé.
                  </TableCell>
                </TableRow>
              ) : (
                users.map((user) => (
                  <TableRow key={user.id}>
                    {/* Name – clickable */}
                    <TableCell>
                      <button
                        onClick={() => openDetail(user)}
                        className="font-medium text-left hover:underline underline-offset-2 cursor-pointer"
                      >
                        {user.name ?? <span className="italic text-muted-foreground">Sans nom</span>}
                      </button>
                    </TableCell>

                    {/* Email – hidden on small screens */}
                    <TableCell className="hidden md:table-cell text-muted-foreground">
                      {user.email ?? '—'}
                    </TableCell>

                    {/* Role badge */}
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={getRoleBadgeClasses(user.role)}
                      >
                        <Shield className="h-3 w-3 mr-1" />
                        {ROLE_LABELS[user.role] ?? user.role}
                      </Badge>
                    </TableCell>

                    {/* Country/City – hidden on small screens */}
                    <TableCell className="hidden lg:table-cell text-muted-foreground">
                      {user.city || user.country
                        ? [user.city, user.country].filter(Boolean).join(', ')
                        : '—'}
                    </TableCell>

                    {/* Registration date – hidden on small screens */}
                    <TableCell className="hidden md:table-cell text-muted-foreground">
                      {formatDate(user.createdAt)}
                    </TableCell>

                    {/* Actions */}
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => openDetail(user)}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Voir les détails</TooltipContent>
                        </Tooltip>

                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => openRoleDialog(user)}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Modifier le rôle</TooltipContent>
                        </Tooltip>

                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-destructive hover:text-destructive"
                              onClick={() => openDeleteDialog(user)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Supprimer</TooltipContent>
                        </Tooltip>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {/* ---- Detail Dialog ---- */}
        <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                Détails de l'utilisateur
              </DialogTitle>
              <DialogDescription>
                Informations complètes sur {selectedUser?.name ?? 'cet utilisateur'}.
              </DialogDescription>
            </DialogHeader>

            {selectedUser && (
              <ScrollArea className="max-h-[70vh] pr-2">
                <div className="space-y-1 px-1">
                  {/* Name */}
                  {renderUserInfoRow(
                    <User className="h-4 w-4" />,
                    'Nom',
                    selectedUser.name
                  )}

                  {/* Email */}
                  {renderUserInfoRow(
                    <Mail className="h-4 w-4" />,
                    'Email',
                    selectedUser.email
                  )}

                  {/* Role */}
                  <div className="flex items-start gap-3 py-2">
                    <span className="text-muted-foreground mt-0.5 shrink-0">
                      <Shield className="h-4 w-4" />
                    </span>
                    <div>
                      <p className="text-xs text-muted-foreground font-medium">Rôle</p>
                      <Badge
                        variant="outline"
                        className={getRoleBadgeClasses(selectedUser.role)}
                      >
                        {ROLE_LABELS[selectedUser.role] ?? selectedUser.role}
                      </Badge>
                    </div>
                  </div>

                  {/* Provider */}
                  {renderUserInfoRow(
                    <Shield className="h-4 w-4" />,
                    'Fournisseur d\'authentification',
                    selectedUser.provider
                  )}

                  {/* Phone */}
                  {renderUserInfoRow(
                    <Phone className="h-4 w-4" />,
                    'Téléphone',
                    selectedUser.phone
                  )}

                  {/* Date of birth */}
                  {renderUserInfoRow(
                    <Calendar className="h-4 w-4" />,
                    'Date de naissance',
                    selectedUser.dateOfBirth
                      ? formatDate(selectedUser.dateOfBirth)
                      : null
                  )}

                  {/* Gender */}
                  {renderUserInfoRow(
                    <User className="h-4 w-4" />,
                    'Genre',
                    selectedUser.gender
                      ? GENDER_LABELS[selectedUser.gender]
                      : null
                  )}

                  {/* Country */}
                  {renderUserInfoRow(
                    <MapPin className="h-4 w-4" />,
                    'Pays',
                    selectedUser.country
                  )}

                  {/* City */}
                  {renderUserInfoRow(
                    <MapPin className="h-4 w-4" />,
                    'Ville',
                    selectedUser.city
                  )}

                  {/* Occupation */}
                  {renderUserInfoRow(
                    <Building2 className="h-4 w-4" />,
                    'Profession',
                    selectedUser.occupation
                  )}

                  {/* Education */}
                  {renderUserInfoRow(
                    <GraduationCap className="h-4 w-4" />,
                    'Niveau d\'études',
                    selectedUser.education
                      ? EDUCATION_LABELS[selectedUser.education]
                      : null
                  )}

                  {/* Registration date */}
                  {renderUserInfoRow(
                    <Calendar className="h-4 w-4" />,
                    'Date d\'inscription',
                    formatDate(selectedUser.createdAt)
                  )}

                  {/* Puzzles count */}
                  <div className="flex items-start gap-3 py-2">
                    <span className="text-muted-foreground mt-0.5 shrink-0">
                      <GraduationCap className="h-4 w-4" />
                    </span>
                    <div>
                      <p className="text-xs text-muted-foreground font-medium">
                        Mots croisés créés
                      </p>
                      <p className="text-sm">
                        {selectedUser._count?.puzzles ?? 0}
                      </p>
                    </div>
                  </div>
                </div>
              </ScrollArea>
            )}
          </DialogContent>
        </Dialog>

        {/* ---- Role Change Dialog ---- */}
        <Dialog open={roleDialogOpen} onOpenChange={setRoleDialogOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Pencil className="h-5 w-5" />
                Modifier le rôle
              </DialogTitle>
              <DialogDescription>
                Changez le rôle de{' '}
                <span className="font-semibold text-foreground">
                  {roleTarget?.name ?? roleTarget?.email ?? 'cet utilisateur'}
                </span>
                .
              </DialogDescription>
            </DialogHeader>

            <div className="py-4">
              <label className="text-sm font-medium mb-2 block">
                Nouveau rôle
              </label>
              <Select value={newRole} onValueChange={setNewRole}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Sélectionner un rôle" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="USER">
                    <span className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full bg-emerald-500" />
                      Joueur
                    </span>
                  </SelectItem>
                  <SelectItem value="CREATOR">
                    <span className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full bg-amber-500" />
                      Créateur
                    </span>
                  </SelectItem>
                  <SelectItem value="ADMIN">
                    <span className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full bg-red-500" />
                      Administrateur
                    </span>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => setRoleDialogOpen(false)}
                disabled={actionLoading}
              >
                Annuler
              </Button>
              <Button
                onClick={handleRoleChange}
                disabled={actionLoading || !newRole || newRole === roleTarget?.role}
              >
                {actionLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Enregistrer
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* ---- Delete Confirmation Dialog ---- */}
        <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2">
                <Trash2 className="h-5 w-5 text-destructive" />
                Supprimer l'utilisateur
              </AlertDialogTitle>
              <AlertDialogDescription>
                Êtes-vous sûr de vouloir supprimer{' '}
                <span className="font-semibold text-foreground">
                  {deleteTarget?.name ?? deleteTarget?.email ?? 'cet utilisateur'}
                </span>
                {' '}? Cette action est irréversible. Tous les mots croisés créés par cet
                utilisateur seront également supprimés.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={actionLoading}>
                Annuler
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDelete}
                disabled={actionLoading}
                className="bg-destructive text-white hover:bg-destructive/90"
              >
                {actionLoading ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : null}
                Supprimer
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </TooltipProvider>
  );
}
