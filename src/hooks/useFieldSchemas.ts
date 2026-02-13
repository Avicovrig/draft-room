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
      const { error } = await supabase.from('league_field_schemas').delete().eq('id', id)

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
      // Two-phase update to avoid unique constraint violations on field_order
      // Phase 1: Set all positions to negative temporary values
      const tempResults = await Promise.all(
        schemaIds.map((id, index) =>
          supabase
            .from('league_field_schemas')
            .update({ field_order: -(index + 1) })
            .eq('id', id)
        )
      )
      const tempErrors = tempResults.filter((r) => r.error)
      if (tempErrors.length > 0) throw tempErrors[0].error

      // Phase 2: Set final positive positions
      const finalResults = await Promise.all(
        schemaIds.map((id, index) =>
          supabase.from('league_field_schemas').update({ field_order: index }).eq('id', id)
        )
      )
      const finalErrors = finalResults.filter((r) => r.error)
      if (finalErrors.length > 0) {
        // Rollback: restore original order (0-based, matching schemaIds order before reorder)
        await Promise.all(
          schemaIds.map((id, index) =>
            supabase.from('league_field_schemas').update({ field_order: index }).eq('id', id)
          )
        )
        throw finalErrors[0].error
      }

      return { leagueId }
    },
    onMutate: async ({ leagueId, schemaIds }) => {
      await queryClient.cancelQueries({ queryKey: ['league-field-schemas', leagueId] })

      const previous = queryClient.getQueryData<LeagueFieldSchema[]>([
        'league-field-schemas',
        leagueId,
      ])

      if (previous) {
        const orderMap = new Map(schemaIds.map((id, i) => [id, i]))
        const updated = previous
          .map((s) => {
            const newOrder = orderMap.get(s.id)
            return newOrder !== undefined ? { ...s, field_order: newOrder } : s
          })
          .sort((a, b) => a.field_order - b.field_order)
        queryClient.setQueryData(['league-field-schemas', leagueId], updated)
      }

      return { previous, leagueId }
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(['league-field-schemas', context.leagueId], context.previous)
      }
    },
    onSettled: (_data, _err, variables) => {
      queryClient.invalidateQueries({ queryKey: ['league-field-schemas', variables.leagueId] })
    },
  })
}
