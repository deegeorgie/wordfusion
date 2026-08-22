"use client";

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { EarnedBadge } from "@/lib/crossword/badges";

// ---------- types ----------

interface BadgeNotificationProps {
  badge: EarnedBadge | null;
  onDismiss: () => void;
}

// ---------- component ----------

export function BadgeNotification({ badge, onDismiss }: BadgeNotificationProps) {
  const timerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  // Auto-dismiss after 5 seconds
  React.useEffect(() => {
    if (badge) {
      timerRef.current = setTimeout(() => {
        onDismiss();
      }, 5000);
    }
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [badge, onDismiss]);

  return (
    <AnimatePresence>
      {badge && (
        <motion.div
          key={"badge-notification"}
          initial={{ opacity: 0, y: 40, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 20, scale: 0.95 }}
          transition={{ type: "spring", damping: 25, stiffness: 300 }}
          className="fixed bottom-6 right-6 z-50 w-80 max-w-[calc(100vw-3rem)]"
        >
          <div
            className={cn(
              "relative overflow-hidden rounded-xl p-4 shadow-lg shadow-black/10",
              "bg-gradient-to-br from-emerald-600 via-emerald-500 to-amber-500",
              "text-white"
            )}
          >
            {/* Close button */}
            <button
              onClick={onDismiss}
              className="absolute top-2 right-2 p-1 rounded-full hover:bg-white/20 transition-colors"
              aria-label="Fermer"
            >
              <X className="size-4" />
            </button>

            <div className="flex items-start gap-3">
              {/* Large emoji */}
              <span className="text-4xl leading-none shrink-0 drop-shadow-sm">
                {badge.icon}
              </span>

              {/* Text content */}
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-wider text-white/80">
                  Nouveau badge !
                </p>
                <p className="text-base font-bold mt-0.5 leading-tight">
                  {badge.name}
                </p>
                <p className="text-xs text-white/75 mt-0.5 leading-snug">
                  {badge.description}
                </p>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
