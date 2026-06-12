# Ishlab chiqarish nazorati

Manufacturing dashboard with 3 modules: Cards, Products, Warehouse.

## Setup

```bash
cd backend
npm install
cp .env.example .env
# Edit .env: set PORT, JWT_SECRET, ADMIN_PASSWORD
npm run dev
```

Open http://localhost:3000

## Login

- Username: `admin`
- Password: value of `ADMIN_PASSWORD` in `.env`

## Switching data source

In `.env`:

```
DATA_SOURCE=mock    # uses backend/src/data/mock/*.json
DATA_SOURCE=mysql   # uses mysql.service.js (requires DB_* vars set)
```

## DB vars (only needed for mysql mode)

```
DB_HOST=
DB_PORT=3306
DB_USER=
DB_PASSWORD=
DB_NAME=
```
