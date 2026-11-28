export const BANK_TRANSFER_WINDOW_MINUTES = 60;
export const BANK_TRANSFER_WORK_NOTICE = 'No iniciaremos ningún trabajo hasta confirmar el pago.';
export const BANK_TRANSFER_POLICY = `Transfiere dentro de los próximos ${BANK_TRANSFER_WINDOW_MINUTES} minutos desde que recibas los datos. ${BANK_TRANSFER_WORK_NOTICE}`;

export function bankTransferDeadline(issuedAt, previousDeadline) {
  return Number.isFinite(Date.parse(previousDeadline))
    ? previousDeadline
    : new Date(new Date(issuedAt).getTime() + BANK_TRANSFER_WINDOW_MINUTES * 60_000).toISOString();
}

export function bankTransferDeadlineLabel(deadline) {
  if (!Number.isFinite(Date.parse(deadline))) return '';
  return new Intl.DateTimeFormat('es-CL', {
    timeZone: 'America/Santiago', dateStyle: 'medium', timeStyle: 'short',
  }).format(new Date(deadline));
}

export function isBankTransferExpired(deadline, now = Date.now()) {
  return Date.parse(deadline) <= now;
}

export function bankTransferWindowNotice(deadline, now = Date.now()) {
  const label = bankTransferDeadlineLabel(deadline);
  if (!label) return BANK_TRANSFER_POLICY;
  if (isBankTransferExpired(deadline, now)) {
    return `El plazo de transferencia venció el ${label} (hora de Chile continental). Si aún no has pagado, contáctanos antes de transferir. ${BANK_TRANSFER_WORK_NOTICE}`;
  }
  return `Transfiere dentro de ${BANK_TRANSFER_WINDOW_MINUTES} minutos, hasta el ${label} (hora de Chile continental). ${BANK_TRANSFER_WORK_NOTICE}`;
}
