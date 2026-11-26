# 🎬 Cine UTN · Trabajo Práctico Programación IV

> Sistema integral de gestión cinematográfica y venta de entradas en línea, desarrollado como proyecto universitario para la cátedra de **Programación IV**. Implementado con arquitectura moderna orientada a componentes independientes y reactividad mediante **Angular 21 (Standalone Components, Signals)** y backend escalable con **Supabase (PostgreSQL, Auth, Realtime WebSockets, Storage y RPC)**.

---

## 📑 Navegación de la Documentación

Para una comprensión exhaustiva de la arquitectura, decisiones de diseño y reglas de negocio, se dispone de documentación especializada:

| Documento | Enfoque y Contenido |
|---|---|
| 📄 **[FUNCIONAL.md](FUNCIONAL.md)** | **Especificación Funcional y Reglas de Negocio:** Matriz de roles (Visitante, Cliente, Empleado, Gerente), flujos de compra, sistema de créditos y reembolsos, lista de espera con prioridad temporal, programa de fidelización y trazabilidad por email del cliente. |
| 🛠️ **[TECNICO.md](TECNICO.md)** | **Arquitectura Técnica y Modelo de Datos:** Esquema DDL completo en PostgreSQL, políticas de seguridad RLS, transacciones atómicas RPC (`registrar_venta_atomica`), sincronización WebSocket (Presence + Postgres Changes), Route Guards funcionales y auditoría. |
| 🎓 **[DEFENSA_ORAL_ARQUITECTURA_ANGULAR.md](DEFENSA_ORAL_ARQUITECTURA_ANGULAR.md)** | **Guía Teórico-Práctica para la Defensa Oral:** Explicación del flujo del programa y aplicación conceptual de Guards, Servicios, Pipes, Directivas, Signals vs Observables, Input/Output y banco de preguntas típicas de profesores. |

---

## 🌟 Características Principales del Sistema

### 🍿 Para Clientes y Visitantes
* **Cartelera Dinámica y Top 3:** Algoritmo que calcula en tiempo real el podio de las 3 películas más taquilleras según entradas efectivamente vendidas (excluyendo cancelaciones).
* **Buscador Multigénero:** Búsqueda predictiva instantánea por título, sinopsis y múltiples categorías simultáneas.
* **Propuestas de Películas Comunitarias:** Módulo para que los clientes sugieran títulos que no están en cartelera con título, sinopsis y fundamentación. Al ser aprobadas por gerencia, el cliente recibe una notificación push y la película pasa a futuros estrenos.
* **Mapa de Butacas Realtime con Presence:** Visualización interactiva de sala (20 filas x 3 columnas: 4-20-4), fila adaptada para personas con discapacidad (`♿` Filas J/K, distribución 2-10-2) y sector VIP (Filas R, S, T con recargo del +35%). Mediante WebSockets, si otro usuario está seleccionando un asiento o completa una compra, el mapa se actualiza en vivo sin recargar.
* **Lista de Espera con Turno Exclusivo (15 min):** Cuando una función se agota, los clientes pueden anotarse y consultar su posición numérica en su perfil. Ante una cancelación, el primero de la fila recibe una alerta con reloj regresivo de 15 minutos para comprar con prioridad exclusiva.
* **Checkout Inteligente y Crédito a Favor:** Descuento por cupones (primera compra, mayores de 50 años), canje de recompensas y uso parcial o total del saldo acumulado por cancelaciones (`credito_saldo`).
* **Leyenda Preventiva Obligatoria:** Notificación automática en pantalla y en el ticket PDF (*"Los menores de edad deben ingresar acompañados por un adulto"*) para filmes clasificados `+13`, `+16` y `+18`.
* **Ticket Digital y QR Dinámico:** Generación y descarga directa en PDF con renderizado de código QR único para admisión en sala y retiro de comestibles.
* **"Mis Películas" y Reseñas Verificadas:** Galería visual con el historial de funciones asistidas y sistema de calificación comunitaria habilitado únicamente tras haber adquirido una entrada para dicho film.

### 👔 Para el Personal del Cine (Staff / Operadores)
* **Validador QR Dual (`/empleado/validador`):** Escáner e ingreso manual de códigos alfanuméricos para control de acceso en sala (`usado_cine`) y despacho de productos en Candy Bar (`usado_candy`). Al consumirse ambos, el QR queda inhabilitado automáticamente (`usado_total`).
* **Auditoría Operativa:** Registro inmutable en base de datos con fecha, hora, usuario validador y resultado del control.

