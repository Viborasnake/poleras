const escapeHtml = value => String(value).replace(/[&<>"']/g, char => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
})[char]);

const chevron = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>';

export function adminSearch({label, placeholder, input, output = ''}) {
  return `<div class="admin-list-search"><label class="admin-filter-field"><span>${escapeHtml(label)}</span><span class="admin-search-field"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 4 4"/></svg><input type="search" autocomplete="off" ${input} placeholder="${escapeHtml(placeholder)}"></span></label>${output}</div>`;
}

export function adminActions({id, label = 'Más acciones', name = label, items}) {
  id = escapeHtml(id);
  return `<div class="admin-actions"><button type="button" class="admin-secondary admin-actions-trigger" popovertarget="${id}"${name === label ? '' : ` aria-label="${escapeHtml(name)}"`}><span>${escapeHtml(label)}</span>${chevron}</button><div id="${id}" class="admin-actions-popover" popover>${items}</div></div>`;
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
    const left = (viewport?.offsetLeft || 0) + 8;
    const right = left + (viewport?.width || document.documentElement.clientWidth) - 16;
    const top = (viewport?.offsetTop || 0) + 8;
    const bottom = top + (viewport?.height || window.innerHeight) - 16;
    const width = Math.min(256, right - left);
    const below = bottom - bounds.bottom - 6;
    const above = bounds.top - top - 6;
    const opensDown = below >= Math.min(260, above);
    Object.assign(popover.style, {
      width: `${width}px`,
      maxHeight: `${Math.max(opensDown ? below : above, 0)}px`,
      left: `${Math.max(left, Math.min(bounds.right - width, right - width))}px`,
      top: opensDown ? `${bounds.bottom + 6}px` : 'auto',
      bottom: opensDown ? 'auto' : `${document.documentElement.clientHeight - bounds.top + 6}px`
    });
  };
  root.addEventListener('beforetoggle', event => {
    if (event.newState === 'open' && event.target.matches('.admin-actions-popover')) position(event.target);
  }, true);
  root.addEventListener('click', event => {
    const item = event.target.closest('.admin-actions-popover :is(button, a)');
    if (!item || item.disabled) return;
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
