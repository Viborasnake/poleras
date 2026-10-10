-- Referencias privadas e idempotencia de solicitudes creativas.
alter table public.orders add column if not exists creative_request_id uuid;
create unique index if not exists orders_creative_request_id_key
  on public.orders (creative_request_id) where creative_request_id is not null;

create policy "droska_designs_insert_reference_own"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'customer-designs'
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and (storage.foldername(name))[2] = 'reference'
);

-- Una cotización con un intento de pago registrado conserva el monto cobrado.
create or replace function private.guard_creative_quote_amount()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if old.request_type = 'creative'
     and (new.total_clp is distinct from old.total_clp or new.quoted_total_clp is distinct from old.quoted_total_clp)
     and exists (select 1 from public.payments p where p.order_id = old.id and p.status in ('pending', 'approved')) then
    raise exception 'La cotización tiene un pago iniciado; no se puede cambiar su importe.';
  end if;
  return new;
end;
$$;
revoke all on function private.guard_creative_quote_amount() from public, anon, authenticated;
drop trigger if exists guard_creative_quote_amount on public.orders;
create trigger guard_creative_quote_amount before update of total_clp, quoted_total_clp on public.orders
for each row execute function private.guard_creative_quote_amount();
