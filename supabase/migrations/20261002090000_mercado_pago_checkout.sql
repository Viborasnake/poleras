-- Mercado Pago Checkout Pro: guarda la preferencia y evita crear pagos desde el navegador.
alter table public.payments
  add column if not exists provider_preference_id text unique,
  add column if not exists provider_payment_id text unique;

alter table public.order_items
  add column if not exists color_hex text,
  add column if not exists quality_review boolean not null default false;

-- Los originales siguen en un bucket privado. Administración puede emitir
-- enlaces firmados de corta duración para preparar pedidos personalizados.
create policy "droska_designs_read_admin"
  on storage.objects for select to authenticated
  using (bucket_id = 'customer-designs' and (select public.is_admin()));

create or replace function private.track_order_status_change()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.status is distinct from old.status then
    insert into public.order_status_history (order_id, status, note)
    values (new.id, new.status,
      case when new.status = 'paid' and new.price_snapshot ->> 'provider' = 'mercado_pago'
        then 'Pago confirmado por Mercado Pago.'
        else 'Estado actualizado desde el panel de administración.' end);
  end if;
  return new;
end;
$$;

revoke all on function private.track_order_status_change() from public, anon, authenticated;

create or replace function private.redeem_mercado_pago_coupon()
returns trigger language plpgsql set search_path = '' as $$
declare
  matched_coupon_id bigint;
  redemption_id bigint;
begin
  if new.status = 'paid' and old.status is distinct from 'paid'
     and new.price_snapshot ->> 'provider' = 'mercado_pago'
     and new.coupon_code is not null and new.discount_clp > 0 then
    select id into matched_coupon_id from public.coupons where code = new.coupon_code;
    if matched_coupon_id is not null then
      insert into public.coupon_redemptions (coupon_id, order_id, amount_clp)
      values (matched_coupon_id, new.id, new.discount_clp)
      on conflict (order_id) do nothing returning id into redemption_id;
      if redemption_id is not null then
        update public.coupons set used_count = used_count + 1, updated_at = now()
        where id = matched_coupon_id;
      end if;
    end if;
  end if;
  return new;
end;
$$;

revoke all on function private.redeem_mercado_pago_coupon() from public, anon, authenticated;
drop trigger if exists redeem_mercado_pago_coupon on public.orders;
create trigger redeem_mercado_pago_coupon
  after update of status on public.orders
  for each row execute function private.redeem_mercado_pago_coupon();
