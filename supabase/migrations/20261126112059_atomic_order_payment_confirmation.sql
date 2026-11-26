create function public.confirm_order_payment(
  p_order_id bigint,
  p_actor uuid,
  p_total_clp integer
)
returns timestamptz
language plpgsql
security invoker
set search_path = ''
as $$
declare
  current_order public.orders%rowtype;
  recorded_payment public.payments%rowtype;
  payment_at timestamptz := now();
  has_transfer_instructions boolean;
begin
  select * into current_order
  from public.orders
  where id = p_order_id
  for update;

  if not found or p_actor is null then
    raise exception 'No pudimos confirmar el pago del pedido.';
  end if;
  if current_order.archived_at is not null
      or current_order.status not in ('submitted', 'quoted', 'awaiting_deposit', 'paid') then
    raise exception 'Este pedido ya no admite confirmar el pago desde aquí.';
  end if;
  if current_order.edit_pending_approval then
    raise exception 'Primero revisa los cambios pendientes del pedido.';
  end if;
  if current_order.payment_confirmed_at is not null and current_order.payment_confirmed_by is not null then
    raise exception 'Este pago ya fue confirmado por administración.';
  end if;
  if current_order.total_clp is distinct from p_total_clp
      or (current_order.status = 'quoted' and current_order.request_type = 'creative'
        and (current_order.quoted_total_clp is distinct from current_order.total_clp or current_order.total_clp <= 0)) then
    raise exception 'El total del pedido cambió o la cotización está incompleta. Recarga el pedido y revisa el monto.';
  end if;

  perform id from public.payments where order_id = p_order_id order by id for update;
  if exists (
    select 1 from public.payments
    where order_id = p_order_id and status in ('refunded', 'partially_refunded', 'charged_back', 'in_mediation')
  ) then
    raise exception 'Este pago tiene una incidencia. Resuélvela antes de confirmar.';
  end if;
  has_transfer_instructions := coalesce(jsonb_typeof(current_order.payment_instructions -> 'transfer') = 'object', false);

  if not exists (
    select 1 from public.payments
    where order_id = p_order_id and provider = 'mercado_pago' and status = 'approved'
  ) then
    select * into recorded_payment
    from public.payments
    where order_id = p_order_id and provider in ('transferencia_bancaria', 'manual') and status in ('pending', 'approved')
    order by (provider = 'transferencia_bancaria') desc, created_at desc, id desc
    limit 1;

    if recorded_payment.id is not null then
      update public.payments set status = 'approved', confirmed_at = payment_at
      where id = recorded_payment.id and status = 'pending';
    elsif not has_transfer_instructions and exists (
      select 1 from public.payments where order_id = p_order_id and provider = 'mercado_pago'
    ) then
      raise exception 'Mercado Pago todavía no aprobó este cobro. Espera la confirmación o pide al cliente que reintente el pago.';
    else
      insert into public.payments (order_id, provider, kind, status, amount_clp, confirmed_at)
      values (
        p_order_id, case when has_transfer_instructions then 'transferencia_bancaria' else 'manual' end,
        'full', 'approved', current_order.total_clp, payment_at
      );
    end if;
  end if;

  update public.orders
  set status = 'paid', payment_confirmed_at = payment_at,
      payment_confirmed_by = p_actor, updated_at = payment_at
  where id = p_order_id;

  if current_order.status = 'paid' then
    insert into public.order_status_history (order_id, status, note)
    values (p_order_id, 'paid', 'Pago confirmado manualmente por administración.');
  end if;

  return payment_at;
end;
$$;

revoke all on function public.confirm_order_payment(bigint, uuid, integer) from public, anon, authenticated;
grant execute on function public.confirm_order_payment(bigint, uuid, integer) to service_role;
