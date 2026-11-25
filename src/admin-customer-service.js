import './admin-customer-service.css';
import { adminSearch, prepareAdminTable } from './admin-ui.js';
import { SURVEY_LIMITS, SURVEY_RATINGS, validQuestionnaire } from '../supabase/functions/_shared/service-survey.js';

const orderPageSize = 20;
const responsePageSize = 15;
const number = new Intl.NumberFormat('es-CL', { maximumFractionDigits: 1 });
const money = new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' });
const date = new Intl.DateTimeFormat('es-CL', { dateStyle: 'medium', timeZone: 'America/Santiago' });
const safe = value => String(value ?? '').replace(/[&<>"']/g, char => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
})[char]);

let activeView = 'orders';
let search = '';
let orderPage = 0;

function pager(page, size, total) {
  if (total <= size) return '';
  const pages = Math.ceil(total / size);
  return `<div class="service-pager"><button type="button" class="admin-secondary" data-page="${page - 1}" ${page ? '' : 'disabled'}>Anterior</button><span>Página ${page + 1} de ${pages}</span><button type="button" class="admin-secondary" data-page="${page + 1}" ${page + 1 < pages ? '' : 'disabled'}>Siguiente</button></div>`;
}

function bindPager(root, selectPage) {
  root.querySelectorAll('[data-page]').forEach(button => {
    button.onclick = () => selectPage(Number(button.dataset.page));
  });
}

function table(headings, rows, label) {
  return `<div class="admin-table-wrap" aria-label="${label}"><table class="admin-table"><thead><tr>${headings.map(heading => `<th>${heading}</th>`).join('')}</tr></thead><tbody>${rows}</tbody></table></div>`;
}

function empty(title, retry = false) {
  return `<div class="admin-empty"><strong>${title}</strong>${retry ? '<button class="admin-secondary" type="button" data-retry>Reintentar</button>' : ''}</div>`;
}

function surveyStatus(order) {
  if (order.simulated) return 'Simulado';
  if (order.responded_at) return 'Respondida';
  if (order.sent_at) return 'Enviada';
  return 'Pendiente de envío';
}

function orderRow(order) {
  const status = surveyStatus(order);
  return `<tr>
    <td><strong>#${safe(order.id)}</strong>${order.archived_at ? '<small>Archivado</small>' : ''}</td>
    <td><strong>${safe(order.customer_name || 'Cliente sin nombre')}</strong>${order.customer_email ? `<small>${safe(order.customer_email)}</small>` : ''}</td>
    <td>${order.fulfillment === 'pickup' ? 'Retiro en tienda' : 'Despacho'}</td>
    <td>${date.format(new Date(order.completed_at))}</td>
    <td>${money.format(order.total_clp || 0)}</td>
    <td><span class="service-status">${status}</span>${order.responded_at || order.sent_at ? `<small>${date.format(new Date(order.responded_at || order.sent_at))}</small>` : ''}</td>
    <td><div class="service-actions"><button type="button" class="admin-secondary" data-service-order="${safe(order.id)}" aria-label="Ver pedido #${safe(order.id)}">Ver pedido</button>${status === 'Pendiente de envío' ? `<button type="button" class="admin-secondary" data-service-send="${safe(order.id)}" aria-label="Enviar encuesta del pedido #${safe(order.id)}">Enviar encuesta</button>` : ''}</div></td>
  </tr>`;
}

