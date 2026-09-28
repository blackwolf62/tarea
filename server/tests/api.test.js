import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { categoryGroup, loadCatalog } from '../src/catalog.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..', '..');
const csvPath = path.join(rootDir, 'data', 'catalog.csv');

const PORT = Number(process.env.TEST_PORT) || 3221;
const BASE = `http://localhost:${PORT}`;

let server = null;

async function fetchJSON(url, options) {
  const res = await fetch(url, options);
  const body = await res.json().catch(() => ({}));
  return { res, body };
}

async function waitForServer({ tries = 40, delayMs = 250 } = {}) {
  let lastError = null;
  for (let i = 0; i < tries; i += 1) {
    try {
      const res = await fetch(`${BASE}/api/products?limit=1`);
      if (res.ok) return;
      lastError = new Error(`HTTP ${res.status}`);
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }
  throw new Error(`El backend no arrancó en ${BASE}: ${lastError?.message}`);
}

before(async () => {
  server = spawn('node', ['src/index.js'], {
    cwd: path.join(rootDir, 'server'),
    env: { ...process.env, PORT: String(PORT) },
    stdio: 'ignore',
  });
  await waitForServer();
});

after(async () => {
  if (server && !server.killed) {
    server.kill('SIGTERM');
    await new Promise((resolve) => setTimeout(resolve, 500));
    if (!server.killed) server.kill('SIGKILL');
  }
});

describe('API catálogo PASO (retroalimentación del arnés)', () => {
  it('GET /api/products pagina y NO devuelve los 4.000 items juntos', async () => {
    const { res, body } = await fetchJSON(`${BASE}/api/products`);
    assert.equal(res.status, 200);
    assert.equal(body.total, 4032);
    assert.equal(body.page, 1);
    assert.equal(body.pageSize, 8);
    assert.equal(body.totalPages, 504);
    assert.equal(body.items.length, 8);
    // Clave del test: paginado, no volcado completo
    assert.ok(
      body.items.length < body.total,
      `items (${body.items.length}) debe ser < total (${body.total})`,
    );

    const page1 = await fetchJSON(`${BASE}/api/products?limit=5&page=1`);
    assert.equal(page1.res.status, 200);
    assert.equal(page1.body.page, 1);
    assert.equal(page1.body.pageSize, 5);
    assert.equal(page1.body.items.length, 5);

    const page2 = await fetchJSON(`${BASE}/api/products?limit=5&page=2`);
    assert.equal(page2.res.status, 200);
    assert.equal(page2.body.page, 2);
    assert.equal(page2.body.pageSize, 5);
    assert.equal(page2.body.items.length, 5);
    const idsPage1 = new Set(page1.body.items.map((p) => p.id));
    for (const item of page2.body.items) {
      assert.ok(!idsPage1.has(item.id), `id ${item.id} repetido entre páginas`);
    }
  });

  it('GET /api/products?search= filtra resultados reales', async () => {
    const { res, body } = await fetchJSON(`${BASE}/api/products?search=chocolate&limit=10`);
    assert.equal(res.status, 200);
    assert.ok(body.total > 0, 'la búsqueda debe encontrar resultados');
    assert.ok(body.total < 4032, 'la búsqueda debe reducir el total');
    assert.ok(body.items.length > 0);
    for (const item of body.items) {
      assert.ok(
        item.name.toLocaleLowerCase('es').includes('chocolate'),
        `“${item.name}” no contiene “chocolate”`,
      );
    }

    // Alias ?q= (mockup/SPEC) debe comportarse igual
    const alias = await fetchJSON(`${BASE}/api/products?q=chocolate&limit=10`);
    assert.equal(alias.body.total, body.total);

    // Búsqueda sin coincidencias → vacío explícito, no error
    const empty = await fetchJSON(`${BASE}/api/products?search=zzzsincoincidencia`);
    assert.equal(empty.body.total, 0);
    assert.deepEqual(empty.body.items, []);
  });

  it('GET /api/products/:id con ID inválido retorna 404', async () => {
    const res = await fetch(`${BASE}/api/products/NOEXISTE-XYZ-999`);
    assert.equal(res.status, 404);
    const body = await res.json();
    assert.ok(body.error, 'el 404 debe incluir { error }');

    // Contrapartida: un ID real sí retorna 200 con precios CLP
    const ok = await fetchJSON(`${BASE}/api/products/10043`);
    assert.equal(ok.res.status, 200);
    assert.equal(ok.body.id, '10043');
    assert.equal(ok.body.currency, 'CLP');
    assert.equal(typeof ok.body.price, 'number');
  });

  it('GET /api/products/filters contiene categorías existentes en el CSV', async () => {
    const { res, body } = await fetchJSON(`${BASE}/api/products/filters`);
    assert.equal(res.status, 200);
    assert.ok(Array.isArray(body.categories), 'categories debe ser array');
    assert.ok(Array.isArray(body.formats), 'formats debe ser array');
    assert.equal(body.categories.length, 26);
    assert.ok(body.categories.includes('Bodega'));
    assert.ok(body.formats.includes('Botella'));

    // Verificación contra el CSV real: cada categoría del endpoint
    // debe existir como grupo raíz en data/catalog.csv
    const products = await loadCatalog(csvPath);
    assert.equal(products.length, 4032);
    const groupsInCsv = new Set(products.map((p) => categoryGroup(p.category)));
    for (const category of body.categories) {
      assert.ok(
        groupsInCsv.has(category),
        `categoría “${category}” no existe en el CSV`,
      );
    }
  });

  it('GET /api/products/filters?category= restringe formatos a la categoría (cascada)', async () => {
    const all = await fetchJSON(`${BASE}/api/products/filters`);
    assert.equal(all.res.status, 200);

    const scoped = await fetchJSON(
      `${BASE}/api/products/filters?category=${encodeURIComponent('Bebé')}`,
    );
    assert.equal(scoped.res.status, 200);
    // Las categorías siguen disponibles; los formatos se restringen
    assert.deepEqual(scoped.body.categories, all.body.categories);
    assert.ok(scoped.body.formats.length > 0, 'Bebé debe tener formatos');
    assert.ok(
      scoped.body.formats.length < all.body.formats.length,
      'los formatos deben restringirse a la categoría',
    );
    // Caso del reporte: "2 latas x 85 g" es ajeno a Bebé → no aparece
    assert.ok(!scoped.body.formats.includes('2 latas x 85 g'));

    // Cada formato existe en productos reales de Bebé del CSV
    const products = await loadCatalog(csvPath);
    const bebeFormats = new Set(
      products
        .filter((p) => categoryGroup(p.category) === 'Bebé')
        .map((p) => p.format),
    );
    assert.deepEqual([...scoped.body.formats].sort(), [...bebeFormats].sort());

    // Categoría desconocida → formatos vacíos, sin error
    const unknown = await fetchJSON(
      `${BASE}/api/products/filters?category=${encodeURIComponent('NoExiste')}`,
    );
    assert.equal(unknown.res.status, 200);
    assert.deepEqual(unknown.body.formats, []);
  });
});

describe('API catálogo PASO (seguridad y robustez)', () => {
  it('page negativo o inválido se normaliza a página 1', async () => {
    for (const page of ['-5', '0', 'abc', '']) {
      const { res, body } = await fetchJSON(`${BASE}/api/products?page=${page}&limit=5`);
      assert.equal(res.status, 200);
      assert.equal(body.page, 1, `?page=${page} debe normalizarse a 1`);
    }
  });

  it('limit=9999 se topa en 50', async () => {
    const { res, body } = await fetchJSON(`${BASE}/api/products?limit=9999`);
    assert.equal(res.status, 200);
    assert.equal(body.pageSize, 50);
    assert.equal(body.limit, 50);
    assert.equal(body.items.length, 50);
  });

  it('GET /api/health responde 200 con el estado del catálogo', async () => {
    const { res, body } = await fetchJSON(`${BASE}/api/health`);
    assert.equal(res.status, 200);
    assert.equal(body.status, 'ok');
    assert.equal(body.totalProducts, 4032);
    assert.ok(body.timestamp, 'debe incluir timestamp');
    assert.ok(!Number.isNaN(Date.parse(body.timestamp)), 'timestamp debe ser ISO válido');
  });

  it('payload malicioso en search o id no genera un 500 no controlado', async () => {
    const xss = '<script>alert("xss")</script>';
    const evil = await fetchJSON(`${BASE}/api/products?search=${encodeURIComponent(xss)}`);
    assert.equal(evil.res.status, 200);
    assert.ok(Array.isArray(evil.body.items));

    const long = await fetchJSON(`${BASE}/api/products?search=${'a'.repeat(500)}`);
    assert.equal(long.res.status, 200);
    assert.ok(Array.isArray(long.body.items));

    const evilId = await fetch(`${BASE}/api/products/${encodeURIComponent('<img src=x onerror=alert(1)>')}`);
    assert.equal(evilId.status, 404);
    const evilIdBody = await evilId.json();
    assert.ok(evilIdBody.error);
    assert.ok(!JSON.stringify(evilIdBody).includes('stack'), 'sin trazas internas');
  });

  it('respuestas API incluyen cabeceras básicas de seguridad', async () => {
    const res = await fetch(`${BASE}/api/products?limit=1`);
    assert.equal(res.status, 200);
    assert.equal(res.headers.get('x-content-type-options'), 'nosniff');
    assert.equal(res.headers.get('x-frame-options'), 'DENY');
    assert.equal(res.headers.get('referrer-policy'), 'strict-origin-when-cross-origin');
  });
});
