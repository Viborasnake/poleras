export const SURVEY_LIMITS = Object.freeze({ title: 120, description: 500, questions: 12, label: 200, comment: 2000 });
export const SURVEY_RATINGS = [1, 2, 3, 4, 5];
export const surveyTokenPattern = /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i;

const isRecord = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const validText = (value, max) => typeof value === 'string' && value.trim().length > 0 && value.length <= max;

export function validQuestionnaire(survey) {
  if (!isRecord(survey) || !validText(survey.title, SURVEY_LIMITS.title) ||
    typeof survey.description !== 'string' || survey.description.length > SURVEY_LIMITS.description ||
    !Array.isArray(survey.questions) || !survey.questions.length || survey.questions.length > SURVEY_LIMITS.questions) return false;
  const ids = new Set();
  for (const question of survey.questions) {
    if (!isRecord(question) || typeof question.id !== 'string' ||
      !/^[a-z0-9-]{1,64}$/.test(question.id) || ids.has(question.id) ||
      !['rating', 'text'].includes(question.type) || !validText(question.label, SURVEY_LIMITS.label) ||
      typeof question.required !== 'boolean') return false;
    ids.add(question.id);
  }
  return true;
}

export function validateSurveyAnswers(questions, answers) {
  if (!isRecord(answers)) return null;
  const known = new Set(questions.map(question => question.id));
  if (Object.keys(answers).some(id => !known.has(id))) return null;
  const cleaned = {};
  for (const question of questions) {
    const value = Object.hasOwn(answers, question.id) ? answers[question.id] : undefined;
    if (value === undefined || (question.type === 'text' && typeof value === 'string' && !value.trim())) {
      if (question.required) return null;
      continue;
    }
    if (question.type === 'rating' ? !SURVEY_RATINGS.includes(value) : !validText(value, SURVEY_LIMITS.comment)) return null;
    cleaned[question.id] = question.type === 'text' ? value.trim() : value;
  }
  return cleaned;
}
