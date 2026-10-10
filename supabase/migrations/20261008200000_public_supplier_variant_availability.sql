-- La tienda solo necesita saber qué variantes tienen un insumo vinculado;
-- no expone costos ni datos de proveedores.
grant select on public.supplier_product_variants to anon;

drop policy if exists "public_supplier_product_variants_read" on public.supplier_product_variants;
create policy "public_supplier_product_variants_read"
  on public.supplier_product_variants for select to anon, authenticated
  using (true);
