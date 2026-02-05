import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Label } from '@/components/ui/Label'
import { Textarea } from '@/components/ui/Textarea'
import { ImageCropper } from '@/components/ui/ImageCropper'
import { X, Plus, Camera } from 'lucide-react'
import type { Player, PlayerCustomField } from '@/lib/types'

interface PlayerProfileFormProps {
  player: Player
  customFields?: PlayerCustomField[]
  onSave: (data: ProfileFormData) => Promise<void>
  onCancel: () => void
}

export interface ProfileFormData {
  bio: string | null
  height: string | null
  weight: string | null
  birthday: string | null
  hometown: string | null
  profilePictureBlob?: Blob | null
  customFields: Array<{ id?: string; field_name: string; field_value: string; field_order: number }>
  deletedCustomFieldIds: string[]
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

export function PlayerProfileForm({
  player,
  customFields = [],
  onSave,
  onCancel,
}: PlayerProfileFormProps) {
  const [bio, setBio] = useState(player.bio || '')
  const [height, setHeight] = useState(player.height || '')
  const [weight, setWeight] = useState(player.weight || '')
  const [birthday, setBirthday] = useState(player.birthday || '')
  const [hometown, setHometown] = useState(player.hometown || '')
  const [profilePictureBlob, setProfilePictureBlob] = useState<Blob | null>(null)
  const [previewUrl, setPreviewUrl] = useState(player.profile_picture_url || '')
  const [showCropper, setShowCropper] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  // Custom fields state
  const [fields, setFields] = useState<Array<{ id?: string; field_name: string; field_value: string; field_order: number }>>(
    customFields.map((f) => ({
      id: f.id,
      field_name: f.field_name,
      field_value: f.field_value || '',
      field_order: f.field_order,
    }))
  )
  const [deletedFieldIds, setDeletedFieldIds] = useState<string[]>([])

  function handleCropComplete(blob: Blob) {
    setProfilePictureBlob(blob)
    setPreviewUrl(URL.createObjectURL(blob))
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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setIsSaving(true)

    try {
      await onSave({
        bio: bio || null,
        height: height || null,
        weight: weight || null,
        birthday: birthday || null,
        hometown: hometown || null,
        profilePictureBlob,
        customFields: fields.filter((f) => f.field_name.trim()),
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

      {/* Default Stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="height">Height</Label>
          <Input
            id="height"
            placeholder="e.g., 6'2&quot;"
            value={height}
            onChange={(e) => setHeight(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="weight">Weight</Label>
          <Input
            id="weight"
            placeholder="e.g., 185 lbs"
            value={weight}
            onChange={(e) => setWeight(e.target.value)}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="birthday">Birthday</Label>
          <Input
            id="birthday"
            type="date"
            value={birthday}
            onChange={(e) => setBirthday(e.target.value)}
            max={new Date().toISOString().split('T')[0]}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="hometown">Hometown</Label>
          <Input
            id="hometown"
            placeholder="e.g., Detroit, MI"
            value={hometown}
            onChange={(e) => setHometown(e.target.value)}
          />
        </div>
      </div>

      {/* Custom Fields */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label>Custom Fields</Label>
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
            No custom fields yet. Add one to include additional info.
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
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        ))}
      </div>

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
        <Button type="submit" disabled={isSaving} className="flex-1">
          {isSaving ? 'Saving...' : 'Save'}
        </Button>
      </div>
    </form>
  )
}
