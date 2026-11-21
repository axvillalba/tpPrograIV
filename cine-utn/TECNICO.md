# 🛠️ Cine UTN · Documento Técnico y Arquitectura

Detalle técnico de la arquitectura de software, decisiones de diseño, modelo de datos relacional (DDL), seguridad RLS y servicios en **Angular 18/19** y **Supabase**.

---

## 📋 Índice

1. [Stack Tecnológico y Arquitectura](#1-stack-tecnológico-y-arquitectura)
2. [Estructura del Proyecto Frontend](#2-estructura-del-proyecto-frontend)
3. [Modelo de Datos y Seguridad RLS (Supabase)](#3-modelo-de-datos-y-seguridad-rls-supabase)
4. [Decisiones Técnicas y Patrones Clave](#4-decisiones-técnicas-y-patrones-clave)
5. [Servicios y Módulos del Sistema](#5-servicios-y-módulos-del-sistema)
6. [Guía de Despliegue y Variables de Entorno](#6-guía-de-despliegue-y-variables-de-entorno)

---

## 1. Stack Tecnológico y Arquitectura

```
┌─────────────────────────────────────────────────────────────┐
│                Angular Single Page App                      │
│   (Standalone Components, Signals, Computeds, Bootstrap 5)  │
└───────────────┬──────────────────────────────┬──────────────┘
                │                              │
     HTTPS REST │                              │ Supabase Realtime
     / Auth API │                              │ (WebSockets)
                ▼                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    Supabase Backend (BaaS)                  │
│ ┌──────────────────┐ ┌──────────────────┐ ┌───────────────┐ │
│ │ Auth & Profiles  │ │ PostgreSQL + RLS │ │ Storage Bucket│ │
│ └──────────────────┘ └──────────────────┘ └───────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

- **Frontend:** Angular 18/19 con **Standalone Components**, control de flujo nativo (`@if`, `@for`), reactividad mediante **Signals** (`signal()`, `computed()`) y ChangeDetectorRef para re-evaluaciones críticas.
- **Estilos:** Bootstrap 5.3 nativo y Bootstrap Icons.
- **Backend as a Service (BaaS):** Supabase (PostgreSQL 15, Authentication Auth, Storage para imágenes y Realtime WebSockets).

---

## 2. Estructura del Proyecto Frontend

```
src/app/
├── components/
│   └── navbar/                 # Barra de navegación compartida
├── pages/
│   ├── admin-dashboard/        # Panel Gerencial (ABM, Métricas, Logs)
│   ├── cartelera/              # Catálogo principal y Próximamente
│   ├── checkout/               # Resumen de compra y pago
│   ├── login / registro/       # Autenticación de usuarios
│   ├── perfil/                 # Historial, Crédito, Mis Películas, Reseñas
│   ├── seleccion-entradas/     # Selector de butacas Realtime + accesibilidad
│   └── validador-qr/           # Escáner de entradas para Staff
├── services/
│   ├── auditoria.ts            # Registro de logs de auditoría
│   ├── auth.ts                 # Servicio de autenticación y cálculo de edad
│   ├── candy.ts                # ABM de productos del Candy Bar
│   ├── cupones.ts              # ABM y validación de cupones
│   ├── recompensas.ts          # Gestión del catálogo de fidelización
│   └── supabase.ts             # Cliente centralizado Supabase
└── environments/
    ├── environment.ts          # Credenciales Supabase Dev
    └── environment.prod.ts     # Credenciales Supabase Prod
```

---

## 3. Modelo de Datos y Seguridad RLS (Supabase)

### 3.1 Esquema Relacional DDL

```sql
-- 1. Perfiles de usuario
CREATE TABLE public.perfiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT UNIQUE NOT NULL,
    nombre TEXT,
    apellido TEXT,
    rol TEXT DEFAULT 'cliente',
    fecha_nacimiento DATE,
    puntos_fidelidad INT DEFAULT 0,
    credito_saldo NUMERIC DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- 2. Películas
CREATE TABLE public.peliculas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    titulo TEXT NOT NULL,
    sinopsis TEXT,
    duracion_minutos INT NOT NULL,
    imagen_url TEXT,
    clasificacion_edad TEXT DEFAULT 'ATP',
    generos TEXT[],
    es_proximamente BOOLEAN DEFAULT false,
    fecha_estreno DATE,
    es_preventa BOOLEAN DEFAULT false,
    precio_preventa NUMERIC DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- 3. Salas
CREATE TABLE public.salas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre TEXT NOT NULL,
    capacidad INT NOT NULL DEFAULT 200
);

-- 4. Funciones
CREATE TABLE public.funciones (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pelicula_id UUID REFERENCES public.peliculas(id) ON DELETE CASCADE,
    sala_id UUID REFERENCES public.salas(id) ON DELETE CASCADE,
    fecha_hora TIMESTAMP WITH TIME ZONE NOT NULL,
    horario_inicio TIMESTAMP WITH TIME ZONE,
    horario_fin TIMESTAMP WITH TIME ZONE,
    formato TEXT DEFAULT '2D',
    idioma TEXT DEFAULT 'Subtitulada',
    precio_base NUMERIC DEFAULT 4500
);

-- 5. Ventas / Reservas
CREATE TABLE public.ventas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.perfiles(id) ON DELETE SET NULL,
    funcion_id UUID REFERENCES public.funciones(id) ON DELETE CASCADE,
    monto_total NUMERIC NOT NULL,
    detalle_butacas JSONB NOT NULL,
    detalle_candy JSONB,
    codigo_qr TEXT UNIQUE NOT NULL,
    estado_qr TEXT DEFAULT 'valido', -- 'valido', 'usado_cine', 'usado_candy', 'usado_total', 'cancelado'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- 6. Candy Bar
CREATE TABLE public.productos_candy (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre TEXT NOT NULL,
    categoria TEXT NOT NULL,
    precio NUMERIC NOT NULL,
    imagen_url TEXT
);

-- 7. Cupones
CREATE TABLE public.cupones (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    codigo TEXT UNIQUE NOT NULL,
    porcentaje_descuento INT NOT NULL,
    solo_mayores_50 BOOLEAN DEFAULT false,
    es_primera_compra BOOLEAN DEFAULT false,
    activo BOOLEAN DEFAULT true
);

-- 8. Recompensas (Fidelización)
CREATE TABLE public.recompensas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre TEXT NOT NULL,
    descripcion TEXT,
    costo_puntos INT NOT NULL,
    tipo TEXT NOT NULL,
    imagen_url TEXT,
    activo BOOLEAN DEFAULT true
);

-- 9. Movimientos de Puntos
CREATE TABLE public.movimientos_puntos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    usuario_id UUID REFERENCES public.perfiles(id) ON DELETE CASCADE,
    cantidad INT NOT NULL,
    motivo TEXT NOT NULL,
    fecha TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- 10. Alertas de Estrenos
CREATE TABLE public.alertas_estrenos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    usuario_id UUID REFERENCES public.perfiles(id) ON DELETE CASCADE,
    pelicula_id UUID REFERENCES public.peliculas(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    UNIQUE(usuario_id, pelicula_id)
);

-- 11. Logs de Auditoría
CREATE TABLE public.logs_auditoria (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    usuario_id UUID REFERENCES public.perfiles(id) ON DELETE SET NULL,
    usuario_email TEXT,
    accion TEXT NOT NULL,
    detalle JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);
```

### 3.2 Políticas de Row Level Security (RLS)

- **Lectura Pública (`SELECT`):** Habilitada para `peliculas`, `funciones`, `salas`, `productos_candy`, `cupones` y `recompensas`.
- **Modificación (`INSERT`, `UPDATE`, `DELETE`):** Restringida a usuarios autenticados con rol `admin` mediante claims en JWT o consulta a `perfiles.rol`.
- **Datos Privados:** La tabla `ventas`, `movimientos_puntos` y `alertas_estrenos` permiten lectura/escritura únicamente al propietario de los datos (`user_id = auth.uid()`) o a administradores.

---

## 4. Decisiones Técnicas y Patrones Clave

### 4.1 Supabase Realtime (Sincronización de Butacas)
En `SeleccionEntradasComponent`, se crea una suscripción al canal WebSocket de Supabase filtrando por `funcion_id`:

```typescript
this.canalRealtime = this.supabaseService.client
  .channel(`ventas-funcion-${funcionId}`)
  .on('postgres_changes', {
    event: 'INSERT',
    schema: 'public',
    table: 'ventas',
    filter: `funcion_id=eq.${funcionId}`
  }, (payload) => {
    // Deshabilita en vivo las butacas recién vendidas
  })
  .subscribe();
```

### 4.2 Algoritmo de Programación Recurrente y Verificación de Solapamiento
Al crear funciones en el `AdminDashboardComponent`, el sistema evalúa la duración de la película + 30 minutos obligatorios de limpieza:

$$\text{Horario Fin Limpieza} = \text{Fecha Inicio} + (\text{Duración Minutos} + 30)\text{ min}$$

Se valida contra las funciones existentes en la misma sala para evitar la condición:
$$\text{NuevaInicio} < \text{ExistenteFinConLimpieza} \quad \land \quad \text{NuevaFinConLimpieza} > \text{ExistenteInicio}$$

### 4.3 Cálculo Preciso de Edad en `AuthService`
Para evitar inconsistencias en la validación de películas `+18` o cupones `+50 años`:

```typescript
calcularEdad(fechaNacimientoStr: string | Date): number {
  if (!fechaNacimientoStr) return 0;
  const hoy = new Date();
  const fechaNac = new Date(fechaNacimientoStr);
  let edad = hoy.getFullYear() - fechaNac.getFullYear();
  const mes = hoy.getMonth() - fechaNac.getMonth();
  if (mes < 0 || (mes === 0 && hoy.getDate() < fechaNac.getDate())) {
    edad--;
  }
  return edad;
}
```

### 4.4 Formato ISO 8601 para Zonas Horarias
Los inputs HTML de tipo `datetime-local` se convierten automáticamente a ISO UTC (`toISOString()`) al persistir en Supabase y se formatean con el pipe `date:'dd/MM/yyyy HH:mm'` al visualizar en pantalla.

---

## 5. Servicios y Módulos del Sistema

- **`SupabaseService`:** Inicializa la instancia singleton del cliente de Supabase JS SDK.
- **`AuthService`:** Gestiona sesión, perfil activo (`perfiles`), login/logout y el cálculo reactivo de edad.
- **`AuditoriaService`:** Centraliza el registro persistente de eventos críticos en `logs_auditoria`.
- **`CandyService` / `CuponesService` / `RecompensasService`:** Encapsulan los métodos CRUD específicos delegando operaciones a Supabase.

---

## 6. Guía de Despliegue y Variables de Entorno

### Configuración de `src/environments/environment.ts`:

```typescript
export const environment = {
  production: false,
  supabaseUrl: 'https://tu-proyecto.supabase.co',
  supabaseKey: 'tu-anon-key-de-supabase'
};
```

### Comandos de Construcción y Verificación:

```bash
# Servidor de desarrollo
ng serve
