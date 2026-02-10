import { useState, useEffect, useRef } from 'react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Label } from '@/components/ui/Label'
import { Textarea } from '@/components/ui/Textarea'
import { ImageCropper } from '@/components/ui/ImageCropper'
import { Select } from '@/components/ui/Select'
import { X, Plus, Camera } from 'lucide-react'
import { useToast } from '@/components/ui/Toast'
import type { PlayerPublic, PlayerCustomField, LeagueFieldSchema } from '@/lib/types'
import { getInitials } from '@/lib/utils'

interface PlayerProfileFormProps {
  player: PlayerPublic
  customFields?: PlayerCustomField[]
  fieldSchemas?: LeagueFieldSchema[]
  allowFreeformFields?: boolean
  onSave: (data: ProfileFormData) => Promise<void>
  onCancel: () => void
}

export interface ProfileFormData {
  bio: string | null
  profilePictureBlob?: Blob | null
  customFields: Array<{ id?: string; field_name: string; field_value: string; field_order: number; schema_id?: string | null }>
  deletedCustomFieldIds: string[]
}

export function PlayerProfileForm({
  player,
  customFields = [],
  fieldSchemas = [],
  allowFreeformFields = true,
  onSave,
  onCancel,
}: PlayerProfileFormProps) {
  const { addToast } = useToast()
  const [bio, setBio] = useState(player.bio || '')
  const [profilePictureBlob, setProfilePictureBlob] = useState<Blob | null>(null)
  const [previewUrl, setPreviewUrl] = useState(player.profile_picture_url || '')
  const [showCropper, setShowCropper] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [schemaErrors, setSchemaErrors] = useState<Record<string, boolean>>({})

  // Schema-backed fields state (manager-defined)
  const [schemaFieldValues, setSchemaFieldValues] = useState<Record<string, { id?: string; value: string }>>(() => {
    const map: Record<string, { id?: string; value: string }> = {}
    for (const schema of fieldSchemas) {
      const existing = customFields.find((f) => f.schema_id === schema.id)
      const defaultValue = schema.field_type === 'checkbox' ? 'false' : ''
      map[schema.id] = {
        id: existing?.id,
        value: existing?.field_value || defaultValue,
      }
    }
    return map
  })

  // Freeform custom fields state (player-defined, schema_id is null)
  const freeformCustomFields = customFields.filter((f) => !f.schema_id)
  const [fields, setFields] = useState<Array<{ id?: string; field_name: string; field_value: string; field_order: number }>>(
    freeformCustomFields.map((f) => ({
      id: f.id,
      field_name: f.field_name,
      field_value: f.field_value || '',
      field_order: f.field_order,
    }))
  )
  const [deletedFieldIds, setDeletedFieldIds] = useState<string[]>([])

  // Track blob URLs for cleanup
  const blobUrlRef = useRef<string | null>(null)

  useEffect(() => {
    return () => {
      if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current)
    }
  }, [])

  function handleCropComplete(blob: Blob) {
    if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current)
    const newUrl = URL.createObjectURL(blob)
    blobUrlRef.current = newUrl
    setProfilePictureBlob(blob)
    setPreviewUrl(newUrl)
    setShowCropper(false)
  }

  function addCustomField() {
    setFields([
      ...fields,
      {
        field_name: '',
        field_value: '',
        field_order: fields.length,
      },
    ])
  }

  function updateCustomField(index: number, key: 'field_name' | 'field_value', value: string) {
    const newFields = [...fields]
    newFields[index] = { ...newFields[index], [key]: value }
    setFields(newFields)
  }

  function removeCustomField(index: number) {
    const field = fields[index]
    if (field.id) {
      setDeletedFieldIds([...deletedFieldIds, field.id])
    }
    setFields(fields.filter((_, i) => i !== index))
  }

  function updateSchemaField(schemaId: string, value: string) {
    setSchemaFieldValues((prev) => ({
      ...prev,
      [schemaId]: { ...prev[schemaId], value },
    }))
    if (schemaErrors[schemaId]) {
      setSchemaErrors((prev) => ({ ...prev, [schemaId]: false }))
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    // Validate required schema fields
    const errors: Record<string, boolean> = {}
    for (const schema of fieldSchemas) {
      if (schema.is_required && !schemaFieldValues[schema.id]?.value?.trim()) {
        errors[schema.id] = true
      }
    }
    if (Object.keys(errors).length > 0) {
      setSchemaErrors(errors)
      return
    }

    setIsSaving(true)

    try {
      // Assemble schema-backed fields
      const schemaFields = fieldSchemas.map((schema, index) => ({
        id: schemaFieldValues[schema.id]?.id,
        field_name: schema.field_name,
        field_value: schemaFieldValues[schema.id]?.value || '',
        field_order: index,
        schema_id: schema.id,
      }))

      // Assemble freeform fields (with offset order after schema fields)
      const freeformFields = fields
        .filter((f) => f.field_name.trim())
        .map((f, index) => ({
          ...f,
          field_order: fieldSchemas.length + index,
          schema_id: null as string | null,
        }))

      await onSave({
        bio: bio || null,
        profilePictureBlob,
        customFields: [...schemaFields, ...freeformFields],
        deletedCustomFieldIds: deletedFieldIds,
      })
    } finally {
      setIsSaving(false)
    }
  }

  if (showCropper) {
    return (
      <ImageCropper
        onCropComplete={handleCropComplete}
        onCancel={() => setShowCropper(false)}
        onFileTooLarge={() => addToast('Image must be under 10MB', 'error')}
      />
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Profile Picture */}
      <div className="flex flex-col items-center gap-3">
        <div className="relative">
          {previewUrl ? (
            <img
              src={previewUrl}
              alt={player.name}
              className="h-24 w-24 rounded-full object-cover ring-2 ring-border"
            />
          ) : (
            <div className="flex h-24 w-24 items-center justify-center rounded-full bg-primary/10 text-2xl font-semibold text-primary ring-2 ring-border">
              {getInitials(player.name)}
            </div>
          )}
          <button
            type="button"
            onClick={() => setShowCropper(true)}
            className="absolute bottom-0 right-0 rounded-full bg-primary p-2 text-primary-foreground shadow-md hover:bg-primary/90"
            aria-label="Upload photo"
          >
            <Camera className="h-4 w-4" />
          </button>
        </div>
        <span className="text-lg font-semibold">{player.name}</span>
      </div>

      {/* Bio */}
      <div className="space-y-2">
        <Label htmlFor="bio">Bio</Label>
        <Textarea
          id="bio"
          placeholder="Tell us about yourself..."
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          rows={3}
        />
      </div>

      {/* Schema Fields (manager-defined) */}
      {fieldSchemas.length > 0 && (
        <div className="space-y-3">
          <Label>League Fields</Label>
          {fieldSchemas.map((schema) => {
            const value = schemaFieldValues[schema.id]?.value || ''
            const errorClass = schemaErrors[schema.id] ? 'border-destructive' : ''
            return (
              <div key={schema.id} className="space-y-1">
                {schema.field_type !== 'checkbox' && (
                  <label className="text-sm font-medium">
                    {schema.field_name}
                    {schema.is_required && (
                      <span className="ml-1 text-destructive">*</span>
                    )}
                  </label>
                )}

                {(!schema.field_type || schema.field_type === 'text') && (
                  <Input
                    placeholder={`Enter ${schema.field_name.toLowerCase()}`}
                    value={value}
                    onChange={(e) => updateSchemaField(schema.id, e.target.value)}
                    className={errorClass}
                  />
                )}

                {schema.field_type === 'number' && (
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      step="any"
                      placeholder={`Enter ${schema.field_name.toLowerCase()}`}
                      value={value}
                      onChange={(e) => updateSchemaField(schema.id, e.target.value)}
                      className={`flex-1 ${errorClass}`}
                    />
                    {!!schema.field_options?.unit && (
                      <span className="text-sm text-muted-foreground">
                        {String(schema.field_options.unit)}
                      </span>
                    )}
                  </div>
                )}

                {schema.field_type === 'date' && (
                  <Input
                    type={schema.field_options?.includeTime ? 'datetime-local' : 'date'}
                    value={value}
                    onChange={(e) => updateSchemaField(schema.id, e.target.value)}
                    className={errorClass}
                  />
                )}

                {schema.field_type === 'dropdown' && (
                  <Select
                    value={value}
                    onChange={(e) => updateSchemaField(schema.id, e.target.value)}
                    className={errorClass}
                  >
                    <option value="">Select {schema.field_name.toLowerCase()}</option>
                    {((schema.field_options?.options as string[]) || []).map((opt) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </Select>
                )}

                {schema.field_type === 'checkbox' && (
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={value === 'true'}
                      onChange={(e) => updateSchemaField(schema.id, e.target.checked ? 'true' : 'false')}
                      className="h-4 w-4 rounded border-border"
                    />
                    <span className="text-sm font-medium">
                      {schema.field_name}
                      {schema.is_required && (
                        <span className="ml-1 text-destructive">*</span>
                      )}
                    </span>
                  </label>
                )}

                {schemaErrors[schema.id] && (
                  <p className="text-xs text-destructive">
                    {schema.field_name} is required
                  </p>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Freeform Custom Fields */}
      {allowFreeformFields && <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label>Additional Info</Label>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={addCustomField}
          >
            <Plus className="mr-1 h-4 w-4" />
            Add Field
          </Button>
        </div>

        {fields.length === 0 && (
          <p className="text-sm text-muted-foreground">
            No additional fields yet. Add one to include extra info.
          </p>
        )}

        {fields.map((field, index) => (
          <div key={field.id || `new-${index}`} className="flex items-start gap-2">
            <div className="flex-1 space-y-2">
              <Input
                placeholder="Field name"
                value={field.field_name}
                onChange={(e) => updateCustomField(index, 'field_name', e.target.value)}
              />
              <Input
                placeholder="Value"
                value={field.field_value}
                onChange={(e) => updateCustomField(index, 'field_value', e.target.value)}
              />
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => removeCustomField(index)}
              className="mt-1 text-muted-foreground hover:text-destructive"
              aria-label="Remove field"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        ))}
      </div>}

      {/* Actions */}
      <div className="flex gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          disabled={isSaving}
          className="flex-1"
        >
          Cancel
        </Button>
        <Button type="submit" loading={isSaving} className="flex-1">
          Save
        </Button>
      </div>
    </form>
  )
}
