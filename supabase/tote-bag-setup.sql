-- Configuración idempotente de la tote bag vendible. Los precios y costos de
-- ambas tallas fueron definidos para la tienda; la base valida el cobro.
begin;

insert into public.product_models (code, name, description, active)
values ('tote', 'Tote bag', 'Bolsa de tela estampada con diseños Droska.', true)
on conflict (code) do update
set name = excluded.name, description = excluded.description, active = true, updated_at = now();

insert into public.product_variants (product_model_id, sku, size, color_name, color_hex, price_clp, active)
select model.id, variant.sku, variant.size, 'Natural', '#E8E0CF', variant.price, true
from public.product_models model
cross join (values
  ('M', 'DR-TOTE-M-NAT', 8990),
  ('L', 'DR-TOTE-L-NAT', 9900)
) as variant(size, sku, price)
where model.code = 'tote'
on conflict (sku) do update
set product_model_id = excluded.product_model_id, size = excluded.size,
    color_name = excluded.color_name, color_hex = excluded.color_hex,
    price_clp = excluded.price_clp, active = true, updated_at = now();

update public.supplier_products
set model_code = 'tote', confirmed_price_clp = 8990,
    price_confirmed_at = now(), updated_at = now()
where category_id = (select id from public.supplier_categories where slug = 'tote-bag')
  and slug = 'mediana';

insert into public.supplier_products
  (name, slug, kind, model_code, category_id, unit_cost_clp,
   print_width_cm, print_height_cm, margin_percent, vat_percent,
   confirmed_price_clp, price_confirmed_at, active)
select 'Grande', 'grande', 'garment', 'tote', category.id, 1900,
       25, 28, 50, 19, 9900, now(), true
from public.supplier_categories category
where category.slug = 'tote-bag'
on conflict (category_id, slug) do update
set name = excluded.name, model_code = 'tote', unit_cost_clp = 1900,
    confirmed_price_clp = 9900, price_confirmed_at = now(),
    active = true, updated_at = now();

insert into public.supplier_product_variants (supplier_product_id, product_variant_id)
select supplier.id, variant.id
from public.supplier_products supplier
join public.supplier_categories category on category.id = supplier.category_id
join public.product_variants variant on variant.sku = case supplier.slug
  when 'mediana' then 'DR-TOTE-M-NAT'
  when 'grande' then 'DR-TOTE-L-NAT'
end
where category.slug = 'tote-bag' and supplier.slug in ('mediana', 'grande')
on conflict do nothing;

commit;
