create table public.service_surveys (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(btrim(title)) between 1 and 120),
  description text not null default '' check (char_length(description) <= 500),
  questions jsonb not null check (case when jsonb_typeof(questions) = 'array'
    then jsonb_array_length(questions) between 1 and 12 else false end),
  active boolean not null default false,
  updated_at timestamptz not null default now()
);

create unique index service_surveys_one_active_idx on public.service_surveys (active) where active;

create table public.service_survey_invitations (
  order_id bigint primary key references public.orders (id) on delete cascade,
  survey_id uuid not null references public.service_surveys (id),
  token uuid not null unique default gen_random_uuid(),
  questionnaire jsonb not null,
  sent_at timestamptz,
  responded_at timestamptz,
  answers jsonb,
  check ((responded_at is null and answers is null)
    or (responded_at is not null and answers is not null and jsonb_typeof(answers) = 'object'))
);

create index service_survey_invitations_survey_idx
  on public.service_survey_invitations (survey_id, order_id);

alter table public.service_surveys enable row level security;
alter table public.service_survey_invitations enable row level security;

revoke all on public.service_surveys, public.service_survey_invitations from public, anon, authenticated;
grant select, insert (title, description, questions), update (title, description, questions, active, updated_at)
  on public.service_surveys to authenticated;
grant select (order_id, survey_id, questionnaire, sent_at, responded_at, answers)
  on public.service_survey_invitations to authenticated;
grant select on public.service_surveys to service_role;
grant select, insert, update on public.service_survey_invitations to service_role;

create policy "admin_read_service_surveys" on public.service_surveys
  for select to authenticated using ((select public.is_admin()));
create policy "admin_create_service_surveys" on public.service_surveys
  for insert to authenticated with check ((select public.is_admin()));
create policy "admin_update_service_surveys" on public.service_surveys
  for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "admin_read_service_invitations" on public.service_survey_invitations
  for select to authenticated using ((select public.is_admin()));

create function public.activate_service_survey(p_survey_id uuid)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if public.is_admin() is not true then
    raise insufficient_privilege;
  end if;

  perform pg_advisory_xact_lock(631291, 1);
  if not exists (select 1 from public.service_surveys where id = p_survey_id) then
    raise exception 'Encuesta no encontrada.';
  end if;

  update public.service_surveys set active = false where active and id <> p_survey_id;
  update public.service_surveys set active = true where id = p_survey_id and not active;
end;
$$;

create function public.service_completed_orders(p_search text default '')
returns table (
  id bigint, customer_name text, customer_email text, fulfillment text, total_clp integer,
  completed_at timestamptz, archived_at timestamptz, sent_at timestamptz, responded_at timestamptz
)
language sql
stable
security invoker
set search_path = ''
as $$
  select o.id, customer.name, customer.email, o.shipping_address->>'fulfillment', o.total_clp,
    coalesce(history.closed_at, o.updated_at), o.archived_at, i.sent_at, i.responded_at
  from public.orders o
  cross join lateral (
    select concat_ws(' ', nullif(o.shipping_address->'customer'->>'first_name', ''),
      nullif(o.shipping_address->'customer'->>'last_name', '')) as name,
      o.shipping_address->'customer'->>'email' as email
  ) customer
  left join lateral (
    select min(h.created_at) as closed_at
    from public.order_status_history h
    where h.order_id = o.id and h.status = 'delivered'
  ) history on true
  left join public.service_survey_invitations i on i.order_id = o.id
  where (select public.is_admin()) and o.status = 'delivered'
    and (btrim(p_search) = '' or strpos(lower(concat_ws(' ', o.id::text, customer.name, customer.email)),
      lower(ltrim(btrim(p_search), '#'))) > 0);
$$;

revoke all on function public.activate_service_survey(uuid), public.service_completed_orders(text)
  from public, anon, authenticated;
grant execute on function public.activate_service_survey(uuid), public.service_completed_orders(text)
  to authenticated;

insert into public.service_surveys (title, description, questions, active)
values (
  'Evaluación de servicio',
  'Cuéntanos cómo fue tu experiencia con Droska. Tus respuestas nos ayudan a mejorar.',
  '[
    {"id":"experiencia","type":"rating","label":"¿Cómo evaluarías tu experiencia con Droska?","required":true},
    {"id":"atencion","type":"rating","label":"¿Cómo evaluarías la atención que recibiste?","required":true},
    {"id":"comentario","type":"text","label":"¿Qué podríamos mejorar?","required":false}
  ]'::jsonb,
  true
);
