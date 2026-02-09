import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { PlayerPublic, PlayerPublicWithCustomFields, ValidatedPlayerProfile } from '@/lib/types'

const PLAYER_COLUMNS = 'id, league_id, name, drafted_by_captain_id, draft_pick_number, bio, profile_picture_url, created_at'

export function usePlayerProfile(playerId: string | undefined) {
  return useQuery({
    queryKey: ['player-profile', playerId],
    queryFn: async () => {
      if (!playerId) return null

      const { data: player, error: playerError } = await supabase
        .from('players')
        .select(PLAYER_COLUMNS)
        .eq('id', playerId)
        .single()

      if (playerError) throw playerError

      const { data: customFields, error: fieldsError } = await supabase
        .from('player_custom_fields')
        .select('*')
        .eq('player_id', playerId)
        .order('field_order', { ascending: true })

      if (fieldsError) throw fieldsError

      return {
        ...player,
        custom_fields: customFields,
      } as PlayerPublicWithCustomFields
    },
    enabled: !!playerId,
    staleTime: 30 * 1000,
  })
}

export function usePlayerByEditToken(playerId: string | undefined, editToken: string | null) {
  return useQuery({
    queryKey: ['player-by-token', playerId, editToken],
    queryFn: async () => {
      if (!playerId || !editToken) return null

      const { data, error } = await supabase.rpc('validate_player_edit_token', {
        p_player_id: playerId,
        p_token: editToken,
      })

      if (error) {
        console.error('Token validation error:', error)
        return null
      }

      return (data as ValidatedPlayerProfile) ?? null
    },
    enabled: !!playerId && !!editToken,
    staleTime: 5 * 60 * 1000,
  })
}

interface UpdatePlayerProfileInput {
  playerId: string
  bio?: string | null
  profile_picture_url?: string | null
}

export function useUpdatePlayerProfile() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ playerId, ...data }: UpdatePlayerProfileInput) => {
      const { data: player, error } = await supabase
        .from('players')
        .update(data)
        .eq('id', playerId)
        .select(PLAYER_COLUMNS)
        .single()

      if (error) throw error
      return player as PlayerPublic
    },
    onSuccess: (player) => {
      queryClient.invalidateQueries({ queryKey: ['player-profile', player.id] })
      queryClient.invalidateQueries({ queryKey: ['league'] })
    },
  })
}

interface UploadProfilePictureInput {
  playerId: string
  leagueId: string
  blob: Blob
}

export function useUploadProfilePicture() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ playerId, leagueId, blob }: UploadProfilePictureInput) => {
      const filePath = `${leagueId}/${playerId}.jpg`

      // Upload to storage
      const { error: uploadError } = await supabase.storage
        .from('profile-pictures')
        .upload(filePath, blob, {
          upsert: true,
          contentType: 'image/jpeg',
        })

      if (uploadError) throw uploadError

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('profile-pictures')
        .getPublicUrl(filePath)

      // Add cache buster to URL
      const publicUrl = `${urlData.publicUrl}?t=${Date.now()}`

      // Update player record
      const { data: player, error: updateError } = await supabase
        .from('players')
        .update({ profile_picture_url: publicUrl })
        .eq('id', playerId)
        .select(PLAYER_COLUMNS)
        .single()

      if (updateError) throw updateError
      return player as PlayerPublic
    },
    onSuccess: (player) => {
      queryClient.invalidateQueries({ queryKey: ['player-profile', player.id] })
      queryClient.invalidateQueries({ queryKey: ['league'] })
    },
  })
}
