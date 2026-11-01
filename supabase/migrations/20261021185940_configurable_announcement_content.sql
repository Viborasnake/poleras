alter table public.storefront_settings
  add column if not exists announcement_origin_text text not null default 'Hecho a tu pinta, en 🇨🇱 Chile.'
    check (char_length(announcement_origin_text) <= 100);
