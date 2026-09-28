import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import {
  findProduct,
  getFilters,
  loadCatalog,
  queryProducts,
} from "./catalog.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "../..");
const csvPath = path.join(rootDir, "data", "catalog.csv");
const mockupDir = path.join(rootDir, "mockup");
const PORT = Number(process.env.PORT) || 3000;

const app = express();
app.disable("x-powered-by");

// CORS + cabeceras básicas de seguridad (sin dependencias extra).
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  if (req.method === "OPTIONS") {
    res.sendStatus(204);
    return;
  }
  next();
});

app.use(express.json());

let products = [];
let loadError = null;

try {
  products = await loadCatalog(csvPath);
  console.log(`Catálogo cargado: ${products.length} productos`);
} catch (error) {
  loadError = error;
  console.error("No se pudo cargar catalog.csv", error);
}

function requireCatalog(_req, res, next) {
  if (loadError || products.length === 0) {
    res.status(500).json({ error: "No se pudo cargar el catálogo" });
    return;
  }
  next();
}

function pickString(value) {
  return typeof value === "string" ? value : "";
}

function filtersHandler(req, res) {
  // ?category= opcional: restringe los formatos a los de esa categoría
  // (filtros en cascada). Sin categoría, devuelve el listado general.
  res.json(
    getFilters(products, { category: pickString(req.query.category ?? "") }),
  );
}

app.get("/api/products/filters", requireCatalog, filtersHandler);

app.get("/api/meta", requireCatalog, filtersHandler);

// Salud: responde siempre 200 (no depende del catálogo) para monitoreo.
app.get("/api/health", (_req, res) => {
  res.json({
    status: "ok",
    totalProducts: products.length,
    timestamp: new Date().toISOString(),
  });
});

app.get("/api/products", requireCatalog, (req, res) => {
  // Aliases soportados:
  //  - búsqueda: ?search= (canónico pedido) y ?q= (mockup/SPEC)
  //  - tamaño:   ?limit= (pedido) y ?pageSize=, defecto 8, máx. 50
  //  - filtros reales del CSV: ?category= (grupo raíz) y ?format= (exacto)
  const search = pickString(req.query.search ?? req.query.q ?? "");
  const category = pickString(req.query.category ?? "");
  const format = pickString(req.query.format ?? "");
  const page = Number.parseInt(String(req.query.page ?? "1"), 10) || 1;
  const limitRaw = req.query.limit ?? req.query.pageSize ?? "8";
  const limit = Number.parseInt(String(limitRaw), 10) || 8;
  res.json(
    queryProducts(products, {
      q: search,
      search,
      category,
      format,
      page,
      limit,
    }),
  );
});

app.get("/api/products/:id", requireCatalog, (req, res) => {
  const product = findProduct(products, req.params.id);
  if (!product) {
    res.status(404).json({ error: "Producto no encontrado" });
    return;
  }
  res.json(product);
});

app.use(express.static(mockupDir));

// 404 JSON para rutas /api/* desconocidas (antes del manejador de errores).
app.use("/api", (_req, res) => {
  res.status(404).json({ error: "Recurso no encontrado" });
});

// Manejo seguro de errores: nunca exponer trazas internas al cliente.
app.use((err, _req, res, _next) => {
  console.error("Error no controlado:", err);
  res.status(500).json({ error: "Error interno del servidor" });
});

app.listen(PORT, () => {
  console.log(`PASO en http://localhost:${PORT}`);
});
