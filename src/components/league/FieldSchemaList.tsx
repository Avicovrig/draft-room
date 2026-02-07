import { useState } from 'react'
import { Plus, Trash2, ChevronUp, ChevronDown, Pencil, Check, X } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/Card'
import {
  useLeagueFieldSchemas,
  useCreateFieldSchema,
  useUpdateFieldSchema,
  useDeleteFieldSchema,
  useReorderFieldSchemas,
} from '@/hooks/useFieldSchemas'
import { useToast } from '@/components/ui/Toast'
import type { LeagueFull } from '@/lib/types'

interface FieldSchemaListProps {
  league: LeagueFull
}

export function FieldSchemaList({ league }: FieldSchemaListProps) {
  const [newFieldName, setNewFieldName] = useState('')
  const [newFieldRequired, setNewFieldRequired] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)

  const { data: schemas = [] } = useLeagueFieldSchemas(league.id)
  const createSchema = useCreateFieldSchema()
  const updateSchema = useUpdateFieldSchema()
  const deleteSchema = useDeleteFieldSchema()
  const reorderSchemas = useReorderFieldSchemas()
  const { addToast } = useToast()

  const isEditable = league.status === 'not_started'

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    if (!newFieldName.trim()) return

    try {
      await createSchema.mutateAsync({
        league_id: league.id,
        field_name: newFieldName.trim(),
        is_required: newFieldRequired,
        field_order: schemas.length,
      })
      setNewFieldName('')
      setNewFieldRequired(false)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to add field'
      if (message.includes('duplicate') || message.includes('unique')) {
        addToast('A field with that name already exists', 'error')
      } else {
        addToast(message, 'error')
      }
    }
  }

  async function handleDelete(id: string) {
    try {
      await deleteSchema.mutateAsync({ id, leagueId: league.id })
      setDeleteConfirmId(null)
    } catch {
      addToast('Failed to delete field', 'error')
    }
  }

  async function handleToggleRequired(id: string, currentRequired: boolean) {
    try {
      await updateSchema.mutateAsync({
        id,
        leagueId: league.id,
        is_required: !currentRequired,
      })
    } catch {
      addToast('Failed to update field', 'error')
    }
  }

  function startEditing(id: string, currentName: string) {
    setEditingId(id)
    setEditName(currentName)
  }

  async function handleSaveEdit(id: string) {
    if (!editName.trim()) return
    try {
      await updateSchema.mutateAsync({
        id,
        leagueId: league.id,
        field_name: editName.trim(),
      })
      setEditingId(null)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to rename field'
      if (message.includes('duplicate') || message.includes('unique')) {
        addToast('A field with that name already exists', 'error')
      } else {
        addToast(message, 'error')
      }
    }
  }

  async function handleMoveUp(index: number) {
    if (index === 0) return
    const newOrder = [...schemas]
    const temp = newOrder[index]
    newOrder[index] = newOrder[index - 1]
    newOrder[index - 1] = temp
    await reorderSchemas.mutateAsync({
      leagueId: league.id,
      schemaIds: newOrder.map((s) => s.id),
    })
  }

  async function handleMoveDown(index: number) {
    if (index === schemas.length - 1) return
    const newOrder = [...schemas]
    const temp = newOrder[index]
    newOrder[index] = newOrder[index + 1]
    newOrder[index + 1] = temp
    await reorderSchemas.mutateAsync({
      leagueId: league.id,
      schemaIds: newOrder.map((s) => s.id),
    })
  }

  return (
    <div className="space-y-6">
      {/* Add Field */}
      {isEditable && (
        <Card>
          <CardHeader>
            <CardTitle>Custom Fields</CardTitle>
            <CardDescription>
              Define fields that players fill out in their profiles. Required fields must be completed before saving.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleAdd} className="flex items-center gap-2">
              <Input
                placeholder="Field name (e.g. Position)"
                value={newFieldName}
                onChange={(e) => setNewFieldName(e.target.value)}
                className="flex-1"
              />
              <label className="flex shrink-0 items-center gap-1.5 text-sm">
                <input
                  type="checkbox"
                  checked={newFieldRequired}
                  onChange={(e) => setNewFieldRequired(e.target.checked)}
                  className="h-4 w-4 rounded border-border"
                />
                Required
              </label>
              <Button
                type="submit"
                disabled={createSchema.isPending || !newFieldName.trim()}
                loading={createSchema.isPending}
              >
                <Plus className="mr-2 h-4 w-4" />
                Add
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Field List */}
      <Card>
        <CardHeader>
          <CardTitle>Fields ({schemas.length})</CardTitle>
          <CardDescription>
            {schemas.length === 0
              ? 'No custom fields defined yet. Players will only see the default profile fields.'
              : 'These fields appear in player profile forms. Drag to reorder.'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {schemas.length === 0 ? (
            <div className="py-6 text-center">
              <p className="text-sm text-muted-foreground">
                No custom fields defined yet.
              </p>
            </div>
          ) : (
            <ul className="space-y-2">
              {schemas.map((schema, index) => (
                <li
                  key={schema.id}
                  className="flex items-center justify-between rounded-lg border border-border p-3"
                >
                  <div className="flex items-center gap-3">
                    {isEditable && (
                      <div className="flex flex-col">
                        <button
                          type="button"
                          onClick={() => handleMoveUp(index)}
                          disabled={index === 0 || reorderSchemas.isPending}
                          className="p-0.5 text-muted-foreground hover:text-foreground disabled:opacity-30"
                          aria-label="Move up"
                        >
                          <ChevronUp className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleMoveDown(index)}
                          disabled={index === schemas.length - 1 || reorderSchemas.isPending}
                          className="p-0.5 text-muted-foreground hover:text-foreground disabled:opacity-30"
                          aria-label="Move down"
                        >
                          <ChevronDown className="h-4 w-4" />
                        </button>
                      </div>
                    )}
                    <div className="flex items-center gap-2">
                      {editingId === schema.id ? (
                        <div className="flex items-center gap-1">
                          <Input
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            className="h-8 w-40"
                            autoFocus
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleSaveEdit(schema.id)
                              if (e.key === 'Escape') setEditingId(null)
                            }}
                          />
                          <button
                            type="button"
                            onClick={() => handleSaveEdit(schema.id)}
                            className="p-1 text-green-600 hover:text-green-700"
                          >
                            <Check className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingId(null)}
                            className="p-1 text-muted-foreground hover:text-foreground"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                      ) : (
                        <>
                          <span className="font-medium">{schema.field_name}</span>
                          {isEditable && (
                            <button
                              type="button"
                              onClick={() => startEditing(schema.id, schema.field_name)}
                              className="p-1 text-muted-foreground hover:text-foreground"
                              aria-label="Edit field name"
                            >
                              <Pencil className="h-3 w-3" />
                            </button>
                          )}
                        </>
                      )}
                      {schema.is_required ? (
                        <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700 dark:bg-red-900/30 dark:text-red-400">
                          Required
                        </span>
                      ) : (
                        <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                          Optional
                        </span>
                      )}
                    </div>
                  </div>
                  {isEditable && (
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleToggleRequired(schema.id, schema.is_required)}
                        disabled={updateSchema.isPending}
                      >
                        {schema.is_required ? 'Make Optional' : 'Make Required'}
                      </Button>
                      {deleteConfirmId === schema.id ? (
                        <div className="flex items-center gap-1">
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => handleDelete(schema.id)}
                            disabled={deleteSchema.isPending}
                            loading={deleteSchema.isPending}
                          >
                            Delete
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setDeleteConfirmId(null)}
                          >
                            Cancel
                          </Button>
                        </div>
                      ) : (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setDeleteConfirmId(schema.id)}
                          aria-label="Delete field"
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      )}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
