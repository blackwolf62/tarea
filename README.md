# PASO — Vitrina de catálogo (4.032 productos)

Vitrina full-stack para explorar el catálogo de supermercado del curso: búsqueda por
nombre, filtros por categoría y formato **en cascada** (los formatos se restringen a la
categoría elegida), paginación configurable, vista de detalle en modal y estados de
carga / sin resultados / error.

Los datos provienen de `data/catalog.csv` (4.032 productos del dataset de Mercadona en
Zenodo, con precios convertidos a pesos chilenos; ver `data/README.md`). El backend carga
el CSV en memoria una sola vez al arrancar y expone 4 endpoints JSON; el frontend es el
HTML/CSS/JS del `mockup/` adaptado, servido por el propio backend.

Medidas de seguridad y robustez implementadas: saneamiento XSS (`escapeHTML`) y
`AbortController` en el frontend; validación de parámetros (`limit` máx. 50, `search`
máx. 100 caracteres), cabeceras de seguridad, endpoint `/api/health` y errores sin
trazas internas en el backend. Detalle en `ARCHITECTURE.md` §7.

## Stack

| Capa | Tecnología |
|---|---|
| Backend | Node.js (18+; verificado en v26) + Express 5 |
| Parseo CSV | `csv-parse/sync` (única dependencia extra) |
| Frontend | HTML + CSS + JS vanilla (`mockup/`, sin bundler ni framework) |
| Datos | `data/catalog.csv` en memoria (sin base de datos) |
| Tests | `node --test` (sin dependencias; `server/tests/api.test.js`) |

## Estructura

```text
tarea-main/
  README.md            # este archivo
  SPECIFICATION.md     # especificación funcional y contrato API (§4.1–§4.5)
  ARCHITECTURE.md      # arquitectura + §7 Decisiones de Seguridad y Robustez
  AGENTS.md            # reglas del arnés agéntico
  data/
    catalog.csv        # 4.032 productos
    README.md          # origen del dataset y conversión EUR → CLP
  mockup/              # frontend (index.html, styles.css, app.js, assets/)
  server/
    package.json       # scripts start / test
    src/
      index.js         # rutas, CORS, cabeceras, /api/health, errores seguros
      catalog.js       # carga del CSV, filtros, paginación y sanitización
    tests/
      api.test.js      # suite de verificación del arnés (10 tests)
```

## Instalación y ejecución

Requisito: Node.js 18 o superior y npm.

### 1. Instalar dependencias del backend

```bash
cd tarea-main/server
npm install
```

### 2. Iniciar el backend (sirve API + frontend)

```bash
npm start
```

Verás `Catálogo cargado: 4032 productos` y `PASO en http://localhost:3000`.
El puerto se puede cambiar con `PORT`:

```bash
PORT=3001 npm start
```

### 3. Abrir la aplicación

- Vitrina: <http://localhost:3000/>
- El backend sirve el `mockup/` como archivos estáticos en el mismo origen, por lo que
  no se necesita un servidor aparte para el frontend. Si el frontend corre en otro
  puerto, la API acepta CORS (`Access-Control-Allow-Origin: *`).

### Endpoints

| Método | Ruta | Descripción |
|---|---|---|
| `GET` | `/api/products?page=&limit=&search=&category=&format=` | Lista paginada (acepta alias `q` y `pageSize`) |
| `GET` | `/api/products/:id` | Detalle completo (404 si no existe) |
| `GET` | `/api/products/filters` | Categorías y formatos únicos; acepta `?category=` para restringir formatos en cascada (`/api/meta` es alias temporal) |
| `GET` | `/api/health` | Salud: `200 { status: "ok", totalProducts, timestamp }` |

Límites de validación: `page` entero `>= 1` (defecto 1); `limit` entero 1–50
(defecto 8, `?limit=9999` → 50); `search` con `trim()` y máximo 100 caracteres.
Payloads maliciosos nunca generan 500 (búsqueda → 200, id inexistente → 404).

Ejemplos:

```bash
curl "http://localhost:3000/api/products?search=chocolate&limit=5&page=2"
curl "http://localhost:3000/api/products?category=Bodega&format=Botella"
curl "http://localhost:3000/api/products/10043"
curl "http://localhost:3000/api/products/filters?category=Beb%C3%A9"
curl "http://localhost:3000/api/health"
```

## Prueba de verificación del arnés

```bash
cd tarea-main/server
npm test
```

Esto ejecuta `node --test tests/`. La suite (`tests/api.test.js`, 10 tests en 2 suites,
todo en verde) levanta el backend real en el puerto 3221 (o el de `TEST_PORT`), lo apaga
al terminar y verifica:

1. `GET /api/products` pagina (`total 4032`, 8 por página, 504 páginas) y no devuelve
   los 4.000 items juntos; páginas con igual `limit` no repiten IDs.
2. `?search=` filtra resultados reales (todo `name` contiene el término; alias `?q=`
   equivalente; término inexistente → `total 0`).
3. `GET /api/products/:id` con ID inválido retorna 404 con `{ error }` (y un ID real
   retorna 200 con precios en CLP).
4. `GET /api/products/filters` contiene las 26 categorías y los formatos del CSV,
   validados contra los grupos raíz reales de `data/catalog.csv`.
5. `GET /api/products/filters?category=Bebé` restringe formatos a la categoría
   (18 formatos, sin `"2 latas x 85 g"`; categoría desconocida → `[]`).
6. Robustez: `?page=-5`/`abc` → página 1; `?limit=9999` → 50; `/api/health` → 200 con
   `totalProducts 4032`; payloads maliciosos en `search`/`id` sin 500 ni `stack`;
   cabeceras `nosniff` / `DENY` / `strict-origin-when-cross-origin` presentes.

## Índice de evidencias

| # | Evidencia | Ruta | Estado |
|---|---|---|---|
| 1 | README del proyecto (este archivo) | `README.md` | ✅ completado |
| 2 | Especificación funcional y contrato API (§4.1–§4.5, `/api/health`) | `SPECIFICATION.md` | ✅ completado |
| 3 | Arquitectura + §7 Seguridad y Robustez | `ARCHITECTURE.md` | ✅ completado |
| 4 | Reglas del agente (filtros en cascada, XSS, validación, health) | `AGENTS.md` | ✅ completado |
| 5 | Suite de verificación del arnés (10 tests, `npm test` en verde) | `server/tests/api.test.js` | ✅ completado |


## Equipo

* Eynier Córdova https://github.com/blackwolf62
* Hans Schiess https://github.com/schiesscl
* Raúl Salas https://github.com/DevRSH
* Francisco Ocharan https://github.com/Looyo-coder
* Victoria Muñoz https://github.com/victoriamunozrobles-bot
* Benjamín Carmona https://github.com/Benj11ii
* Miguel Mora
* Isabel de la Cuadra https://github.com/Isabel-de-la-Cuadra
