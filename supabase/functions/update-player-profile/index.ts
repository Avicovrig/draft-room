import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const {
      playerId,
      editToken,
      bio,
      profile_picture_url,
      customFields,
      deletedCustomFieldIds,
    } = await req.json()

    if (!playerId || !editToken) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (!UUID_RE.test(playerId) || !UUID_RE.test(editToken)) {
      return new Response(
        JSON.stringify({ error: 'Invalid field format' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Create admin client to bypass RLS
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { persistSession: false } }
    )

    // Verify edit token
    const { data: player, error: playerError } = await supabaseAdmin
      .from('players')
      .select('id, league_id')
      .eq('id', playerId)
      .eq('edit_token', editToken)
      .single()

    if (playerError || !player) {
      return new Response(
        JSON.stringify({ error: 'Invalid player or token' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Validate required schema fields
    if (customFields && customFields.length > 0) {
      const { data: requiredSchemas } = await supabaseAdmin
        .from('league_field_schemas')
        .select('id, field_name')
        .eq('league_id', player.league_id)
        .eq('is_required', true)

      if (requiredSchemas && requiredSchemas.length > 0) {
        const submittedBySchemaId = new Map<string, string>()
        for (const field of customFields) {
          if (field.schema_id) {
            submittedBySchemaId.set(field.schema_id, field.field_value || '')
          }
        }

        const missingFields: string[] = []
        for (const schema of requiredSchemas) {
          const value = submittedBySchemaId.get(schema.id)
          if (!value || !value.trim()) {
            missingFields.push(schema.field_name)
          }
        }

        if (missingFields.length > 0) {
          return new Response(
            JSON.stringify({ error: `Required fields missing: ${missingFields.join(', ')}` }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }
      }
    }

    // Update player profile
    const updateData: Record<string, unknown> = {}
    if (bio !== undefined) updateData.bio = bio
    if (profile_picture_url !== undefined) updateData.profile_picture_url = profile_picture_url

    if (Object.keys(updateData).length > 0) {
      const { error: updateError } = await supabaseAdmin
        .from('players')
        .update(updateData)
        .eq('id', playerId)

      if (updateError) {
        console.error('Failed to update player:', updateError)
        return new Response(
          JSON.stringify({ error: 'Failed to update profile' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
    }

    // Delete removed custom fields
    if (deletedCustomFieldIds && deletedCustomFieldIds.length > 0) {
      const { error: deleteError } = await supabaseAdmin
        .from('player_custom_fields')
        .delete()
        .in('id', deletedCustomFieldIds)
        .eq('player_id', playerId)

      if (deleteError) {
        console.error('Failed to delete custom fields:', deleteError)
      }
    }

    // Upsert custom fields
    if (customFields && customFields.length > 0) {
      for (const field of customFields) {
        if (field.id) {
          // Update existing
          const { error } = await supabaseAdmin
            .from('player_custom_fields')
            .update({
              field_name: field.field_name,
              field_value: field.field_value || null,
              field_order: field.field_order,
              schema_id: field.schema_id || null,
            })
            .eq('id', field.id)
            .eq('player_id', playerId)

          if (error) {
            console.error('Failed to update custom field:', error)
          }
        } else {
          // Insert new
          const { error } = await supabaseAdmin
            .from('player_custom_fields')
            .insert({
              player_id: playerId,
              field_name: field.field_name,
              field_value: field.field_value || null,
              field_order: field.field_order,
              schema_id: field.schema_id || null,
            })

          if (error) {
            console.error('Failed to insert custom field:', error)
          }
        }
      }
    }

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Update player profile error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
