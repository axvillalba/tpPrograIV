# 🛠️ Cine UTN · Documento de Arquitectura y Especificación Técnica

Este documento detalla la arquitectura de software, el diseño de la base de datos relacional (DDL), los procedimientos almacenados atómicos (RPC), la seguridad RBAC, los canales en tiempo real y los patrones de desarrollo implementados en el proyecto **Cine UTN**, desarrollado bajo el ecosistema **Angular 21** y **Supabase (PostgreSQL 15)**.

---

## 📋 Índice General

1. [Arquitectura General del Sistema](#1-arquitectura-general-del-sistema)
2. [Estructura del Proyecto y Módulos](#2-estructura-del-proyecto-y-módulos)
3. [Modelo de Datos DDL en PostgreSQL (Esquema Completo)](#3-modelo-de-datos-ddl-en-postgresql-esquema-completo)
4. [Procedimientos Almacenados y Transacciones Atómicas (RPC)](#4-procedimientos-almacenados-y-transacciones-atómicas-rpc)
5. [Arquitectura de Sincronización en Tiempo Real (WebSockets)](#5-arquitectura-de-sincronización-en-tiempo-real-websockets)
6. [Seguridad, Control de Acceso RBAC y Guards](#6-seguridad-control-de-acceso-rbac-y-guards)
7. [Algoritmos Clave del Negocio](#7-algoritmos-clave-del-negocio)
8. [Configuración, Entornos y Despliegue](#8-configuración-entornos-y-despliegue)

---

## 1. Arquitectura General del Sistema

El sistema implementa una arquitectura desacoplada basada en el patrón **JAMstack / BaaS (Backend as a Service)**:

```
┌────────────────────────────────────────────────────────────────────────┐
│                        Cine UTN Single Page App                        │
│         Angular 21 (Standalone Components, Signals, Computed)          │
└───────────────┬───────────────────────────────┬────────────────────────┘
                │                               │
     HTTPS REST │ Auth / RPC                    │ WebSockets (WSS)
                ▼                               ▼
┌────────────────────────────────────────────────────────────────────────┐
│                        Supabase Cloud Platform                         │
│  ┌───────────────────────┐ ┌───────────────────────┐ ┌───────────────┐ │
│  │   Supabase Auth & RLS │ │   PostgreSQL 15       │ │ Realtime WSS  │ │
│  │   (JWT & Sessions)    │ │   (Tablas, RPCs, DDL) │ │ (Presence &   │ │
│  └───────────────────────┘ └───────────────────────┘ │  Broadcast)   │ │
│  ┌─────────────────────────────────────────────────┐ └───────────────┘ │
│  │   Storage Buckets (Posters de Películas/Premios)│                   │
│  └─────────────────────────────────────────────────┘                   │
└────────────────────────────────────────────────────────────────────────┘
```

### Tecnologías Empleadas:
* **Frontend:** Angular 21 (`^21.2.0`) con control de flujo nativo (`@if`, `@for`), componentes independientes sin `NgModule`, gestión de estado reactivo mediante `signal()`, `computed()` y `effect()`.
* **Backend y Base de Datos:** PostgreSQL 15 en Supabase, con tablas relacionales normalizadas, constraints estrictos, estructuras `JSONB` y funciones almacenadas de control de transacciones (`SECURITY DEFINER`).
* **Sincronización:** Canales WebSocket bidireccionales provistos por Supabase Realtime (Presence para selección concurrente y Postgres Changes para ocupación y lista de espera).

---

## 2. Estructura del Proyecto y Módulos

```
cine-utn/
├── src/
│   ├── app/
│   │   ├── components/
│   │   │   ├── modal-sistema/           # Diálogos modales y alertas globales reactivas
│   │   │   └── navbar/                  # Navegación, indicadores de sesión y perfil
│   │   ├── guards/
│   │   │   └── auth.guard.ts            # Guards funcionales (adminGuard, staffGuard, authGuard)
│   │   ├── pages/
│   │   │   ├── admin-dashboard/         # Panel Gerencial (ABM, Métricas, Roles RBAC, Sugerencias)
│   │   │   ├── auth/                    # Registro de usuarios y login de clientes
│   │   │   ├── candy/                   # Catálogo y selección de confitería
│   │   │   ├── cartelera/               # Cartelera, próximos estrenos y propuestas de clientes
│   │   │   ├── checkout/                # Resumen de compra, cupones, crédito y emisión PDF
│   │   │   ├── detalle-pelicula/        # Sinopsis, promedio de estrellas y funciones
│   │   │   ├── login-staff/             # Portal corporativo seguro para personal
│   │   │   ├── perfil/                  # Mis Películas, entradas, listas de espera y crédito
│   │   │   ├── seleccion-entradas/      # Selector de butacas Realtime, VIP, adaptadas y espera
│   │   │   └── validador-qr/            # Terminal de control de acceso para empleados
│   │   ├── services/
│   │   │   ├── auditoria.ts             # Trazabilidad inmutable de eventos críticos
│   │   │   ├── auth.ts                  # Autenticación, sesión, RBAC y cálculo de edad
│   │   │   ├── candy.ts                 # Operaciones CRUD sobre productos de confitería
│   │   │   ├── cupones.ts               # Validación de códigos promocionales
│   │   │   ├── lista-espera.ts          # Gestión reactiva de la cola de espera de 15 min
│   │   │   ├── modal.ts                 # Servicio desacoplado de interacción y alertas
│   │   │   ├── peliculas.ts             # Consultas sobre catálogo fílmico
│   │   │   ├── recompensas.ts           # Catálogo del programa de fidelización
│   │   │   └── supabase.ts              # Instancia singleton del cliente de Supabase
│   │   ├── app.routes.ts                # Enrutador con carga perezosa de rutas protegidas
│   │   ├── app.ts                       # Componente raíz con escuchas globales de alertas
│   │   └── app.config.ts                # Configuración de proveedores (Router, HttpClient)
│   ├── environments/
│   │   ├── environment.ts               # Credenciales de entorno para desarrollo
│   │   └── environment.prod.ts          # Credenciales de entorno para producción
│   └── styles.css                       # Overrides de Bootstrap 5 y paleta cinema
```

---

## 3. Modelo de Datos DDL en PostgreSQL (Esquema Completo)

### 3.1 Tabla Central de Ventas (`public.ventas`)
```sql
CREATE TABLE public.ventas (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    user_id UUID NULL,
    funcion_id UUID NULL,
    monto_total NUMERIC NOT NULL,
    descuento_aplicado NUMERIC NULL DEFAULT 0,
    detalle_butacas JSONB NOT NULL,
    detalle_candy JSONB NULL,
    codigo_qr TEXT NOT NULL,
    estado_qr TEXT NULL DEFAULT 'valido'::text,
    entradas_validadas BOOLEAN NULL DEFAULT false,
    candy_entregado BOOLEAN NULL DEFAULT false,
    usado BOOLEAN NULL DEFAULT false,
    fecha_validacion TIMESTAMP WITH TIME ZONE NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT ventas_pkey PRIMARY KEY (id),
    CONSTRAINT ventas_codigo_qr_key UNIQUE (codigo_qr),
    CONSTRAINT fk_ventas_funciones FOREIGN KEY (funcion_id) REFERENCES public.funciones (id) ON DELETE SET NULL,
    CONSTRAINT fk_ventas_perfiles FOREIGN KEY (user_id) REFERENCES public.perfiles (id) ON DELETE SET NULL,
    CONSTRAINT ventas_estado_qr_check CHECK (
        estado_qr = ANY (ARRAY[
            'valido'::text,
            'usado_cine'::text,
            'usado_candy'::text,
            'usado_total'::text,
            'cancelado'::text
        ])
    )
);
```

### 3.2 Perfiles y Ficha de Usuario (`public.perfiles`)
```sql
CREATE TABLE public.perfiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT UNIQUE NOT NULL,
    nombre TEXT,
    apellido TEXT,
    rol TEXT DEFAULT 'cliente',
    rol_admin_id UUID REFERENCES public.roles_admin(id) ON DELETE SET NULL,
    fecha_nacimiento DATE,
    tipo_sangre TEXT DEFAULT 'O+',
    color_ojos TEXT,
    dias_vacaciones INT DEFAULT 14,
    puntos_fidelidad INT DEFAULT 0,
    credito_saldo NUMERIC DEFAULT 0,
    activo BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);
```

### 3.3 Roles Administrativos Granulares (`public.roles_admin`)
```sql
CREATE TABLE public.roles_admin (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre TEXT NOT NULL,
    descripcion TEXT,
    permisos TEXT[] NOT NULL DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);
```

### 3.4 Propuestas de Películas por Clientes (`public.propuestas_peliculas`)
```sql
CREATE TABLE public.propuestas_peliculas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    usuario_id UUID REFERENCES public.perfiles(id) ON DELETE CASCADE,
    nombre_usuario TEXT NOT NULL,
    titulo TEXT NOT NULL,
    comentario TEXT,
    estado TEXT DEFAULT 'pendiente', -- 'pendiente', 'aprobada', 'rechazada'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);
```

### 3.5 Lista de Espera Inteligente (`public.lista_espera`)
```sql
CREATE TABLE public.lista_espera (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    funcion_id UUID REFERENCES public.funciones(id) ON DELETE CASCADE,
    usuario_id UUID REFERENCES public.perfiles(id) ON DELETE CASCADE,
    estado TEXT DEFAULT 'esperando', -- 'esperando', 'notificado', 'comprado', 'expirado', 'cancelado'
    posicion INT NOT NULL,
    expira_en TIMESTAMP WITH TIME ZONE NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);
```

### 3.6 Notificaciones al Usuario (`public.notificaciones`)
```sql
CREATE TABLE public.notificaciones (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    usuario_id UUID REFERENCES public.perfiles(id) ON DELETE CASCADE,
    titulo TEXT NOT NULL,
    mensaje TEXT NOT NULL,
    tipo TEXT NOT NULL, -- 'cancelacion_funcion', 'propuesta_aprobada', 'lista_espera_turno'
    leida BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);
```

### 3.7 Catálogo de Funciones, Películas y Salas
```sql
CREATE TABLE public.peliculas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    titulo TEXT NOT NULL,
    sinopsis TEXT,
    duracion_minutos INT NOT NULL,
    imagen_url TEXT,
    clasificacion_edad TEXT DEFAULT 'ATP',
    generos TEXT[],
    activa BOOLEAN DEFAULT true,
    es_proximamente BOOLEAN DEFAULT false,
    fecha_estreno DATE,
    es_preventa BOOLEAN DEFAULT false,
    precio_preventa NUMERIC DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

CREATE TABLE public.salas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre TEXT NOT NULL,
    capacidad INT NOT NULL DEFAULT 544
);

CREATE TABLE public.funciones (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pelicula_id UUID REFERENCES public.peliculas(id) ON DELETE CASCADE,
    sala_id UUID REFERENCES public.salas(id) ON DELETE CASCADE,
    fecha_hora TIMESTAMP WITH TIME ZONE NOT NULL,
    horario_inicio TIMESTAMP WITH TIME ZONE,
    horario_fin TIMESTAMP WITH TIME ZONE,
    formato TEXT DEFAULT '2D',
    idioma TEXT DEFAULT 'Subtitulada',
    precio_base NUMERIC DEFAULT 4500,
    estado TEXT DEFAULT 'programada'
);
```

---

## 4. Procedimientos Almacenados y Transacciones Atómicas (RPC)

### 4.1 Registro Atómico de Ventas (`registrar_venta_atomica`)
Garantiza que ninguna butaca sea vendida en colisión concurrente, deduce saldo a favor, suma puntos contables y consume canjes en un único bloque atómico:

```sql
CREATE OR REPLACE FUNCTION public.registrar_venta_atomica(
    p_venta_id UUID,
    p_user_id UUID,
    p_funcion_id UUID,
    p_monto_total NUMERIC,
    p_descuento_aplicado NUMERIC,
    p_detalle_butacas JSONB,
    p_detalle_candy JSONB,
    p_codigo_qr TEXT,
    p_credito_usado NUMERIC,
    p_canje_id UUID,
    p_motivo_puntos TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_asiento JSONB;
    v_ocupado BOOLEAN;
BEGIN
    FOR v_asiento IN SELECT * FROM jsonb_array_elements(p_detalle_butacas)
    LOOP
        SELECT EXISTS (
            SELECT 1 FROM public.ventas v
            WHERE v.funcion_id = p_funcion_id
              AND v.estado_qr != 'cancelado'
              AND v.detalle_butacas @> jsonb_build_array(v_asiento)
        ) INTO v_ocupado;

        IF v_ocupado THEN
            RAISE EXCEPTION 'Una o más butacas acaban de ser reservadas por otro comprador.';
        END IF;
    END LOOP;

    INSERT INTO public.ventas (
        id, user_id, funcion_id, monto_total, descuento_aplicado,
        detalle_butacas, detalle_candy, codigo_qr, estado_qr
    ) VALUES (
        p_venta_id, p_user_id, p_funcion_id, p_monto_total, p_descuento_aplicado,
        p_detalle_butacas, p_detalle_candy, p_codigo_qr, 'valido'
    );

    IF p_credito_usado > 0 AND p_user_id IS NOT NULL THEN
        UPDATE public.perfiles
        SET credito_saldo = GREATEST(0, credito_saldo - p_credito_usado)
        WHERE id = p_user_id;
    END IF;

    IF p_monto_total > 0 AND p_user_id IS NOT NULL THEN
        UPDATE public.perfiles
        SET puntos_fidelidad = puntos_fidelidad + FLOOR(p_monto_total)::INT
        WHERE id = p_user_id;

        INSERT INTO public.movimientos_puntos (usuario_id, cantidad, motivo)
        VALUES (p_user_id, FLOOR(p_monto_total)::INT, p_motivo_puntos);
    END IF;

    IF p_canje_id IS NOT NULL THEN
        UPDATE public.canjes_recompensas
        SET estado = 'utilizado'
        WHERE id = p_canje_id;
    END IF;

    RETURN jsonb_build_object('success', true, 'venta_id', p_venta_id);
END;
$$;
```

### 4.2 Cancelación Atómica de Función Completa (`cancelar_funcion_atomica`)
Suspende una función completa ante fallas operativas de sala, acreditando el 100% a cada comprador, revirtiendo puntos y emitiendo notificaciones en una sola transacción:

```sql
CREATE OR REPLACE FUNCTION public.cancelar_funcion_atomica(
    p_funcion_id UUID,
    p_motivo TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_venta RECORD;
    v_ventas_afectadas INT := 0;
    v_total_reembolsado NUMERIC := 0;
    v_titulo_pelicula TEXT;
BEGIN
    SELECT p.titulo INTO v_titulo_pelicula
    FROM public.funciones f
    JOIN public.peliculas p ON p.id = f.pelicula_id
    WHERE f.id = p_funcion_id;

    -- 1. Marcar la función como cancelada
    UPDATE public.funciones
    SET estado = 'cancelada'
    WHERE id = p_funcion_id;

    -- 2. Procesar cada venta activa de la función
    FOR v_venta IN 
        SELECT id, user_id, monto_total
        FROM public.ventas
        WHERE funcion_id = p_funcion_id AND estado_qr != 'cancelado'
    LOOP
        UPDATE public.ventas
        SET estado_qr = 'cancelado'
        WHERE id = v_venta.id;

        IF v_venta.user_id IS NOT NULL THEN
            UPDATE public.perfiles
            SET credito_saldo = credito_saldo + v_venta.monto_total,
                puntos_fidelidad = GREATEST(0, puntos_fidelidad - FLOOR(v_venta.monto_total)::INT)
            WHERE id = v_venta.user_id;

            INSERT INTO public.movimientos_puntos (usuario_id, cantidad, motivo)
            VALUES (v_venta.user_id, -FLOOR(v_venta.monto_total)::INT, 
                    'Reversión por suspensión de función: ' || COALESCE(v_titulo_pelicula, 'Cine'));

            INSERT INTO public.notificaciones (usuario_id, titulo, mensaje, tipo)
            VALUES (
                v_venta.user_id,
                '⚠️ Función Suspendida: Reembolso Acreditado',
                'La función de "' || COALESCE(v_titulo_pelicula, 'Película') || '" fue cancelada por: ' || p_motivo || 
                '. Se te acreditaron $' || v_venta.monto_total || ' como crédito en tu cuenta. Podés reubicarte en otra función.',
                'cancelacion_funcion'
            );
        END IF;

        v_ventas_afectadas := v_ventas_afectadas + 1;
        v_total_reembolsado := v_total_reembolsado + v_venta.monto_total;
    END LOOP;

    RETURN jsonb_build_object(
        'success', true,
        'ventas_canceladas', v_ventas_afectadas,
        'total_reembolsado', v_total_reembolsado
    );
END;
$$;
```

---

## 5. Arquitectura de Sincronización en Tiempo Real (WebSockets)

El frontend orquesta 4 canales de comunicación bidireccional en paralelo:

1. **`sala-presence-${funcionId}`:** Canal de Presencia temporal donde cada cliente reporta las butacas que está inspeccionando para renderizarlas con aura pulsante naranja en los demás navegadores.
2. **`ventas-funcion-${funcionId}`:** Canal Postgres Changes para escuchar inserciones de ventas o cancelaciones. Si una venta muta a `cancelado`, los asientos se liberan automáticamente en el mapa.
3. **`lista-espera-${funcionId}`:** Canal de sincronización de cola virtual. Despacha la ventana de 15 minutos en tiempo real al usuario que alcanza la posición `#1`.
4. **`notificaciones-user-${userId}`:** Escucha permanente en el componente raíz `App` para desplegar alertas de emergencia cuando se suspende una función o se aprueba una propuesta de película.

---

## 6. Seguridad, Control de Acceso RBAC y Guards

### 6.1 Route Guards Funcionales (`src/app/guards/auth.guard.ts`)
```typescript
export const adminGuard: CanActivateFn = async (route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);
  const perfil = await authService.getPerfilActual();

  if (perfil && perfil.activo !== false && authService.tienePermisoAdmin(perfil)) {
    return true;
  }
  return router.createUrlTree(['/login-staff']);
};

export const staffGuard: CanActivateFn = async (route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);
  const perfil = await authService.getPerfilActual();

  if (perfil && perfil.activo !== false && (perfil.rol === 'empleado' || authService.tienePermisoAdmin(perfil))) {
    return true;
  }
  return router.createUrlTree(['/login-staff']);
};
```

### 6.2 Control de Secciones Dinámicas en `AdminDashboardComponent`
Los tabs habilitados se determinan reactivamente evaluando los permisos del rol asignado:
```typescript
puedeVerPestana(idPestana: string): boolean {
  if (this.esGerenteGeneral()) return true;
  const permisos = this.usuarioStaff()?.roles_admin?.permisos || [];
  return permisos.includes(idPestana);
}
```

---

## 7. Algoritmos Clave del Negocio

### 7.1 Solapamiento y Margen Sanitario (30 min)
$$\text{FinConLimpieza} = \text{Inicio} + (\text{Duración Minutos} + 30)\text{ min}$$
$$\text{Colisión} = (\text{Inicio}_{\text{nueva}} < \text{FinLimpieza}_{F_e}) \land (\text{FinLimpieza}_{\text{nueva}} > \text{Inicio}_{F_e})$$

### 7.2 Cálculo Riguroso de Edad
```typescript
calcularEdad(fechaNacimientoStr: string | Date): number {
  if (!fechaNacimientoStr) return 0;
  const hoy = new Date();
  const fechaNac = new Date(fechaNacimientoStr);
  let edad = hoy.getFullYear() - fechaNac.getFullYear();
  const diffMes = hoy.getMonth() - fechaNac.getMonth();
  if (diffMes < 0 || (diffMes === 0 && hoy.getDate() < fechaNac.getDate())) {
    edad--;
  }
  return edad;
}
```

---

## 8. Configuración, Entornos y Despliegue

### Compilación de Producción:
```bash
npx ng build --configuration production
```
Los artefactos estáticos generados se ubican en `dist/cine-utn/browser`.

### Configuración Recomendada de Hosting (Firebase Hosting):
```json
{
  "hosting": {
    "public": "dist/cine-utn/browser",
    "ignore": ["firebase.json", "**/.*", "**/node_modules/**"],
    "rewrites": [
      {
        "source": "**",
        "destination": "/index.html"
      }
    ]
  }
}
```
