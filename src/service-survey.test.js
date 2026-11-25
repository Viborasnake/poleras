import test from 'node:test';
import assert from 'node:assert/strict';
import { validQuestionnaire, validateSurveyAnswers, surveyTokenPattern } from '../supabase/functions/_shared/service-survey.js';

const questions = [
  { id: 'experience', type: 'rating', label: '¿Cómo estuvo el servicio?', required: true },
  { id: 'feedback', type: 'text', label: 'Déjanos un comentario', required: false },
];

test('una encuesta tiene preguntas identificables y tipos compatibles', () => {
  const survey = { title: 'Evaluación de servicio', description: '', questions };
  assert.equal(validQuestionnaire(survey), true);
  assert.equal(validQuestionnaire({ ...survey, questions: [questions[0], questions[0]] }), false);
  assert.equal(validQuestionnaire({ ...survey, questions: [{ ...questions[0], label: ' ' }] }), false);
  assert.equal(validQuestionnaire({ ...survey, questions: [{ ...questions[0], type: 'url' }] }), false);
  assert.equal(validQuestionnaire({ ...survey, questions: [] }), false);
});

test('la respuesta respeta las preguntas originales y puede omitir comentarios opcionales', () => {
  assert.deepEqual(validateSurveyAnswers(questions, { experience: 4, feedback: '  Excelente  ' }), { experience: 4, feedback: 'Excelente' });
  assert.deepEqual(validateSurveyAnswers(questions, { experience: 1, feedback: ' ' }), { experience: 1 });
  assert.equal(validateSurveyAnswers(questions, { feedback: 'Excelente' }), null);
  assert.equal(validateSurveyAnswers(questions, { experience: '5' }), null);
  assert.equal(validateSurveyAnswers(questions, { experience: 6 }), null);
  assert.equal(validateSurveyAnswers(questions, { experience: 5, other: 'Extra' }), null);
  assert.equal(validateSurveyAnswers(questions, { experience: 5, feedback: 'x'.repeat(2001) }), null);
});

test('el número de pedido no es un enlace de encuesta', () => {
  assert.equal(surveyTokenPattern.test('48ac78c1-001d-498c-8e83-5461503569ee'), true);
  assert.equal(surveyTokenPattern.test('51'), false);
});
