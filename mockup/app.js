const grid = document.querySelector('#product-grid');
const search = document.querySelector('#search');
const categoryFilter = document.querySelector('#category-filter');
const formatFilter = document.querySelector('#format-filter');
const resultCount = document.querySelector('#result-count');
const dialog = document.querySelector('#product-dialog');
const pagination = document.querySelector('#pagination');
const pagePrev = document.querySelector('#page-prev');
const pageNext = document.querySelector('#page-next');
const pageNumbers = document.querySelector('#page-numbers');

const PAGE_SIZE = 8;

const state = {
  q: '',
  category: '',
  format: '',
  page: 1,
  total: 0,
  totalPages: 0,
  items: [],
  loading: false,
  error: null,
};

const PLANTILLAS = {
  cargando: `
    <div class="inline-state">
      <span class="state-icon spinner" aria-hidden="true"></span>
      <strong>Cargando productos</strong>
      <p>Espera mientras consultamos el catálogo.</p>
    </div>`,
  vacio: `
    <div class="inline-state empty">
      <span class="state-icon" aria-hidden="true">⌕</span>
      <strong>Sin resultados</strong>
      <p>Prueba con otra búsqueda o elimina algunos filtros.</p>
      <button type="button" data-action="clear">Limpiar filtros</button>
    </div>`,
  error: `
    <div class="inline-state error">
      <span class="state-icon" aria-hidden="true">!</span>
      <strong>No pudimos cargar el catálogo</strong>
      <p>Inténtalo nuevamente en unos momentos.</p>
      <button type="button" data-action="retry">Reintentar</button>
    </div>`,
};

function formatPrice(value, currency) {
  return new Intl.NumberFormat('es-CL', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(value);
}

function categoryGroup(category) {
  return category.split(' > ')[0];
}

function formatCount(value) {
  return new Intl.NumberFormat('es-CL').format(value);
}

function productCard(product) {
  return `
    <article class="product-card">
      <button class="card-button" type="button" data-product-id="${product.id}" aria-label="Ver detalle de ${product.name}">
        <span class="image-wrap">
          <img src="${product.image}" alt="" />
          <span class="card-index">#${product.id}</span>
        </span>
        <span class="card-copy">
          <span class="card-type">${categoryGroup(product.category)}</span>
          <strong>${product.name}</strong>
          <span class="card-meta">${product.format} <i>•</i> ${formatPrice(product.price, product.currency)}</span>
          <span class="view-link">Ver detalle <span aria-hidden="true">→</span></span>
        </span>
      </button>
    </article>`;
}

function fillSelect(select, values, placeholder) {
  const current = select.value;
  select.innerHTML = `<option value="">${placeholder}</option>` +
    values.map((value) => `<option value="${value.replaceAll('"', '&quot;')}">${value}</option>`).join('');
  if (values.includes(current)) select.value = current;
}

function pageItems(current, totalPages) {
  if (totalPages <= 0) return [];
  if (totalPages <= 5) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }
  const items = new Set([1, totalPages, current]);
  if (current > 1) items.add(current - 1);
  if (current < totalPages) items.add(current + 1);
  if (current <= 3) {
    items.add(2);
    items.add(3);
  }
  if (current >= totalPages - 2) {
    items.add(totalPages - 1);
    items.add(totalPages - 2);
  }
  const sorted = [...items].filter((n) => n >= 1 && n <= totalPages).sort((a, b) => a - b);
  const result = [];
  for (let i = 0; i < sorted.length; i += 1) {
    if (i > 0 && sorted[i] - sorted[i - 1] > 1) result.push('ellipsis');
    result.push(sorted[i]);
  }
  return result;
}

function renderPagination() {
  const { page, totalPages, loading, error, total } = state;
  if (loading || error || total === 0 || totalPages <= 1) {
    pagination.hidden = true;
    pageNumbers.innerHTML = '';
    pagePrev.disabled = true;
    pageNext.disabled = true;
    return;
  }

  pagination.hidden = false;
  pagePrev.disabled = page <= 1;
  pageNext.disabled = page >= totalPages;
  pageNumbers.innerHTML = pageItems(page, totalPages)
    .map((item) => {
      if (item === 'ellipsis') return '<span aria-hidden="true">…</span>';
      const active = item === page ? ' class="active"' : '';
      return `<button type="button" data-page="${item}"${active} ${item === page ? 'aria-current="page"' : ''}>${item}</button>`;
    })
    .join('');
}

