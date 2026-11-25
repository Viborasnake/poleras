import type { SupabaseClient } from 'npm:@supabase/supabase-js@2.98.0'
import { validQuestionnaire } from './service-survey.js'

export async function serviceSurveyLink(admin: SupabaseClient, orderId: string, preview = false) {
  const readInvitation = () => admin.from('service_survey_invitations')
    .select('token,sent_at').eq('order_id', orderId).maybeSingle()
  const { data: invitation, error } = await readInvitation()
  if (error) throw error
  if (invitation) return { token: preview ? 'vista-previa' : invitation.token, sent: Boolean(invitation.sent_at) }

  const { data: questionnaire, error: surveyError } = await admin.from('service_surveys')
    .select('id,title,description,questions').eq('active', true).maybeSingle()
  if (surveyError) throw surveyError
  if (!questionnaire || !validQuestionnaire(questionnaire)) return null
  if (preview) return { token: 'vista-previa', sent: false }

  const { id, ...snapshot } = questionnaire
  const { data: created, error: createError } = await admin.from('service_survey_invitations')
    .upsert({ order_id: orderId, survey_id: id, questionnaire: snapshot }, { onConflict: 'order_id', ignoreDuplicates: true })
    .select('token').maybeSingle()
  if (createError) throw createError
  if (created) return { token: created.token, sent: false }
  const existing = await readInvitation()
  if (existing.error || !existing.data) throw existing.error || new Error('No encontramos la invitación.')
  return { token: existing.data.token, sent: Boolean(existing.data.sent_at) }
}

export async function markServiceSurveySent(admin: SupabaseClient, orderId: string) {
  const { error } = await admin.from('service_survey_invitations')
    .update({ sent_at: new Date().toISOString() }).eq('order_id', orderId).is('sent_at', null)
  if (error) console.error('No pudimos registrar el envío de la encuesta', error)
}
