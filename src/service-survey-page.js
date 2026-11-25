import './design-system.css';
import './accessibility.css';
import './service-survey-page.css';
import { supabase } from './storefront-runtime.js';
import { SURVEY_LIMITS, SURVEY_RATINGS, surveyTokenPattern, validQuestionnaire } from '../supabase/functions/_shared/service-survey.js';

const root = document.querySelector('#service-survey');
const token = location.hash.slice(1);
const safe = value => String(value).replace(/[&<>"']/g, char => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
})[char]);

function showMessage(title, message, canRetry = false) {
  root.innerHTML = `<h1 tabindex="-1">${title}</h1><p>${message}</p>${canRetry ?
    '<button type="button" class="ds-cta ds-cta--sm">Volver a intentar</button>' :
    '<a class="service-survey-home" href="/">Ir a la tienda</a>'}`;
  root.querySelector('h1').focus();
  if (canRetry) root.querySelector('button').onclick = loadSurvey;
}

async function requestSurvey(body) {
  const { data, error } = await supabase.functions.invoke('service-survey', { body: { token, ...body } });
  if (error) {
    const response = error.context;
    const payload = await response?.json?.().catch(() => null);
    return { error: payload?.error || 'Hubo un problema de conexión. Intenta nuevamente.', status: response?.status };
  }
  return data || { error: 'Hubo un problema de conexión. Intenta nuevamente.' };
}

function questionMarkup(question) {
  const id = safe(question.id);
  const label = `${safe(question.label)}${question.required ? '' : ' <small>(opcional)</small>'}`;
  if (question.type === 'text') {
    return `<div class="survey-question"><label for="survey-${id}">${label}</label><textarea class="ds-field" id="survey-${id}" name="${id}" rows="4" maxlength="${SURVEY_LIMITS.comment}" ${question.required ? 'required' : ''}></textarea></div>`;
  }
  return `<fieldset class="survey-question"><legend>${label}</legend><div class="survey-rating">${SURVEY_RATINGS.map(rating =>
    `<label><input type="radio" name="${id}" value="${rating}" ${question.required ? 'required' : ''}> <span>${rating}</span></label>`).join('')}</div><div class="survey-rating-scale"><span>1 · Muy mala</span><span>5 · Muy buena</span></div></fieldset>`;
}

function renderSurvey(survey) {
  root.innerHTML = `<h1 tabindex="-1">${safe(survey.title)}</h1>${survey.description ? `<p>${safe(survey.description)}</p>` : ''}<form>${survey.questions.map(questionMarkup).join('')}<div class="survey-submit"><button class="ds-cta ds-cta--md" type="submit">Enviar respuestas</button><p role="alert"></p></div></form>`;
  const form = root.querySelector('form');
  const button = form.querySelector('button');
  const feedback = form.querySelector('[role="alert"]');
  root.querySelector('h1').focus();
  form.onsubmit = async event => {
    event.preventDefault();
    if (button.disabled) return;
    const values = new FormData(form);
    const answers = Object.fromEntries(survey.questions.filter(question => values.has(question.id)).map(question => [
      question.id, question.type === 'rating' ? Number(values.get(question.id)) : values.get(question.id)
    ]));
    button.disabled = true;
    button.textContent = 'Enviando…';
    feedback.textContent = '';
    const response = await requestSurvey({ answers });
    if (response.completed) {
      showMessage('¡Gracias por responder!', response.submitted ? 'Recibimos tu evaluación.' : 'Ya recibimos la evaluación de este pedido.');
      return;
    }
    feedback.textContent = response.error;
    button.disabled = false;
    button.textContent = 'Enviar respuestas';
  };
}

async function loadSurvey() {
  if (!surveyTokenPattern.test(token)) {
    showMessage('Enlace de encuesta no disponible', 'Abre el enlace de evaluación que te enviamos por correo.');
    return;
  }
  root.innerHTML = '<p role="status">Cargando encuesta…</p>';
  const response = await requestSurvey();
  if (response.completed) showMessage('¡Gracias por responder!', 'Ya recibimos la evaluación de este pedido.');
  else if (validQuestionnaire(response.survey)) renderSurvey(response.survey);
  else if (response.status === 404) showMessage('Enlace de encuesta no disponible', 'Revisa el enlace del correo de evaluación.');
  else showMessage('No pudimos cargar la encuesta', 'Intenta nuevamente en unos momentos.', true);
}

loadSurvey();
