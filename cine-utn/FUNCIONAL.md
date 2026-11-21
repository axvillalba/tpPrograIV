# 🎬 Cine UTN · Documento Funcional

Este documento especifica qué hace la aplicación **Cine UTN**, a qué usuarios está dirigida, cuáles son sus flujos de trabajo principales y las reglas de negocio estrictas que rigen la operación.

---

## 📋 Índice

1. [Visión General del Sistema](#1-visión-general-del-sistema)
2. [Matriz de Roles y Permisos](#2-matriz-de-roles-y-permisos)
3. [Pantallas y Módulos Principales](#3-pantallas-y-módulos-principales)
4. [Flujos Operativos clave](#4-flujos-operativos-clave)
5. [Reglas de Negocio Estrictas (Hard-Rules)](#5-reglas-de-negocio-estrictas-hard-rules)
6. [Programa de Fidelización y Beneficios](#6-programa-de-fidelización-y-beneficios)
7. [Métricas, Reportes y Auditoría](#7-métricas-reportes-y-auditoría)

---

## 1. Visión General del Sistema

**Cine UTN** es una plataforma web integral para la gestión completa de un complejo de cines. Ofrece al cliente final una experiencia moderna de consulta de cartelera, venta de entradas con selector de butacas interactivo en vivo, compra de combos en Candy Bar, sistema de fidelización y gestión de perfil con historial visual.

Paralelamente, dota a la empresa de herramientas de gestión administrativa en tiempo real (Panel de Gerencia) y operativas de campo (Validador QR de entradas y combos en puerta).

---

## 2. Matriz de Roles y Permisos

| Rol | Quién es | Funcionalidades y Alcance |
|---|---|---|
| **Visitante** | Usuario no autenticado | Consultar cartelera principal, próximos estrenos, top 3 más vendidas, fichas de películas, horarios y reseñas de otros usuarios. |
| **Cliente** | Usuario registrado | Comprar entradas (con control de edad), seleccionar butacas en vivo, adquirir Candy Bar, aplicar cupones, activar alertas de estreno, cancelar reservas con reembolso a crédito a favor, acumular y canjear puntos de fidelidad, publicar reseñas de películas vistas. |
| **Staff / Empleado** | Personal de control en cine | Acceso exclusivo al **Validador QR** (`/empleado/validador`) para registrar la admisión a sala (`usado_cine`) y la entrega de productos en el Candy Bar (`usado_candy`). |
| **Administrador / Gerente** | Gerencia del complejo | Acceso total al **Panel de Gerencia** (`/admin/dashboard`): gestión del catálogo de películas, programación recurrente de funciones con validación de limpieza, ABM de Candy Bar, emisión de cupones, catálogo de recompensas, métricas financieras, exportación a CSV/Excel y logs de auditoría. |

---

## 3. Pantallas y Módulos Principales

### 🍿 3.1 Cartelera & Próximamente
- **En Cartelera:** Listado interactivo filtrable por texto (título/sinopsis) y por género.
- **Top 3 Más Vendidas:** Sección destacada que calcula dinámicamente el ranking de películas según la cantidad real de entradas vendidas.
- **Próximamente / Estrenos:** Pestaña con películas futuras donde el usuario registrado puede activar un recordatorio/alerta (`🔔 Avisarme cuando estrene`).
- **Preventas Promocionales:** Identificación visual de películas en preventa con precio promocional destacado.

### 🪑 3.2 Selección de Entradas & Butacas en Tiempo Real
- **Mapa de Sala Traducido:**
  - **Butacas Estándar:** Tarifa base (\$4500).
  - **Butacas Accesibles / Discapacidad (Filas J/K):** Distribución adaptada `2 - 10 - 2` resaltadas en celeste (`♿`).
  - **Zona VIP (Filas R, S, T):** Asientos confort con recargo del +35% sobre la tarifa base.
- **Sincronización Realtime:** Escucha viva a Supabase. Si otro cliente reserva un asiento en simultáneo, la butaca pasa automáticamente a estado ocupado en pantalla.

### 💳 3.3 Checkout, Cupones y Crédito
- **Resumen Comercial:** Selección de Candy Bar y desglose de montos.
- **Validación de Cupones:** Verificación de restricciones (porcentaje de descuento, exclusivo mayores de 50 años, primera compra).
- **Aplicación de Crédito en Cuenta:** Opción para saldar parte o el total de la compra mediante el `credito_saldo` acumulado por cancelaciones previas.

### 👤 3.4 Perfil del Cliente ("Mis Películas")
- **Mis Películas Vistas:** Galería gráfica de pósters de las películas disfrutadas en el cine con su estado de calificación.
- **Crédito a Favor:** Visualizador del saldo disponible para futuras compras.
- **Gestión de Cancelación:** Botón para cancelar reservas con al menos 2 horas de anticipación.
- **Puntos y Canje:** Historial de movimientos de puntos y catálogo para canjear entradas o combos gratis.
- **Publicación de Reseñas:** Formulario de calificación (1 a 5 estrellas + comentario) habilitado únicamente para películas con compra verificada.

### 🛡️ 3.5 Panel de Gerencia (Administración)
Organizado por pestañas virtuales:
1. **Películas:** ABM con subida de afiches a Storage, toggle de "Próximamente" (con fecha de estreno) y "Preventa" (con precio promocional).
2. **Candy Bar:** ABM de comestibles y combos con subida de fotos.
3. **Cupones:** Emisión y control de códigos promocionales con reglas de uso.
4. **Funciones & Salas:** Programación masiva puntual o recurrente por días de la semana con verificación estricta de vacantes de sala.
5. **Fidelización:** Administración de premios y requerimiento de puntos.
6. **Reportes & Logs:** Indicadores KPI, exportación a Excel/CSV y auditoría de eventos.

---

## 4. Flujos Operativos clave

### 4.1 Flujo de Compra y Control de Edad
```
[Cliente selecciona Película] 
       │
       ├─── ¿Es Clasificación +18? ───> NO ───> [Navega a Selección de Función]
       │                                 ▲
       YES                               │
       │                                 │
       ▼                                 │
[Consulta Perfil] ──> ¿Es Mayor de Edad? ┘
       │
       NO ──> ⛔ [Bloquea Selección y Muestra Alerta de Restricción]
```

### 4.2 Flujo de Cancelación y Crédito
```
[Cliente solicita Cancelación desde /perfil]
       │
       ├─── ¿Faltan más de 2 Horas para la Función?
       │        │
       │        ├──> NO  ──> ⛔ [Operación Denegada por Restricción de Plazo]
       │        │
       │        └──> SÍ  ──> 1. Marca venta estado_qr = 'cancelado'
       │                     2. Acredita monto_total a perfiles.credito_saldo
       │                     3. Notifica al usuario
```

### 4.3 Flujo de Validación QR en Puerta (Empleado)
```
[Empleado escanea QR] ──> [Sistema consulta Venta]
                                   │
      ┌────────────────────────────┼────────────────────────────┐
      ▼                            ▼                            ▼
[Ingreso a Sala]           [Retiro en Candy]            [Ambos Concretados]
  `usado_cine`               `usado_candy`                 `usado_total`
```

---

## 5. Reglas de Negocio Estrictas (Hard-Rules)

1. **Restricción de Edad (+18):** El sistema exige inicio de sesión y verifica la fecha de nacimiento del usuario. Si tiene menos de 18 años, el sistema bloquea el ingreso a la selección de funciones para películas con clasificación `+18`.
2. **Tiempo de Limpieza e Incompatibilidad de Horarios:** Al programar una función en una sala, el sistema exige un bloque libre obligatorio de **30 minutos de limpieza** entre la finalización de una función (duración película + 30 min) y el inicio de la siguiente. Si se detecta un solapamiento, la función no se crea.
3. **Plazo Límite de Cancelación:** La reserva solo puede cancelarse si faltan **2 horas o más** para el horario de proyección. El reembolso es siempre al 100% en saldo a favor (`credito_saldo`), nunca en efectivo ni reintegro bancario.
4. **Reseñas Verificadas:** Solo pueden opinar aquellos usuarios que tengan en la base de datos una compra finalizada vinculada a la película. Un usuario solo puede dejar una reseña por película.
5. **Topes Comerciales:**
   - Descuentos de cupones: entre 1% y 100%.
   - Precios de Candy: mayores a \$0 y menores a \$999.999.
   - Puntos de Fidelización: Acumulación automática basada en compras anteriores.

---

## 6. Programa de Fidelización y Beneficios

- **Acumulación:** Cada compra confirmada genera un registro positivo en `movimientos_puntos`.
- **Canje:** El usuario puede intercambiar su saldo acumulado por premios activos en la tabla `recompensas`.
- **Aplicación:** Al efectuar un canje exitoso, el beneficio se registra en el almacenamiento local para aplicarse con descuento total en el siguiente Checkout.

---

## 7. Métricas, Reportes y Auditoría

- **Métricas Financieras (KPIs):** Recaudación total acumulada, total de entradas vendidas, combos de Candy Bar expendidos y porcentaje estimado de ocupación de salas.
- **Exportación de Datos:** Descarga directa de las transacciones registradas en formato `.csv` estandarizado para análisis en Microsoft Excel.
- **Log de Auditoría (Audit Log):** Registro inmutable en `logs_auditoria` que documenta fecha, hora, correo electrónico y detalle técnico de cada acción administrativa (programación de funciones, modificaciones de catálogo, exportaciones de datos y cancelaciones).