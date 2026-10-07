-- Mantiene una sola entrada de historial por transición y describe el origen
-- de una confirmación de pago que cambia el pedido a pagado.
create or replace function private.track_order_status_change()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.status is distinct from old.status then
    insert into public.order_status_history (order_id, status, note)
    values (
      new.id,
      new.status,
      case
        when new.status = 'paid' and new.price_snapshot ->> 'provider' = 'mercado_pago'
          then 'Pago confirmado por Mercado Pago.'
        when new.status = 'paid' and new.price_snapshot ->> 'provider' = 'bank_transfer'
          then 'Transferencia confirmada por administración.'
        when new.status = 'paid'
          then 'Pago confirmado por administración.'
        else 'Estado actualizado desde el panel de administración.'
      end
    );
  end if;
  return new;
end;
$$;

revoke all on function private.track_order_status_change() from public, anon, authenticated;
