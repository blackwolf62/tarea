import { readFile } from 'node:fs/promises';
import { parse } from 'csv-parse/sync';

export const PAGE_SIZE = 8;

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

function matchesFilters(product, { q, category, format }) {
  const query = q.trim().toLocaleLowerCase('es');
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

export function queryProducts(products, { q = '', category = '', format = '', page = 1 } = {}) {
  const filtered = products.filter((product) => matchesFilters(product, { q, category, format }));
  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const safePage = Math.min(Math.max(1, page), total === 0 ? 1 : totalPages);
  const start = (safePage - 1) * PAGE_SIZE;
  const items = filtered.slice(start, start + PAGE_SIZE);
  return {
    items,
    total,
    page: safePage,
    pageSize: PAGE_SIZE,
    totalPages: total === 0 ? 0 : totalPages,
  };
}

export function findProduct(products, id) {
  return products.find((product) => product.id === String(id)) ?? null;
}
