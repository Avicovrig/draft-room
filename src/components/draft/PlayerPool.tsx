import { useState, useRef, useCallback, useMemo, useEffect } from 'react'
import {
  Search,
  ArrowUpDown,
  ArrowUpNarrowWide,
  ArrowDownNarrowWide,
  Filter,
  X,
} from 'lucide-react'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { PlayerProfileModal } from '@/components/player/PlayerProfileModal'
import { PlayerPoolItem } from './PlayerPoolItem'
import { cn } from '@/lib/utils'
import {
  matchesNumberFilter,
  matchesDateFilter,
  isFilterActive,
  SORTABLE_FIELD_TYPES,
} from '@/lib/playerFilters'
import type { PlayerPublic, PlayerCustomField, LeagueFieldSchema } from '@/lib/types'

export type SortOption = 'default' | 'name-asc' | 'name-desc' | `field:${string}`

const BASE_SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: 'default', label: 'Default' },
  { value: 'name-asc', label: 'Name A-Z' },
  { value: 'name-desc', label: 'Name Z-A' },
]

function compareFieldValues(
  aVal: string | undefined,
  bVal: string | undefined,
  fieldType: string
): number {
  const aEmpty = !aVal || !aVal.trim()
  const bEmpty = !bVal || !bVal.trim()
  if (aEmpty && bEmpty) return 0
  if (aEmpty) return 1
  if (bEmpty) return -1

  if (fieldType === 'number') {
    const aNum = parseFloat(aVal)
    const bNum = parseFloat(bVal)
    if (isNaN(aNum) && isNaN(bNum)) return 0
    if (isNaN(aNum)) return 1
    if (isNaN(bNum)) return -1
    return aNum - bNum
  }

  if (fieldType === 'date') {
    const aTime = new Date(aVal).getTime()
    const bTime = new Date(bVal).getTime()
    if (isNaN(aTime) && isNaN(bTime)) return 0
    if (isNaN(aTime)) return 1
    if (isNaN(bTime)) return -1
    return aTime - bTime
  }

  if (fieldType === 'checkbox') {
    // checked ("true") sorts before unchecked ("false")
    if (aVal === bVal) return 0
    return aVal === 'true' ? -1 : 1
  }

  // text, dropdown: locale compare
  return aVal.localeCompare(bVal)
}

interface PlayerPoolProps {
  players: PlayerPublic[]
  customFieldsMap?: Record<string, PlayerCustomField[]>
  canPick: boolean
  onPick: (playerId: string) => void
  isPicking: boolean
  showExpandedDetails?: boolean
  onAddToQueue?: (playerId: string) => void
  queuedPlayerIds?: Set<string>
  isAddingToQueue?: boolean
  search?: string
  onSearchChange?: (search: string) => void
  sortBy?: SortOption
  onSortChange?: (sort: SortOption) => void
  searchInputRef?: React.RefObject<HTMLInputElement | null>
  notes?: Record<string, string>
  onNoteChange?: (playerId: string, note: string) => void
  fieldSchemas?: LeagueFieldSchema[]
  filters?: Record<string, string>
  onFilterChange?: (schemaId: string, value: string) => void
  onClearFilters?: () => void
  sortDirection?: 'asc' | 'desc'
  onSortDirectionChange?: (dir: 'asc' | 'desc') => void
}

