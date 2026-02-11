import { useState, useRef, useCallback, useMemo, useEffect } from 'react'
import { Search, User, Plus, ArrowUpDown, StickyNote, Filter, X } from 'lucide-react'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { PlayerProfileModal } from '@/components/player/PlayerProfileModal'
import { cn, getInitials } from '@/lib/utils'
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
}: PlayerPoolProps) {
  const [localSearch, setLocalSearch] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [viewingPlayer, setViewingPlayer] = useState<PlayerPublic | null>(null)
  const [localSortBy, setLocalSortBy] = useState<SortOption>('default')
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null)
  const [showFilters, setShowFilters] = useState(false)
  const activeFilterCount = Object.values(filters).filter((v) => v.trim()).length

  const searchRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  // Use controlled values when provided, otherwise local state
  const search = controlledSearch ?? localSearch
  const setSearch = onSearchChange ?? setLocalSearch
  const sortBy = controlledSortBy ?? localSortBy
  const setSortBy = onSortChange ?? setLocalSortBy

  const sortOptions = useMemo(() => {
    if (fieldSchemas.length === 0) return BASE_SORT_OPTIONS
    const fieldOptions = [...fieldSchemas]
      .sort((a, b) => a.field_order - b.field_order)
      .map((s) => ({ value: `field:${s.id}` as SortOption, label: s.field_name }))
    return { base: BASE_SORT_OPTIONS, fields: fieldOptions }
  }, [fieldSchemas])

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
          return Object.entries(filters).every(([schemaId, filterText]) => {
            if (!filterText.trim()) return true
            const field = playerFields.find((f) => f.schema_id === schemaId)
            return field?.field_value?.toLowerCase().includes(filterText.toLowerCase())
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
              const cmp = compareFieldValues(aVal, bVal, schema?.field_type || 'text')
              return cmp !== 0 ? cmp : a.name.localeCompare(b.name)
            }
          }
        }),
    [players, search, sortBy, filters, activeFilterCount, customFieldsMap, fieldSchemas]
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
      <div className="mb-4 flex items-center gap-2">
        <div className="relative flex-1">
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
                <div key={schema.id} className="flex items-center gap-2">
                  <label
                    className="w-24 shrink-0 truncate text-xs text-muted-foreground"
                    title={schema.field_name}
                  >
                    {schema.field_name}
                  </label>
                  {schema.field_type === 'dropdown' ? (
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
            {filteredPlayers.map((player) => {
              const customFields = customFieldsMap[player.id] || []
              const hasExpandableContent = player.bio || customFields.length > 0

              return (
                <li
                  key={player.id}
                  id={`player-${player.id}`}
                  role="option"
                  aria-selected={selectedId === player.id}
                >
                  <div
                    className={cn(
                      'flex items-center gap-3 px-4 py-3 transition-[colors,box-shadow] duration-150 min-h-[52px]',
                      canPick && !isPicking && 'cursor-pointer hover:bg-accent',
                      !canPick && 'cursor-default',
                      isPicking && 'opacity-50',
                      selectedId === player.id &&
                        'bg-primary/10 hover:bg-primary/20 ring-2 ring-primary ring-inset'
                    )}
                    onClick={() => canPick && !isPicking && setSelectedId(player.id)}
                  >
                    {/* Profile Picture */}
                    <button
                      type="button"
                      tabIndex={-1}
                      onClick={(e) => {
                        e.stopPropagation()
                        setViewingPlayer(player)
                      }}
                      className="flex-shrink-0 rounded-full focus:outline-none focus:ring-2 focus:ring-primary"
                    >
                      {player.profile_picture_url ? (
                        <img
                          src={player.profile_picture_url}
                          alt={player.name}
                          loading="lazy"
                          className="h-11 w-11 rounded-full object-cover"
                        />
                      ) : (
                        <div className="flex h-11 w-11 items-center justify-center rounded-full bg-muted text-sm font-medium text-muted-foreground">
                          {getInitials(player.name)}
                        </div>
                      )}
                    </button>

                    {/* Player Info */}
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-base truncate">{player.name}</div>
                    </div>

                    {/* View Profile Button */}
                    <button
                      type="button"
                      tabIndex={-1}
                      onClick={(e) => {
                        e.stopPropagation()
                        setViewingPlayer(player)
                      }}
                      className="flex-shrink-0 p-2.5 min-h-[44px] min-w-[44px] flex items-center justify-center text-muted-foreground hover:text-foreground rounded-md hover:bg-accent"
                      title="View full profile"
                    >
                      <User className="h-4 w-4" />
                    </button>

                    {/* Note Button */}
                    {onNoteChange && (
                      <button
                        type="button"
                        tabIndex={-1}
                        onClick={(e) => {
                          e.stopPropagation()
                          setEditingNoteId(editingNoteId === player.id ? null : player.id)
                        }}
                        className={cn(
                          'flex-shrink-0 p-2.5 min-h-[44px] min-w-[44px] flex items-center justify-center rounded-md',
                          notes[player.id]
                            ? 'text-yellow-600 dark:text-yellow-400'
                            : 'text-muted-foreground hover:text-foreground hover:bg-accent'
                        )}
                        title={notes[player.id] ? 'Edit note' : 'Add note'}
                      >
                        <StickyNote className="h-4 w-4" />
                      </button>
                    )}

                    {/* Add to Queue Button */}
                    {onAddToQueue && (
                      <button
                        type="button"
                        tabIndex={-1}
                        onClick={(e) => {
                          e.stopPropagation()
                          onAddToQueue(player.id)
                        }}
                        disabled={queuedPlayerIds.has(player.id) || isAddingToQueue}
                        className={cn(
                          'flex-shrink-0 p-2.5 min-h-[44px] min-w-[44px] flex items-center justify-center rounded-md',
                          queuedPlayerIds.has(player.id)
                            ? 'text-primary cursor-default'
                            : 'text-muted-foreground hover:text-foreground hover:bg-accent'
                        )}
                        title={queuedPlayerIds.has(player.id) ? 'Already in queue' : 'Add to queue'}
                      >
                        <Plus className="h-4 w-4" />
                      </button>
                    )}
                  </div>

                  {/* Inline Note Editor */}
                  {editingNoteId === player.id && onNoteChange && (
                    <div className="border-t border-border/50 bg-yellow-50/50 px-4 py-2 dark:bg-yellow-950/20">
                      <textarea
                        autoFocus
                        rows={2}
                        placeholder="Add a note about this player..."
                        value={notes[player.id] || ''}
                        onChange={(e) => onNoteChange(player.id, e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Escape') {
                            e.stopPropagation()
                            setEditingNoteId(null)
                          }
                        }}
                        onClick={(e) => e.stopPropagation()}
                        className="w-full resize-none rounded border border-input bg-background px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                      />
                    </div>
                  )}

                  {/* Note Preview (when not editing, in expanded mode) */}
                  {showExpandedDetails && notes[player.id] && editingNoteId !== player.id && (
                    <div className="border-t border-border/50 bg-yellow-50/50 px-4 py-2 dark:bg-yellow-950/20">
                      <p className="text-sm text-yellow-700 dark:text-yellow-300 line-clamp-2">
                        <StickyNote className="mr-1 inline h-3 w-3" />
                        {notes[player.id]}
                      </p>
                    </div>
                  )}

                  {/* Expanded Content (only in fullscreen mode) */}
                  {showExpandedDetails && hasExpandableContent && (
                    <div className="border-t border-border/50 bg-muted/30 px-4 py-3 pl-6">
                      {/* Bio */}
                      {player.bio && (
                        <p className="mb-2 text-sm text-muted-foreground line-clamp-3">
                          {player.bio}
                        </p>
                      )}

                      {/* Custom Fields */}
                      {customFields.length > 0 && (
                        <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
                          {customFields.map((field) => (
                            <span key={field.id}>
                              <span className="text-muted-foreground">{field.field_name}:</span>{' '}
                              {field.field_value || '-'}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </li>
              )
            })}
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
