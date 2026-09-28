# SPECIFICATION.md — Vitrina PASO / Catálogo 4.032 productos

> Documento de especificación previo a implementación. No describe código final, solo
> comportamiento esperado, contrato API y supuestos a aprobar.
>
> Fuentes revisadas:
> - `data/catalog.csv` (4.032 filas verificadas por script)
> - `data/README.md` (origen Mercadona/Zenodo, conversión EUR→CLP, columnas)
> - `mockup/index.html`, `mockup/app.js`, `mockup/styles.css`
> - `server/src/index.js`, `server/src/catalog.js` (implementación de referencia existente)
> - `.cursor/plans/catálogo_api_express_9f03c9f9.plan.md`
> - `AGENTS.md`: **no encontrado** en el repositorio (ver §5.3). Se documenta como supuesto.

---

## 1. Resumen y alcance

Vitrina web “PASO - Catálogo de supermercado” que consume un backend Node.js + Express
que carga `data/catalog.csv` en memoria una sola vez al arrancar.

Alcance funcional:

1. Búsqueda por nombre.
2. Dos filtros: categoría (agrupada) y formato (exacto).
3. Paginación de 8 productos por página.
4. Vista de detalle en `<dialog>` modal.
5. Tres estados explícitos: cargando, sin resultados, error.
6. Tres endpoints: `GET /api/products`, `GET /api/products/:id`, `GET /api/products/filters`.

Fuera de alcance (salvo aprobación contraria): ordenamiento, rango de precios,
favoritos/carrito, autenticación, i18n adicional, CORS (mismo origen), paginación
configurable por cliente.

---

## 2. Datos reales (base de la especificación)

### 2.1 Columnas del CSV

Verificado por lectura directa del CSV:

```text
id,name,description,format,category,price,priceUnit,originalPrice,currency,imageUrl,productUrl,extractedAt
```

| Columna | Tipo en CSV | Ejemplo real | Observaciones |
|---|---|---|---|
| `id` | string numérico | `10043` | Único (4.032/4.032). En esta entrega no hay sufijos de variante con `-`, aunque `README` indica que se conservan si existen. Se trata como `string`, no `number`. |
| `name` | string es | `Batido de chocolate 90% leche Puleva` | Nunca vacío. Máx. ~368 caracteres. Campo de búsqueda. |
| `description` | string es | `Batido de chocolate 90% leche Puleva. Alérgenos: Contiene leche...` | Nunca vacía. Máx. ~3.817 caracteres. Solo se muestra en detalle, no se busca por ella. |
| `format` | string libre | `6 mini bricks x 200 ml`, `Paquete`, `Botella` | Nunca vacío. **252 valores distintos.** Filtro exacto. |
| `category` | ruta `A > B` | `Huevos, leche y mantequilla > Leche y bebidas vegetales` | Nunca vacía. **149 rutas completas**, **26 grupos raíz**. Filtro por grupo raíz. |
| `price` | entero CLP | `2605` | Rango real `185 – 449.434`. Ya convertido con `1 EUR = 1.085,59 CLP` (02-09-2026, Banco Central). Redondeado a entero. La app no convierte. |
| `priceUnit` | enum corto | `/ud.`, `/pack`, `/200 g` | Solo 3 valores. No es filtro. Se muestra en detalle. |
| `originalPrice` | entero CLP | `3040` | Puede ser igual a `price` (sin descuento) o mayor. |
| `currency` | constante | `CLP` | 100% `CLP`. No es filtro. |
| `imageUrl` | URL https | `https://prod-mercadona.imgix.net/images/...?fit=crop&h=600&w=600` | Nunca vacía. Remota (imgix). El mockup trae 8 imágenes locales en `mockup/assets/*.jpg` solo para abrir sin conexión; el catálogo real usa URL remota. |
| `productUrl` | URL https | `https://tienda.mercadona.es/product/10043/...` | Nunca vacía. Enlace “Ver ficha de origen”. |
| `extractedAt` | string | `2025-11-06 20:29:59` | Formato `YYYY-MM-DD HH:MM:SS`, no ISO-8601 con `T/Z`. Se muestra tal cual. |

Sin nulos: conteo de vacíos por columna = 0 en las 4.032 filas.

