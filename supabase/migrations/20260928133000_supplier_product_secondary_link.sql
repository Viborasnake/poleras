-- Relación general entre un insumo principal y el insumo secundario que consume.
-- dtf_product_id se conserva por compatibilidad con los registros existentes.

alter table public.supplier_products
  add column if not exists secondary_product_id bigint;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'supplier_products_secondary_product_fk'
      and conrelid = 'public.supplier_products'::regclass
  ) then
    alter table public.supplier_products
      add constraint supplier_products_secondary_product_fk
      foreign key (secondary_product_id)
      references public.supplier_products(id)
      on delete set null;
  end if;
end $$;

update public.supplier_products
set secondary_product_id = dtf_product_id
where secondary_product_id is null
  and dtf_product_id is not null;

update public.supplier_products principal
set secondary_product_id = (
  select secondary.id
  from public.supplier_products secondary
  where secondary.kind = 'dtf'
    and secondary.active
  order by secondary.id
  limit 1
)
where principal.kind = 'garment'
  and principal.secondary_product_id is null;

comment on column public.supplier_products.secondary_product_id is
  'Insumo secundario consumido por el insumo principal; su costo se prorratea según el tamaño configurado.';
