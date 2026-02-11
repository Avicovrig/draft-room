import { getCorsHeaders, handleCors } from '../_shared/cors.ts'
import { createAdminClient } from '../_shared/supabase.ts'
import {
  UUID_RE,
  DANGEROUS_PATTERN,
  errorResponse,
  requirePost,
  requireJson,
} from '../_shared/validation.ts'
import { authenticateManager } from '../_shared/auth.ts'
import { rateLimit } from '../_shared/rateLimit.ts'
import { logAudit, getClientIp } from '../_shared/audit.ts'
import type { CopyLeagueRequest } from '../_shared/types.ts'

Deno.serve(async (req) => {
  const corsResponse = handleCors(req)
  if (corsResponse) return corsResponse

  const methodResponse = requirePost(req)
  if (methodResponse) return methodResponse

  const jsonResponse = requireJson(req)
  if (jsonResponse) return jsonResponse

  const rateLimitResponse = rateLimit(req, { windowMs: 60_000, maxRequests: 5 })
  if (rateLimitResponse) return rateLimitResponse

  try {
    const { sourceLeagueId, newLeagueName } = (await req.json()) as CopyLeagueRequest

    // Validate inputs
    if (!sourceLeagueId || !newLeagueName) {
      return errorResponse('Missing required fields', 400, req)
    }

    if (!UUID_RE.test(sourceLeagueId)) {
      return errorResponse('Invalid field format', 400, req)
    }

    const trimmedName = newLeagueName.trim()
    if (trimmedName.length < 1 || trimmedName.length > 100) {
      return errorResponse('League name must be 1-100 characters', 400, req)
    }

    if (DANGEROUS_PATTERN.test(trimmedName)) {
      return errorResponse('League name contains invalid characters', 400, req)
    }

    const supabaseAdmin = createAdminClient()

    // Authenticate as manager of the source league
    const authResult = await authenticateManager(req, sourceLeagueId, supabaseAdmin)
    if (authResult instanceof Response) return authResult
    const { user } = authResult

    // Fetch source league with captains, players, and field schemas
    const { data: sourceLeague, error: leagueError } = await supabaseAdmin
      .from('leagues')
      .select(
        `
        id, draft_type, time_limit_seconds, allow_player_custom_fields, scheduled_start_at,
        captains (id, name, is_participant, draft_position, player_id, team_color, team_name, team_photo_url),
        players (id, name, bio, profile_picture_url)
      `
      )
      .eq('id', sourceLeagueId)
      .single()

    if (leagueError || !sourceLeague) {
      return errorResponse('Failed to fetch source league', 500, req)
    }

    // Fetch field schemas
    const { data: sourceSchemas, error: schemasError } = await supabaseAdmin
      .from('league_field_schemas')
      .select('id, field_name, field_type, is_required, field_order, field_options')
      .eq('league_id', sourceLeagueId)

    if (schemasError) {
      return errorResponse('Failed to fetch field schemas', 500, req)
    }

    // Fetch player custom fields for all source players
    const sourcePlayerIds = (sourceLeague.players ?? []).map((p: { id: string }) => p.id)
    let sourceCustomFields: Array<{
      id: string
      player_id: string
      schema_id: string | null
      field_name: string
      field_value: string | null
      field_order: number
    }> = []
    if (sourcePlayerIds.length > 0) {
      const { data: customFields, error: cfError } = await supabaseAdmin
        .from('player_custom_fields')
        .select('id, player_id, schema_id, field_name, field_value, field_order')
        .in('player_id', sourcePlayerIds)

      if (cfError) {
        return errorResponse('Failed to fetch custom fields', 500, req)
      }
      sourceCustomFields = customFields ?? []
    }

    // Fetch captain draft queues
    const sourceCaptainIds = (sourceLeague.captains ?? []).map((c: { id: string }) => c.id)
    let sourceDraftQueues: Array<{
      captain_id: string
      player_id: string
      position: number
    }> = []
    if (sourceCaptainIds.length > 0) {
      const { data: queues, error: queueError } = await supabaseAdmin
        .from('captain_draft_queues')
        .select('captain_id, player_id, position')
        .in('captain_id', sourceCaptainIds)

      if (queueError) {
        return errorResponse('Failed to fetch draft queues', 500, req)
      }
      sourceDraftQueues = queues ?? []
    }

    // Step A: Create new league
    const { data: newLeague, error: createLeagueError } = await supabaseAdmin
      .from('leagues')
      .insert({
        name: trimmedName,
        manager_id: user.id,
        status: 'not_started',
        draft_type: sourceLeague.draft_type,
        time_limit_seconds: sourceLeague.time_limit_seconds,
        allow_player_custom_fields: sourceLeague.allow_player_custom_fields,
        current_pick_index: 0,
      })
      .select('id')
      .single()

    if (createLeagueError || !newLeague) {
      console.error('Failed to create new league:', createLeagueError)
      return errorResponse('Failed to create new league', 500, req)
    }

    const newLeagueId = newLeague.id

    try {
      // Step B: Copy captains (new IDs generated by DB, fresh access_token via default)
      const oldCaptainIdMap = new Map<string, string>()
      const sourceCaptains = sourceLeague.captains ?? []

      if (sourceCaptains.length > 0) {
        const captainInserts = sourceCaptains.map(
          (c: {
            name: string
            is_participant: boolean
            draft_position: number
            team_color: string | null
            team_name: string | null
            team_photo_url: string | null
          }) => ({
            league_id: newLeagueId,
            name: c.name,
            is_participant: c.is_participant,
            draft_position: c.draft_position,
            team_color: c.team_color,
            team_name: c.team_name,
            team_photo_url: c.team_photo_url,
            auto_pick_enabled: false,
            consecutive_timeout_picks: 0,
          })
        )

        const { data: newCaptains, error: captainsError } = await supabaseAdmin
          .from('captains')
          .insert(captainInserts)
          .select('id, draft_position')

        if (captainsError || !newCaptains) {
          console.error('Failed to copy captains:', captainsError)
          throw new Error('Failed to copy captains')
        }

        // Build old → new captain ID map using draft_position as the join key
        for (const newCaptain of newCaptains) {
          const oldCaptain = sourceCaptains.find(
            (c: { draft_position: number }) => c.draft_position === newCaptain.draft_position
          )
          if (oldCaptain) {
            oldCaptainIdMap.set(oldCaptain.id, newCaptain.id)
          }
        }
      }

      // Step C: Copy players (new IDs generated by DB, fresh edit_token via default)
      const oldPlayerIdMap = new Map<string, string>()
      const sourcePlayers = sourceLeague.players ?? []

      if (sourcePlayers.length > 0) {
        const playerInserts = sourcePlayers.map(
          (p: { name: string; bio: string | null; profile_picture_url: string | null }) => ({
            league_id: newLeagueId,
            name: p.name,
            bio: p.bio,
            profile_picture_url: p.profile_picture_url,
            drafted_by_captain_id: null,
            draft_pick_number: null,
          })
        )

        const { data: newPlayers, error: playersError } = await supabaseAdmin
          .from('players')
          .insert(playerInserts)
          .select('id, name')

        if (playersError || !newPlayers) {
          console.error('Failed to copy players:', playersError)
          throw new Error('Failed to copy players')
        }

        // Build old → new player ID map using name + index as join key
        // Players are returned in insert order, which matches sourcePlayers order
        for (let i = 0; i < sourcePlayers.length; i++) {
          if (i < newPlayers.length) {
            oldPlayerIdMap.set(sourcePlayers[i].id, newPlayers[i].id)
          }
        }
      }

      // Step D: Remap captain player_id for participant captains
      const participantCaptains = sourceCaptains.filter(
        (c: { is_participant: boolean; player_id: string | null }) =>
          c.is_participant && c.player_id
      )
      for (const oldCaptain of participantCaptains) {
        const newCaptainId = oldCaptainIdMap.get(oldCaptain.id)
        const newPlayerId = oldPlayerIdMap.get(oldCaptain.player_id!)
        if (newCaptainId && newPlayerId) {
          const { error: linkError } = await supabaseAdmin
            .from('captains')
            .update({ player_id: newPlayerId })
            .eq('id', newCaptainId)

          if (linkError) {
            console.error('Failed to link captain to player:', linkError)
            // Non-critical: continue without linking
          }
        }
      }

      // Step E: Copy field schemas
      const oldSchemaIdMap = new Map<string, string>()

      if (sourceSchemas && sourceSchemas.length > 0) {
        const schemaInserts = sourceSchemas.map(
          (s: {
            field_name: string
            field_type: string
            is_required: boolean
            field_order: number
            field_options: string[] | null
          }) => ({
            league_id: newLeagueId,
            field_name: s.field_name,
            field_type: s.field_type,
            is_required: s.is_required,
            field_order: s.field_order,
            field_options: s.field_options,
          })
        )

        const { data: newSchemas, error: schemasInsertError } = await supabaseAdmin
          .from('league_field_schemas')
          .insert(schemaInserts)
          .select('id, field_name, field_order')

        if (schemasInsertError || !newSchemas) {
          console.error('Failed to copy field schemas:', schemasInsertError)
          throw new Error('Failed to copy field schemas')
        }

        // Build old → new schema ID map using field_name + field_order as join key
        for (const newSchema of newSchemas) {
          const oldSchema = sourceSchemas.find(
            (s: { field_name: string; field_order: number }) =>
              s.field_name === newSchema.field_name && s.field_order === newSchema.field_order
          )
          if (oldSchema) {
            oldSchemaIdMap.set(oldSchema.id, newSchema.id)
          }
        }
      }

      // Step F: Copy player custom fields with remapped IDs
      if (sourceCustomFields.length > 0) {
        const customFieldInserts = sourceCustomFields
          .filter((cf) => oldPlayerIdMap.has(cf.player_id))
          .map((cf) => ({
            player_id: oldPlayerIdMap.get(cf.player_id)!,
            schema_id: cf.schema_id ? (oldSchemaIdMap.get(cf.schema_id) ?? null) : null,
            field_name: cf.field_name,
            field_value: cf.field_value,
            field_order: cf.field_order,
          }))

        if (customFieldInserts.length > 0) {
          const { error: cfInsertError } = await supabaseAdmin
            .from('player_custom_fields')
            .insert(customFieldInserts)

          if (cfInsertError) {
            console.error('Failed to copy custom fields:', cfInsertError)
            // Non-critical: continue without custom fields
          }
        }
      }

      // Step G: Copy captain draft queues with remapped IDs
      if (sourceDraftQueues.length > 0) {
        const queueInserts = sourceDraftQueues
          .filter((q) => oldCaptainIdMap.has(q.captain_id) && oldPlayerIdMap.has(q.player_id))
          .map((q) => ({
            captain_id: oldCaptainIdMap.get(q.captain_id)!,
            player_id: oldPlayerIdMap.get(q.player_id)!,
            position: q.position,
          }))

        if (queueInserts.length > 0) {
          const { error: queueInsertError } = await supabaseAdmin
            .from('captain_draft_queues')
            .insert(queueInserts)

          if (queueInsertError) {
            console.error('Failed to copy draft queues:', queueInsertError)
            // Non-critical: continue without draft queues
          }
        }
      }

      logAudit(supabaseAdmin, {
        action: 'league_copied',
        leagueId: newLeagueId,
        actorType: 'manager',
        actorId: user.id,
        metadata: {
          sourceLeagueId,
          captains: sourceCaptains.length,
          players: sourcePlayers.length,
          fieldSchemas: (sourceSchemas ?? []).length,
        },
        ipAddress: getClientIp(req),
      })

      return new Response(
        JSON.stringify({
          success: true,
          leagueId: newLeagueId,
          counts: {
            captains: sourceCaptains.length,
            players: sourcePlayers.length,
            fieldSchemas: (sourceSchemas ?? []).length,
          },
        }),
        {
          status: 200,
          headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
        }
      )
    } catch (copyError) {
      // Rollback: delete the new league (FK cascades will clean up related rows)
      console.error('Copy failed, rolling back new league:', copyError)
      const { error: deleteError } = await supabaseAdmin
        .from('leagues')
        .delete()
        .eq('id', newLeagueId)

      if (deleteError) {
        console.error('CRITICAL: Rollback failed (delete new league):', {
          newLeagueId,
          deleteError,
        })
      }

      return errorResponse('Failed to copy league', 500, req)
    }
  } catch (error) {
    console.error('Copy league error:', error)
    return errorResponse('Internal server error', 500, req)
  }
})
