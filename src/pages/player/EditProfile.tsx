import { useState } from 'react'
import { useParams, useSearchParams, useNavigate } from 'react-router-dom'
import { ExternalLink } from 'lucide-react'
import { Header } from '@/components/layout/Header'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { PlayerProfileForm, type ProfileFormData } from '@/components/player/PlayerProfileForm'
import { usePlayerByEditToken } from '@/hooks/usePlayerProfile'
import { useLeague } from '@/hooks/useLeagues'
import { useLeagueFieldSchemas } from '@/hooks/useFieldSchemas'
import { useToast } from '@/components/ui/Toast'
import { supabase } from '@/lib/supabase'

export function EditProfile() {
  const { playerId } = useParams<{ playerId: string }>()
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token')
  const navigate = useNavigate()
  const { addToast } = useToast()
  const [saved, setSaved] = useState(false)

  const { data: player, isLoading, error, refetch } = usePlayerByEditToken(playerId, token)
  const { data: league } = useLeague(player?.league_id)
  const { data: fieldSchemas } = useLeagueFieldSchemas(player?.league_id)
  const linkedCaptain = league?.captains.find((c) => c.player_id === player?.id)

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="container mx-auto px-4 py-8">
          <div className="flex items-center justify-center py-12">
            <div className="text-muted-foreground">Loading profile...</div>
          </div>
        </main>
      </div>
    )
  }

  if (error || !player) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="container mx-auto px-4 py-8">
          <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-center text-destructive">
            Invalid or expired profile link
          </div>
        </main>
      </div>
    )
  }

  async function handleSave(data: ProfileFormData) {
    if (!player || !playerId || !token) return

    try {
      // Upload profile picture if provided
      let profilePictureUrl = player.profile_picture_url
      if (data.profilePictureBlob) {
        const filePath = `${player.league_id}/${player.id}.jpg`

        // Upload directly to storage (no auth required with updated policy)
        const { error: uploadError } = await supabase.storage
          .from('profile-pictures')
          .upload(filePath, data.profilePictureBlob, {
            upsert: true,
            contentType: 'image/jpeg',
          })

        if (uploadError) {
          console.error('Upload error:', uploadError)
          throw new Error('Failed to upload profile picture')
        }

        // Get public URL
        const { data: urlData } = supabase.storage
          .from('profile-pictures')
          .getPublicUrl(filePath)

        profilePictureUrl = `${urlData.publicUrl}?t=${Date.now()}`
      }

      // Update profile via edge function
      const response = await supabase.functions.invoke('update-player-profile', {
        body: {
          playerId,
          editToken: token,
          bio: data.bio,
          profile_picture_url: profilePictureUrl,
          customFields: data.customFields,
          deletedCustomFieldIds: data.deletedCustomFieldIds,
        },
      })

      if (response.error) {
        throw new Error(response.error.message || 'Failed to save profile')
      }

      if (response.data?.error) {
        throw new Error(response.data.error)
      }

      addToast('Profile saved successfully!', 'success')
      setSaved(true)
      refetch()
    } catch (err) {
      console.error('Save error:', err)
      addToast(err instanceof Error ? err.message : 'Failed to save profile', 'error')
    }
  }

  function handleGoToDraft() {
    if (!player || !league) return

    if (linkedCaptain) {
      navigate(`/league/${player.league_id}/captain?token=${linkedCaptain.access_token}`)
    } else {
      window.open(`/league/${player.league_id}/spectate?token=${league.spectator_token}`, '_blank')
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container mx-auto px-4 py-8">
        <div className="mx-auto max-w-lg">
          <Card>
            <CardHeader>
              <CardTitle>Edit Your Profile</CardTitle>
            </CardHeader>
            <CardContent>
              {saved ? (
                <div className="space-y-4 text-center">
                  <div className="rounded-lg border border-green-500/50 bg-green-500/10 p-4 text-green-600 dark:text-green-400">
                    Your profile has been saved!
                  </div>
                  <div className="flex flex-col gap-2">
                    <Button onClick={() => setSaved(false)}>
                      Edit Again
                    </Button>
                    {linkedCaptain ? (
                      <Button variant="outline" onClick={handleGoToDraft}>
                        Go to Draft Room
                      </Button>
                    ) : (
                      <Button variant="outline" onClick={handleGoToDraft}>
                        <ExternalLink className="mr-2 h-4 w-4" />
                        Watch Draft
                      </Button>
                    )}
                  </div>
                </div>
              ) : (
                <PlayerProfileForm
                  player={player}
                  customFields={player.custom_fields}
                  fieldSchemas={fieldSchemas}
                  allowFreeformFields={league?.allow_player_custom_fields ?? true}
                  onSave={handleSave}
                  onCancel={() => window.history.back()}
                />
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  )
}