### 📊 Para la Gerencia (Administración)
* **Panel de Control Centralizado (`/admin/dashboard`):** Pestañas para ABM de películas (con subida de afiches a Storage), productos de Candy Bar, cupones promocionales, recompensas de fidelización y evaluación de películas sugeridas.
* **Sistema de Roles Granulares (RBAC):** Creación de roles administrativos personalizados asignando permisos específicos por secciones (ej: solo Reportes, solo Películas, etc.) para delegar tareas a empleados sin brindar acceso total.
* **Cancelación Atómica de Funciones:** Ante contingencias operativas de sala, la gerencia suspende la función acreditando el 100% del dinero (entradas + combos) a todos los compradores de forma atómica, revirtiendo puntos y emitiendo una notificación push con opción de reubicarse en otra función.
* **Programación Inteligente de Funciones:** Creación puntual o recurrente por días de la semana con verificación algorítmica estricta del margen obligatorio de 30 minutos de limpieza entre funciones en la misma sala.
* **Reportes y Exportación de Ventas:** Métricas financieras (KPIs) en tiempo real y exportación consolidada a formato CSV compatible con Microsoft Excel.
* **Registro de Auditoría (Audit Log):** Monitoreo en vivo de todas las acciones críticas ejecutadas en el panel administrativo.

---

## 🛠️ Stack Tecnológico

| Capa | Herramienta / Tecnología | Versión |
|---|---|---|
| **Lenguaje Base** | TypeScript | `~5.9.2` |
| **Framework Frontend** | Angular (Standalone Components & Signals) | `^21.2.0` |
| **Estilos e Iconografía** | Bootstrap + Bootstrap Icons | `^5.3.8` / `^1.13.1` |
| **Backend as a Service** | Supabase (PostgreSQL, Auth, RLS, Storage) | `^2.115.0` |
| **Tiempo Real** | Supabase Realtime (WebSockets & Channels) | v2 |
| **Librerías Auxiliares** | `qrcode` (Generación QR), `html2pdf.js` (Exportación PDF) | `^1.5.4` / `^0.14.0` |
| **Empaquetador y Build** | `@angular/build:application` (Vite / esbuild) | `^21.2.21` |

---

## 🔐 Seguridad y Control de Acceso

La aplicación implementa una estrategia de **defensa en profundidad**:
1. **Guards Funcionales de Angular (`src/app/guards/auth.guard.ts`):**
   * `adminGuard`: Restringe `/admin/dashboard` a usuarios con rol `gerente` o `admin`.
   * `staffGuard`: Habilita `/empleado/validador` para `empleado`, `gerente` y `admin`.
   * `authGuard`: Protege rutas privadas de clientes como `/perfil`.
2. **Validación en Componente (`ngOnInit`):** Doble verificación de roles y estado activo (`perfil.activo !== false`) para prevenir bypass de enrutamiento en el cliente.
3. **Políticas de Fila (RLS en PostgreSQL):** La integridad de los datos está garantizada a nivel motor de base de datos en Supabase, impidiendo escrituras no autorizadas mediante JWT.

---

## 🚀 Puesta en Marcha en Desarrollo

### 1. Clonar el Repositorio
```bash
git clone https://github.com/axel2020-ar/cine-utn.git
cd cine-utn
```

### 2. Instalar Dependencias
```bash
npm install
```

### 3. Configurar Variables de Entorno
Verificar o crear el archivo `src/environments/environment.ts` con las credenciales del proyecto Supabase:
```typescript
export const environment = {
  production: false,
  supabaseUrl: 'https://tu-proyecto.supabase.co',
  supabaseKey: 'tu-anon-public-key'
};
```

### 4. Ejecutar el Servidor Local
```bash
npm start
# o: npx ng serve
```
La aplicación quedará disponible en `http://localhost:4200/`.

---

## 🧪 Compilación y Verificación para Producción

Para compilar y verificar la ausencia de errores de tipado o empaquetado:
```bash
npm run build
```
El resultado optimizado se genera en el directorio `dist/cine-utn/browser`.

---

## 👥 Cuentas de Prueba para la Defensa Oral

| Perfil | Email sugerido | Rol en el Sistema | Vista Principal |
|---|---|---|---|
| **Gerente General** | `gerente@cineutn.com` | `gerente` / `admin` | `/admin/dashboard` |
| **Personal de Puerta** | `empleado@cineutn.com` | `empleado` | `/empleado/validador` |
| **Cliente Frecuente** | Cuenta registrada en `/login` | `cliente` | `/cartelera` y `/perfil` |
| **Visitante Anónimo** | Botón "Ingresar como Invitado" | `anonimo` | `/cartelera` (compras sin registro) |