function renderGrid() {
  if (state.loading) {
    grid.innerHTML = PLANTILLAS.cargando;
    resultCount.textContent = 'Cargando catálogo…';
    renderPagination();
    return;
  }
  if (state.error) {
    grid.innerHTML = PLANTILLAS.error;
    resultCount.textContent = 'No se pudo cargar el catálogo';
    renderPagination();
    return;
  }
  if (state.total === 0) {
    grid.innerHTML = PLANTILLAS.vacio;
    resultCount.textContent = 'Mostrando 0 productos';
    renderPagination();
    return;
  }

  grid.innerHTML = state.items.map(productCard).join('');
  const start = (state.page - 1) * PAGE_SIZE + 1;
  const end = start + state.items.length - 1;
  resultCount.textContent = `Mostrando ${formatCount(start)}-${formatCount(end)} de ${formatCount(state.total)}`;
  renderPagination();
}

async function fetchJSON(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  return response.json();
}

async function loadMeta() {
  const meta = await fetchJSON('/api/meta');
  fillSelect(categoryFilter, meta.categories, 'Todas las categorías');
  fillSelect(formatFilter, meta.formats, 'Todos los formatos');
}

async function loadProducts() {
  state.loading = true;
  state.error = null;
  renderGrid();

  const params = new URLSearchParams();
  if (state.q) params.set('q', state.q);
  if (state.category) params.set('category', state.category);
  if (state.format) params.set('format', state.format);
  params.set('page', String(state.page));

  try {
    const data = await fetchJSON(`/api/products?${params}`);
    state.items = data.items;
    state.total = data.total;
    state.page = data.page;
    state.totalPages = data.totalPages;
    state.loading = false;
    renderGrid();
  } catch (error) {
    state.error = error;
    state.items = [];
    state.total = 0;
    state.totalPages = 0;
    state.loading = false;
    renderGrid();
  }
}

function openDetail(product) {
  document.querySelector('#detail-id').textContent = `PRODUCTO #${product.id}`;
  document.querySelector('#detail-title').textContent = product.name;
  document.querySelector('#detail-description').textContent = product.description;
  const image = document.querySelector('#detail-image');
  image.src = product.image;
  image.alt = product.name;

  const values = [
    ['Categoría', product.category],
    ['Formato', product.format],
    ['Unidad de precio', product.priceUnit],
    ['Identificador', product.id],
  ];
  document.querySelector('#detail-list').innerHTML = values
    .map(([label, value]) => `<div><dt>${label}</dt><dd>${value}</dd></div>`)
    .join('');

  document.querySelector('#detail-price').textContent = formatPrice(product.price, product.currency);
  document.querySelector('#detail-currency').textContent = `Moneda: ${product.currency}`;
  document.querySelector('#detail-original-price').textContent = `Precio original: ${formatPrice(product.originalPrice, product.currency)}`;
  document.querySelector('#detail-extracted-at').textContent = `Datos extraídos: ${product.extractedAt}`;
  document.querySelector('#detail-source').href = product.productUrl;
  dialog.showModal();
}

function applyFiltersFromControls({ resetPage = true } = {}) {
  state.q = search.value.trim();
  state.category = categoryFilter.value;
  state.format = formatFilter.value;
  if (resetPage) state.page = 1;
  loadProducts();
}

function clearFilters() {
  search.value = '';
  categoryFilter.value = '';
  formatFilter.value = '';
  applyFiltersFromControls();
}

grid.addEventListener('click', async (event) => {
  const actionButton = event.target.closest('[data-action]');
  if (actionButton) {
    if (actionButton.dataset.action === 'clear') clearFilters();
    if (actionButton.dataset.action === 'retry') {
      loadMeta().catch(() => {});
      loadProducts();
    }
    return;
  }

  const button = event.target.closest('[data-product-id]');
  if (!button) return;
  const fromPage = state.items.find((item) => item.id === button.dataset.productId);
  if (fromPage) {
    openDetail(fromPage);
    return;
  }
  try {
    const product = await fetchJSON(`/api/products/${encodeURIComponent(button.dataset.productId)}`);
    openDetail(product);
  } catch {
    state.error = new Error('detail');
    renderGrid();
  }
});

document.querySelector('#dialog-close').addEventListener('click', () => dialog.close());
dialog.addEventListener('click', (event) => { if (event.target === dialog) dialog.close(); });

[search, categoryFilter, formatFilter].forEach((control) => {
  control.addEventListener('input', () => applyFiltersFromControls());
});

pagePrev.addEventListener('click', () => {
  if (state.page <= 1) return;
  state.page -= 1;
  loadProducts();
});

pageNext.addEventListener('click', () => {
  if (state.page >= state.totalPages) return;
  state.page += 1;
  loadProducts();
});

pageNumbers.addEventListener('click', (event) => {
  const button = event.target.closest('[data-page]');
  if (!button) return;
  const nextPage = Number(button.dataset.page);
  if (!nextPage || nextPage === state.page) return;
  state.page = nextPage;
  loadProducts();
});

async function boot() {
  state.loading = true;
  renderGrid();
  try {
    await loadMeta();
    await loadProducts();
  } catch (error) {
    state.loading = false;
    state.error = error;
    renderGrid();
  }
}

boot();
