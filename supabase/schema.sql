-- RadarBug: pegá todo esto en Supabase → SQL Editor → Run (una sola vez).

-- Foto diaria de precios: una fila por producto por día
create table if not exists precios (
  id           bigserial primary key,
  fecha        date not null default ((now() at time zone 'America/Argentina/Buenos_Aires')::date),
  tienda_id    text not null,
  product_key  text not null,          -- tienda|url del producto
  ean          text,                   -- código de barras (cuando la tienda lo publica)
  nombre       text,
  precio       numeric not null,
  precio_lista numeric,
  url          text,
  img          text,
  unique (product_key, fecha)
);
create index if not exists precios_ean_idx on precios (ean, fecha desc) where ean is not null;
create index if not exists precios_key_idx on precios (product_key, fecha desc);

-- Configuración interna (token de MercadoLibre, etc.)
create table if not exists config (
  key        text primary key,
  value      text,
  updated_at timestamptz default now()
);

-- Seguridad: nadie accede desde el navegador; solo la API de Vercel con la clave service_role
alter table precios enable row level security;
alter table config  enable row level security;

-- Estadísticas de precio de los últimos N días (sin contar hoy)
create or replace function stats_precios(keys text[], dias int default 60)
returns table (product_key text, dias_con_datos int, min_precio numeric, prom_precio numeric, max_lista numeric, primera_fecha date)
language sql stable as $$
  select p.product_key, count(*)::int, min(p.precio), avg(p.precio), max(p.precio_lista), min(p.fecha)
  from precios p
  where p.product_key = any(keys)
    and p.fecha >= ((now() at time zone 'America/Argentina/Buenos_Aires')::date - dias)
    and p.fecha <  ((now() at time zone 'America/Argentina/Buenos_Aires')::date)
  group by p.product_key
$$;

-- Último precio conocido de cada EAN en cada tienda (últimos 3 días)
create or replace function ultimos_por_ean(eans text[])
returns table (ean text, tienda_id text, nombre text, precio numeric, url text, fecha date)
language sql stable as $$
  select distinct on (p.ean, p.tienda_id) p.ean, p.tienda_id, p.nombre, p.precio, p.url, p.fecha
  from precios p
  where p.ean = any(eans)
    and p.fecha >= ((now() at time zone 'America/Argentina/Buenos_Aires')::date - 3)
  order by p.ean, p.tienda_id, p.fecha desc
$$;

-- Limpieza: borra fotos de más de 180 días (opcional, para no llenar el plan gratis)
create or replace function limpiar_precios_viejos()
returns void language sql as $$
  delete from precios where fecha < ((now() at time zone 'America/Argentina/Buenos_Aires')::date - 180)
$$;
