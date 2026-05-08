# AquaCare — RO Service Marketplace

A full-stack RO water purifier service platform with AI chatbot, technician dashboard, and transparent pricing.

## 📁 Structure

```
ro-marketplace/
├── backend/    ← Node.js + Express + Drizzle ORM
└── frontend/   ← React + Vite + Tailwind CSS
```

---

## ✅ Prerequisites

- Node.js v18+ → https://nodejs.org
- npm (comes with Node)
- A free PostgreSQL database from https://neon.tech

---

## 🚀 Setup — Backend

### 1. Install dependencies
```bash
cd backend
npm install
```

### 2. Create `.env` file
Copy `.env.example` to `.env` and fill in your values:
```bash
cp .env.example .env
```

Edit `.env`:
```
DATABASE_URL=postgresql://user:password@host/dbname?sslmode=require
JWT_SECRET=any-long-random-string-here
PORT=3000
NODE_ENV=development
```

Get your `DATABASE_URL` from https://neon.tech → your project → Connection Details.

### 3. Push database schema
```bash
npm run db:push
```

### 4. Add sample data
Open the Neon SQL Editor (neon.tech → your project → SQL Editor) and run:

```sql
INSERT INTO parts (name, category, min_price, max_price, description, is_active) VALUES
('Carbon Filter', 'filter', 450, 450, 'Removes chlorine and bad taste', true),
('Sediment Filter', 'filter', 450, 450, 'Removes dirt and rust', true),
('Membrane', 'membrane', 1250, 1650, 'Core RO filtration membrane', true),
('Spun Filter', 'filter', 150, 250, 'Pre-filter for large particles', true),
('Adapter', 'electrical', 750, 750, 'Power adapter for RO pump', true),
('Solenoid Valve', 'valve', 450, 450, 'Controls water flow', true),
('RO Pump', 'pump', 1650, 1850, 'Main pressure pump', true),
('Flow Resistor', 'valve', 100, 100, 'Regulates reject water flow', true),
('Tape', 'accessory', 100, 100, 'PTFE thread seal tape', true),
('UV Lamp', 'electrical', 350, 350, 'UV sterilization lamp', true),
('UV Adapter', 'electrical', 350, 350, 'UV lamp power adapter', true),
('Filter Kit', 'kit', 1050, 1050, 'Carbon + Sediment + Spun bundle', true),
('Full Kit', 'kit', 2250, 2250, 'Complete annual service kit', true);

INSERT INTO products (name, category, description, price, brand, rating, in_stock, features) VALUES
('Kent Grand Plus', 'ro_system', 'Best-selling 9L RO+UV+UF purifier', 14999, 'Kent', 4.5, true, '["9L tank","UV+UF","TDS controller"]'),
('Aquaguard Geneus', 'ro_system', 'Smart RO with active copper', 17999, 'Aquaguard', 4.3, true, '["8.5L tank","Active copper","Smart indicator"]'),
('HUL Pureit Eco Mineral', 'ro_system', 'Mineral RO with eco-recovery', 9999, 'Pureit', 4.2, true, '["10L tank","Mineral cartridge","7-stage"]'),
('Livpure Glo', 'ro_system', 'Affordable 7-stage purification', 7499, 'Livpure', 4.0, true, '["7L tank","7-stage RO","Auto shut-off"]');

INSERT INTO amc_plans (name, description, price, duration, services_included, features, is_active) VALUES
('Basic', 'Annual filter change + 1 service visit', 1499, 12, 1, '["1 service visit","Filter replacement","Phone support"]', true),
('Standard', '2 service visits + filter kit included', 2499, 12, 2, '["2 service visits","Filter kit included","Priority support"]', true),
('Premium', '3 service visits + full kit + priority support', 3999, 12, 3, '["3 service visits","Full kit included","24/7 support","Free emergency visit"]', true);
```

### 5. Start backend
```bash
npm run dev
```
Backend runs at http://localhost:3000
Test it: http://localhost:3000/api/health

---

## 🚀 Setup — Frontend

### 1. Install dependencies
```bash
cd frontend
npm install
```

### 2. Start frontend
```bash
npm run dev
```
Frontend runs at http://localhost:5173

> The Vite proxy forwards `/api` requests to `http://localhost:3000` automatically — no extra config needed.

---

## 🌐 Running Both Together

Open **two terminals**:

**Terminal 1:**
```bash
cd backend
npm run dev
```

**Terminal 2:**
```bash
cd frontend
npm run dev
```

Open http://localhost:5173 in your browser.

---

## 📦 Push to GitHub

```bash
# From the ro-marketplace root
git init
git add .
git commit -m "feat: RO marketplace initial commit"
git remote add origin https://github.com/YOUR_USERNAME/ro-marketplace.git
git branch -M main
git push -u origin main
```

---

## 🚀 Deployment

### Frontend → Vercel
1. Push to GitHub
2. Import repo on vercel.com
3. Set Root Directory: `frontend`
4. Build Command: `npm run build`
5. Output Directory: `dist`
6. Add env var: `VITE_API_URL` = your Railway backend URL

### Backend → Railway
1. Import repo on railway.app
2. Set Root Directory: `backend`
3. Add env vars: `DATABASE_URL`, `JWT_SECRET`, `PORT=3000`, `NODE_ENV=production`

---

## 🔑 API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /api/auth/register | Customer register |
| POST | /api/auth/login | Customer login |
| POST | /api/auth/technician/register | Tech register |
| POST | /api/auth/technician/login | Tech login |
| GET | /api/auth/users/me | Get profile |
| GET | /api/products | List products |
| GET | /api/parts | List parts + prices |
| GET | /api/amc-plans | List AMC plans |
| POST | /api/bookings | Create booking |
| GET | /api/bookings | User's bookings |
| POST | /api/bookings/:id/accept | Tech accepts job |
| PATCH | /api/bookings/:id/status | Update job status |
| POST | /api/bookings/:id/bill | Generate bill |
| GET | /api/bookings/technician/jobs | Tech job pool |
| GET | /api/bookings/technician/earnings | Tech earnings |
| GET | /api/technicians/nearby | Nearby technicians |
| PATCH | /api/technicians/me/availability | Toggle online |
| POST | /api/chat | AI chatbot message |
| GET | /api/chat/history | Chat history |
| GET | /api/health | Health check |
