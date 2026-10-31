# Cine UTN · Documento funcional

Qué hace la aplicación **Cine UTN**, para quién y con qué reglas de negocio.
La parte técnica (instalación, arquitectura y modelo DDL) está detallada en `TECNICO.md`.

## Índice

1. [Qué es Cine UTN](#1-qué-es-cine-utn)
2. [Roles y Permisos](#2-roles-y-permisos)
3. [Pantallas y Flujos Principales](#3-pantallas-y-flujos-principales)
4. [Flujo de Compra y Validación](#4-flujo-de-compra-y-validación)
5. [Reglas de Negocio Estrictas](#5-reglas-de-negocio-estrictas)
6. [Próximos Hitos (Fidelización)](#6-próximos-hitos-fidelización)

---

## 1. Qué es Cine UTN

Una plataforma web integral para la gestión completa de un complejo de cines. Permite al cliente final consultar la cartelera, comprar entradas y productos del Candy Bar, y administrar su perfil. Paralelamente, provee a la empresa herramientas de gestión administrativa (Panel de Gerencia) y operativas (Validador QR en puerta).

## 2. Roles y Permisos

| Rol | Quién es | Qué puede hacer |
|---|---|---|
| **Visitante** | Usuario anónimo | Ver cartelera, top de películas, detalle, horarios y reseñas. |
| **Cliente** | Usuario registrado | Comprar entradas, adquirir productos de Candy Bar, aplicar cupones, acceder a `/perfil`, ver historial y publicar reseñas. |
| **Empleado** | Staff operativo | Acceso exclusivo al **Validador QR** (`/empleado/validador`) para registrar el ingreso a sala y la entrega física de combos en el Candy Bar. |
| **Administrador** | Gerencia | Acceso al **Panel de Gerencia** (`/admin/dashboard`). Control total sobre el catálogo de películas, programación automática de funciones, catálogo de Candy Bar y creación de Cupones de descuento. |

## 3. Pantallas y Flujos Principales

*   **Cartelera:** Visualización destacada y listado filtrable.
*   **Detalle de Película:** Ficha técnica, selector de funciones agrupadas por formato y reseñas relacionales.
*   **Checkout:** Selección de butacas, agregado de Candy Bar y procesamiento de pago con generación de comprobante PDF y código QR.
*   **Panel de Gerencia (ABM):** Interfaz modular con pestañas para gestionar Películas, Candy Bar, Cupones y Funciones. Incluye subida de afiches e imágenes a la nube.

## 4. Flujo de Compra y Validación

1.  El cliente selecciona película, horario, butacas y opcionalmente productos de Candy Bar.
2.  Al abonar, el sistema genera una venta con un `codigo_qr` único.
3.  En el cine, el **Empleado** escanea el QR. El sistema posee un estado doble de validación:
    *   `usado_cine`: Si el cliente entra a la sala.
    *   `usado_candy`: Si el cliente retira su comida.
    *   `usado_total`: Si ambas acciones fueron concretadas.

## 5. Reglas de Negocio Estrictas

*   **Tiempo de Limpieza (Hard-Rule):** El sistema administrativo **bloquea** la programación de una función si no existe un margen libre y obligatorio de **al menos 30 minutos** entre el final de una película y el inicio de la siguiente en la misma sala.
*   **Incompatibilidad Temporal:** Validación matemática que impide el solapamiento de horarios en la misma sala.
*   **Límites Comerciales:** Los cupones de descuento tienen un tope lógico (1% a 100%). Los productos del Candy Bar no admiten precios negativos ni superiores a seis cifras ($999.999).
*   **Reseñas Verificadas:** Un usuario solo puede reseñar una película si tiene una compra registrada de la misma. Al cambiar su nombre en el perfil, la reseña se actualiza automáticamente (sistema relacional).

## 6. Próximos Hitos (Fidelización)
En desarrollo actual para cumplir con los requerimientos de inversores:
*   Sistema de acumulación de puntos (1 punto = $1).
*   Catálogo de recompensas canjeables configurables por gerencia.
*   Dashboard financiero y de ventas.