### 2.2 Valores de filtro disponibles

#### Categoría (filtro agrupado)

El mockup y `server/src/catalog.js:6-8` definen:

```js
categoryGroup(category) = category.split(' > ')[0]
```

Es decir, el `<select id="category-filter">` no lista las 149 rutas completas, sino los
26 grupos raíz, ordenados con `Intl.Collator('es', {sensitivity:'base'})`:

1. Aceite, especias y salsas
2. Agua y refrescos
3. Aperitivos
4. Arroz, legumbres y pasta
5. Azúcar, caramelos y chocolate
6. Bebé
7. Bodega
8. Cacao, café e infusiones
9. Carne
10. Cereales y galletas
11. Charcutería y quesos
12. Congelados
13. Conservas, caldos y cremas
14. Cuidado del cabello
15. Cuidado facial y corporal
16. Fitoterapia y parafarmacia
17. Fruta y verdura
18. Huevos, leche y mantequilla
19. Limpieza y hogar
20. Maquillaje
21. Marisco y pescado
22. Mascotas
23. Panadería y pastelería
24. Pizzas y platos preparados
25. Postres y yogures
26. Zumos

Semántica: igualdad exacta contra el grupo raíz. `category=Cacao, café e infusiones`
coincide con `Cacao, café e infusiones > Cacao soluble y chocolate a la taza`.

#### Formato (filtro exacto)

`252` valores distintos, ordenados con el mismo collator. Ejemplos por frecuencia:

`Paquete` (1.007), `Caja` (471), `Botella` (363), `Bote` (331), `Bandeja` (203),
`Pieza` (143), `1 ud.` (129), `Tarro` (128), `Brick` (87), `Tarrina` (75),
`Frasco` (75), `Lata` (73), `Spray` (63), `Tableta` (52), `6 bricks x 1 L` (33), …

La lista completa no se hardcodea: la provee `GET /api/products/filters`.
Semántica: igualdad exacta (`product.format === format`), sensible a tildes,
mayúsculas y puntuación (comparación estricta en servidor).

#### Columnas que NO son filtro

| Columna | Motivo para no exponerla como filtro |
|---|---|
| `price` / `originalPrice` | Rango muy amplio y con outlier (449.434); el mockup no incluye slider/rango. |
| `priceUnit` | Solo 3 valores, bajo valor discriminante; se muestra en detalle. |
| `currency` | Constante `CLP`. |
| `description` | Texto largo libre; no se busca ni filtra por ella (solo `name`). |
| `imageUrl`, `productUrl`, `extractedAt`, `id` | Identidad/procedencia, no facetas. |

---

## 3. Descripción funcional detallada

Referencia principal: `mockup/app.js` (estado, `PAGE_SIZE = 8`, plantillas, paginación,
detalle) + `mockup/index.html` (estructura) + `server/src/catalog.js` (reglas de filtrado).

### 3.1 Búsqueda (campo `q`)

- Control: `<input id="search" type="search" placeholder="Buscar por nombre...">`.
- Campo buscado: **solo `name`**. No se busca en `description`, `category` ni `format`.
- Normalización: `trim()` + `toLocaleLowerCase('es')` + `includes` (subcadena, sin stemming,
  sin tolerancia a tildes: `cafe` no encuentra `café` salvo coincidencia exacta insensible a caja).
- Vacío = sin filtro de texto.
- Combinación: AND con los dos filtros (`q AND category AND format`).
- Interacción:
  - Evento `input` en búsqueda, categoría y formato → actualiza estado y dispara
    `loadProducts()` con `page = 1` (reset de página).
  - Sin debounce en el mockup actual; cada pulsación dispara un `fetch`.
    Propuesta a aprobar: mantener sin debounce en v1 (simple, 4.032 registros en memoria
    responden rápido) o añadir debounce 250–300 ms (ver supuestos §5).
- Query param: `q`. Si está vacío o solo espacios, no se envía (o se envía vacío y el
  servidor lo trata como sin filtro).

### 3.2 Filtros

- Controles:
  - `<select id="category-filter">` con opción inicial `Todas las categorías` (`value=""`).
  - `<select id="format-filter">` con opción inicial `Todos los formatos` (`value=""`).
