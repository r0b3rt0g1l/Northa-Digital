-- Almacén compartido del asistente ciudadano para toda la flota.
-- Una sola base; cada fila lleva el slug del municipio.
-- El sitio accede con la service key desde el servidor (route handlers);
-- RLS queda activo sin políticas para que la anon key no lea nada.

create extension if not exists pgcrypto;

create table if not exists public.conversaciones (
  id               uuid primary key default gen_random_uuid(),
  municipio        text not null,
  correo_ciudadano text,
  iniciada_en      timestamptz not null default now(),
  ultima_actividad timestamptz not null default now(),
  escalada         boolean not null default false,
  resumen_tema     text
);

create table if not exists public.mensajes (
  id              uuid primary key default gen_random_uuid(),
  conversacion_id uuid not null references public.conversaciones(id) on delete cascade,
  rol             text not null check (rol in ('ciudadano', 'asistente')),
  texto           text not null,
  secciones       jsonb not null default '[]'::jsonb,
  creado_en       timestamptz not null default now()
);

create table if not exists public.reportes (
  id          uuid primary key default gen_random_uuid(),
  municipio   text not null,
  periodo     text not null check (periodo ~ '^[0-9]{4}-[0-9]{2}$'),
  generado_en timestamptz not null default now(),
  html        text not null,
  json        jsonb not null,
  enviado_a   text[] not null default '{}',
  enviado_en  timestamptz,
  unique (municipio, periodo)
);

create index if not exists conversaciones_municipio_iniciada_idx
  on public.conversaciones (municipio, iniciada_en desc);
create index if not exists mensajes_conversacion_creado_idx
  on public.mensajes (conversacion_id, creado_en);
create index if not exists reportes_municipio_periodo_idx
  on public.reportes (municipio, periodo desc);

-- Mantiene ultima_actividad al insertar mensajes.
create or replace function public.tocar_conversacion() returns trigger
language plpgsql as $$
begin
  update public.conversaciones
     set ultima_actividad = greatest(ultima_actividad, new.creado_en)
   where id = new.conversacion_id;
  return new;
end $$;

drop trigger if exists mensajes_tocar_conversacion on public.mensajes;
create trigger mensajes_tocar_conversacion
  after insert on public.mensajes
  for each row execute function public.tocar_conversacion();

alter table public.conversaciones enable row level security;
alter table public.mensajes       enable row level security;
alter table public.reportes       enable row level security;
