-- Revierte únicamente la confirmación administrativa antes de iniciar producción.
-- La operación es atómica: pedido, pago manual e historial cambian juntos.
create or replace function public.revoke_order_payment_confirmation(p_order_id bigint, p_actor uuid)
returns text
language plpgsql
security invoker
set search_path = ''
as $$
declare
  current_order public.orders%rowtype;
  next_status text;
begin
  select * into current_order
  from public.orders
  where id = p_order_id
  for update;

  if not found then raise exception 'order_not_found'; end if;
  if current_order.status <> 'paid'
     or current_order.payment_confirmed_at is null
     or current_order.payment_confirmed_by is null then
    raise exception 'payment_not_reversible';
  end if;
  if current_order.edit_pending_approval then raise exception 'pending_order_edit'; end if;
  if current_order.request_type = 'creative' then raise exception 'creative_payment_not_reversible'; end if;
  if p_actor is null then raise exception 'missing_actor'; end if;

  next_status := 'submitted';
  perform set_config('droska.payment_reversal_actor', p_actor::text, true);
  update public.orders
  set status = next_status,
      payment_confirmed_at = null,
      payment_confirmed_by = null,
      payment_transfer_notice_at = null,
      updated_at = now()
  where id = p_order_id;

  update public.payments
  set status = 'pending', confirmed_at = null
  where order_id = p_order_id
    and provider in ('transferencia_bancaria', 'manual')
    and status = 'approved';

  return next_status;
end;
$$;

revoke all on function public.revoke_order_payment_confirmation(bigint, uuid) from public, anon, authenticated;
grant execute on function public.revoke_order_payment_confirmation(bigint, uuid) to service_role;

create or replace function private.track_order_status_change()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.status is distinct from old.status then
    insert into public.order_status_history (order_id, status, note)
    values (
      new.id,
      new.status,
      case
        when old.status = 'paid' and new.status = 'submitted'
          and old.payment_confirmed_at is not null and new.payment_confirmed_at is null
          then 'Confirmación del pago revertida por administración (usuario '
            || coalesce(current_setting('droska.payment_reversal_actor', true), 'desconocido') || ').'
        when new.status = 'paid' then 'Pago confirmado por administración.'
        else 'Estado actualizado desde el panel de administración.'
      end
    );
  end if;
  return new;
end;
$$;

revoke all on function private.track_order_status_change() from public, anon, authenticated;
