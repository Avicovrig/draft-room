import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { PlayerCustomField } from '@/lib/types'

export function useLeagueCustomFields(leagueId: string | undefined) {
  return useQuery({
    queryKey: ['league-custom-fields', leagueId],
    queryFn: async () => {
      if (!leagueId) return {}

      // Single query using join to avoid N+1
      const { data: customFields, error: fieldsError } = await supabase
        .from('player_custom_fields')
        .select('*, players!inner(league_id)')
        .eq('players.league_id', leagueId)
        .order('field_order', { ascending: true })

      if (fieldsError) throw fieldsError

      // Group by player_id
      const map: Record<string, PlayerCustomField[]> = {}
      for (const field of customFields || []) {
        if (!map[field.player_id]) {
          map[field.player_id] = []
        }
        // Strip the join data before storing
        const { players: _, ...fieldData } = field as PlayerCustomField & { players: unknown }
        map[field.player_id].push(fieldData as PlayerCustomField)
      }

      return map
    },
    enabled: !!leagueId,
    staleTime: 30_000,
  })
}

interface CreateCustomFieldInput {
  player_id: string
  field_name: string
  field_value?: string | null
  field_order?: number
}

export function useCreateCustomField() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (data: CreateCustomFieldInput) => {
      const { data: field, error } = await supabase
        .from('player_custom_fields')
        .insert({
          player_id: data.player_id,
          field_name: data.field_name,
          field_value: data.field_value ?? null,
          field_order: data.field_order ?? 0,
        })
        .select()
        .single()

      if (error) throw error
      return field as PlayerCustomField
    },
    onSuccess: (field) => {
      queryClient.invalidateQueries({ queryKey: ['player-profile', field.player_id] })
    },
  })
}

interface UpdateCustomFieldInput {
  id: string
  player_id: string
  field_name?: string
  field_value?: string | null
  field_order?: number
}

export function useUpdateCustomField() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, player_id, ...data }: UpdateCustomFieldInput) => {
      const { data: field, error } = await supabase
        .from('player_custom_fields')
        .update(data)
        .eq('id', id)
        .select()
        .single()

      if (error) throw error
      return { ...field, player_id } as PlayerCustomField
    },
    onSuccess: (field) => {
      queryClient.invalidateQueries({ queryKey: ['player-profile', field.player_id] })
    },
  })
}

export function useDeleteCustomField() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, player_id }: { id: string; player_id: string }) => {
      const { error } = await supabase.from('player_custom_fields').delete().eq('id', id)

      if (error) throw error
      return { player_id }
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['player-profile', data.player_id] })
    },
  })
}

interface UpsertCustomFieldsInput {
  playerId: string
  leagueId?: string
  fields: Array<{
    id?: string
    field_name: string
    field_value: string
    field_order: number
    schema_id?: string | null
  }>
  deletedIds: string[]
}

export function useUpsertCustomFields() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ playerId, leagueId, fields, deletedIds }: UpsertCustomFieldsInput) => {
      // Delete removed fields
      if (deletedIds.length > 0) {
        const { error: deleteError } = await supabase
          .from('player_custom_fields')
          .delete()
          .in('id', deletedIds)

        if (deleteError) throw deleteError
      }

      // Batch upsert fields — separate updates from inserts
      const updates = fields.filter((f) => f.id)
      const inserts = fields.filter((f) => !f.id)

      if (updates.length > 0) {
        await Promise.all(
          updates.map((field) => {
            return supabase
              .from('player_custom_fields')
              .update({
                field_name: field.field_name,
                field_value: field.field_value || null,
                field_order: field.field_order,
                schema_id: field.schema_id ?? null,
              })
              .eq('id', field.id!)
              .then(({ error }) => {
                if (error) throw error
              })
          })
        )
      }

      if (inserts.length > 0) {
        const { error } = await supabase.from('player_custom_fields').insert(
          inserts.map((field) => ({
            player_id: playerId,
            field_name: field.field_name,
            field_value: field.field_value || null,
            field_order: field.field_order,
            schema_id: field.schema_id ?? null,
          }))
        )
        if (error) throw error
      }

      return { playerId, leagueId }
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['player-profile', data.playerId] })
      if (data.leagueId) {
        queryClient.invalidateQueries({ queryKey: ['league', data.leagueId] })
        queryClient.invalidateQueries({ queryKey: ['league-custom-fields', data.leagueId] })
      }
    },
  })
}
