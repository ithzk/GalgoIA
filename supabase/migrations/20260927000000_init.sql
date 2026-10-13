-- GalgoAI: esquema inicial
-- Todas las tablas tienen RLS activado SIN políticas: nadie puede leerlas con la anon key.
-- Solo la Edge Function (service role) accede a los datos, ya autenticada y filtrada por usuario.

create table if not exists public.usuarios (
  email      text primary key,
  nombre     text,
  creado_en  timestamptz not null default now()
);

create table if not exists public.titulos (
  session_id text primary key,
  user_email text not null references public.usuarios(email) on delete cascade,
  titulo     text not null default 'Chat sin título',
  creado_en  timestamptz not null default now()
);
create index if not exists titulos_user_idx on public.titulos (user_email);

create table if not exists public.historial (
  id                  bigserial primary key,
  session_id          text not null,
  user_email          text not null references public.usuarios(email) on delete cascade,
  mensaje_usuario     text not null default '',
  respuesta_asistente text not null default '',
  creado_en           timestamptz not null default now()
);
create index if not exists historial_user_idx    on public.historial (user_email, id);
create index if not exists historial_session_idx on public.historial (session_id, id);

-- Base de conocimiento oficial del ITT (fragmentos de documentos)
create table if not exists public.conocimiento (
  id        bigserial primary key,
  titulo    text not null,
  categoria text,
  contenido text not null,
  fuente    text,
  fts       tsvector generated always as (
              setweight(to_tsvector('spanish', coalesce(titulo, '')), 'A') ||
              setweight(to_tsvector('spanish', coalesce(categoria, '')), 'B') ||
              setweight(to_tsvector('spanish', coalesce(contenido, '')), 'C')
            ) stored
);
create index if not exists conocimiento_fts_idx on public.conocimiento using gin (fts);

alter table public.usuarios     enable row level security;
alter table public.titulos      enable row level security;
alter table public.historial    enable row level security;
alter table public.conocimiento enable row level security;

-- Búsqueda: cualquier palabra de la pregunta que coincida (OR), ordenada por relevancia
create or replace function public.buscar_conocimiento(consulta text, limite int default 5)
returns table (id bigint, titulo text, categoria text, contenido text, fuente text, relevancia real)
language plpgsql stable
as $$
declare
  tsq tsquery;
  palabras text;
begin
  select string_agg(w, ' | ') into palabras
  from (
    select distinct lower(x) as w
    from regexp_split_to_table(
           regexp_replace(consulta, '[^[:alnum:]áéíóúüñÁÉÍÓÚÜÑ ]', ' ', 'g'), '\s+') x
    where length(x) > 2
  ) t;

  if palabras is null then return; end if;
  tsq := to_tsquery('spanish', palabras);

  return query
    select c.id, c.titulo, c.categoria, c.contenido, c.fuente, ts_rank(c.fts, tsq)
    from public.conocimiento c
    where c.fts @@ tsq
    order by ts_rank(c.fts, tsq) desc
    limit limite;
end;
$$;

revoke all on function public.buscar_conocimiento(text, int) from public, anon, authenticated;
