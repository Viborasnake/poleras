alter table public.catalog_designs
  add column customer_photo_subject text not null default 'pets'
  constraint catalog_designs_customer_photo_subject_check
  check (customer_photo_subject in ('pets', 'people'));

update public.catalog_designs
set customer_photo_subject = 'people'
where slug = 'mi-pobre-angelito';
