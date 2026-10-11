create table if not exists public.storefront_settings (
  id boolean primary key default true check (id),
  whatsapp_number text not null default '56965217926' check (whatsapp_number ~ '^56[0-9]{9}$'),
  support_email text not null default '' check (char_length(support_email) <= 254 and (support_email = '' or support_email ~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$')),
  announcement_enabled boolean not null default true,
  announcement_text text not null default 'De tu cabeza a tu polera. Así de simple.' check (char_length(announcement_text) <= 100 and (not announcement_enabled or length(trim(announcement_text)) > 0)),
  updated_at timestamptz not null default now()
);

alter table public.storefront_settings enable row level security;
revoke all on public.storefront_settings from anon, authenticated;
grant select on public.storefront_settings to anon, authenticated;
grant update on public.storefront_settings to authenticated;

create policy "storefront_settings_read" on public.storefront_settings
  for select to anon, authenticated using (true);
create policy "storefront_settings_admin_update" on public.storefront_settings
  for update to authenticated using ((select public.is_admin()))
  with check ((select public.is_admin()));

insert into public.storefront_settings (id) values (true)
  on conflict (id) do nothing;
