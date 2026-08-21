'use client'

import { useCallback, useMemo } from 'react'
import { CheckCircle2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Badge } from '@/components/ui/badge'
import type { Clue } from '@/lib/crossword/types'

interface ClueListProps {
  clues: Clue[]
  activeClueNumber: number | null
  activeClueDirection: 'across' | 'down'
  onSelectClue: (number: number, direction: 'across' | 'down') => void
  completedClues: Set<string>
}

function getClueKey(number: number, direction: 'across' | 'down'): string {
  return `${number}-${direction}`
}

function ClueItem({
  clue,
  isActive,
  isCompleted,
  onSelect,
}: {
  clue: Clue
  isActive: boolean
  isCompleted: boolean
  onSelect: () => void
}) {
  return (
    <button
      type="button"
      role="button"
      aria-label={`${clue.direction === 'across' ? 'Horizontal' : 'Vertical'} ${clue.number}: ${clue.text}${isCompleted ? ' (complétée)' : ''}`}
      aria-pressed={isActive}
      tabIndex={isActive ? 0 : -1}
      onClick={onSelect}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onSelect()
        }
      }}
      className={cn(
        'group relative flex w-full items-start gap-3 rounded-lg px-3 py-2.5 text-left transition-all duration-200',
        'hover:bg-accent/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1',
        isActive && 'bg-primary/10 hover:bg-primary/15 border-l-2 border-l-primary pl-[10px]',
        !isActive && 'border-l-2 border-l-transparent pl-[10px]',
        isCompleted && !isActive && 'opacity-70',
      )}
    >
      {/* Clue Number */}
      <span
        className={cn(
          'shrink-0 text-sm font-bold tabular-nums pt-px',
          isCompleted && !isActive
            ? 'text-muted-foreground'
            : isActive
              ? 'text-primary'
              : 'text-foreground',
        )}
      >
        {clue.number}.
      </span>

      {/* Clue Text */}
      <span
        className={cn(
          'flex-1 text-sm leading-relaxed',
          isCompleted && !isActive && 'text-muted-foreground line-through decoration-muted-foreground/40',
          isActive && 'text-foreground font-medium',
          !isActive && !isCompleted && 'text-foreground/80',
        )}
      >
        {clue.text}
      </span>

      {/* Completed Badge */}
      {isCompleted && (
        <span className="shrink-0 pt-px">
          <Badge
            variant="secondary"
            className="gap-1 bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400 text-[10px] px-1.5 py-0"
          >
            <CheckCircle2 className="size-3" />
            <span className="hidden sm:inline">OK</span>
          </Badge>
        </span>
      )}
    </button>
  )
}

export default function ClueList({
  clues,
  activeClueNumber,
  activeClueDirection,
  onSelectClue,
  completedClues,
}: ClueListProps) {
  const acrossClues = useMemo(
    () =>
      clues
        .filter((c) => c.direction === 'across')
        .sort((a, b) => a.number - b.number),
    [clues],
  )

  const downClues = useMemo(
    () =>
      clues
        .filter((c) => c.direction === 'down')
        .sort((a, b) => a.number - b.number),
    [clues],
  )

  // Determine the default tab based on active direction
  const defaultTab = activeClueDirection

  const handleSelectClue = useCallback(
    (number: number, direction: 'across' | 'down') => {
      onSelectClue(number, direction)
    },
    [onSelectClue],
  )

  const completedAcross = useMemo(
    () => acrossClues.filter((c) => completedClues.has(getClueKey(c.number, c.direction))).length,
    [acrossClues, completedClues],
  )

  const completedDown = useMemo(
    () => downClues.filter((c) => completedClues.has(getClueKey(c.number, c.direction))).length,
    [downClues, completedClues],
  )

  return (
    <div className="flex h-full w-full flex-col">
      <Tabs
        defaultValue={defaultTab}
        className="flex h-full flex-col"
      >
        {/* Sticky Tabs Header */}
        <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm pb-2">
          <TabsList className="w-full h-10">
            <TabsTrigger value="across" className="flex-1 gap-1.5 text-xs sm:text-sm">
              <span className="font-medium">Horizontal</span>
              {acrossClues.length > 0 && (
                <Badge
                  variant="outline"
                  className="text-[10px] px-1 py-0 h-4 min-w-4 justify-center font-normal"
                >
                  {completedAcross}/{acrossClues.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="down" className="flex-1 gap-1.5 text-xs sm:text-sm">
              <span className="font-medium">Vertical</span>
              {downClues.length > 0 && (
                <Badge
                  variant="outline"
                  className="text-[10px] px-1 py-0 h-4 min-w-4 justify-center font-normal"
                >
                  {completedDown}/{downClues.length}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>
        </div>

        {/* Across Clues Tab */}
        <TabsContent value="across" className="flex-1 mt-0">
          <ScrollArea className="h-full max-h-[60vh] lg:max-h-none">
            <div className="space-y-0.5 px-1 pb-4">
              {acrossClues.length === 0 ? (
                <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
                  Aucune indication horizontale
                </div>
              ) : (
                acrossClues.map((clue, idx) => (
                  <ClueItem
                    key={`${getClueKey(clue.number, clue.direction)}-${idx}`}
                    clue={clue}
                    isActive={
                      activeClueNumber === clue.number &&
                      activeClueDirection === 'across'
                    }
                    isCompleted={completedClues.has(
                      getClueKey(clue.number, clue.direction),
                    )}
                    onSelect={() => handleSelectClue(clue.number, 'across')}
                  />
                ))
              )}
            </div>
          </ScrollArea>
        </TabsContent>

        {/* Down Clues Tab */}
        <TabsContent value="down" className="flex-1 mt-0">
          <ScrollArea className="h-full max-h-[60vh] lg:max-h-none">
            <div className="space-y-0.5 px-1 pb-4">
              {downClues.length === 0 ? (
                <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
                  Aucune indication verticale
                </div>
              ) : (
                downClues.map((clue, idx) => (
                  <ClueItem
                    key={`${getClueKey(clue.number, clue.direction)}-${idx}`}
                    clue={clue}
                    isActive={
                      activeClueNumber === clue.number &&
                      activeClueDirection === 'down'
                    }
                    isCompleted={completedClues.has(
                      getClueKey(clue.number, clue.direction),
                    )}
                    onSelect={() => handleSelectClue(clue.number, 'down')}
                  />
                ))
              )}
            </div>
          </ScrollArea>
        </TabsContent>
      </Tabs>
    </div>
  )
}