- Poblado: al arrancar (`boot()`), `GET /api/products/filters` (ver §4.3; el código
  existente usa `GET /api/meta` — ver discrepancia en §5.3) devuelve listas ordenadas;
  `fillSelect()` preserva la selección actual si sigue existiendo.
- Comportamiento:
  - Cambiar cualquiera → `page = 1` → refetch.
  - Valores son opacos: el frontend no transforma categoría/formato, los reenvía tal cual.
  - Filtro desconocido (ej. categoría inexistente) → simplemente 0 resultados, no error 400.
- Contador asociado: `Mostrando X-Y de Z` (ver §3.3) refleja el `total` filtrado.

### 3.3 Paginación

- Constante: `PAGE_SIZE = 8` fija, no configurable por query param en el código actual.
  - Sin filtros: `4.032 / 8 = 504 páginas`.
- Parámetro: `page` base 1. Valor por defecto `1`.
- Lógica servidor (`queryProducts` en `catalog.js:61-75`):
  1. Filtrar primero, paginar después.
  2. `total = filtrados.length`.
  3. `totalPages = total === 0 ? 0 : ceil(total / 8)`. Nota: si `total > 0` pero el cálculo
     daría 0, se fuerza mínimo 1 antes del clamp.
  4. `safePage = clamp(page, 1, totalPages)` (con `total === 0 → 1`).
     - `page=0`, negativo, `NaN` → `1`.
     - `page > totalPages` → última página (no error, no vacío).
  5. `items = filtrados.slice((safePage-1)*8, +8)`.
  6. Respuesta incluye `page` ya normalizada (el cliente debe adoptar `data.page`, no la pedida).
- UI (`mockup/app.js:90-135`, `mockup/index.html:54-58`):
  - Contenedor `<nav id="pagination">` con `Anterior`, `<div id="page-numbers">`, `Siguiente`.
  - Oculta (`hidden = true`, botones deshabilitados) cuando: `loading`, `error`,
    `total === 0` o `totalPages <= 1`.
  - Visible en caso contrario; `Anterior` deshabilitado si `page <= 1`,
    `Siguiente` si `page >= totalPages`.
  - Números (`pageItems(current, totalPages)`):
    - `totalPages <= 5` → todas las páginas.
    - Si no: conjunto `{1, totalPages, current-1, current, current+1}` más `2,3` si
      `current <= 3`, más `totalPages-1, totalPages-2` si `current >= totalPages-2`,
      ordenado, con `…` (ellipsis) donde haya salto > 1.
    - Ejemplo sin filtros en pág. 1: `1 2 3 … 504` (coincide con el plan).
    - Página activa: clase `active` + `aria-current="page"`.
  - Contador `<span id="result-count">`:
    - Cargando: `Cargando catálogo…`.
    - Error: `No se pudo cargar el catálogo`.
    - Vacío: `Mostrando 0 productos`.
    - Con datos: `Mostrando X-Y de Z` con formato `es-CL` (punto de miles),
      donde `X = (page-1)*8+1`, `Y = X + items.length - 1`. Ej.: `Mostrando 1-8 de 4.032`.
  - Navegación: clic en `Anterior/Siguiente/número` → actualiza `state.page` → refetch.
    No hay scroll-to-top especificado; a aprobar si se añade.

### 3.4 Vista de detalle / modal

- Disparador: clic en la tarjeta (`<button data-product-id="...">`). Toda la card es botón,
  con `aria-label="Ver detalle de {name}"`.
- Origen de datos (doble vía, `mockup/app.js:259-272`):
  1. Si el producto está en `state.items` (página actual), se abre directo sin fetch.
  2. Si no (caso borde), `GET /api/products/:id`.
  3. Si ese fetch falla → se muestra estado de error general (no un error específico de modal).
- Contenedor: `<dialog id="product-dialog">` nativo con `.showModal()`.
  - Cierre: botón `×` (`#dialog-close`), clic en backdrop (`event.target === dialog`),
    y Escape nativo del `<dialog>`.