export function PlayerPool({
  players,
  customFieldsMap = {},
  canPick,
  onPick,
  isPicking,
  showExpandedDetails = false,
  onAddToQueue,
  queuedPlayerIds = new Set(),
  isAddingToQueue = false,
  search: controlledSearch,
  onSearchChange,
  sortBy: controlledSortBy,
  onSortChange,
  searchInputRef: externalSearchRef,
  notes = {},
  onNoteChange,
  fieldSchemas = [],
  filters = {},
  onFilterChange,
  onClearFilters,
  sortDirection: controlledSortDirection,
  onSortDirectionChange,
}: PlayerPoolProps) {
  const [localSearch, setLocalSearch] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [viewingPlayer, setViewingPlayer] = useState<PlayerPublic | null>(null)
  const [localSortBy, setLocalSortBy] = useState<SortOption>('default')
  const [localSortDirection, setLocalSortDirection] = useState<'asc' | 'desc'>('asc')
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null)
  const [showFilters, setShowFilters] = useState(false)
  const activeFilterCount = useMemo(() => {
    return Object.entries(filters).filter(([schemaId, v]) => {
      const schema = fieldSchemas.find((s) => s.id === schemaId)
      return isFilterActive(schema?.field_type ?? 'text', v)
    }).length
  }, [filters, fieldSchemas])

  const searchRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  // Use controlled values when provided, otherwise local state
  const search = controlledSearch ?? localSearch
  const setSearch = onSearchChange ?? setLocalSearch
  const sortBy = controlledSortBy ?? localSortBy
  const setSortBy = onSortChange ?? setLocalSortBy
  const sortDirection = controlledSortDirection ?? localSortDirection
  const setSortDirection = onSortDirectionChange ?? setLocalSortDirection

  const sortOptions = useMemo(() => {
    const sortableSchemas = fieldSchemas.filter((s) => SORTABLE_FIELD_TYPES.has(s.field_type))
    if (sortableSchemas.length === 0) return BASE_SORT_OPTIONS
    const fieldOptions = [...sortableSchemas]
      .sort((a, b) => a.field_order - b.field_order)
      .map((s) => ({ value: `field:${s.id}` as SortOption, label: s.field_name }))
    return { base: BASE_SORT_OPTIONS, fields: fieldOptions }
  }, [fieldSchemas])

  // Reset sortBy if current selection references a text-type or deleted schema
  useEffect(() => {
    if (!sortBy.startsWith('field:')) return
    const schemaId = sortBy.slice(6)
    const schema = fieldSchemas.find((s) => s.id === schemaId)
    if (!schema || !SORTABLE_FIELD_TYPES.has(schema.field_type)) {
      setSortBy('default')
    }
  }, [sortBy, fieldSchemas, setSortBy])

  // Clear selected player if they're no longer in the available list (e.g., drafted by another client)
  useEffect(() => {
    if (selectedId && !players.some((p) => p.id === selectedId)) {
      setSelectedId(null)
    }
  }, [selectedId, players])

  const filteredPlayers = useMemo(
    () =>
      players
        .filter((p) => p.name.toLowerCase().includes(search.toLowerCase()))
        .filter((p) => {
          if (activeFilterCount === 0) return true
          const playerFields = customFieldsMap[p.id] || []
          return Object.entries(filters).every(([schemaId, filterValue]) => {
            const schema = fieldSchemas.find((s) => s.id === schemaId)
            if (!isFilterActive(schema?.field_type ?? 'text', filterValue)) return true
            const field = playerFields.find((f) => f.schema_id === schemaId)
            switch (schema?.field_type) {
              case 'number':
                return matchesNumberFilter(field?.field_value, filterValue)
              case 'date':
                return matchesDateFilter(field?.field_value, filterValue)
              default:
                return (
                  field?.field_value?.toLowerCase().includes(filterValue.toLowerCase()) ?? false
                )
            }
          })
        })
        .sort((a, b) => {
          switch (sortBy) {
            case 'name-asc':
              return a.name.localeCompare(b.name)
            case 'name-desc':
              return b.name.localeCompare(a.name)
            case 'default': {
              // Default: profile picture first, then name
              const aHasPic = a.profile_picture_url ? 1 : 0
              const bHasPic = b.profile_picture_url ? 1 : 0
              if (bHasPic !== aHasPic) return bHasPic - aHasPic
              return a.name.localeCompare(b.name)
            }
            default: {
              // field:${schemaId} pattern
              const schemaId = sortBy.slice(6)
              const schema = fieldSchemas.find((s) => s.id === schemaId)
              const aFields = customFieldsMap[a.id] || []
              const bFields = customFieldsMap[b.id] || []
              const aVal = aFields.find((f) => f.schema_id === schemaId)?.field_value ?? undefined
              const bVal = bFields.find((f) => f.schema_id === schemaId)?.field_value ?? undefined
              const dir = sortDirection === 'desc' ? -1 : 1
              const cmp = compareFieldValues(aVal, bVal, schema?.field_type || 'text') * dir
              return cmp !== 0 ? cmp : a.name.localeCompare(b.name)
            }
          }
        }),
    [
      players,
      search,
      sortBy,
      sortDirection,
      filters,
      activeFilterCount,
      customFieldsMap,
      fieldSchemas,
    ]
  )

  function handlePick() {
    if (selectedId && canPick) {
      onPick(selectedId)
      setSelectedId(null)
    }
  }

  const scrollToItem = useCallback((index: number) => {
    const list = listRef.current
    if (!list) return
    const items = list.querySelectorAll('li')
    items[index]?.scrollIntoView({ block: 'nearest' })
  }, [])

  function handleSearchKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown' && filteredPlayers.length > 0) {
      e.preventDefault()
      setSelectedId(filteredPlayers[0].id)
      listRef.current?.focus()
      scrollToItem(0)
    }
  }

  function handleListKeyDown(e: React.KeyboardEvent) {
    if (!canPick || isPicking || filteredPlayers.length === 0) return

    const currentIndex = selectedId ? filteredPlayers.findIndex((p) => p.id === selectedId) : -1

    if (e.key === 'ArrowDown') {
      e.preventDefault()
      const nextIndex = currentIndex < filteredPlayers.length - 1 ? currentIndex + 1 : 0
      setSelectedId(filteredPlayers[nextIndex].id)
      scrollToItem(nextIndex)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      const prevIndex = currentIndex > 0 ? currentIndex - 1 : filteredPlayers.length - 1
      setSelectedId(filteredPlayers[prevIndex].id)
      scrollToItem(prevIndex)
    } else if (e.key === 'Enter' && selectedId) {
      e.preventDefault()
      handlePick()
    } else if (e.key === 'Escape') {
      setSelectedId(null)
      searchRef.current?.focus()
    }
  }

  return (
    <div className="flex h-full flex-col">
      <div className="mb-4 space-y-2">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            ref={(el) => {
              ;(searchRef as React.MutableRefObject<HTMLInputElement | null>).current = el
              if (externalSearchRef)
                (externalSearchRef as React.MutableRefObject<HTMLInputElement | null>).current = el
            }}
            placeholder="Search players..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={handleSearchKeyDown}
            className="pl-9"
          />
        </div>
        <div className="flex items-center gap-2">
          <div className="relative flex-shrink-0">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortOption)}
              className="h-10 appearance-none rounded-md border border-input bg-background pl-8 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              title="Sort players"
            >
              {Array.isArray(sortOptions) ? (
                sortOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))
              ) : (
                <>
                  {sortOptions.base.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                  <optgroup label="Sort by field">
                    {sortOptions.fields.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </optgroup>
                </>
              )}
            </select>
            <ArrowUpDown className="pointer-events-none absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          </div>
          {sortBy.startsWith('field:') && (
            <button
              type="button"
              onClick={() => setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')}
              className="flex-shrink-0 h-10 rounded-md border border-input px-2 text-sm hover:bg-accent"
              title={sortDirection === 'asc' ? 'Sort ascending' : 'Sort descending'}
              aria-label={sortDirection === 'asc' ? 'Sort ascending' : 'Sort descending'}
            >
              {sortDirection === 'asc' ? (
                <ArrowUpNarrowWide className="h-4 w-4" />
              ) : (
                <ArrowDownNarrowWide className="h-4 w-4" />
              )}
            </button>
          )}
          {fieldSchemas.length > 0 && onFilterChange && (
            <button
              type="button"
              onClick={() => setShowFilters(!showFilters)}
              className={cn(
                'relative flex-shrink-0 h-10 rounded-md border border-input px-2.5 text-sm hover:bg-accent',
                showFilters && 'bg-accent'
              )}
              title="Filter by fields"
              aria-label={
                activeFilterCount > 0
                  ? `Filter by fields (${activeFilterCount} active)`
                  : 'Filter by fields'
              }
            >
              <Filter className="h-4 w-4" />
              {activeFilterCount > 0 && (
                <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[10px] font-medium text-primary-foreground">
                  {activeFilterCount}
                </span>
              )}
            </button>
          )}
        </div>
      </div>

      {/* Filter Panel */}
      {showFilters && fieldSchemas.length > 0 && onFilterChange && (
        <div className="mb-3 rounded-lg border border-border bg-muted/30 p-3">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">Filter by fields</span>
            {activeFilterCount > 0 && onClearFilters && (
              <button
                type="button"
                onClick={onClearFilters}
                className="text-xs text-primary hover:underline"
              >
                Clear all
              </button>
            )}
          </div>
          <div className="grid gap-2">
            {fieldSchemas
              .sort((a, b) => a.field_order - b.field_order)
              .map((schema) => (
                <div
                  key={schema.id}
                  className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-2"
                >
                  <label
                    className="shrink-0 truncate text-xs text-muted-foreground sm:w-24"
                    title={schema.field_name}
                  >
                    {schema.field_name}
                  </label>
                  {schema.field_type === 'number' ? (
                    <NumberFilterInput
                      value={filters[schema.id] || ''}
                      onChange={(v) => onFilterChange(schema.id, v)}
                      unit={schema.field_options?.unit as string | undefined}
                    />
                  ) : schema.field_type === 'date' ? (
                    <DateFilterInput
                      value={filters[schema.id] || ''}
                      onChange={(v) => onFilterChange(schema.id, v)}
                      includeTime={!!schema.field_options?.includeTime}
                    />
                  ) : schema.field_type === 'dropdown' ? (
                    <select
                      value={filters[schema.id] || ''}
                      onChange={(e) => onFilterChange(schema.id, e.target.value)}
                      className="h-7 flex-1 rounded border border-input bg-background px-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
                    >
                      <option value="">All</option>
                      {((schema.field_options?.options as string[]) || []).map((opt) => (
                        <option key={opt} value={opt}>
                          {opt}
                        </option>
                      ))}
                    </select>
                  ) : schema.field_type === 'checkbox' ? (
                    <select
                      value={filters[schema.id] || ''}
                      onChange={(e) => onFilterChange(schema.id, e.target.value)}
                      className="h-7 flex-1 rounded border border-input bg-background px-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
                    >
                      <option value="">All</option>
                      <option value="true">Yes</option>
                      <option value="false">No</option>
                    </select>
                  ) : (
                    <div className="relative flex-1">
                      <input
                        type="text"
                        placeholder="Filter..."
                        value={filters[schema.id] || ''}
                        onChange={(e) => onFilterChange(schema.id, e.target.value)}
                        className="h-7 w-full rounded border border-input bg-background px-2 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
                      />
                      {filters[schema.id] && (
                        <button
                          type="button"
                          onClick={() => onFilterChange(schema.id, '')}
                          className="absolute right-1 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      )}
                    </div>
                  )}
                </div>
              ))}
          </div>
        </div>
      )}

      <div
        ref={listRef}
        tabIndex={canPick ? 0 : undefined}
        onKeyDown={handleListKeyDown}
        role="listbox"
        aria-activedescendant={selectedId ? `player-${selectedId}` : undefined}
        aria-label="Available players"
        className="flex-1 overflow-y-auto rounded-lg border border-border focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {filteredPlayers.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-1 p-8 text-sm text-muted-foreground">
            <p>
              {activeFilterCount > 0
                ? 'No players match your filters'
                : search
                  ? 'No players match your search'
                  : 'No players available'}
            </p>
            {activeFilterCount > 0 && onClearFilters && (
              <button
                type="button"
                onClick={onClearFilters}
                className="text-primary hover:underline"
              >
                Clear filters
              </button>
            )}
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {filteredPlayers.map((player) => (
              <PlayerPoolItem
                key={player.id}
                player={player}
                customFields={customFieldsMap[player.id] || []}
                isSelected={selectedId === player.id}
                onSelect={setSelectedId}
                canPick={canPick}
                isPicking={isPicking}
                onViewProfile={setViewingPlayer}
                showExpandedDetails={showExpandedDetails}
                note={notes[player.id]}
                isEditingNote={editingNoteId === player.id}
                onToggleNote={() =>
                  setEditingNoteId(editingNoteId === player.id ? null : player.id)
                }
                onNoteChange={onNoteChange}
                onAddToQueue={onAddToQueue}
                isQueued={queuedPlayerIds.has(player.id)}
                isAddingToQueue={isAddingToQueue}
              />
            ))}
          </ul>
        )}
      </div>

      {canPick && (
        <div className="mt-4 flex-shrink-0">
          <Button
            onClick={handlePick}
            disabled={!selectedId}
            loading={isPicking}
            className="w-full min-h-[52px] text-base touch-manipulation"
            size="lg"
          >
            {selectedId
              ? `Draft ${filteredPlayers.find((p) => p.id === selectedId)?.name}`
              : 'Select a player to draft'}
          </Button>
        </div>
      )}

      {/* Player Profile Modal */}
      {viewingPlayer && (
        <PlayerProfileModal
          player={viewingPlayer}
          customFields={customFieldsMap[viewingPlayer.id] || []}
          fieldSchemas={fieldSchemas}
          note={notes[viewingPlayer.id]}
          onClose={() => setViewingPlayer(null)}
        />
      )}
    </div>
  )
}

