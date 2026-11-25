import {escapeHtml} from './admin-ui.js';

let nextTitle = 0;
const orderDialogs = new WeakSet();

export function showOrderDialog(dialog, {focus} = {}) {
  dialog.classList.add('admin-order-modal');
  const heading = dialog.querySelector('.dialog-title h2');
  heading.id ||= `admin-order-modal-title-${++nextTitle}`;
  heading.tabIndex = -1;
  dialog.setAttribute('aria-labelledby', heading.id);
  const description = dialog.querySelector('.admin-order-confirm-message');
  if (description) {
    description.id = `${heading.id}-description`;
    dialog.setAttribute('aria-describedby', description.id);
  }

  const status = dialog.querySelector(':scope > form > .dialog-actions + .admin-form-status');
  if (status) status.previousElementSibling.before(status);

  const close = dialog.querySelector('.dialog-close');
  close.classList.add('ds-icon-button', 'close-button');
  close.replaceChildren(document.createElement('span'));

  if (!orderDialogs.has(dialog)) {
    dialog.addEventListener('cancel', event => {
      if (dialog.getAttribute('aria-busy') === 'true') event.preventDefault();
    });
    orderDialogs.add(dialog);
  }

  const initialFocus = focus ?? heading;
  initialFocus.setAttribute('autofocus', '');
  dialog.scrollTop = 0;
  if (!dialog.open) dialog.showModal();
  initialFocus.removeAttribute('autofocus');
  initialFocus.focus({preventScroll: true});
}

export function confirmOrderAction(root, {orderId, title, message, action, danger = false}) {
  const dialog = document.createElement('dialog');
  dialog.className = 'admin-dialog admin-order-confirm-dialog';
  dialog.innerHTML = `<header class="dialog-title">
    <div><span class="admin-eyebrow">PEDIDO #${escapeHtml(orderId)}</span><h2>${escapeHtml(title)}</h2></div>
    <button type="button" class="dialog-close" aria-label="Cerrar"></button>
  </header>
  <p class="admin-order-confirm-message">${escapeHtml(message)}</p>
  <form method="dialog" class="dialog-actions">
    <button type="button" class="admin-secondary dialog-cancel">Cancelar</button>
    <button type="submit" class="${danger ? 'admin-danger' : 'admin-primary'}" value="confirm">${escapeHtml(action)}</button>
  </form>`;
  root.append(dialog);
  showOrderDialog(dialog, {focus: dialog.querySelector('.dialog-cancel')});
  return new Promise(resolve => {
    dialog.addEventListener('close', () => {
      dialog.remove();
      resolve(dialog.returnValue === 'confirm');
    }, {once: true});
  });
}