- Contenido (ids en `index.html:61-85`, rellenado en `openDetail`):
  - `#detail-id`: `PRODUCTO #${id}` (eyebrow).
  - `#detail-title`: `name`.
  - `#detail-description`: `description` (texto plano vía `textContent`, sin HTML).
  - `#detail-image`: `src = product.image`, `alt = product.name`.
  - `#detail-list` (dl): 4 pares fijos:
    - `Categoría` → ruta completa `category` (no solo el grupo).
    - `Formato` → `format`.
    - `Unidad de precio` → `priceUnit`.
    - `Identificador` → `id`.
  - Bloque comercio:
    - `Precio publicado`: `Intl.NumberFormat('es-CL',{style:'currency',currency, maximumFractionDigits:0})`. Ej.: `$2.605`.
    - `Moneda: CLP` (`#detail-currency`).
    - `Precio original: $X` (`#detail-original-price`, mismo formato).
    - `Datos extraídos: {extractedAt}` (texto tal cual).
    - Enlace `Ver ficha de origen →` → `productUrl`, `target="_blank"`, `rel="noopener noreferrer"`.
- Card en grilla (resumen): imagen, `#id` (chip), grupo de categoría (raíz, mayúsculas,
  color oliva), `name`, `format • precio CLP`, enlace visual `Ver detalle →`.
  La card no muestra descripción, `priceUnit` ni precio original.

### 3.5 Los 3 estados

Implementados como plantillas inline en `#product-grid` (`PLANTILLAS` en `app.js:26-47`)
más texto en `#result-count` y visibilidad de paginación.

| Estado | Disparador | Contenido en grilla | `result-count` | Paginación | Acciones |
|---|---|---|---|---|---|
| **Cargando** | `boot()` inicial y cada `loadProducts()` (flag `loading=true` antes del fetch). | Spinner + `Cargando productos` + `Espera mientras consultamos el catálogo.` | `Cargando catálogo…` | Oculta | Ninguna (controles siguen habilitados en el mockup). |
| **Sin resultados** | Fetch OK con `total === 0` (ej. `q=zzzsincoincidencia`, o combinación imposible categoría+formato). | Icono `⌕` + `Sin resultados` + `Prueba con otra búsqueda o elimina algunos filtros.` + botón `Limpiar filtros`. | `Mostrando 0 productos` | Oculta | `Limpiar filtros` vacía búsqueda + ambos selects y refetch pág. 1. |
| **Error** | `fetch` rechaza o `response.ok === false` (red caída, 500 por CSV ausente, 404 en detalle fallback). En arranque, fallo de meta o productos. | Icono `!` + `No pudimos cargar el catálogo` + `Inténtalo nuevamente en unos momentos.` + botón `Reintentar`. | `No se pudo cargar el catálogo` | Oculta | `Reintentar` reintenta `loadMeta()` (ignora su error) + `loadProducts()`. |

Detalles:

- `renderGrid()` es la única que pinta: orden `loading → error → vacío → datos`.
- Error de detalle (producto fuera de página + fetch `/:id` fallido) reutiliza el estado
  de error general de la grilla; no hay toast/modal de error dedicado.
- El plan exige “quitar el switch de referencia” de estados: los estados son reales,
  no un panel de demostración.
- Accesibilidad existente: `aria-live="polite"` en grilla, `aria-label` en paginación y
  modal (`aria-labelledby="detail-title"`). A aprobar si se añaden `role="status/alert"`.

---

## 4. Contrato de la API (3 endpoints requeridos)

Base URL: mismo origen que sirve el mockup (`express.static(mockup/)`). Sin prefijo de
versión. Todas las respuestas son `application/json; charset=utf-8`.

Modelo `Product` (clave: el servidor renombra `imageUrl → image`):

```json
{
  "id": "10043",
  "name": "Batido de chocolate 90% leche Puleva",
  "description": "Batido de chocolate 90% leche Puleva. Alérgenos: ...",
  "format": "6 mini bricks x 200 ml",
  "category": "Huevos, leche y mantequilla > Leche y bebidas vegetales",
  "price": 2605,
  "priceUnit": "/pack",
  "originalPrice": 3040,
  "currency": "CLP",
  "productUrl": "https://tienda.mercadona.es/product/10043/batido-chocolate-90-leche-puleva-pack-6",
  "extractedAt": "2025-11-06 20:29:59",
  "image": "https://prod-mercadona.imgix.net/images/118b04b2870df73a19605a8987545455.jpg?fit=crop&h=600&w=600"
}
```

