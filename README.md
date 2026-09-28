# Vitrina de productos

Aplicación web desarrollada para el **Desafío Full Stack — Etapa 1: Construir una vitrina de productos con ayuda de agentes de IA**.

El proyecto permite explorar un catálogo de **4.032 productos de supermercado**, utilizando una API propia para realizar búsquedas, filtros y paginación desde el backend.

## Equipo

* Eynier Córdova https://github.com/blackwolf62
* Hans Schiess https://github.com/schiesscl
* Raúl Salas https://github.com/DevRSH
* Francisco Ocharan https://github.com/Looyo-coder
* Victoria Muñoz https://github.com/victoriamunozrobles-bot
* Benjamín Carmona https://github.com/Benj11ii,
* Miguel Mora
* Isabel de la Cuadra https://github.com/Isabel-de-la-Cuadra

## Funcionalidades

La aplicación permite:

* Visualizar productos mediante cards.
* Ver imagen, nombre, categoría, formato y precio.
* Buscar productos por nombre.
* Filtrar productos por categoría y formato.
* Avanzar y retroceder entre páginas de resultados.
* Seleccionar un producto y consultar su información completa.
* Visualizar estados de carga, sin resultados y error.
* Consultar el catálogo mediante una API propia.

La búsqueda, los filtros y la paginación se procesan en el **backend**.

## Tecnologías

### Frontend

* HTML
* CSS
* JavaScript

### Backend

* Node.js
* Express
* csv-parse

### Datos

* `data/catalog.csv`
* 4.032 productos.
* Los datos mostrados corresponden a la información disponible en el catálogo entregado para el desafío.

## Uso de IA

El proyecto fue desarrollado con apoyo de **agentes de inteligencia artificial**, de acuerdo con la modalidad propuesta para este desafío.

La carpeta `.cursor/` contiene recursos de planificación utilizados durante el proceso de desarrollo asistido por IA.

## Estructura del proyecto

```text
tarea/
├── .cursor/       # Planificación y recursos utilizados durante el desarrollo con IA
├── data/          # Catálogo y documentación de los datos
├── mockup/        # Interfaz y recursos del proyecto
└── server/        # API y lógica de procesamiento del catálogo
```

## Requisitos

* Node.js
* npm

## Instalación

Clonar el repositorio:

```bash
git clone https://github.com/blackwolf62/tarea.git
cd tarea
```

Instalar las dependencias del servidor:

```bash
cd server
npm install
```

## Ejecución

Desde la carpeta `server`:

```bash
npm start
```

Luego abrir en el navegador:

```text
http://localhost:3000
```

## API

La aplicación utiliza una API REST propia.

### Productos

```text
GET /api/products
```

Permite consultar productos y admite los siguientes parámetros:

| Parámetro  | Descripción          |
| ---------- | -------------------- |
| `q`        | Búsqueda por nombre  |
| `category` | Filtro por categoría |
| `format`   | Filtro por formato   |
| `page`     | Número de página     |

Ejemplo:

```text
/api/products?q=leche&page=1
```

### Detalle de producto

```text
GET /api/products/:id
```

Permite obtener la información completa de un producto.

### Metadatos

```text
GET /api/meta
```

Entrega información utilizada para construir los filtros disponibles.

## Datos

El catálogo utilizado corresponde al archivo `data/catalog.csv` entregado como parte del desafío.

La aplicación utiliza únicamente la información disponible en estos datos y no completa campos mediante valores inventados.

## Estados de la interfaz

La aplicación contempla tres estados alternativos:

* **Cargando:** mientras se obtiene información desde la API.
* **Sin resultados:** cuando la búsqueda o los filtros no encuentran productos.
* **Error:** cuando se produce un problema al consultar la API, ofreciendo la posibilidad de reintentar.

## Alcance

El proyecto implementa las funcionalidades solicitadas para la **Etapa 1** del desafío.

No forman parte de esta etapa:

* Carrito de compra.
* Compra de productos.
* Pagos.
* Administración de productos.


