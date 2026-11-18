# Inventory and Warehouse Management Backend

Node.js, Express, MongoDB/Mongoose, JWT, bcrypt, and ImageKit backend for the inventory warehouse project.

## Setup

1. Copy `Backend/.env.example` to `Backend/.env`.
2. Set `MONGODB_URI`, `JWT_SECRET`, and the ImageKit credentials.
3. Install dependencies and start the backend:

```powershell
cd Backend
npm install
npm run dev
```

The API runs at `http://localhost:3000`.

For the Vite frontend, copy `Frontend/.env.example` to `Frontend/.env` and set `VITE_API_URL` to the backend deployment URL. The backend CORS configuration allows `https://warehouse-d6el.vercel.app`; if you change the frontend domain, update `FRONTEND_URL` in the backend deployment environment. In Vercel, configure `MONGODB_URI` and `JWT_SECRET` as project environment variables, and ensure MongoDB Atlas network access permits connections from the deployed backend.

## First admin account

Public registration cannot create admins. From an interactive terminal, run `npm run create-admin` in `Backend`. The command uses `Backend/.env`, asks for the admin’s name and email, and reads the password without echoing it. It can create an admin or promote an existing account; it refuses to run if an admin already exists. Make sure `MONGODB_URI` points to the same database used by the deployed backend, then sign in through the frontend.

## Authentication

Send login responses with:

```http
Authorization: Bearer <token>
```

Public registration creates only `warehouseManager`, `supplier`, or `salesRepresentative` accounts. Admin accounts and role assignments must be created or changed by an admin.

## Main API groups

- `/api/auth`
- `/api/users`
- `/api/products`
- `/api/warehouses`
- `/api/stock`, `/api/stock/in`, `/api/stock/out`, `/api/stock/low`
- `/api/transactions`
- `/api/orders`
- `/api/supply-requests`
- `/api/upload/auth`
- `/api/dashboard/stats`

Set product and supplier image fields only from successful ImageKit uploads. Never expose or commit the ImageKit private key.
