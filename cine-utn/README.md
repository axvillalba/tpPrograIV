# Cine UTN · TP Programación IV

Aplicación web integral para la gestión y reserva de entradas de cine: cartelera interactiva, selección de asientos, compra de tickets, validación de ingresos/candy bar por código QR para personal y gestión de perfiles con reseñas comunitarias.

Desarrollada con **Angular 18/19** (Standalone Components, Signals) y **Supabase** (PostgreSQL, Auth, RLS y RPC).

| | |
|---|---|
| **Proyecto** | Cine UTN |
| **Tecnologías** | Angular + Supabase + Bootstrap/Tailwind |
| **Estado actual** | Core funcional, Perfil, Validador QR Staff y Reseñas Relacionales listas |

---

## 📚 Documentación del Proyecto

| Documento | Qué contiene |
|---|---|
| [FUNCIONAL.md](FUNCIONAL.md) | Reglas de negocio, roles de usuario (Cliente, Empleado, Admin), flujos de compra, validación QR y sistema de reseñas. |
| [TECNICO.md](TECNICO.md) | Arquitectura, modelo de datos DDL, configuración de Supabase, componentes Standalone, Signals y mapa de rutas. |

---

## 🍿 Características Principales

- **Cartelera Principal & Top 3**: Destacado de las películas más vendidas, buscador interactivo y filtrado por género.
- **Detalle de Película & Horarios**: Sinopsis, restricción de edad, duración, promedio de calificación y grilla de funciones agrupadas por formato (`2D`, `3D`) e idioma (`Castellano`, `Subtitulada`).
- **Reserva & Compra**: Selección de funciones con automatización de horarios y margen de limpieza obligatorio de 30 minutos entre funciones.
- **Validaciones QR (Staff/Candy Bar)**: Pantalla exclusiva `/empleado/validador` con actualización de estado en tiempo real (`usado_cine`, `usado_candy`, `usado_total`).
- **Mi Perfil & Historial**: Consulta de ventas realizadas, historial de entradas compradas y módulo para calificar/reseñar películas vistas.
- **Reseñas Relacionales**: Integración dinámica relacional entre `resenas` y `perfiles` mediante `usuario_id` en PostgreSQL.

---

## 🛠️ Stack Tecnológico

| Capa | Tecnología |
|---|---|
| Frontend | Angular (Standalone Components, Signals, Reactive & Template Forms) |
| Backend & DB | Supabase (PostgreSQL, Client Auth, Row Level Security) |
| Estilos | Bootstrap 5 / Tailwind CSS + Icons |
| Control de Versiones | Git & GitHub (`laComarca`) |

---

## ⚡ Arranque Rápido

```bash
# 1. Instalar dependencias
npm install

# 2. Iniciar servidor de desarrollo
npm start