// ── Filter sub-components ────────────────────────────────────────────

const selectClass =
  'h-7 rounded border border-input bg-background px-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-ring'
const inputClass =
  'h-7 rounded border border-input bg-background px-2 text-xs focus:outline-none focus:ring-1 focus:ring-ring'

type NumberOp = 'eq' | 'gt' | 'lt' | 'range'

function NumberFilterInput({
  value,
  onChange,
  unit,
}: {
  value: string
  onChange: (v: string) => void
  unit?: string
}) {
  const colonIdx = value.indexOf(':')
  const op = (colonIdx !== -1 ? value.slice(0, colonIdx) : 'eq') as NumberOp
  const rest = colonIdx !== -1 ? value.slice(colonIdx + 1) : ''

  let val1 = ''
  let val2 = ''
  if (op === 'range') {
    const pipeIdx = rest.indexOf('|')
    if (pipeIdx !== -1) {
      val1 = rest.slice(0, pipeIdx)
      val2 = rest.slice(pipeIdx + 1)
    } else {
      val1 = rest
    }
  } else {
    val1 = rest
  }

  function encode(newOp: NumberOp, v1: string, v2: string) {
    if (!v1 && !v2) {
      // Keep the operator selected but no value yet
      onChange(newOp === 'range' ? `${newOp}:${v1}|${v2}` : `${newOp}:`)
      return
    }
    if (newOp === 'range') {
      onChange(`${newOp}:${v1}|${v2}`)
    } else {
      onChange(`${newOp}:${v1}`)
    }
  }

  return (
    <div className="flex flex-1 items-center gap-1">
      <select
        value={op}
        onChange={(e) => {
          const newOp = e.target.value as NumberOp
          encode(newOp, val1, newOp === 'range' ? val2 : '')
        }}
        className={cn(selectClass, 'w-16 shrink-0')}
      >
        <option value="eq">=</option>
        <option value="gt">&gt;</option>
        <option value="lt">&lt;</option>
        <option value="range">Range</option>
      </select>
      <input
        type="number"
        placeholder={op === 'range' ? 'Min' : 'Value'}
        value={val1}
        onChange={(e) => encode(op, e.target.value, val2)}
        className={cn(inputClass, 'flex-1 min-w-0')}
      />
      {op === 'range' && (
        <>
          <span className="text-xs text-muted-foreground">–</span>
          <input
            type="number"
            placeholder="Max"
            value={val2}
            onChange={(e) => encode(op, val1, e.target.value)}
            className={cn(inputClass, 'flex-1 min-w-0')}
          />
        </>
      )}
      {unit && <span className="shrink-0 text-xs text-muted-foreground">{unit}</span>}
      {(val1 || val2) && (
        <button
          type="button"
          onClick={() => onChange('')}
          className="shrink-0 text-muted-foreground hover:text-foreground"
        >
          <X className="h-3 w-3" />
        </button>
      )}
    </div>
  )
}

