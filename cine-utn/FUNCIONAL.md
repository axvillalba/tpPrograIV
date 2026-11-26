# 🎬 Cine UTN · Documento de Especificación Funcional

Este documento describe la totalidad de los requerimientos, reglas de negocio, matrices de permisos y flujos operativos que conforman el sistema **Cine UTN**, integrando tanto las especificaciones fundacionales de la cátedra de **Programación IV** como las sucesivas ampliaciones y escalados solicitados por la gerencia (*"Empresario Importante"*).

---

## 📋 Índice General

1. [Visión General del Producto](#1-visión-general-del-producto)
2. [Matriz de Roles y Permisos Granulares (RBAC)](#2-matriz-de-roles-y-permisos-granulares-rbac)
3. [Trazabilidad de Requerimientos y Correos del Cliente](#3-trazabilidad-de-requerimientos-y-correos-del-cliente)
4. [Módulos del Sistema y Experiencia de Usuario](#4-módulos-del-sistema-y-experiencia-de-usuario)
5. [Nuevos Módulos de Escalabilidad](#5-nuevos-módulos-de-escalabilidad)
6. [Reglas de Negocio Estrictas (Hard-Rules)](#6-reglas-de-negocio-estrictas-hard-rules)
7. [Flujos Operativos Clave (Diagramas de Proceso)](#7-flujos-operativos-clave-diagramas-de-proceso)
8. [Métricas Financieras, Reportes y Auditoría](#8-métricas-financieras-reportes-y-auditoría)

---

## 1. Visión General del Producto

**Cine UTN** es una plataforma web integral orientada al sector cinematográfico que unifica en una sola solución:
* La atención al cliente (cartelera dinámica, selector interactivo de butacas con presencia en vivo, preventas, Candy Bar, sugerencias de películas, lista de espera inteligente y programa de fidelización).
* El control operativo de acceso mediante escaneo y validación de códigos QR para salas y confitería.
* La administración estratégica del negocio (programación masiva de funciones con márgenes de desinfección, emisión de cupones, analítica financiera, cancelación atómica de funciones y gestión de roles granulares).

---

## 2. Matriz de Roles y Permisos Granulares (RBAC)

El sistema soporta tanto roles tradicionales como un esquema moderno de **Control de Acceso Basado en Roles (RBAC)** configurable dinámicamente desde el panel administrativo:

| Rol Base | Alcance y Definición | Secciones y Capacidades |
|---|---|---|
| **Visitante Anónimo** | Usuario público sin cuenta | Cartelera, próximos estrenos, top 3, ficha técnica, tráilers, reseñas y compra anónima de entradas y combos. |
| **Cliente Registrado** | Espectador autenticado en la plataforma | Cupón de bienvenida (20%), acumulación y canje de puntos, saldo a favor (`credito_saldo`), alertas de estreno, **postulación de sugerencias de películas**, **inscripción a listas de espera (turno de 15 min)** y publicación de reseñas verificadas. |
| **Empleado / Staff** | Personal de admisión y confitería | Acceso al portal `/empleado/validador`. Escanea o tipea códigos QR, valida ingresos a sala (`usado_cine`), entrega comestibles (`usado_candy`) e inhabilita entradas consumidas (`usado_total`). |
| **Empleado con Rol Configurable** | Personal con permisos acotados | Acceso a `/admin/dashboard` restringido únicamente a las pestañas asignadas en su perfil (ej: solo *Reportes* o solo *Películas y Sugerencias*). |
| **Gerente / Administrador Total** | Dirección general del complejo | Acceso irrestricto a todas las áreas del `/admin/dashboard`, gestión del catálogo, aprobación/rechazo de sugerencias, creación de roles, **cancelación atómica de funciones por contingencias técnicas** y auditoría. |

---

## 3. Trazabilidad de Requerimientos y Correos del Cliente

### ✉️ Emails 1 al 9 — Núcleo Operativo del Cine
* **Email 1 (Edificio Único y Geometría de Salas):** 20 filas (`A` a `T`), 3 columnas (4-20-4), 30 min obligatorios de limpieza entre funciones, registro con ficha médica/personal (tipo de sangre, color de ojos, días de vacaciones), cupón del 20% y compra anónima.
* **Email 2 y 3 (Reseñas y Cartelera):** Reseñas con estrellas (1 a 5) y comentario antes de comprar, promedio ponderado, top 3 películas más taquilleras y buscador con filtrado simultáneo por múltiples géneros.
* **Email 4 (Cupones y Candy Bar):** Descuento de primera compra configurable, cupones segmentados para mayores de 50 años, catálogo de Candy Bar con retiro bajo el mismo código QR.
* **Email 5 (Personal y Programación):** Validador QR con entrada manual para contingencias de lectura, invalidación automática tras el uso y asignación horaria sin colisiones de sala.
* **Email 6 (Accesibilidad y Tiempo Real):** Fila adaptada para personas con discapacidad (`♿` Filas J/K con distribución `2 - 10 - 2`), restricción para menores en filmes `+18` con leyenda obligatoria (*"Los menores de edad deben ingresar acompañados por un adulto"*) y butacas en tiempo real vía WebSockets.
* **Email 7 (Usabilidad y Puntos):** Selectores ergonómicos de fecha y horario, reporte diario de facturación/entradas y programa de fidelización (\$1 = 1 punto) con catálogo de canjes y saldos no transferibles.
* **Email 8 (Marketing y Preventas):** Combos especiales destacados en pasarela de compra, sección *Próximamente* con suscripción a alertas de estreno, preventa anticipada (7 días antes con precio promocional) y sección *Mis Películas* con historial visual.
* **Email 9 (Cancelaciones, Crédito y Filas VIP):** Cancelación de compras por parte del cliente hasta 2 horas antes (reembolso íntegro a `credito_saldo` para futuras compras), butacas VIP en las 3 últimas filas (`R`, `S`, `T` con +35%), exportación a Excel/CSV y auditoría de eventos.

---

## 4. Módulos del Sistema y Experiencia de Usuario

### 4.1 Cartelera & Próximamente
* Pestañas para alternar entre exhibición activa y próximos estrenos.
* Indicadores visuales de formato (`2D`, `3D`), clasificación (`ATP`, `+13`, `+16`, `+18`) y distintivos de `PREVENTA`.
* Buscador predictivo en tiempo real por texto y género.

### 4.2 Selector de Butacas con Presencia en Vivo
* Renderizado gráfico de la sala con perspectiva hacia la pantalla:
  * ⚪ Gris oscuro: Butaca Estándar.
  * 🟡 Dorado: Butaca VIP (Filas R, S, T con +35%).
  * 🔵 Celeste con icono `♿`: Butaca Adaptada (Filas J/K, 2-10-2).
  * 🔴 Rojo: Asiento vendido / no disponible.
  * 🟠 Naranja pulsante: Asiento seleccionado simultáneamente por otro usuario en vivo (Presence).
  * 🟢 Verde: Asientos elegidos por el usuario actual.

### 4.3 Checkout Inteligente y Medios de Pago Combinados
* Desglose detallado: Subtotal Entradas + Subtotal Candy - Cupones - Canjes - Saldo a Favor = Total a Pagar.
* Soporte para cancelación total con saldo (\$0) o pago combinado (crédito + tarjeta).
* Generación instantánea del comprobante en PDF con código QR vectorial de alta definición.

### 4.4 Panel de Perfil del Usuario
* **Mis Entradas Activas:** Visualización de tickets y opción de cancelación autónoma ($>2$ horas antes).
* **Crédito a Favor:** Saldo en pesos (\$ ARS) disponible para futuras transacciones.
* **Mis Películas Vistas:** Historial visual con pósters y formulario para calificar películas asistidas.
* **Fidelización y Canjes:** Extracto contable de puntos acumulados/utilizados y catálogo de premios.

---

## 5. Nuevos Módulos de Escalabilidad

A partir del nuevo requerimiento de la gerencia (*"Por el retraso del proyecto, agrego unos puntos más"*), se incorporaron 4 módulos avanzados de alta disponibilidad:

### 💡 5.1 Propuesta de Películas por Clientes
* **Perspectiva del Cliente:** Los usuarios registrados disponen de un módulo en la cartelera para sugerir títulos que no forman parte de la oferta actual. Pueden remitir una propuesta a la vez, detallando:
  * Título propuesto.
  * Descripción / Sinopsis.
  * Justificación / Explicación de por qué debería proyectarse en el cine.
* **Perspectiva de la Gerencia:** En la pestaña *Películas Sugeridas* del panel administrativo, los directores evalúan las solicitudes:
  * **Aceptar:** Al pulsar aceptar, el sistema actualiza la propuesta a `aprobada`, despacha una notificación push al cliente (*"🎬 ¡Tu sugerencia fue aceptada!"*) y redirige automáticamente al formulario de alta de películas precargando el título y la sinopsis como futuro estreno (*Próximamente*).
  * **Rechazar:** Cambia el estado a `rechazada` y registra la decisión en la bitácora de auditoría.

### 🛡️ 5.2 Sistema de Roles y Permisos Granulares (RBAC)
* **Problemática:** La gerencia requería descentralizar la administración sin otorgar privilegios totales sobre la plataforma.
* **Solución Implementada:**
  * Catálogo de roles administrativos dinámicos en la tabla `roles_admin`.
  * Selección granular de secciones habilitadas: `Películas`, `Candy Bar`, `Cupones`, `Funciones`, `Fidelización`, `Reportes`, `Películas Sugeridas`, `Roles y Empleados`.
  * Asignación directa del rol a cualquier usuario con perfil `empleado`.
  * La interfaz del panel adapta su menú lateral y bloquea el acceso a secciones no concedidas.

### ⏳ 5.3 Lista de Espera Inteligente para Funciones Agotadas
* **Inscripción en Cola:** Si una función agota la totalidad de sus butacas, los clientes registrados pueden anotarse con un clic en la **Lista de Espera**.
* **Visualización en Perfil:** En su perfil, el cliente consulta las listas de espera en las que participa y su **posición numérica exacta en la fila** (`#1`, `#2`, etc.).
* **Despacho Automático de Vacantes (Ventana de 15 Minutos):**
  * Cuando se produce una cancelación (por el cliente o por la administración), el sistema promueve de inmediato al usuario en la posición `#1`.
  * Se emite una alerta en tiempo real en su interfaz con un **reloj regresivo de 15:00 minutos**.
  * Durante ese lapso, dicho usuario tiene prioridad exclusiva para adquirir la butaca liberada. Si el tiempo expira sin concretar la compra, el turno pasa automáticamente al siguiente de la cola.
* **Control Gerencial:** En el panel de funciones, la administración visualiza la cantidad de clientes en espera por cada función programada.

### 🚨 5.4 Cancelación Atómica de Funciones por Parte del Cine
* **Problemática:** Ante contingencias operativas o fallas técnicas en una sala, la gerencia necesita suspender una función íntegra de forma segura e inmediata.
* **Garantía Transaccional Atómica:** Mediante el procedimiento `cancelar_funcion_atomica`:
  1. Se cancelan todas las entradas vinculadas a la función (`estado_qr = 'cancelado'`).
  2. Se libera la totalidad de las butacas de la sala.
  3. Se acredita de forma automática el 100% del dinero gastado (entradas y productos de Candy Bar) como `credito_saldo` en la cuenta de cada cliente afectado.
  4. Se revierten los puntos de fidelización concedidos por dichas compras.
  5. Se emite una notificación de emergencia a cada comprador informando el motivo técnico de la suspensión.
  6. **Reubicación Inmediata:** La alerta emergente ofrece un botón directo (*"Reubicarse / Ver Crédito"*) para que el usuario consulte otras funciones de la misma película y utilice su saldo a favor para reemitir su entrada sin costo adicional.
  7. **Principio ACID:** La transacción opera de forma atómica: o se procesa con éxito para todos los afectados o se aborta por completo, impidiendo estados inconsistentes o reembolsos a medias.

---

## 6. Reglas de Negocio Estrictas (Hard-Rules)

1. **Margen de Limpieza:** Bloque libre obligatorio de 30 minutos entre la finalización de una función y el inicio de la siguiente en la misma sala.
2. **Plazo de Cancelación del Cliente:** Límite estricto de 2 horas previas al inicio de la función para cancelaciones autónomas. Reembolso exclusivamente a saldo virtual (`credito_saldo`).
3. **Prioridad Temporal de Lista de Espera:** 15 minutos improrrogables para el cliente notificado. Vencido el plazo, la vacante se transfiere al sucesor inmediato.
4. **Unicidad de Propuestas:** Un cliente solo puede mantener una propuesta de película en estado `pendiente` a la vez.
5. **Caducidad QR:** Inhabilitación automática a `usado_total` tras verificarse tanto el acceso a sala como la entrega de confitería.
6. **Integridad de Reembolso Masivo:** La cancelación gerencial de función debe reintegrar el 100% del monto total (entradas + combos) sin excepciones.

---

## 7. Flujos Operativos Clave (Diagramas de Proceso)

### 7.1 Flujo de Lista de Espera y Notificación de Vacante
```
[Función Agotada (0 Butacas Libres)]
                 │
                 ▼
    [Cliente se anota en Lista de Espera] ──> [Visualiza su posición (#N) en /perfil]
                 │
  (Ocurre una cancelación en la función)
                 │
                 ▼
       ¿Es el #1 de la cola?
          ├── NO  ──> Avanza una posición en la fila (#N-1)
          └── SÍ  ──> 1. Notificación Push en pantalla
                      2. Inicia cuenta regresiva de 15 minutos
                      3. Prioridad de compra exclusiva
                             │
            ┌────────────────┴────────────────┐
            ▼                                 ▼
   [Compra dentro de 15 min]          [Expira el tiempo]
   - Butaca confirmada                - Turno pasa al siguiente cliente (#2)
   - Sale de la lista de espera       - Se libera la vacante
```

### 7.2 Flujo de Cancelación Atómica por Falla de Sala (Admin)
```
[Gerente detecta falla técnica en Sala]
                 │
                 ▼
[Acciona "Cancelar Función" e ingresa motivo]
                 │
                 ▼
    [Ejecuta RPC `cancelar_funcion_atomica`]
                 │
   ┌─────────────┴─────────────┐
   ▼                           ▼
[Reembolso Total]     [Despacho de Alertas]
- 100% a credito_saldo  - Notificación push a cada usuario
- Entradas + Candy      - Motivo de suspensión
- Revierte puntos       - Opción directa: "Reubicarse en otra función"
                 │
                 ▼
[Liberación total de la sala y registro en Auditoría]
```

---

## 8. Métricas Financieras, Reportes y Auditoría

* **KPIs Directivos:** Recaudación acumulada neta, total de tickets emitidos, combos vendidos y tasa de ocupación de salas.
* **Exportación CSV / Excel:** Reporte tabular con metadata completa de transacciones y estados de pago.
* **Auditoría Exhaustiva (`logs_auditoria`):** Trazabilidad de creaciones de películas, altas de cupones, modificaciones de precios, programaciones, cancelaciones atómicas de sala y validaciones de empleados.
