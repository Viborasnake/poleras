create table public.admin_notification_settings (
  id boolean primary key default true check (id),
  enabled boolean not null default true,
  recipient_email text not null default '' check (char_length(recipient_email) <= 254 and (recipient_email = '' or recipient_email ~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$')),
  updated_at timestamptz not null default now()
);

alter table public.admin_notification_settings enable row level security;
revoke all on public.admin_notification_settings from anon, authenticated;
grant select, update on public.admin_notification_settings to authenticated;

create policy "admin_notification_settings_read" on public.admin_notification_settings
  for select to authenticated using ((select public.is_admin()));
create policy "admin_notification_settings_update" on public.admin_notification_settings
  for update to authenticated using ((select public.is_admin()))
  with check ((select public.is_admin()));

insert into public.admin_notification_settings (id) values (true);
