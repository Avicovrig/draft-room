import { useState } from 'react'
import { Plus, Trash2, ChevronUp, ChevronDown, Pencil, X } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Label } from '@/components/ui/Label'
import { Select } from '@/components/ui/Select'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/Card'
import {
  useLeagueFieldSchemas,
  useCreateFieldSchema,
  useUpdateFieldSchema,
  useDeleteFieldSchema,
  useReorderFieldSchemas,
} from '@/hooks/useFieldSchemas'
import { useToast } from '@/components/ui/Toast'
import type { LeagueFull, LeagueFieldSchema } from '@/lib/types'

const FIELD_TYPES = [
  { value: 'text', label: 'Text' },
  { value: 'number', label: 'Number' },
  { value: 'date', label: 'Date' },
  { value: 'dropdown', label: 'Dropdown' },
  { value: 'checkbox', label: 'Checkbox' },
] as const

type FieldType = (typeof FIELD_TYPES)[number]['value']

function getTypeLabel(schema: LeagueFieldSchema): string {
  const type = schema.field_type as FieldType
  const opts = schema.field_options
  switch (type) {
    case 'number':
      return opts?.unit ? `Number (${opts.unit})` : 'Number'
    case 'date':
      return opts?.includeTime ? 'Date & Time' : 'Date'
    case 'dropdown': {
      const count = (opts?.options as string[] | undefined)?.length ?? 0
      return `Dropdown (${count} option${count !== 1 ? 's' : ''})`
    }
    case 'checkbox':
      return 'Checkbox'
    default:
      return 'Text'
  }
}

interface FieldOptionsEditorProps {
  type: FieldType
  unit: string
  onUnitChange: (v: string) => void
  includeTime: boolean
  onIncludeTimeChange: (v: boolean) => void
  dropdownOptions: string[]
  onDropdownOptionsChange: (v: string[]) => void
  checkboxLabel: string
  onCheckboxLabelChange: (v: string) => void
}

