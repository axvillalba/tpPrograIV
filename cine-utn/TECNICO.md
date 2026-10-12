# Cine UTN · Documento Técnico

Especificaciones técnicas, esquema DDL de la base de datos de Supabase, arquitectura del cliente Angular y buenas prácticas aplicadas.

---

## 1. Arquitectura & Stack Técnico

- **Frontend**: Angular 18/19 (Standalone Components, Signals, Reactive Forms, `ChangeDetectorRef`).
- **Backend as a Service**: Supabase (PostgreSQL 15+, Auth Service, Client SDK).
- **Control de Navegación**: Router con Lazy Loading (`loadComponent`), Guards de Autenticación y `NavbarComponent` dinámico.

---

## 2. Modelo de Datos (DDL Supabase)

### Tabla `public.peliculas`
```sql
create table public.peliculas (
  id uuid not null default gen_random_uuid (),
  titulo text not null,
  sinopsis text not null,
  duracion_minutos integer not null,
  imagen_url text null,
  clasificacion_edad text null,
  generos text[] not null,
  es_preventa boolean null default false,
  fecha_estreno date null,
  destacada boolean null default false,
  constraint peliculas_pkey primary key (id),
  constraint peliculas_clasificacion_edad_check check (clasificacion_edad = any (array['ATP'::text, '+13'::text, '+18'::text]))
);