Tipos: `id, name, description, format, category, priceUnit, currency, productUrl,
extractedAt, image` son `string`; `price, originalPrice` son `number` entero (pesos).

### 4.1 `GET /api/products` — lista con búsqueda, filtros y paginación

**Query params** (todos opcionales, con sanitización — ver §4.5):

| Param | Tipo | Defecto | Reglas |
|---|---|---|---|
| `search` (`q` como alias) | string | `""` | `trim()` + tope de 100 caracteres. Vacío = sin filtro. Solo contra `name`, `toLocaleLowerCase('es')` + `includes`. No distingue descripción. |
| `category` | string | `""` | Vacío = todas. No vacío = igualdad contra `categoryGroup()` (tramo antes de ` > `). Sensible a mayúsculas/tildes. Valor desconocido → `total: 0`, no 400. |
| `format` | string | `""` | Vacío = todos. No vacío = igualdad exacta con `format`. Valor desconocido → `total: 0`, no 400. |
| `page` | int base 1 | `1` | Entero `>= 1`. `<=0`/`NaN`/`abc` → `1`. `> totalPages` → `totalPages` (clamp, no 404). |
| `limit` (`pageSize` como alias) | int 1–50 | `8` | Entero entre 1 y 50. `> 50` (ej. `9999`) se topa en `50`. Inválido → `8`. |

Sin validación estricta 400 en el código actual: params ausentes o malformados degradan
a defecto/clamp.

**Respuesta `200 OK`:**

```json
{
  "items": [ { "id": "10043", "...": "..." } ],
  "total": 4032,
  "page": 1,
  "pageSize": 8,
  "totalPages": 504
}
```

| Campo | Tipo | Descripción |
|---|---|---|
| `items` | `Product[]` | Máx. `pageSize` elementos de la página `page` ya normalizada. Vacío solo si `total === 0`. |
| `total` | number | Total filtrado (no el total del catálogo, salvo sin filtros). |
| `page` | number | Página efectiva tras clamp. El cliente debe usarla. |
| `pageSize` | number | Tamaño efectivo (1–50, defecto 8). |
| `limit` | number | Alias de `pageSize` (mismo valor) para consumidores que lo esperan. |
| `totalPages` | number | `ceil(total/pageSize)`; `0` si `total === 0`. |

**Ejemplos:**

```http
GET /api/products
GET /api/products?q=chocolate&page=1
GET /api/products?category=Huevos%2C%20leche%20y%20mantequilla&format=6%20mini%20bricks%20x%20200%20ml&page=2
GET /api/products?q=zzzsincoincidencia → { "items": [], "total": 0, "page": 1, "pageSize": 8, "totalPages": 0 }
```

**Errores:**

```json
// 500 — CSV no cargó al arrancar o catálogo vacío
{ "error": "No se pudo cargar el catálogo" }
```

### 4.2 `GET /api/products/:id` — detalle por identificador

- `:id` es el `id` del CSV como string de ruta (ej. `10043`). Comparación estricta
  `product.id === String(id)`. No hay normalización adicional.
- Codificar con `encodeURIComponent` en cliente.

**Respuesta `200 OK`:** un objeto `Product` (mismo esquema de §4, con `image`).

```http
GET /api/products/10043 → { "id": "10043", "name": "...", ... "image": "https://..." }
```

**Errores:**

```json
// 404 — id inexistente
{ "error": "Producto no encontrado" }

// 500 — catálogo no cargado
{ "error": "No se pudo cargar el catálogo" }
```

### 4.3 `GET /api/products/filters` — facetas para los selects

> Discrepancia a aprobar (§5.3): el servidor existente expone `GET /api/meta` con este
> mismo payload y el mockup lo consume como `/api/meta`. El enunciado exige
> `GET /api/products/filters`. La especificación adopta **`/api/products/filters` como
> canónica** y propone mantener `/api/meta` como alias temporal o migrar el frontend
> a la nueva ruta.

Sin query params obligatorios. Acepta `?category=` opcional para filtros en cascada:
con categoría, `formats` se restringe a los formatos únicos dentro de esa categoría
(`categories` se devuelve siempre completa); sin categoría, listado general.
Categoría desconocida → `formats: []` con 200.

**Respuesta `200 OK`:**

