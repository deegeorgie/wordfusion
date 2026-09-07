"use client";

import * as React from "react";
import { motion } from "framer-motion";
import {
  Award,
  Lock,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import {
  ALL_BADGES,
  evaluateBadges,
  type EarnedBadge,
  type BadgeDefinition,
  type BadgeCategory,
  type StreakCompletion,
} from "@/lib/crossword/badges";

// ---------- types ----------

interface BadgePanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId?: string;
}

// ---------- constants ----------

const STORAGE_KEY = "crossword-streak-data";

const CATEGORY_META: {
  key: BadgeCategory;
  label: string;
  icon: string;
  bg: string;
}[] = [
  { key: "progression", label: "Progression", icon: "📈", bg: "bg-emerald-500/5" },
  { key: "speed",      label: "Vitesse",     icon: "⏱️", bg: "bg-amber-500/5" },
  { key: "streak",     label: "Séries",      icon: "🔥", bg: "bg-orange-500/5" },
  { key: "mastery",    label: "Maîtrise",    icon: "🎯", bg: "bg-violet-500/5" },
  { key: "special",    label: "Spécial",     icon: "✨", bg: "bg-sky-500/5" },
];

// ---------- helpers ----------

function loadData(userId?: string): StreakCompletion[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(userId ? `${STORAGE_KEY}:${userId}` : `${STORAGE_KEY}:anonymous`);
    if (!raw) return [];
    return JSON.parse(raw) as StreakCompletion[];
  } catch {
    return [];
  }
}

function formatEarnedDate(isoDate: string): string {
  return new Date(isoDate + "T00:00:00").toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

// ---------- sub-components ----------

function BadgeCard({
  badge,
  earned,
  index,
}: {
  badge: BadgeDefinition;
  earned: EarnedBadge | undefined;
  index: number;
}) {
  const isEarned = !!earned;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: index * 0.06 }}
    >
      <Card
        className={cn(
          "relative overflow-hidden transition-shadow hover:shadow-md",
          isEarned && "border-l-4 border-l-amber-400/70"
        )}
      >
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            {/* Emoji icon */}
            <div className="relative shrink-0">
              <span
                className="text-3xl leading-none inline-block"
                style={!isEarned ? { filter: "grayscale(1) opacity(0.4)" } : undefined}
              >
                {badge.icon}
              </span>
              {!isEarned && (
                <span className="absolute -right-1 -bottom-1 text-muted-foreground">
                  <Lock className="size-3.5" />
                </span>
              )}
            </div>

            {/* Text content */}
            <div className="min-w-0 flex-1">
              <p
                className={cn(
                  "font-semibold text-sm leading-tight",
                  isEarned ? "text-foreground" : "text-muted-foreground"
                )}
              >
                {badge.name}
              </p>
              <p
                className={cn(
                  "text-xs mt-0.5 leading-snug",
                  isEarned ? "text-muted-foreground" : "text-muted-foreground/60"
                )}
              >
                {badge.description}
              </p>
              {isEarned && earned ? (
                <p className="text-[11px] mt-1.5 text-emerald-600 font-medium">
                  Débloqué le {formatEarnedDate(earned.earnedAt)}
                </p>
              ) : (
                <p className="text-[11px] mt-1.5 text-muted-foreground/50 italic">
                  Non débloqué
                </p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

// ---------- main component ----------

export function BadgePanel({ open, onOpenChange, userId }: BadgePanelProps) {
  const [earnedBadges, setEarnedBadges] = React.useState<EarnedBadge[]>([]);

  React.useEffect(() => {
    if (open) {
      const completions = loadData(userId);
      setEarnedBadges(evaluateBadges(completions));
    }
  }, [open, userId]);

  const earnedSet = React.useMemo(
    () => new Set(earnedBadges.map((b) => b.id)),
    [earnedBadges]
  );

  const earnedCount = earnedBadges.length;
  const totalCount = ALL_BADGES.length;

  // Group badges by category, preserving order from CATEGORY_META
  const categories = React.useMemo(() => {
    let idx = 0;
    return CATEGORY_META.map((cat) => {
      const badges = ALL_BADGES.filter((b) => b.category === cat.key);
      const mapped = badges.map((b) => ({ badge: b, index: idx++ }));
      return { ...cat, badges: mapped };
    });
  }, []);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-hidden flex flex-col gap-0 p-0">
        {/* Header */}
        <div className="px-6 pt-6 pb-4">
          <DialogHeader>
            <DialogTitle className="text-xl flex items-center gap-2">
              <Award className="size-5 text-amber-500" />
              Mes Badges
            </DialogTitle>
            <DialogDescription>
              <span className="font-medium text-foreground">
                {earnedCount}/{totalCount} débloqués
              </span>
              {" — "}Découvrez vos accomplissements
            </DialogDescription>
          </DialogHeader>
        </div>

        <ScrollArea className="flex-1 px-6 pb-6">
          <div className="space-y-6 pr-4">
            {categories.map((cat, catIdx) => (
              <React.Fragment key={cat.key}>
                {catIdx > 0 && <Separator />}
                <div>
                  <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                    <span>{cat.icon}</span>
                    <span>{cat.label}</span>
                    <Badge
                      variant="secondary"
                      className="ml-1 text-xs tabular-nums"
                    >
                      {cat.badges.filter(({ badge }) => earnedSet.has(badge.id)).length}/{cat.badges.length}
                    </Badge>
                  </h3>
                  <div
                    className={cn(
                      "grid grid-cols-2 lg:grid-cols-3 gap-3 rounded-xl p-3 -mx-1",
                      cat.bg
                    )}
                  >
                    {cat.badges.map(({ badge, index }) => (
                      <BadgeCard
                        key={badge.id}
                        badge={badge}
                        earned={earnedBadges.find((e) => e.id === badge.id)}
                        index={index}
                      />
                    ))}
                  </div>
                </div>
              </React.Fragment>
            ))}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
