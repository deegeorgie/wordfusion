"use client";

import * as React from "react";
import { motion, useSpring, useTransform, useMotionValue } from "framer-motion";
import {
  BarChart3,
  Trophy,
  Flame,
  Clock,
  Target,
  TrendingUp,
  Calendar,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

// ---------- types ----------

interface StreakCompletion {
  date: string;
  puzzleId: string;
  time: number;
  difficulty: number;
  title: string;
  language: string;
}

interface StatsPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// ---------- helpers ----------

const STORAGE_KEY = "crossword-streak-data";

function loadData(): StreakCompletion[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as StreakCompletion[];
  } catch {
    return [];
  }
}

function toLocaleDate(d: string): string {
  return new Date(d + "T00:00:00").toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatTime(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)}s`;
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return `${m} min ${s}s`;
}

function getDifficultyLabel(d: number): string {
  if (d <= 1) return "Facile";
  if (d === 2) return "Moyen";
  return "Difficile";
}

function getDifficultyColor(d: number): string {
  if (d <= 1) return "bg-emerald-500/15 text-emerald-600 border-emerald-500/25";
  if (d === 2) return "bg-amber-500/15 text-amber-600 border-amber-500/25";
  return "bg-orange-500/15 text-orange-600 border-orange-500/25";
}

function getLanguageFlag(lang: string): string {
  return lang === "en" ? "\u{1F1EC}\u{1F1E7}" : "\u{1F1EB}\u{1F1F7}";
}

function dateKey(d: string): string {
  // Normalise ISO date string to YYYY-MM-DD
  return d.slice(0, 10);
}

function todayKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function yesterdayKey(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function prevDay(key: string): string {
  const d = new Date(key + "T00:00:00");
  d.setDate(d.getDate() - 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// ---------- calculation functions ----------

function calcCurrentStreak(dates: Set<string>): number {
  const today = todayKey();
  const yesterday = yesterdayKey();
  if (!dates.has(today) && !dates.has(yesterday)) return 0;

  let streak = 0;
  let check = dates.has(today) ? today : yesterday;
  while (dates.has(check)) {
    streak++;
    check = prevDay(check);
  }
  return streak;
}

function calcBestStreak(dates: Set<string>): number {
  const sorted = Array.from(dates).sort();
  if (sorted.length === 0) return 0;

  let best = 1;
  let current = 1;
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i] === prevDay(sorted[i - 1])) {
      current++;
      if (current > best) best = current;
    } else {
      current = 1;
    }
  }
  return best;
}

function getLast14DaysData(
  completions: StreakCompletion[]
): { day: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const c of completions) {
    const key = dateKey(c.date);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  const result: { day: string; count: number }[] = [];
  for (let i = 13; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    const label = d.toLocaleDateString("fr-FR", { weekday: "short", day: "numeric" });
    result.push({ day: label, count: counts.get(key) ?? 0 });
  }
  return result;
}

function getDifficultyDistribution(
  completions: StreakCompletion[]
): { name: string; value: number; color: string }[] {
  const counts = { Facile: 0, Moyen: 0, Difficile: 0 };
  for (const c of completions) {
    const label = getDifficultyLabel(c.difficulty);
    counts[label]++;
  }
  const colorMap: Record<string, string> = {
    Facile: "#10b981",
    Moyen: "#f59e0b",
    Difficile: "#f97316",
  };
  return Object.entries(counts)
    .filter(([, v]) => v > 0)
    .map(([name, value]) => ({
      name,
      value,
      color: colorMap[name],
    }));
}

// ---------- Animated number sub-component ----------

function AnimatedNumber({ value, duration = 0.8 }: { value: number; duration?: number }) {
  const motionVal = useMotionValue(0);
  const spring = useSpring(motionVal, { duration: duration * 1000, bounce: 0 });
  const display = useTransform(spring, (v) =>
    value >= 100 ? Math.round(v).toLocaleString("fr-FR") : Math.round(v * 10) / 10
  );

  React.useEffect(() => {
    motionVal.set(value);
  }, [motionVal, value]);

  const [text, setText] = React.useState("0");
  React.useEffect(() => {
    const unsub = display.on("change", (v) => setText(String(v)));
    return unsub;
  }, [display]);

  return <span>{text}</span>;
}

// ---------- Main component ----------

export function StatsPanel({ open, onOpenChange }: StatsPanelProps) {
  const [completions, setCompletions] = React.useState<StreakCompletion[]>([]);

  React.useEffect(() => {
    if (open) {
      setCompletions(loadData());
    }
  }, [open]);

  // Derived stats
  const totalSolved = completions.length;
  const uniqueDates = React.useMemo(
    () => new Set(completions.map((c) => dateKey(c.date))),
    [completions]
  );
  const currentStreak = React.useMemo(() => calcCurrentStreak(uniqueDates), [uniqueDates]);
  const bestStreak = React.useMemo(() => calcBestStreak(uniqueDates), [uniqueDates]);
  const avgTime =
    totalSolved > 0
      ? completions.reduce((sum, c) => sum + c.time, 0) / totalSolved
      : 0;

  const dailyData = React.useMemo(() => getLast14DaysData(completions), [completions]);
  const difficultyData = React.useMemo(
    () => getDifficultyDistribution(completions),
    [completions]
  );
  const recentActivity = React.useMemo(
    () => [...completions].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 20),
    [completions]
  );

  // Stat cards config
  const statCards = [
    {
      icon: Target,
      label: "Puzzles résolus",
      value: totalSolved,
      format: (v: number) => String(v),
      color: "text-emerald-600",
      bg: "bg-emerald-500/10",
    },
    {
      icon: Flame,
      label: "Série en cours",
      value: currentStreak,
      format: (v: number) => String(v),
      color: "text-amber-600",
      bg: "bg-amber-500/10",
    },
    {
      icon: Trophy,
      label: "Meilleure série",
      value: bestStreak,
      format: (v: number) => String(v),
      color: "text-orange-600",
      bg: "bg-orange-500/10",
    },
    {
      icon: Clock,
      label: "Temps moyen",
      value: avgTime,
      format: (v: number) => formatTime(v),
      color: "text-emerald-600",
      bg: "bg-emerald-500/10",
      isTime: true,
    },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-hidden flex flex-col gap-0 p-0">
        <div className="px-6 pt-6 pb-4">
          <DialogHeader>
            <DialogTitle className="text-xl flex items-center gap-2">
              <BarChart3 className="size-5 text-emerald-600" />
              Statistiques Personnelles
            </DialogTitle>
            <DialogDescription>
              Retrouvez vos performances et votre progression
            </DialogDescription>
          </DialogHeader>
        </div>

        {totalSolved === 0 ? (
          <div className="flex-1 flex items-center justify-center px-6 pb-10">
            <div className="text-center space-y-3">
              <div className="mx-auto w-16 h-16 rounded-full bg-emerald-500/10 flex items-center justify-center">
                <TrendingUp className="size-8 text-emerald-500" />
              </div>
              <p className="text-muted-foreground text-sm max-w-xs mx-auto">
                Commencez à résoudre des puzzles pour voir vos statistiques&nbsp;!
              </p>
            </div>
          </div>
        ) : (
          <ScrollArea className="flex-1 px-6 pb-6">
            <div className="space-y-6 pr-4">
              {/* Stat cards grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {statCards.map((card, i) => {
                  const Icon = card.icon;
                  return (
                    <motion.div
                      key={card.label}
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.35, delay: i * 0.08 }}
                    >
                      <Card className="py-4 gap-0">
                        <CardContent className="flex items-center gap-4">
                          <div
                            className={cn(
                              "flex items-center justify-center size-10 rounded-lg shrink-0",
                              card.bg
                            )}
                          >
                            <Icon className={cn("size-5", card.color)} />
                          </div>
                          <div className="min-w-0">
                            <div className={cn("text-2xl font-bold tabular-nums", card.color)}>
                              {card.isTime ? (
                                formatTime(card.value)
                              ) : (
                                <AnimatedNumber value={card.value} />
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground truncate">
                              {card.label}
                            </p>
                          </div>
                        </CardContent>
                      </Card>
                    </motion.div>
                  );
                })}
              </div>

              <Separator />

              {/* Charts section */}
              <div className="space-y-5">
                {/* Daily activity bar chart */}
                <div>
                  <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                    <Calendar className="size-4 text-muted-foreground" />
                    Activité des 14 derniers jours
                  </h3>
                  <div className="h-[180px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={dailyData}
                        margin={{ top: 4, right: 4, left: -16, bottom: 0 }}
                      >
                        <XAxis
                          dataKey="day"
                          tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                          tickLine={false}
                          axisLine={false}
                          interval={1}
                        />
                        <YAxis
                          allowDecimals={false}
                          tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                          tickLine={false}
                          axisLine={false}
                          width={24}
                        />
                        <Tooltip
                          contentStyle={{
                            borderRadius: "8px",
                            border: "1px solid hsl(var(--border))",
                            backgroundColor: "hsl(var(--popover))",
                            color: "hsl(var(--popover-foreground))",
                            fontSize: "12px",
                          }}
                          formatter={(val: number) => [`${val} puzzle${val > 1 ? "s" : ""}`, "Résolus"]}
                          cursor={{ fill: "hsl(var(--muted)" }}
                        />
                        <Bar
                          dataKey="count"
                          fill="#10b981"
                          radius={[4, 4, 0, 0]}
                          maxBarSize={28}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Difficulty distribution pie chart */}
                {difficultyData.length > 0 && (
                  <div>
                    <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                      <TrendingUp className="size-4 text-muted-foreground" />
                      Répartition par difficulté
                    </h3>
                    <div className="flex items-center gap-4">
                      <div className="h-[160px] w-[160px] shrink-0">
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              data={difficultyData}
                              cx="50%"
                              cy="50%"
                              innerRadius={40}
                              outerRadius={70}
                              paddingAngle={3}
                              dataKey="value"
                              stroke="none"
                            >
                              {difficultyData.map((entry, idx) => (
                                <Cell key={idx} fill={entry.color} />
                              ))}
                            </Pie>
                            <Tooltip
                              contentStyle={{
                                borderRadius: "8px",
                                border: "1px solid hsl(var(--border))",
                                backgroundColor: "hsl(var(--popover))",
                                color: "hsl(var(--popover-foreground))",
                                fontSize: "12px",
                              }}
                              formatter={(val: number) => [`${val} puzzle${val > 1 ? "s" : ""}`, ""]}
                            />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                      <div className="flex flex-col gap-2 text-sm">
                        {difficultyData.map((d) => (
                          <div key={d.name} className="flex items-center gap-2">
                            <span
                              className="size-3 rounded-full shrink-0"
                              style={{ backgroundColor: d.color }}
                            />
                            <span className="text-muted-foreground">{d.name}</span>
                            <span className="font-semibold tabular-nums">{d.value}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <Separator />

              {/* Recent activity */}
              <div>
                <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                  <BarChart3 className="size-4 text-muted-foreground" />
                  Activité récente
                </h3>
                <div className="max-h-[300px]">
                  <ScrollArea className="h-full max-h-[300px]">
                    <div className="space-y-2">
                      {recentActivity.map((c, i) => (
                        <motion.div
                          key={`${c.puzzleId}-${c.date}-${i}`}
                          initial={{ opacity: 0, x: -8 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ duration: 0.25, delay: i * 0.03 }}
                          className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2.5 text-sm"
                        >
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <span className="font-medium truncate">{c.title}</span>
                              <span className="text-base leading-none">{getLanguageFlag(c.language)}</span>
                            </div>
                            <p className="text-xs text-muted-foreground">
                              {toLocaleDate(c.date)}
                            </p>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <Badge
                              variant="outline"
                              className={cn("text-xs", getDifficultyColor(c.difficulty))}
                            >
                              {getDifficultyLabel(c.difficulty)}
                            </Badge>
                            <span className="text-xs text-muted-foreground tabular-nums w-16 text-right">
                              {formatTime(c.time)}
                            </span>
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  </ScrollArea>
                </div>
              </div>
            </div>
          </ScrollArea>
        )}
      </DialogContent>
    </Dialog>
  );
}
