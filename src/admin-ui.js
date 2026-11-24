const escapeHtml = value => String(value).replace(/[&<>"']/g, char => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
})[char]);

const chevron = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>';

export function adminSearch({label, placeholder, input, output = ''}) {
  return `<div class="admin-list-search"><label class="admin-filter-field"><span>${escapeHtml(label)}</span><span class="admin-search-field"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 4 4"/></svg><input type="search" autocomplete="off" ${input} placeholder="${escapeHtml(placeholder)}"></span></label>${output}</div>`;
}

function adminPopover({id, label, name, items, filters = false, surfaceClass = '', width, preferredHeight, icon = ''}) {
  const target = escapeHtml(id);
  const count = filters ? '<span data-active-filter-count></span>' : '';
  return `<div class="admin-actions${filters ? ' admin-filters' : ''}"><button type="button" class="admin-secondary admin-actions-trigger" popovertarget="${target}"${name === label ? '' : ` aria-label="${escapeHtml(name)}"`}>${icon}<span>${escapeHtml(label)}${count}</span>${chevron}</button><div id="${target}" class="admin-actions-popover${filters ? ' admin-filter-popover' : ''} ${escapeHtml(surfaceClass)}"${width ? ` data-popover-width="${Number(width)}"` : ''}${preferredHeight ? ` data-popover-height="${Number(preferredHeight)}"` : ''} popover>${items}</div></div>`;
}

export function adminActions({id, label = 'Más acciones', name = label, items}) {
  return adminPopover({id, label, name, items});
}

export function adminFilters(id, items, options = {}) {
  return adminPopover({id, label: 'Filtros', name: 'Filtros', items, filters: true, ...options});
}

export function updateAdminFilterCount(root, id, count) {
  const badge = root.querySelector(`[popovertarget="${id}"] [data-active-filter-count]`);
  if (badge) badge.textContent = count ? ` (${count})` : '';
}

export function adminActionTrigger(action) {
  return action.closest('.admin-actions-popover')?.previousElementSibling;
}

// Keep the actual buttons in their row so existing handlers and form associations
// survive. The browser puts the open popover above overflow containers.
const actionRoots = new WeakSet();
export function bindAdminActions(root) {
  if (actionRoots.has(root)) return;
  actionRoots.add(root);
  if (!('showPopover' in HTMLElement.prototype)) return;
  const position = popover => {
    const trigger = adminActionTrigger(popover);
    const bounds = trigger.getBoundingClientRect();
    const viewport = window.visualViewport;
    const dialog = trigger.closest('dialog')?.getBoundingClientRect();
    const viewportLeft = viewport?.offsetLeft || 0;
    const viewportTop = viewport?.offsetTop || 0;
    const viewportRight = viewportLeft + (viewport?.width || document.documentElement.clientWidth);
    const viewportBottom = viewportTop + (viewport?.height || window.innerHeight);
    const left = Math.max(viewportLeft, dialog?.left ?? viewportLeft) + 8;
    const right = Math.min(viewportRight, dialog?.right ?? viewportRight) - 8;
    const top = Math.max(viewportTop, dialog?.top ?? viewportTop) + 8;
    const bottom = Math.min(viewportBottom, dialog?.bottom ?? viewportBottom) - 8;
    const defaultWidth = popover.classList.contains('admin-filter-popover') ? 340 : 256;
    const width = Math.min(Number(popover.dataset.popoverWidth) || defaultWidth, right - left);
    const anchorLeft = dialog ? bounds.left : bounds.right - width;
    const below = bottom - bounds.bottom - 6;
    const above = bounds.top - top - 6;
    const opensDown = below >= Math.min(Number(popover.dataset.popoverHeight) || 260, above);
    Object.assign(popover.style, {
      width: `${width}px`,
      maxHeight: `${Math.max(opensDown ? below : above, 0)}px`,
      left: `${Math.max(left, Math.min(anchorLeft, right - width))}px`,
      top: opensDown ? `${bounds.bottom + 6}px` : 'auto',
      bottom: opensDown ? 'auto' : `${document.documentElement.clientHeight - bounds.top + 6}px`
    });
  };
  root.addEventListener('beforetoggle', event => {
    if (event.newState === 'open' && event.target.matches('.admin-actions-popover')) position(event.target);
  }, true);
  root.addEventListener('click', event => {
    const item = event.target.closest('.admin-actions-popover :is(button, a)');
    if (!item || item.disabled || (item.form && item.closest('.admin-filter-popover'))) return;
    const popover = item.closest('.admin-actions-popover');
    const trigger = adminActionTrigger(item);
    popover.hidePopover();
    trigger.focus({preventScroll: true});
  }, true);
  const updateOpenPosition = event => {
    const open = root.querySelector('.admin-actions-popover:popover-open');
    if (!open || (event.target instanceof Node && open.contains(event.target))) return;
    position(open);
  };
  window.addEventListener('scroll', updateOpenPosition, true);
  window.addEventListener('resize', updateOpenPosition);
  window.visualViewport?.addEventListener('resize', updateOpenPosition);
}

export function prepareAdminTable(table) {
  const headings = table.tHead?.rows[0]?.cells;
  if (!headings?.length) return;
  const region = table.closest('.admin-table-wrap');
  if (!region || table.classList.contains('admin-responsive-table')) return;
  table.classList.add('admin-responsive-table');
  table.setAttribute('role', 'table');
  region.setAttribute('role', 'region');
  region.tabIndex = 0;
  for (const group of [table.tHead, ...table.tBodies]) {
    group.setAttribute('role', 'rowgroup');
    for (const row of group.rows) {
      row.setAttribute('role', 'row');
      for (const [index, cell] of Array.from(row.cells).entries()) {
        if (group === table.tHead) {
          cell.scope = 'col';
          cell.setAttribute('role', 'columnheader');
        } else if (cell.tagName === 'TD') {
          cell.setAttribute('role', 'cell');
          if (!index || row.cells.length !== headings.length) continue;
          const label = document.createElement('span');
          label.className = 'admin-cell-label';
          label.ariaHidden = 'true';
          label.textContent = headings[index].textContent;
          cell.prepend(label);
        }
      }
    }
  }
}

let nextDialogTitle = 0;
export function observeAdminDialogs(root) {
  // Some order subdialogs are inserted and given their headings on demand.
  new MutationObserver(() => {
    for (const dialog of root.querySelectorAll('dialog.admin-dialog:not([aria-labelledby]):not([aria-label])')) {
      const heading = dialog.querySelector('.dialog-title h2');
      if (!heading) continue;
      heading.id ||= `admin-dialog-title-${++nextDialogTitle}`;
      dialog.setAttribute('aria-labelledby', heading.id);
    }
  }).observe(root, {childList: true, subtree: true});
}