```json
{
  "categories": ["Aceite, especias y salsas", "Agua y refrescos", "...(26 en total)"],
  "formats": ["1 kg", "1 ud.", "Botella", "Bote", "...(252 en total)"]
}
```

| Campo | Tipo | Descripción |
|---|---|---|
| `categories` | `string[]` | 26 grupos raíz únicos, ordenados `Intl.Collator('es',{sensitivity:'base'})`. |
| `formats` | `string[]` | 252 formatos únicos, mismo orden. |

**Errores:**

```json
// 500 — catálogo no cargado
{ "error": "No se pudo cargar el catálogo" }
```

**Ejemplo de consumo (frontend):**

```js
const meta = await (await fetch('/api/products/filters')).json();
// meta.categories → poblar #category-filter (más opción "")
// meta.formats   → poblar #format-filter   (más opción "")
```

### 4.4 `GET /api/health` — salud del servicio

Sin query params. Responde siempre `200 OK` (no depende del catálogo, útil para monitoreo):

```json
{
  "status": "ok",
  "totalProducts": 4032,
  "timestamp": "2026-09-28T01:25:49.524Z"
}
```

| Campo | Tipo | Descripción |
|---|---|---|
| `status` | string | Siempre `"ok"`. |
| `totalProducts` | number | Productos cargados en memoria (`4032` en operación normal). |
| `timestamp` | string | Instante de la respuesta en ISO-8601. |

### 4.5 Límites de validación y cabeceras

- `search`: `trim()` + máximo 100 caracteres (el excedente se recorta).
- `page`: entero `>= 1` (defecto 1); `?page=-5` o `?page=abc` → página 1.
- `limit`: entero 1–50 (defecto 8); `?limit=9999` → `pageSize: 50`.
- Payloads maliciosos en `search` o `:id` (ej. `<script>…</script>`) nunca generan 500:
  búsqueda → 200 con resultados (o vacío); id inexistente → 404 `{ error }`.
- Los errores 500 responden `{ error: "No se pudo cargar el catálogo" }` o
  `{ error: "Error interno del servidor" }`, sin trazas internas (`stack`).
- Rutas `/api/*` desconocidas → `404 { error: "Recurso no encontrado" }`.
- Todas las respuestas incluyen `X-Content-Type-Options: nosniff`,
  `X-Frame-Options: DENY` y `Referrer-Policy: strict-origin-when-cross-origin`.

---

## 5. Supuestos (requieren revisión y aprobación)

### 5.1 Datos

1. **A1 — Precios ya en CLP.** No se consulta ni calcula tipo de cambio en runtime.
   `1 EUR = 1.085,59 CLP` solo es trazabilidad de generación.
2. **A2 — `currency` siempre `CLP`.** No hay multi-moneda; el formateador usa `es-CL` con
   0 decimales.
3. **A3 — `id` tratado como `string`.** Aunque hoy son numéricos sin guiones, se compara
   como string para soportar futuros sufijos de variante.
4. **A4 — Sin registros incompletos.** Conteo de vacíos = 0; no se define fila con
   `imageUrl` rota, precio nulo o categoría sin grupo. Si aparece, se filtra (`filter(p => p.id)`)
   o se muestra tal cual sin validación adicional.
5. **A5 — `category` siempre tiene forma `Grupo > Subcategoría` o `Grupo` solo.**
   El filtro usa solo el grupo; la ruta completa solo se muestra en detalle.
6. **A6 — `format` es vocabulario abierto (252 valores).** No se normaliza
   (`Botella` ≠ `botella`); el orden del select es alfabético español base.
7. **A7 — `priceUnit` no filtra.** Solo `/ud.`, `/pack`, `/200 g`.
8. **A8 — Imágenes remotas sin fallback.** Si imgix falla/offline, el `<img>` queda roto;
   no hay placeholder ni retry de imagen. Los 8 `assets/*.jpg` son solo del mockup
   desconectado, no del catálogo real.
9. **A9 — `extractedAt` se muestra literal** (`2025-11-06 20:29:59`), sin parseo a fecha
   ni formato relativo.
10. **A10 — CSV cargado una vez en memoria al arrancar.** Sin recarga en caliente, sin
    paginación a disco, sin caché HTTP específica. Si el archivo falta, toda `/api/*`
    responde `500 {error: "No se pudo cargar el catálogo"}`.