type DateOp = 'after' | 'before' | 'range'

function DateFilterInput({
  value,
  onChange,
  includeTime,
}: {
  value: string
  onChange: (v: string) => void
  includeTime: boolean
}) {
  const colonIdx = value.indexOf(':')
  const op = (colonIdx !== -1 ? value.slice(0, colonIdx) : 'after') as DateOp
  const rest = colonIdx !== -1 ? value.slice(colonIdx + 1) : ''

  let val1 = ''
  let val2 = ''
  if (op === 'range') {
    const pipeIdx = rest.indexOf('|')
    if (pipeIdx !== -1) {
      val1 = rest.slice(0, pipeIdx)
      val2 = rest.slice(pipeIdx + 1)
    } else {
      val1 = rest
    }
  } else {
    val1 = rest
  }

  const dateType = includeTime ? 'datetime-local' : 'date'

  function encode(newOp: DateOp, v1: string, v2: string) {
    if (!v1 && !v2) {
      onChange(newOp === 'range' ? `${newOp}:|` : `${newOp}:`)
      return
    }
    if (newOp === 'range') {
      onChange(`${newOp}:${v1}|${v2}`)
    } else {
      onChange(`${newOp}:${v1}`)
    }
  }

  return (
    <div className="flex flex-1 items-center gap-1">
      <select
        value={op}
        onChange={(e) => {
          const newOp = e.target.value as DateOp
          encode(newOp, val1, newOp === 'range' ? val2 : '')
        }}
        className={cn(selectClass, 'w-18 shrink-0')}
      >
        <option value="after">After</option>
        <option value="before">Before</option>
        <option value="range">Range</option>
      </select>
      <input
        type={dateType}
        value={val1}
        onChange={(e) => encode(op, e.target.value, val2)}
        className={cn(inputClass, 'flex-1 min-w-0')}
      />
      {op === 'range' && (
        <>
          <span className="text-xs text-muted-foreground">–</span>
          <input
            type={dateType}
            value={val2}
            onChange={(e) => encode(op, val1, e.target.value)}
            className={cn(inputClass, 'flex-1 min-w-0')}
          />
        </>
      )}
      {(val1 || val2) && (
        <button
          type="button"
          onClick={() => onChange('')}
          className="shrink-0 text-muted-foreground hover:text-foreground"
        >
          <X className="h-3 w-3" />
        </button>
      )}
    </div>
  )
}
