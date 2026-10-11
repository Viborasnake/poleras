-- El proveedor registra el cobro; la confirmación final pertenece a administración.
alter table public.orders
  add constraint orders_paid_requires_admin_confirmation
  check (status <> 'paid' or (payment_confirmed_at is not null and payment_confirmed_by is not null));

create or replace function private.track_order_status_change()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.status is distinct from old.status then
    insert into public.order_status_history (order_id, status, note)
    values (
      new.id,
      new.status,
      case
        when new.status = 'paid' then 'Pago confirmado por administración.'
        else 'Estado actualizado desde el panel de administración.'
      end
    );
  end if;
  return new;
end;
$$;

revoke all on function private.track_order_status_change() from public, anon, authenticated;
