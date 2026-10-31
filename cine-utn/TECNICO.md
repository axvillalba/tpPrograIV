# Cine UTN · Documento técnico

Detalle de la arquitectura, seguridad y decisiones de implementación del proyecto basado en Angular 18/19 y Supabase.

## Índice

1. [Arquitectura y Stack](#1-arquitectura-y-stack)
2. [Seguridad y Base de Datos (RLS)](#2-seguridad-y-base-de-datos-rls)
3. [Decisiones Técnicas Destacadas](#3-decisiones-técnicas-destacadas)
4. [Estructura del Panel de Gerencia](#4-estructura-del-panel-de-gerencia)

---

## 1. Arquitectura y Stack

*   **Frontend:** Angular 18/19. Uso estricto de **Standalone Components** y reactividad basada en **Signals** (`signal()`).
*   **UI/UX:** Bootstrap 5 nativo y Bootstrap Icons. Interfaz construida sin dependencias a librerías de componentes pesadas para asegurar alta performance.
*   **Backend as a Service:** Supabase (PostgreSQL, Authentication, Storage).

---

## 2. Seguridad y Base de Datos (RLS)

El proyecto implementa políticas de **Row Level Security (RLS)** en PostgreSQL para garantizar la integridad de los datos directamente en la capa de base de datos.

| Tabla | Política de Acceso |
|---|---|
| `peliculas` | Lectura pública. Modificación restringida (temporalmente en desarrollo). |
| `funciones` | Lectura pública. Modificación restringida (temporalmente en desarrollo). |
| `cupones` | Lectura pública (para validación en checkout). ABM exclusivo para usuarios `authenticated`. Políticas segmentadas (`FOR INSERT`, `FOR UPDATE`, `FOR DELETE`) con validación `WITH CHECK (true)`. |
| `productos_candy` | Lectura pública. ABM exclusivo para `authenticated`. |
| `resenas` | Relación directa por `usuario_id` a `perfiles`. Previene inconsistencia de datos si el usuario cambia su información personal. |

---

## 3. Decisiones Técnicas Destacadas

1.  **Carga Paralela en Dashboards:** Implementación de `Promise.all()` en la hidratación de datos del Panel de Gerencia. Esto anula el "efecto cascada", permitiendo cargar Películas, Funciones, Cupones y Candy Bar simultáneamente.
2.  **Manejo de Zonas Horarias (Timezones):** Para la programación de funciones, las fechas locales de los `datetime-local` inputs se transforman y almacenan en formato `ISO 8601 UTC` en la base de datos, y se reconvierten a la zona horaria local (ej. Argentina) al momento de editar o visualizar en las grillas, evitando desfases horarios.
3.  **Filtrado de Histórico en Cliente:** Para prevenir la sobrecarga del DOM y mejorar la UX del administrador, el servicio de funciones aplica un filtro `.gte('horario_fin', hoy)` que trae únicamente las funciones activas/futuras a la tabla visual, sin eliminar el registro histórico necesario para la facturación.
4.  **Storage Cloud:** Subida directa de archivos de imagen (afiches de películas e ítems del Candy Bar) a los buckets estructurados de Supabase Storage (`/posters` y `/posters/candy`), devolviendo URLs públicas listas para renderizar.

---

## 4. Estructura del Panel de Gerencia

El componente `admin-dashboard.ts` actúa como un orquestador inteligente segmentado por pestañas virtuales (`pestanaActiva = signal(...)`), pero delega las peticiones HTTP a servicios dedicados siguiendo el principio de Responsabilidad Única:

*   `CandyService`: Gestiona el ABM de `productos_candy`.
*   `CuponesService`: Gestiona el ABM de `cupones`.
*   `SupabaseService`: Cliente general y gestión compartida de catálogo.