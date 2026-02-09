import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { LeagueFieldSchema } from '@/lib/types'

export function useLeagueFieldSchemas(leagueId: string | undefined) {
  return useQuery({
    queryKey: ['league-field-schemas', leagueId],
    queryFn: async () => {
      if (!leagueId) return []

      const { data, error } = await supabase
        .from('league_field_schemas')
        .select('*')
        .eq('league_id', leagueId)
        .order('field_order', { ascending: true })

      if (error) throw error
      return (data || []) as LeagueFieldSchema[]
    },
    enabled: !!leagueId,
    staleTime: 5 * 60 * 1000,
  })
}

interface CreateFieldSchemaInput {
  league_id: string
  field_name: string
  field_type?: string
  is_required?: boolean
  field_order: number
  field_options?: Record<string, unknown> | null
}

export function useCreateFieldSchema() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (data: CreateFieldSchemaInput) => {
      const { data: schema, error } = await supabase
        .from('league_field_schemas')
        .insert({
          league_id: data.league_id,
          field_name: data.field_name,
          field_type: data.field_type ?? 'text',
          is_required: data.is_required ?? false,
          field_order: data.field_order,
          field_options: data.field_options ?? null,
        })
        .select()
        .single()

      if (error) throw error
      return schema as LeagueFieldSchema
    },
    onSuccess: (schema) => {
      queryClient.invalidateQueries({ queryKey: ['league-field-schemas', schema.league_id] })
    },
  })
}

interface UpdateFieldSchemaInput {
  id: string
  leagueId: string
  field_name?: string
  field_type?: string
  is_required?: boolean
  field_order?: number
  field_options?: Record<string, unknown> | null
}

export function useUpdateFieldSchema() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, leagueId, ...data }: UpdateFieldSchemaInput) => {
      const { data: schema, error } = await supabase
        .from('league_field_schemas')
        .update(data)
        .eq('id', id)
        .select()
        .single()

      if (error) throw error
      return { ...(schema as LeagueFieldSchema), leagueId }
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['league-field-schemas', result.leagueId] })
    },
  })
}

export function useDeleteFieldSchema() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, leagueId }: { id: string; leagueId: string }) => {
      const { error } = await supabase
        .from('league_field_schemas')
        .delete()
        .eq('id', id)

      if (error) throw error
      return { leagueId }
    },
    onSuccess: ({ leagueId }) => {
      queryClient.invalidateQueries({ queryKey: ['league-field-schemas', leagueId] })
      queryClient.invalidateQueries({ queryKey: ['league-custom-fields', leagueId] })
    },
  })
}

export function useReorderFieldSchemas() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ leagueId, schemaIds }: { leagueId: string; schemaIds: string[] }) => {
      const updates = schemaIds.map((id, index) =>
        supabase
          .from('league_field_schemas')
          .update({ field_order: index })
          .eq('id', id)
      )

      const results = await Promise.all(updates)
      const errors = results.filter((r) => r.error)
      if (errors.length > 0) throw errors[0].error

      return { leagueId }
    },
    onSuccess: ({ leagueId }) => {
      queryClient.invalidateQueries({ queryKey: ['league-field-schemas', leagueId] })
    },
  })
}
