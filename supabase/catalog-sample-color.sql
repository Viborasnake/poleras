alter table public.catalog_designs
  add column if not exists sample_color text not null default '#ffffff';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'catalog_designs_sample_color_format'
      and conrelid = 'public.catalog_designs'::regclass
  ) then
    alter table public.catalog_designs
      add constraint catalog_designs_sample_color_format
      check (sample_color ~ '^#[0-9a-fA-F]{6}$');
  end if;
end
$$;

update public.catalog_designs
set sample_color = '#202124'
where slug = 'guardiana-celestial-magenta-estelar';