function FieldOptionsEditor({
  type,
  unit,
  onUnitChange,
  includeTime,
  onIncludeTimeChange,
  dropdownOptions,
  onDropdownOptionsChange,
  checkboxLabel,
  onCheckboxLabelChange,
}: FieldOptionsEditorProps) {
  if (type === 'text') return null

  return (
    <div className="rounded-md border border-border bg-muted/30 p-3">
      {type === 'number' && (
        <div className="flex items-center gap-2">
          <Label htmlFor="field-unit" className="shrink-0 text-sm">
            Unit (optional)
          </Label>
          <Input
            id="field-unit"
            placeholder="e.g. lbs, cm, years"
            value={unit}
            onChange={(e) => onUnitChange(e.target.value)}
            className="h-8 max-w-48"
          />
        </div>
      )}

      {type === 'date' && (
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={includeTime}
            onChange={(e) => onIncludeTimeChange(e.target.checked)}
            className="h-4 w-4 rounded border-border"
          />
          Include time
        </label>
      )}

      {type === 'dropdown' && (
        <div className="space-y-2">
          <Label className="text-sm">Options</Label>
          {dropdownOptions.map((opt, i) => (
            <div key={i} className="flex items-center gap-2">
              <Input
                placeholder={`Option ${i + 1}`}
                value={opt}
                onChange={(e) => {
                  const next = [...dropdownOptions]
                  next[i] = e.target.value
                  onDropdownOptionsChange(next)
                }}
                className="h-8 flex-1"
                autoFocus={i === dropdownOptions.length - 1 && dropdownOptions.length > 1}
              />
              {dropdownOptions.length > 1 && (
                <button
                  type="button"
                  onClick={() => onDropdownOptionsChange(dropdownOptions.filter((_, j) => j !== i))}
                  className="p-1 text-muted-foreground hover:text-destructive"
                  aria-label="Remove option"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          ))}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onDropdownOptionsChange([...dropdownOptions, ''])}
          >
            <Plus className="mr-1 h-3 w-3" />
            Add option
          </Button>
        </div>
      )}

      {type === 'checkbox' && (
        <div className="flex items-center gap-2">
          <Label htmlFor="field-checkbox-label" className="shrink-0 text-sm">
            Label (optional)
          </Label>
          <Input
            id="field-checkbox-label"
            placeholder="e.g. Has prior experience"
            value={checkboxLabel}
            onChange={(e) => onCheckboxLabelChange(e.target.value)}
            className="h-8 max-w-64"
          />
        </div>
      )}
    </div>
  )
}

function buildFieldOptions(
  type: FieldType,
  unit: string,
  includeTime: boolean,
  dropdownOptions: string[],
  checkboxLabel: string
): Record<string, unknown> | null {
  switch (type) {
    case 'number':
      return unit.trim() ? { unit: unit.trim() } : null
    case 'date':
      return includeTime ? { includeTime: true } : null
    case 'dropdown':
      return { options: dropdownOptions.map((o) => o.trim()).filter(Boolean) }
    case 'checkbox':
      return checkboxLabel.trim() ? { label: checkboxLabel.trim() } : null
    default:
      return null
  }
}

function initOptionsFromSchema(schema: LeagueFieldSchema) {
  const opts = schema.field_options
  return {
    unit: (opts?.unit as string) || '',
    includeTime: (opts?.includeTime as boolean) || false,
    dropdownOptions: (opts?.options as string[] | undefined)?.length ? (opts!.options as string[]) : [''],
    checkboxLabel: (opts?.label as string) || '',
  }
}

interface FieldSchemaListProps {
  league: LeagueFull
}

export function FieldSchemaList({ league }: FieldSchemaListProps) {
  // Add form state
  const [newFieldName, setNewFieldName] = useState('')
  const [newFieldType, setNewFieldType] = useState<FieldType>('text')
  const [newFieldRequired, setNewFieldRequired] = useState(false)
  const [newUnit, setNewUnit] = useState('')
  const [newIncludeTime, setNewIncludeTime] = useState(false)
  const [newDropdownOptions, setNewDropdownOptions] = useState<string[]>([''])
  const [newCheckboxLabel, setNewCheckboxLabel] = useState('')

  // Edit state
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [editType, setEditType] = useState<FieldType>('text')
  const [editRequired, setEditRequired] = useState(false)
  const [editUnit, setEditUnit] = useState('')
  const [editIncludeTime, setEditIncludeTime] = useState(false)
  const [editDropdownOptions, setEditDropdownOptions] = useState<string[]>([''])
  const [editCheckboxLabel, setEditCheckboxLabel] = useState('')

  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)

  const { data: schemas = [] } = useLeagueFieldSchemas(league.id)
  const createSchema = useCreateFieldSchema()
  const updateSchema = useUpdateFieldSchema()
  const deleteSchema = useDeleteFieldSchema()
  const reorderSchemas = useReorderFieldSchemas()
  const { addToast } = useToast()

  const isEditable = league.status === 'not_started'

  function resetAddForm() {
    setNewFieldName('')
    setNewFieldType('text')
    setNewFieldRequired(false)
    setNewUnit('')
    setNewIncludeTime(false)
    setNewDropdownOptions([''])
    setNewCheckboxLabel('')
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    if (!newFieldName.trim()) return

    if (newFieldType === 'dropdown') {
      const validOptions = newDropdownOptions.map((o) => o.trim()).filter(Boolean)
      if (validOptions.length === 0) {
        addToast('Dropdown fields need at least one option', 'error')
        return
      }
    }

    try {
      await createSchema.mutateAsync({
        league_id: league.id,
        field_name: newFieldName.trim(),
        field_type: newFieldType,
        is_required: newFieldRequired,
        field_order: schemas.length,
        field_options: buildFieldOptions(
          newFieldType,
          newUnit,
          newIncludeTime,
          newDropdownOptions,
          newCheckboxLabel
        ),
      })
      resetAddForm()
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

  function startEditing(schema: LeagueFieldSchema) {
    const opts = initOptionsFromSchema(schema)
    setEditingId(schema.id)
    setEditName(schema.field_name)
    setEditType(schema.field_type as FieldType)
    setEditRequired(schema.is_required)
    setEditUnit(opts.unit)
    setEditIncludeTime(opts.includeTime)
    setEditDropdownOptions(opts.dropdownOptions)
    setEditCheckboxLabel(opts.checkboxLabel)
  }

  async function handleSaveEdit(id: string) {
    if (!editName.trim()) return

    if (editType === 'dropdown') {
      const validOptions = editDropdownOptions.map((o) => o.trim()).filter(Boolean)
      if (validOptions.length === 0) {
        addToast('Dropdown fields need at least one option', 'error')
        return
      }
    }

    try {
      await updateSchema.mutateAsync({
        id,
        leagueId: league.id,
        field_name: editName.trim(),
        field_type: editType,
        is_required: editRequired,
        field_options: buildFieldOptions(
          editType,
          editUnit,
          editIncludeTime,
          editDropdownOptions,
          editCheckboxLabel
        ),
      })
      setEditingId(null)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update field'
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
            <form onSubmit={handleAdd} className="space-y-3">
              <div className="flex flex-wrap items-end gap-2">
                <div className="min-w-0 flex-1">
                  <Label htmlFor="new-field-name" className="mb-1 text-xs text-muted-foreground">
                    Field name
                  </Label>
                  <Input
                    id="new-field-name"
                    placeholder="e.g. Position, Height"
                    value={newFieldName}
                    onChange={(e) => setNewFieldName(e.target.value)}
                  />
                </div>
                <div className="w-36">
                  <Label htmlFor="new-field-type" className="mb-1 text-xs text-muted-foreground">
                    Type
                  </Label>
                  <Select
                    id="new-field-type"
                    value={newFieldType}
                    onChange={(e) => setNewFieldType(e.target.value as FieldType)}
                  >
                    {FIELD_TYPES.map((t) => (
                      <option key={t.value} value={t.value}>
                        {t.label}
                      </option>
                    ))}
                  </Select>
                </div>
                <label className="flex shrink-0 items-center gap-1.5 pb-1 text-sm">
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
              </div>

              <FieldOptionsEditor
                type={newFieldType}
                unit={newUnit}
                onUnitChange={setNewUnit}
                includeTime={newIncludeTime}
                onIncludeTimeChange={setNewIncludeTime}
                dropdownOptions={newDropdownOptions}
                onDropdownOptionsChange={setNewDropdownOptions}
                checkboxLabel={newCheckboxLabel}
                onCheckboxLabelChange={setNewCheckboxLabel}
              />
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
                  className="rounded-lg border border-border p-3"
                >
                  {editingId === schema.id ? (
                    /* Expanded Edit Panel */
                    <div className="space-y-3">
                      <div className="flex flex-wrap items-end gap-2">
                        <div className="min-w-0 flex-1">
                          <Label className="mb-1 text-xs text-muted-foreground">
                            Field name
                          </Label>
                          <Input
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            autoFocus
                            onKeyDown={(e) => {
                              if (e.key === 'Escape') setEditingId(null)
                            }}
                          />
                        </div>
                        <div className="w-36">
                          <Label className="mb-1 text-xs text-muted-foreground">
                            Type
                          </Label>
                          <Select
                            value={editType}
                            onChange={(e) => setEditType(e.target.value as FieldType)}
                          >
                            {FIELD_TYPES.map((t) => (
                              <option key={t.value} value={t.value}>
                                {t.label}
                              </option>
                            ))}
                          </Select>
                        </div>
                        <label className="flex shrink-0 items-center gap-1.5 pb-1 text-sm">
                          <input
                            type="checkbox"
                            checked={editRequired}
                            onChange={(e) => setEditRequired(e.target.checked)}
                            className="h-4 w-4 rounded border-border"
                          />
                          Required
                        </label>
                      </div>

                      <FieldOptionsEditor
                        type={editType}
                        unit={editUnit}
                        onUnitChange={setEditUnit}
                        includeTime={editIncludeTime}
                        onIncludeTimeChange={setEditIncludeTime}
                        dropdownOptions={editDropdownOptions}
                        onDropdownOptionsChange={setEditDropdownOptions}
                        checkboxLabel={editCheckboxLabel}
                        onCheckboxLabelChange={setEditCheckboxLabel}
                      />

                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          onClick={() => handleSaveEdit(schema.id)}
                          disabled={updateSchema.isPending || !editName.trim()}
                          loading={updateSchema.isPending}
                        >
                          Save
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setEditingId(null)}
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : (
                    /* Normal Display */
                    <div className="flex items-center justify-between">
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
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-medium">{schema.field_name}</span>
                          {isEditable && (
                            <button
                              type="button"
                              onClick={() => startEditing(schema)}
                              className="p-1 text-muted-foreground hover:text-foreground"
                              aria-label="Edit field"
                            >
                              <Pencil className="h-3 w-3" />
                            </button>
                          )}
                          <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                            {getTypeLabel(schema)}
                          </span>
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
