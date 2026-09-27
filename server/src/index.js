import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { findProduct, getMeta, loadCatalog, queryProducts } from './catalog.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '../..');
const csvPath = path.join(rootDir, 'data', 'catalog.csv');
const mockupDir = path.join(rootDir, 'mockup');
const PORT = Number(process.env.PORT) || 3000;

const app = express();
let products = [];
let loadError = null;

try {
  products = await loadCatalog(csvPath);
  console.log(`Catálogo cargado: ${products.length} productos`);
} catch (error) {
  loadError = error;
  console.error('No se pudo cargar catalog.csv', error);
}

function requireCatalog(_req, res, next) {
  if (loadError || products.length === 0) {
    res.status(500).json({ error: 'No se pudo cargar el catálogo' });
    return;
  }
  next();
}

app.get('/api/meta', requireCatalog, (_req, res) => {
  res.json(getMeta(products));
});

app.get('/api/products', requireCatalog, (req, res) => {
  const q = typeof req.query.q === 'string' ? req.query.q : '';
  const category = typeof req.query.category === 'string' ? req.query.category : '';
  const format = typeof req.query.format === 'string' ? req.query.format : '';
  const page = Number.parseInt(String(req.query.page ?? '1'), 10) || 1;
  res.json(queryProducts(products, { q, category, format, page }));
});

app.get('/api/products/:id', requireCatalog, (req, res) => {
  const product = findProduct(products, req.params.id);
  if (!product) {
    res.status(404).json({ error: 'Producto no encontrado' });
    return;
  }
  res.json(product);
});

app.use(express.static(mockupDir));

app.listen(PORT, () => {
  console.log(`PASO en http://localhost:${PORT}`);
});
