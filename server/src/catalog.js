import { readFile } from 'node:fs/promises';
import { parse } from 'csv-parse/sync';

export const PAGE_SIZE = 8;
export const DEFAULT_PAGE_SIZE = 8;
export const MAX_PAGE_SIZE = 50;
export const MAX_SEARCH_LENGTH = 100;

export function categoryGroup(category) {
  return String(category ?? '').split(' > ')[0];
}

function toProduct(row) {
  return {
    id: String(row.id ?? ''),
    name: row.name ?? '',
    description: row.description ?? '',
    format: row.format ?? '',
    category: row.category ?? '',
    price: Number(row.price),
    priceUnit: row.priceUnit ?? '',
    originalPrice: Number(row.originalPrice),
    currency: row.currency ?? 'CLP',
    productUrl: row.productUrl ?? '',
    extractedAt: row.extractedAt ?? '',
    image: row.imageUrl ?? '',
  };
}

export async function loadCatalog(csvPath) {
  const raw = await readFile(csvPath, 'utf8');
  const rows = parse(raw, {
    columns: true,
    skip_empty_lines: true,
    relax_quotes: true,
    relax_column_count: true,
  });
  return rows.map(toProduct).filter((product) => product.id);
}

// Sanitización de entrada (fuente única de verdad para los query params):
// - search: trim + tope de 100 caracteres (evita payloads abusivos).
// - page: entero >= 1 (defecto 1); inválidos/negativos → 1.
// - limit: entero 1–50 (defecto 8); > 50 se topa en 50.
export function sanitizeSearch(value) {
  return String(value ?? '').trim().slice(0, MAX_SEARCH_LENGTH);
}

function matchesFilters(product, { q, search, category, format }) {
  const rawQuery = search ?? q ?? '';
  const query = String(rawQuery).trim().toLocaleLowerCase('es');
  const matchesQuery = !query || product.name.toLocaleLowerCase('es').includes(query);
  const matchesCategory = !category || categoryGroup(product.category) === category;
  const matchesFormat = !format || product.format === format;
  return matchesQuery && matchesCategory && matchesFormat;
}

export function getMeta(products) {
  const categories = new Set();
  const formats = new Set();
  for (const product of products) {
    const group = categoryGroup(product.category);
    if (group) categories.add(group);
    if (product.format) formats.add(product.format);
  }
  const collator = new Intl.Collator('es', { sensitivity: 'base' });
  return {
    categories: [...categories].sort(collator.compare),
    formats: [...formats].sort(collator.compare),
  };
}

// Filtros en cascada: con `category` se restringen los formatos a los que
// existen dentro de esa categoría. Las categorías se devuelven siempre
// completas para no colapsar el selector de categoría del frontend.
// Sin categoría (o con una desconocida) el comportamiento es el general.
export function getFilters(products, { category = '' } = {}) {
  const full = getMeta(products);
  const wanted = String(category ?? '').trim();
  if (!wanted) return full;
  const formats = new Set();
  for (const product of products) {
    if (categoryGroup(product.category) === wanted && product.format) {
      formats.add(product.format);
    }
  }
  const collator = new Intl.Collator('es', { sensitivity: 'base' });
  return {
    categories: full.categories,
    formats: [...formats].sort(collator.compare),
  };
}

export function normalizePagination({ page = 1, limit, pageSize } = {}) {
  const parsedPage = Number.parseInt(String(page ?? '1'), 10);
  const safePage = Number.isFinite(parsedPage) && parsedPage >= 1 ? parsedPage : 1;
  const rawSize = limit ?? pageSize ?? DEFAULT_PAGE_SIZE;
  const parsedSize = Number.parseInt(String(rawSize), 10);
  const safeSize = Number.isFinite(parsedSize)
    ? Math.min(Math.max(parsedSize, 1), MAX_PAGE_SIZE)
    : DEFAULT_PAGE_SIZE;
  return { page: safePage, pageSize: safeSize };
}

export function queryProducts(
  products,
  { q = '', search = '', category = '', format = '', page = 1, limit, pageSize } = {},
) {
  const effectiveQuery = sanitizeSearch(search || q || '');
  const { page: requestedPage, pageSize: effectivePageSize } = normalizePagination({
    page,
    limit,
    pageSize,
  });
  const filtered = products.filter((product) =>
    matchesFilters(product, { q: effectiveQuery, category, format }),
  );
  const total = filtered.length;
  const totalPages = total === 0 ? 0 : Math.ceil(total / effectivePageSize);
  const safePage = total === 0 ? 1 : Math.min(Math.max(1, requestedPage), totalPages);
  const start = (safePage - 1) * effectivePageSize;
  const items = filtered.slice(start, start + effectivePageSize);
  return {
    items,
    total,
    page: safePage,
    pageSize: effectivePageSize,
    // Alias para consumidores que esperan `limit` en la respuesta
    limit: effectivePageSize,
    totalPages,
  };
}

export function findProduct(products, id) {
  return products.find((product) => product.id === String(id)) ?? null;
}
