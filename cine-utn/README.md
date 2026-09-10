# 🎬 Cine UTN - Documentación del Proyecto y Estado de Avance

**Cine UTN** es una plataforma web moderna para la reserva de entradas de cine y productos de Candy Bar, desarrollada con **Angular (Standalone Components)** en el front-end y **Supabase** como backend serverless y base de datos relacional PostgreSQL.

---

## 📌 Tabla de Estado de Funcionalidades

| Módulo / Funcionalidad | Descripción de la Implementación | Estado |
| :--- | :--- | :---: |
| **Cartelera y Buscador** | Búsqueda en tiempo real por título/sinopsis y filtrado dinámico por género de películas. | ✅ Implementado |
| **Afiches Oficiales** | Carga de posters cinematográficos oficiales con URLs directas de alta resolución sin bloqueos de hotlinking/CORS. | ✅ Implementado |
| **Top 3 Películas Más Vendidas** | Sección superior destacada en cartelera que agrupa y calcula dinámicamente las películas con más tickets vendidos desde la tabla `ventas` de Supabase. | ✅ Implementado |
| **Sistema de Reseñas y Puntuación** | Permite a los usuarios dejar calificaciones (1 a 5 estrellas) y comentarios cortos. Muestra la puntuación promedio general y el conteo de opiniones por película antes de comprar. Incluye feedback visual al publicar. | ✅ Implementado |
| **Validación de Clasificación por Edad** | Control de edad leyendo el perfil del usuario. Bloqueo para películas +18 a menores y alertas preventivas para cintas +13. | ✅ Implementado |
| **Selección Interactiva de Butacas** | Modelo de filas y bloques con precios diferenciales (Estándar, Adaptada Discapacidad, VIP) y detección en tiempo real de asientos ocupados por función. | ✅ Implementado |
| **Candy Bar Integrado** | Menú de productos categorizados (Pochoclos, Bebidas, Combos, Snacks, Golosinas) seleccionables e integrados en el mismo flujo de compra. | ✅ Implementado |
| **Cupones de Descuento Dinámicos** | Validación contra la tabla `cupones` en Supabase. Soporta porcentaje configurable, descuento automático en 1ra compra y restricción exclusiva para usuarios mayores de 50 años. | ✅ Implementado |
| **Checkout y Comprobante con QR** | Procesamiento de ventas, generación de código QR único para entradas y snack bar, opción de descarga de Ticket en PDF e impresión directa. | ✅ Implementado |
| **Mapa Interactivo de Salas del Cine** | Pantalla o vista modal con la distribución geográfica completa del establecimiento indicando la ubicación física exacta de la sala asignada a la función. | ⏳ Pendiente (Sin luz verde del directorio) |

---

## 🛠️ Arquitectura Técnica y Stack de Tecnologías

* **Frontend:** Angular (v17+ Standalone Components, Signals, Computed properties, RxJS).
* **Estilos & UI:** Bootstrap 5 + Bootstrap Icons.
* **Backend / Database:** Supabase (PostgreSQL, Auth, Realtime queries).
* **Librerías Adicionales:** `qrcode` (para generación de códigos QR de reserva) y `html2pdf.js` (para exportación de comprobantes a PDF).

---

## 🗄️ Esquema de Base de Datos (Supabase)

La aplicación utiliza las siguientes tablas principales en Supabase:

* `peliculas`: Información de títulos, sinopsis, géneros, duración, clasificación y URLs de afiches.
* `funciones`: Días, horarios, idioma, formato y relación con salas de proyección.
* `ventas`: Registro histórico de compras con UUID, usuario, detalle de butacas seleccionadas, detalle de productos de Candy Bar, descuento aplicado y código QR.
* `resenas`: Comentarios y valoraciones numéricas (1 a 5) dejadas por los usuarios para cada película.
* `productos_candy`: Catálogo de consumibles categorizados con precios e imágenes.
* `cupones`: Códigos de descuento con porcentajes variables, vigencia, flag de 1ra compra y restricción para mayores de 50 años.

---

## ⚙️ Instrucciones de Configuración e Instalación

1. Clonar el repositorio.
2. Ejecutar `npm install` para instalar las dependencias.
3. Configurar las credenciales de la API de Supabase en `src/environments/environment.ts`.
4. Ejecutar los scripts SQL proporcionados para crear y poblar las tablas en el panel de Supabase.
5. Iniciar el servidor de desarrollo con `ng serve` o `npm start` e ingresar a `http://localhost:4200`.

---

## 📝 Próximos Pasos

Mantenerse a la espera de la confirmación directiva respecto al módulo de la vista del mapa del cine para proceder con la maquetación y asignación de ubicaciones de salas.