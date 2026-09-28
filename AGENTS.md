# Instrucciones del Agente (AGENTS.md)

Este repositorio implementa una vitrina de productos de supermercado (4.032 productos) basada en `data/catalog.csv`.

## 1. Directrices de Arquitectura

- **Backend:** Node.js (18+) con Express 5. Carga `data/catalog.csv` en memoria al iniciar (`server/src/catalog.js`).
- **Frontend:** HTML, CSS y Vanilla JS dentro de `mockup/`. Es servido como contenido estático por Express en la raíz `/`.
- **Datos reales:** No inventar atributos, formatos ni campos. Usar únicamente los datos parseados de `data/catalog.csv` con precios en pesos chilenos (CLP).
- **Procesamiento en backend:** La búsqueda (`?search=`), filtros (`?category=`, `?format=`) y paginación (`?page=`, `?limit=`) DEBEN ejecutarse exclusivamente en el backend. El frontend no debe procesar el catálogo completo.
- **Filtros dependientes (cascada):** `GET /api/products/filters` acepta `?category=` opcional. Con categoría, devuelve las categorías completas y solo los formatos únicos dentro de esa categoría; el frontend repuebla el selector de formato y resetea su valor a `""` al cambiar de categoría.

## 2. Seguridad y Robustez (obligatorio)

- **Protección XSS (frontend, `mockup/app.js`):** todo texto dinámico de la API inyectado vía `innerHTML` (`productCard`, `fillSelect`, `#detail-list`) DEBE pasar por `escapeHTML()`. El resto usa `textContent` o asignación de propiedades (`.src`/`.href`).
- **AbortController (frontend):** `loadProducts()` aborta el fetch anterior en cada nueva interacción y descarta respuestas obsoletas; un `abort` nunca muestra estado de error.
- **Validación de parámetros (backend, fuente única en `server/src/catalog.js`):**
  - `page`: entero `>= 1` (defecto 1); `?page=-5` o `?page=abc` → página 1.
  - `limit`: entero 1–50 (defecto 8); `?limit=9999` se topa en 50.
  - `search`: `trim()` + máximo 100 caracteres (el excedente se recorta).
- **Cabeceras de seguridad:** toda respuesta incluye `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY` y `Referrer-Policy: strict-origin-when-cross-origin` (sin dependencias extra).
- **Endpoint de salud:** `GET /api/health` responde siempre `200` con `{ status: "ok", totalProducts, timestamp }`, sin depender del catálogo.
- **Errores seguros:** los 500 devuelven mensajes genéricos fijos (`{ error }`), nunca trazas internas (`stack`). Rutas `/api/*` desconocidas → `404` JSON.

## 3. Límites y Restricciones

- No agregar bases de datos externas (se mantiene en memoria).
- No implementar carrito de compras, pasarelas de pago ni módulos de administración.
- No agregar empaquetadores complejos (Webpack, Vite, etc.) en el frontend para preservar la simplicidad del código mockup original.

## 4. Comprobación y Verificación (Arnés)

- Cada cambio en las rutas o lógica de negocio debe validarse ejecutando la suite de pruebas nativa:

  ```bash
  npm test
  ```

  (ubicada en `server/tests/api.test.js`; 10 tests en 2 suites, todo en verde).

- Los contratos de respuesta de los endpoints (`/api/products`, `/api/products/:id`, `/api/products/filters`, `/api/health`) deben apegarse estrictamente a lo establecido en `SPECIFICATION.md` (§4.1–§4.5).
