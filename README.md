# DFB Smart Shop

An AI-integrated e-commerce + inventory system for **DFB Glass and Aluminum
Supply** (glass, aluminum profiles, hardware, and screens; Pasig / Cainta,
Rizal). The shop owner manages stock, orders, promos, and settings; customers
browse, use AI visual search, get an instant size-based price quote, and place
orders (payment is arranged offline).

**Live:** https://dfbsupply.store

---

## Status — complete ✅

All five thesis objectives are functionally complete and the app runs entirely
on live cloud data (no mock data remains). It is deployed to Vercel on a custom
domain.

| Objective | Feature | State |
| --- | --- | --- |
| 1 | Responsive web UI (Store, Buyer, Admin) | ✅ |
| 2 | Client-side AI visual search (TensorFlow.js + MobileNet) | ✅ |
| 3 | Dynamic size-based pricing (deterministic formula) | ✅ |
| 4 | Real-time cloud data (Supabase) | ✅ |
| 5 | Smart recommendations (rule-based, admin-curated) | ✅ |

Plus: Supabase Auth (admin + buyer), guest checkout, order email via Resend, and
live delivery tracking (Supabase Realtime).

---

## Architecture

A **serverless web application**: there is no custom backend server. Data,
authentication, and file storage are handled by **Supabase**; the AI and pricing
logic run **entirely in the browser**; a single **Vercel** serverless function
sends transactional email via **Resend**.

| Layer | Technology | Responsibility |
| --- | --- | --- |
| Client / UI | React 19, Vite, MUI, TypeScript | Store, Buyer, and Admin interfaces (responsive) |
| Client AI | TensorFlow.js + MobileNet | In-browser visual search (photo → category → products) |
| Pricing | Deterministic JS formula | Size-based price estimate |
| Database / Auth / Storage | Supabase (PostgreSQL + RLS) | Products, orders, users, promos, recommendations, settings, notifications |
| Serverless logic | Vercel Functions (`/api`) | Secret-key operations (Resend email) |
| Email | Resend | Order notifications + Supabase Auth login codes (SMTP) |
| Hosting | Vercel | Static build + CDN + serverless functions |
| Domain / DNS | Namecheap | Domain registration and DNS records |

Full spec in [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

> **Note:** the earlier Firebase scaffolding in `backend/` and `database/` is
> **superseded** by the Supabase stack in `supabase/`. It is kept only for
> historical reference; the live system does not use Firebase.

```
dfb-smart-shop/
├── frontend/          # React + Vite + MUI app (this is the whole application)
│   ├── api/           #   Vercel serverless function — send-order-email.ts
│   └── src/
│       ├── pages/, sections/, layouts/, components/, theme/   UI
│       ├── services/db/    Supabase query/mutation functions + DB↔UI mappers
│       ├── services/ai/    MobileNet visual-search bridge
│       ├── auth/           Supabase Auth (sign-in/out, route guards)
│       ├── hooks/, routes/, locales/, utils/
│       └── lib/            Supabase client
│
├── supabase/          # PostgreSQL schema, RLS, RPCs, seed (the live data tier)
│   ├── migrations/    #   SQL migrations (incl. place_order, cancel_order RPCs)
│   ├── seed.sql, apply_all.sql
│   └── README.md      #   includes the ERD
│
├── docs/              # Architecture, navigation, deploy, testing guides
├── backend/, database/, ai/   # Legacy Firebase-era design docs (superseded)
```

---

## The interfaces

The app serves several interfaces from one codebase — see
[`docs/NAVIGATION.md`](docs/NAVIGATION.md) for the full route map.

| Interface | Who | Base path | Login |
| --- | --- | --- | --- |
| **Store** (public webshop) | Shoppers / guests | `/` | No |
| **Buyer app** | Registered customers | `/buyer` | Yes (customer) |
| **Admin back-office** | Owner / staff | `/admin` | Yes (admin only) |
| **Auth** | Sign-in / register / reset | `/login` | — |
| **Rider tracker** | Delivery rider (standalone) | `/track/:orderId` | Link-based |

---

## Run locally

```bash
cd frontend
yarn install
yarn dev        # http://localhost:3000
yarn build      # type-check + production build
```

Configure Supabase first: copy [`frontend/.env.example`](frontend/.env.example)
to `.env.local` and fill in `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`
from the Supabase dashboard. The app talks directly to the live Supabase project.

The `/api` email function does **not** run under `yarn dev` (plain Vite). To test
email locally, use `vercel dev` with a gitignored `.env` holding `RESEND_API_KEY`.

### Demo sign-in

| Role | URL | Email | Password |
| --- | --- | --- | --- |
| Admin (owner) | `/login/admin` | `owner@dfbsmartshop.com` | `admin1234` |
| Buyer | `/login` | `buyer@test.com` | `buyer1234` |
| Guest | `/` | — | — |

---

## Deploy

Deployed to **Vercel** with **Root Directory = `frontend`**; the Namecheap domain
points at Vercel and Resend sends order email. Step-by-step guide (env vars, DNS,
domain verification) in [`docs/DEPLOY.md`](docs/DEPLOY.md).

---

## Documentation

- Architecture & tech stack → [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)
- Project summary → [`docs/PROJECT-SUMMARY.md`](docs/PROJECT-SUMMARY.md)
- Route / navigation map → [`docs/NAVIGATION.md`](docs/NAVIGATION.md)
- Deployment → [`docs/DEPLOY.md`](docs/DEPLOY.md)
- Testing → [`docs/TESTING.md`](docs/TESTING.md)
- Live delivery tracking walkthrough → [`docs/TRACKER-WALKTHROUGH.md`](docs/TRACKER-WALKTHROUGH.md)
- Database schema & ERD → [`supabase/README.md`](supabase/README.md)
