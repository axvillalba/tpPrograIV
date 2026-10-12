# Cine UTN · Documento Funcional

Detalle funcional de la aplicación **Cine UTN**: roles, requerimientos de negocio, flujos de usuario y estado de avance.

---

## 1. Visión General
Cine UTN permite a los usuarios consultar la cartelera del cine, ver el detalle de las películas con sus reseñas comunitarias, seleccionar funciones disponibles, realizar compras de entradas/candy bar y acceder a su perfil personal. 

Por otro lado, el personal del cine (empleados y administradores) cuenta con herramientas para validar el acceso en sala y la entrega de combos de Candy Bar mediante escaneo/validación de códigos QR.

---

## 2. Roles de Usuario

| Rol | Descripción | Permisos y Accesos |
|---|---|---|
| **Invitado / Visitante** | Usuario no autenticado | Navegar por la cartelera, ver detalles de películas, horarios y reseñas comunitarias. |
| **Cliente Registrado** | Usuario con cuenta autenticada | Todo lo anterior, más acceso a `/perfil`, historial de compras, generación de entradas y capacidad de publicar reseñas sobre películas compradas. |
| **Empleado** | Personal de puerta y Candy Bar | Acceso al validador QR (`/empleado/validador`) para registrar ingreso a salas y entrega de productos. |
| **Administrador** | Personal administrativo | Gestión integral de la programación (películas, salas, funciones), roles y reportes. |

---

## 3. Flujos de Pantallas

1. **Cartelera (`/cartelera`)**:
   - Muestra el Top 3 de películas más vendidas.
   - Listado completo con buscador en tiempo real y filtro por géneros.
2. **Detalle de Película (`/peliculas/:id`)**:
   - Información técnica (sinopsis, clasificación, duración, géneros).
   - Promedio de estrellas de la comunidad y listado de reseñas con nombre del autor.
   - Selector de días y horarios agrupados por formato (`2D`/`3D`) e idioma (`Castellano`/`Subtitulada`).
3. **Perfil de Usuario (`/perfil`)**:
   - Datos personales y rol del usuario logueado.
   - Historial de compras registradas vinculadas por `user_id`.
   - Módulo interactivo "Calificar Películas Vistas" habilitado únicamente para películas adquiridas.
4. **Validador QR (`/empleado/validador`)**:
   - Búsqueda manual o escaneo de `codigo_qr`.
   - Control de estados: `valido`, `usado_cine`, `usado_candy`, `usado_total` o `cancelado`.
   - Botones para registrar ingreso a sala o entrega de Candy Bar.

---

## 4. Reglas de Negocio Implementadas

- **Limpieza de Salas**: Entre la hora de finalización de una función (`horario_fin`) y el inicio de la siguiente (`horario_inicio`) en la misma sala, se exige un buffer automático de **al menos 30 minutos**.
- **Integridad de Reseñas**: Las reseñas se asocian de forma relacional al `usuario_id` (FK a `perfiles`). Si el usuario actualiza sus datos en su perfil, la autoría de la reseña se refleja dinámicamente.
- **Validación Única de QR**: Un ticket QR no puede ser reutilizado para el ingreso a la sala o la entrega de Candy Bar más de una vez.
- **Formato e Idioma**: Se valida mediante restricciones `CHECK` en base de datos que el formato sea exclusivamente `2D`, `3D`, `4D` o `5D`, y el idioma `Castellano` o `Subtitulada`.
- **Restricción de Calificación**: Las calificaciones de reseñas deben ser valores enteros estrictos del `1` al `5`.