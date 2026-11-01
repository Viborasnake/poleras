-- Additive opt-in: existing visitors retain the classic storefront.
alter table public.storefront_settings
  add column storefront_layout text not null default 'classic'
  constraint storefront_settings_layout_check check (storefront_layout in ('classic','drop-wall'));

comment on column public.storefront_settings.storefront_layout is
  'Public home layout, controlled by administrators. classic is the safe default; drop-wall opts into the photographic wall.';
-- Existing public read and administrator-only update RLS policies apply unchanged.