### 5.2 Experiencia de usuario

11. **B1 — Búsqueda solo por `name`, subcadena insensible a caja (es), sin acento-insensible
    ni debounce.** Cada `input` dispara fetch y resetea a pág. 1. Aprobar si se quiere
    debounce 250 ms y/o búsqueda también en `description`.
12. **B2 — Filtros en AND estricto.** No hay OR, ni multi-selección, ni rango de precios,
    ni ordenamiento (relevancia/precio/nombre). Aprobar si se añade `sort`.
13. **B3 — `pageSize` fijo en 8.** No hay selector de 12/24/48 ni query param. 504 páginas
    sin filtros es el comportamiento esperado.
14. **B4 — Página fuera de rango hace clamp, no error.** `page=9999` con 3 páginas
    devuelve pág. 3. `page=abc` → pág. 1.
15. **B5 — Paginación oculta con 0–1 páginas, loading o error.** Contador textual es la
    única señal en esos casos.
16. **B6 — Detalle prioriza caché de página.** Solo hace `GET /:id` si el item no está
    visible. Error de detalle reutiliza el estado de error de la grilla (no hay modal de error).
17. **B7 — Botones `Limpiar filtros` y `Reintentar` son las únicas recuperaciones.**
    No hay vaciado parcial, ni reintento solo de imagen, ni persistencia en URL
    (`?q=&category=` no se refleja en `location`/historial; recargar pierde estado).
    Aprobar si se quiere sincronizar filtros en URL.
18. **B8 — Idioma fijo español (`es-CL`).** Textos de estados, moneda y miles en formato
    chileno. Sin i18n.
19. **B9 — Mismo origen, sin CORS/auth/rate-limit.** Express sirve estáticos + API.
    Sin paginación infinita/scroll, sin responsive más allá del CSS existente
    (4→2→1 columnas, modal 2→1 columnas).

### 5.3 Discrepancias y pendientes de decisión

20. **C1 — `AGENTS.md` no existe en el repo.** Se asumió convención estándar
    (mismo origen, `PAGE_SIZE=8`, estados del mockup). Confirmar si hay reglas
    adicionales fuera del repo.
21. **C2 — `GET /api/meta` vs `GET /api/products/filters`.** El código y el plan usan
    `/api/meta`; el enunciado exige `/api/products/filters`. Decisión propuesta:
    implementar `/api/products/filters` como canónica y (a elegir):
    - (a) mantener `/api/meta` como alias 302/compat, o
    - (b) eliminarla y migrar `mockup/app.js`.
    Por defecto se propone (a) durante la transición.
22. **C3 — Campo `image` vs `imageUrl`.** El CSV trae `imageUrl`; la API expone `image`
    (mapeo en `toProduct`). Decisión propuesta: mantener `image` en API por compatibilidad
    con el mockup, documentando el mapeo. Aprobar si se prefiere devolver `imageUrl`.
23. **C4 — Sin contrato de error detallado.** Solo `{error: string}` con 404/500.
    No hay códigos de validación, ni `400` por params inválidos. Aprobar si se exige
    validación estricta.

---

## 6. Criterios de aceptación propuestos (para aprobar junto a supuestos)

- [ ] Carga inicial: 8 cards, `Mostrando 1-8 de 4.032`, última página `504`.
- [ ] `q=chocolate` filtra por nombre; vaciar restaura.
- [ ] `category` (grupo) y `format` (exacto) filtran y se combinan en AND; pág. resetea a 1.
- [ ] Paginación: Anterior/Siguiente, números con `…`, activa marcada, oculta en 0–1 pág.
- [ ] Detalle abre con precio `$X` es-CL, `image` remota, 4 campos + ficha de origen `_blank`; cierra por `×`, backdrop y Escape.
- [ ] Estados: cargando (spinner), vacío con `Limpiar filtros`, error con `Reintentar`.
- [ ] `GET /api/products`, `GET /api/products/:id` (200/404), `GET /api/products/filters`
      responden los JSON exactos de §4; `500` si el CSV falta.

---

*Fin de especificación — pendiente de aprobación de supuestos §5 antes de implementar.*
