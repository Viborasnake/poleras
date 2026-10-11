import { orderPaymentState } from './payment-state.js';

const normalize = value => String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('es-CL');
const compact = value => normalize(value).replace(/[^a-z0-9]/g, '');
const archiveDateFormatter = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Santiago', year: 'numeric', month: '2-digit', day: '2-digit' });

export function archiveDay(value) {
  if (!value) return '';
  const parts = archiveDateFormatter.formatToParts(new Date(value));
  const part = type => parts.find(item => item.type === type)?.value || '';
  return `${part('year')}-${part('month')}-${part('day')}`;
}

export function archivedOrderStatus(order) {
  return order.archived_from_status || order.status || '';
}

export function filterArchivedOrders(orders, { query = '', status = '', payment = '', from = '', to = '' } = {}) {
  const term = normalize(query).trim();
  const rutTerm = compact(query);
  return orders.filter(order => {
    const customer = order.shipping_address?.customer || {};
    const searchable = [order.id, [customer.first_name, customer.last_name].filter(Boolean).join(' '), customer.first_name, customer.last_name, customer.email, customer.rut, customer.tax_id, customer.taxId, order.shipping_address?.rut, order.shipping_address?.tax_id];
    const matchesQuery = !term || searchable.some(value => normalize(value).includes(term)) || Boolean(rutTerm && [customer.rut, customer.tax_id, customer.taxId, order.shipping_address?.rut, order.shipping_address?.tax_id].some(value => compact(value).includes(rutTerm)));
    const day = archiveDay(order.archived_at);
    return matchesQuery && (!status || archivedOrderStatus(order) === status) && (!payment || orderPaymentState(order) === payment) && (!from || day >= from) && (!to || day <= to);
  });
}
