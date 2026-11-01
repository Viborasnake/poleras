-- La línea femenina creada en Insumos debe existir también como producto comprable.
insert into public.product_models (code, name, description, active)
values ('woman', 'Mujer', 'Calce femenino para todos los días.', true)
on conflict (code) do update
set name = excluded.name,
    description = excluded.description,
    active = true,
    updated_at = now();

insert into public.product_variants (product_model_id, sku, size, color_name, color_hex, price_clp, active)
select model.id, item.sku, item.size, 'Blanco', '#FFFFFF', item.price_clp, true
from public.product_models model
cross join (values
  ('S', 'DR-WMN-S-WHT', 14990),
  ('M', 'DR-WMN-M-WHT', 14990),
  ('L', 'DR-WMN-L-WHT', 14990)
) as item(size, sku, price_clp)
where model.code = 'woman'
on conflict (sku) do update
set size = excluded.size,
    active = true,
    updated_at = now();

update public.supplier_products
set model_code = 'woman', updated_at = now()
where category_id = (
  select id from public.supplier_categories where slug = 'polera-mujer-basica'
);