async function mountOrders({ panel, supabase, localOrders, openOrder, previewEmail }) {
  panel.innerHTML = `<div class="admin-panel-head"><div><h2>Pedidos terminados</h2><p>Revisa los pedidos cerrados y el estado de su evaluación.</p></div></div>
    <form class="service-search">${adminSearch({ label: 'Buscar pedido', placeholder: 'N° de pedido, cliente o correo', input: 'name="order_search" maxlength="120"' })}<button type="submit" class="admin-secondary">Buscar</button></form>
    <p class="service-list-status" role="status"></p><div data-service-list></div>`;
  const form = panel.querySelector('form');
  const output = panel.querySelector('[role="status"]');
  const list = panel.querySelector('[data-service-list]');
  form.elements.order_search.value = search;
  let request = 0;

  async function load({ focus = false } = {}) {
    const requestId = ++request;
    list.setAttribute('aria-busy', 'true');
    output.textContent = 'Cargando pedidos…';
    const first = orderPage * orderPageSize;
    const result = await supabase.rpc('service_completed_orders', { p_search: search }, { count: 'exact' })
      .order('completed_at', { ascending: false }).order('id', { ascending: false }).range(first, first + orderPageSize - 1);
    if (!list.isConnected || requestId !== request) return;
    list.removeAttribute('aria-busy');
    if (result.error) {
      output.textContent = '';
      list.innerHTML = empty('No pudimos cargar los pedidos terminados.', true);
      list.querySelector('[data-retry]').onclick = () => load();
      return;
    }

    const total = result.count ?? result.data.length;
    const lastPage = Math.max(0, Math.ceil(total / orderPageSize) - 1);
    if (orderPage > lastPage) {
      orderPage = lastPage;
      return load({ focus });
    }
    const simulated = !orderPage ? localOrders.filter(order => order.status === 'delivered').map(order => {
      const customer = order.shipping_address?.customer || {};
      return {
        id: order.id, customer_name: [customer.first_name, customer.last_name].filter(Boolean).join(' '),
        customer_email: customer.email, fulfillment: order.shipping_address?.fulfillment,
        completed_at: order.order_status_history?.find(entry => entry.status === 'delivered')?.created_at || order.updated_at || order.created_at,
        total_clp: order.total_clp, archived_at: order.archived_at, simulated: true,
      };
    }).filter(order => !search || [order.id, order.customer_name, order.customer_email].join(' ').toLowerCase().includes(search.replace(/^#/, '').toLowerCase())) : [];
    const orders = [...simulated, ...result.data];
    output.textContent = `${number.format(total)} ${total === 1 ? 'pedido terminado' : 'pedidos terminados'}${simulated.length ? ` · ${simulated.length} ${simulated.length === 1 ? 'simulado' : 'simulados'}` : ''}`;
    list.innerHTML = orders.length ? table(['Pedido', 'Cliente', 'Entrega', 'Fecha de cierre', 'Total', 'Encuesta', 'Acciones'], orders.map(orderRow).join(''), 'Pedidos terminados') + pager(orderPage, orderPageSize, total) :
      empty(search ? 'No hay pedidos terminados que coincidan con la búsqueda.' : 'Todavía no hay pedidos terminados.');
    if (!orders.length) return;
    prepareAdminTable(list.querySelector('table'));
    if (focus) list.querySelector('.admin-table-wrap').focus();
    bindPager(list, page => { orderPage = page; load({ focus: true }); });
    list.querySelectorAll('[data-service-order]').forEach(button => {
      button.onclick = () => runRowAction(button, () => openOrder(button.dataset.serviceOrder));
    });
    list.querySelectorAll('[data-service-send]').forEach(button => {
      button.onclick = () => runRowAction(button, () => previewEmail(orders.find(order => String(order.id) === button.dataset.serviceSend)));
    });
  }

  form.onsubmit = event => {
    event.preventDefault();
    search = form.elements.order_search.value.trim();
    orderPage = 0;
    load();
  };
  await load();
}

async function runRowAction(button, action) {
  if (button.disabled) return;
  button.disabled = true;
  button.setAttribute('aria-busy', 'true');
  try {
    await action();
  } finally {
    button.disabled = false;
    button.removeAttribute('aria-busy');
  }
}

function surveyRow(survey) {
  const id = safe(survey.id);
  return `<tr><td><strong>${safe(survey.title)}</strong>${survey.description ? `<small>${safe(survey.description)}</small>` : ''}</td>
    <td><span class="service-status${survey.active ? ' is-active' : ''}">${survey.active ? 'Activa' : 'Inactiva'}</span></td>
    <td>${survey.questions.length}</td><td>${date.format(new Date(survey.updated_at))}</td>
    <td><div class="service-actions"><button type="button" class="admin-secondary" data-edit-survey="${id}">Editar</button><button type="button" class="admin-secondary" data-survey-results="${id}">Ver resultados</button>${survey.active ? '' : `<button type="button" class="admin-secondary" data-activate-survey="${id}">Activar</button>`}</div></td></tr>`;
}

async function mountSurveys({ panel, root, supabase, toast }) {
  panel.innerHTML = `<div class="admin-panel-head"><div><h2>Encuestas</h2><p>La encuesta activa se incluye en el correo de evaluación de cada pedido que termina.</p></div><button type="button" class="admin-primary" data-new-survey>Nueva encuesta</button></div><div data-survey-list aria-live="polite"></div>`;
  const list = panel.querySelector('[data-survey-list]');
  const add = panel.querySelector('[data-new-survey]');

  async function load() {
    list.innerHTML = '<p class="service-list-status" role="status">Cargando encuestas…</p>';
    const { data, error } = await supabase.from('service_surveys').select('id,title,description,questions,active,updated_at')
      .order('active', { ascending: false }).order('updated_at', { ascending: false });
    if (!list.isConnected) return;
    if (error) {
      list.innerHTML = empty('No pudimos cargar las encuestas.', true);
      list.querySelector('[data-retry]').onclick = load;
      return;
    }
    list.innerHTML = data.length ? table(['Encuesta', 'Estado', 'Preguntas', 'Última edición', 'Acciones'], data.map(surveyRow).join(''), 'Encuestas') :
      empty('Todavía no hay encuestas.');
    if (data.length) prepareAdminTable(list.querySelector('table'));
    list.querySelectorAll('[data-edit-survey]').forEach(button => {
      button.onclick = () => editSurvey(data.find(survey => survey.id === button.dataset.editSurvey));
    });
    list.querySelectorAll('[data-survey-results]').forEach(button => {
      button.onclick = () => openResults(root, supabase, data.find(survey => survey.id === button.dataset.surveyResults));
    });
    list.querySelectorAll('[data-activate-survey]').forEach(button => {
      button.onclick = async () => {
        if (!window.confirm('¿Activar esta encuesta para los próximos pedidos terminados?')) return;
        await runRowAction(button, async () => {
          const { error: activationError } = await supabase.rpc('activate_service_survey', { p_survey_id: button.dataset.activateSurvey });
          if (activationError) return toast('No pudimos activar la encuesta. Intenta nuevamente.');
          await load();
          list.querySelector(`[data-edit-survey="${CSS.escape(button.dataset.activateSurvey)}"]`)?.focus();
          toast('Encuesta activada.');
        });
      };
    });
  }

  function editSurvey(survey) {
    openEditor(root, supabase, survey, async id => {
      await load();
      list.querySelector(`[data-edit-survey="${CSS.escape(id)}"]`)?.focus();
      toast('Encuesta guardada.');
    });
  }

  add.onclick = () => editSurvey();
  await load();
}

function dialogHeader(title, copy) {
  return `<div class="dialog-title"><div><h2 id="service-dialog-title">${title}</h2><p>${copy}</p></div><button type="button" class="ds-icon-button close-button dialog-close" aria-label="Cerrar"><span></span></button></div>`;
}

function showDialog(root, html) {
  const dialog = document.createElement('dialog');
  dialog.className = 'admin-dialog service-dialog';
  dialog.setAttribute('aria-labelledby', 'service-dialog-title');
  dialog.innerHTML = html;
  root.append(dialog);
  dialog.querySelector('.dialog-close').onclick = () => dialog.close();
  dialog.addEventListener('close', () => dialog.remove(), { once: true });
  dialog.showModal();
  return dialog;
}

function questionFields(question, index) {
  return `<fieldset class="service-question-editor" data-question-id="${safe(question.id)}"><legend>Pregunta ${index}</legend>
    <label>Enunciado<input name="question_label" value="${safe(question.label)}" maxlength="${SURVEY_LIMITS.label}" required></label>
    <div class="service-question-settings"><label>Tipo de respuesta<select name="question_type"><option value="rating">Calificación de 1 a 5</option><option value="text" ${question.type === 'text' ? 'selected' : ''}>Texto libre</option></select></label>
    <label class="service-question-required"><input name="question_required" type="checkbox" ${question.required ? 'checked' : ''}> Obligatoria</label>
    <button class="admin-secondary" type="button" data-remove-question>Quitar pregunta</button></div></fieldset>`;
}

function openEditor(root, supabase, survey, onSaved) {
  const newQuestion = () => ({ id: crypto.randomUUID(), type: 'rating', label: '', required: true });
  const questions = survey?.questions || [newQuestion()];
  const dialog = showDialog(root, `<form>${dialogHeader(survey ? 'Editar encuesta' : 'Nueva encuesta', 'Las invitaciones ya enviadas conservan sus preguntas.')}
    <label>Nombre de la encuesta<input name="title" maxlength="${SURVEY_LIMITS.title}" value="${safe(survey?.title)}" required autofocus></label>
    <label>Texto de bienvenida (opcional)<textarea name="description" rows="2" maxlength="${SURVEY_LIMITS.description}">${safe(survey?.description)}</textarea></label>
    <div class="service-question-list">${questions.map((question, index) => questionFields(question, index + 1)).join('')}</div>
    <button type="button" class="admin-secondary" data-add-question>Añadir pregunta</button>
    <p class="admin-form-status" role="alert"></p>
    <div class="dialog-actions"><button type="button" class="admin-secondary dialog-cancel">Cancelar</button><button type="submit" class="admin-primary">Guardar encuesta</button></div></form>`);

  const form = dialog.querySelector('form');
  const list = form.querySelector('.service-question-list');
  const add = form.querySelector('[data-add-question]');
  const cancel = form.querySelector('.dialog-cancel');
  const close = form.querySelector('.dialog-close');
  const submit = form.querySelector('[type="submit"]');
  const status = form.querySelector('[role="alert"]');
  const syncQuestions = () => {
    const count = list.children.length;
    add.disabled = count >= SURVEY_LIMITS.questions;
    Array.from(list.children).forEach((row, index) => {
      row.querySelector('legend').textContent = `Pregunta ${index + 1}`;
      row.querySelector('[data-remove-question]').disabled = count < 2;
    });
  };

  cancel.onclick = () => dialog.close();
  dialog.addEventListener('cancel', event => { if (submit.disabled) event.preventDefault(); });
  add.onclick = () => {
    list.insertAdjacentHTML('beforeend', questionFields(newQuestion(), list.children.length + 1));
    syncQuestions();
    list.lastElementChild.querySelector('[name="question_label"]').focus();
  };
  list.onclick = event => {
    const button = event.target.closest('[data-remove-question]');
    if (!button || button.disabled) return;
    const row = button.closest('fieldset');
    const neighbor = row.nextElementSibling || row.previousElementSibling;
    row.remove();
    syncQuestions();
    neighbor.querySelector('input').focus();
  };
  syncQuestions();

  form.onsubmit = async event => {
    event.preventDefault();
    if (submit.disabled) return;
    const draft = {
      title: form.elements.title.value.trim(),
      description: form.elements.description.value.trim(),
      questions: Array.from(list.children, row => ({
        id: row.dataset.questionId,
        label: row.querySelector('[name="question_label"]').value.trim(),
        type: row.querySelector('[name="question_type"]').value,
        required: row.querySelector('[name="question_required"]').checked,
      })),
    };
    if (!validQuestionnaire(draft)) {
      status.textContent = 'Completa el nombre y el enunciado de cada pregunta.';
      return;
    }
    status.textContent = '';
    for (const button of [submit, close, cancel]) button.disabled = true;
    submit.textContent = 'Guardando…';

    const query = survey ?
      supabase.from('service_surveys').update({ ...draft, updated_at: new Date().toISOString() }).eq('id', survey.id).eq('updated_at', survey.updated_at) :
      supabase.from('service_surveys').insert(draft);
    const { data, error } = await query.select('id').maybeSingle();
    if (data && !error) {
      dialog.close();
      await onSaved(data.id);
      return;
    }
    status.textContent = error ? 'No pudimos guardar la encuesta. Intenta nuevamente.' : 'La encuesta cambió en otra sesión. Vuelve a abrirla para ver la última versión.';
    for (const button of [submit, close, cancel]) button.disabled = false;
    submit.textContent = 'Guardar encuesta';
  };
}

function summarizeServiceSurvey(invitations) {
  const responses = [];
  const ratings = new Map();
  let sent = 0;
  for (const invitation of invitations) {
    if (invitation.sent_at || invitation.responded_at) sent++;
    if (!invitation.responded_at || !validQuestionnaire(invitation.questionnaire)) continue;
    responses.push(invitation);
    for (const question of invitation.questionnaire.questions) {
      const value = invitation.answers?.[question.id];
      if (question.type !== 'rating' || !SURVEY_RATINGS.includes(value)) continue;
      const key = JSON.stringify([question.id, question.label]);
      const score = ratings.get(key) || { label: question.label, total: 0, sum: 0, counts: [0, 0, 0, 0, 0] };
      score.counts[value - 1]++;
      score.sum += value;
      score.total++;
      ratings.set(key, score);
    }
  }
  return { sent, responses, ratings: [...ratings.values()] };
}

function responseCard(response) {
  return `<details class="service-response"><summary>Pedido #${safe(response.order_id)} <span>${date.format(new Date(response.responded_at))}</span></summary>
    <dl>${response.questionnaire.questions.map(question => {
      const answer = response.answers?.[question.id];
      return `<div><dt>${safe(question.label)}</dt><dd>${answer === undefined ? 'Sin respuesta' : `${safe(answer)}${question.type === 'rating' ? ' de 5' : ''}`}</dd></div>`;
    }).join('')}</dl></details>`;
}

async function openResults(root, supabase, survey) {
  const dialog = showDialog(root, `${dialogHeader('Resultados de la encuesta', safe(survey.title))}<div class="service-results"></div>`);
  const results = dialog.querySelector('.service-results');

  async function load() {
    results.innerHTML = '<p role="status">Cargando resultados…</p>';
    const invitations = [];
    const size = 250;
    for (let from = 0; dialog.open; from += size) {
      const { data, error } = await supabase.from('service_survey_invitations')
        .select('order_id,questionnaire,sent_at,responded_at,answers').eq('survey_id', survey.id)
        .order('order_id').range(from, from + size - 1);
      if (!dialog.open) return;
      if (error) {
        results.innerHTML = empty('No pudimos cargar los resultados.', true);
        results.querySelector('[data-retry]').onclick = load;
        return;
      }
      invitations.push(...data);
      if (data.length < size) break;
    }
    const { sent, responses, ratings } = summarizeServiceSurvey(invitations);
    responses.sort((a, b) => new Date(b.responded_at) - new Date(a.responded_at));
    results.innerHTML = `<dl class="service-metrics"><div><dt>Enviadas</dt><dd>${number.format(sent)}</dd></div><div><dt>Respondidas</dt><dd>${number.format(responses.length)}</dd></div><div><dt>Tasa de respuesta</dt><dd>${sent ? `${number.format(responses.length / sent * 100)} %` : '—'}</dd></div></dl>
      ${ratings.length ? `<section><h3>Calificaciones</h3><ul class="service-scores">${ratings.map(score => `<li><strong>${safe(score.label)}</strong><p>Promedio <b>${number.format(score.sum / score.total)} de 5</b> · ${number.format(score.total)} ${score.total === 1 ? 'respuesta' : 'respuestas'}</p><ul aria-label="Respuestas por nota">${score.counts.map((count, index) => `<li>Nota ${index + 1} <b>${number.format(count)}</b></li>`).join('')}</ul></li>`).join('')}</ul></section>` : ''}
      <section><h3 tabindex="-1">Respuestas por pedido</h3><div data-responses></div></section>`;
    const list = results.querySelector('[data-responses]');
    if (!responses.length) {
      list.innerHTML = empty('Todavía no hay respuestas.');
      return;
    }
    function showPage(page, focus = false) {
      const first = page * responsePageSize;
      list.innerHTML = responses.slice(first, first + responsePageSize).map(responseCard).join('') + pager(page, responsePageSize, responses.length);
      bindPager(list, target => showPage(target, true));
      if (focus) list.previousElementSibling.focus();
    }
    showPage(0);
  }

  await load();
}

export function renderCustomerService({ root, shell, pageHeading, supabase, localOrders, openOrder, previewEmail, toast }) {
  const options = [['orders', 'Pedidos terminados'], ['surveys', 'Encuestas']];
  const heading = pageHeading('POSTVENTA', 'Servicio al cliente', 'Consulta pedidos terminados y gestiona las evaluaciones de servicio.');
  shell(`${heading}<div class="service-navigation" role="group" aria-label="Vistas de servicio al cliente">${options.map(([key, name]) =>
    `<button type="button" class="admin-secondary" data-service-view="${key}" aria-controls="service-panel" aria-pressed="${key === activeView}">${name}</button>`).join('')}</div>
    <section class="admin-panel service-panel" id="service-panel"></section>
    <dialog class="admin-dialog admin-order-dialog" id="order-dialog"><div id="order-dialog-content"></div></dialog>`, 'servicio-cliente');

  const panel = root.querySelector('#service-panel');
  const buttons = root.querySelectorAll('[data-service-view]');
  function mount() {
    const current = document.createElement('div');
    panel.replaceChildren(current);
    if (activeView === 'orders') mountOrders({ panel: current, supabase, localOrders, openOrder, previewEmail });
    else mountSurveys({ panel: current, root, supabase, toast });
  }
  buttons.forEach(button => {
    button.onclick = () => {
      if (activeView === button.dataset.serviceView) return;
      activeView = button.dataset.serviceView;
      buttons.forEach(view => view.setAttribute('aria-pressed', String(view === button)));
      mount();
    };
  });
  mount();
}
