-- Public storefront reads only the customer-facing size labels and order.
-- Existing RLS policies continue to restrict writes to administrators.
revoke all on public.catalog_product_sizes from anon, authenticated;
grant select on public.catalog_product_sizes to anon;
grant select, insert, update, delete on public.catalog_product_sizes to authenticated;

create policy catalog_product_sizes_storefront_read
on public.catalog_product_sizes for select to anon, authenticated using (true);
