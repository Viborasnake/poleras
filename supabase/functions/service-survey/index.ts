import { createClient } from 'npm:@supabase/supabase-js@2.98.0'
import { surveyTokenPattern, validQuestionnaire, validateSurveyAnswers } from '../_shared/service-survey.js'

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Cache-Control': 'no-store',
  'Content-Type': 'application/json',
}

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers })

Deno.serve(async request => {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers })
  if (request.method !== 'POST') return json({ error: 'Método no permitido.' }, 405)

  const body = await request.json().catch(() => null)
  if (typeof body?.token !== 'string' || !surveyTokenPattern.test(body.token)) {
    return json({ error: 'Este enlace de encuesta no está disponible.' }, 404)
  }

  const url = Deno.env.get('SUPABASE_URL')
  const secret = Deno.env.get('SUPABASE_SECRET_KEY') || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!url || !secret) return json({ error: 'La encuesta no está disponible en este momento.' }, 503)

  const admin = createClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false } })
  const { data: invitation, error } = await admin.from('service_survey_invitations')
    .select('questionnaire,responded_at').eq('token', body.token).maybeSingle()
  if (error) return json({ error: 'No pudimos cargar la encuesta. Intenta nuevamente.' }, 503)
  if (!invitation || !validQuestionnaire(invitation.questionnaire)) {
    return json({ error: 'Este enlace de encuesta no está disponible.' }, 404)
  }
  if (invitation.responded_at) return json({ completed: true })
  if (!Object.hasOwn(body, 'answers')) return json({ survey: invitation.questionnaire })

  const answers = validateSurveyAnswers(invitation.questionnaire.questions, body.answers)
  if (!answers) return json({ error: 'Revisa las preguntas obligatorias y vuelve a intentar.' }, 422)
  const { data: saved, error: saveError } = await admin.from('service_survey_invitations')
    .update({ answers, responded_at: new Date().toISOString() }).eq('token', body.token)
    .is('responded_at', null).select('responded_at').maybeSingle()
  if (saveError) return json({ error: 'No pudimos guardar tu respuesta. Intenta nuevamente.' }, 503)
  return json({ completed: true, submitted: Boolean(saved) })
})
