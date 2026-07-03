# DFB Smart Shop — Navigation Guide

Live site: **https://dfbsupply.store**

The app has **four interfaces**, each with its own layout and login rules:

| Interface | Who it's for | Base path | Login required |
| --- | --- | --- | --- |
| **Store** | Public shoppers / guests | `/` | No |
| **Buyer app** | Registered customers | `/buyer` | Yes (customer) |
| **Admin back-office** | Shop owner / staff | `/admin` | Yes (admin only) |
| **Auth** | Sign-in / register / reset | `/login` | — |
| **Rider tracker** | Delivery rider (standalone) | `/track/<orderId>` | No (link-based) |

Sign-in accounts (see [TESTING.md](TESTING.md)):

| Role | URL | Email | Password |
| --- | --- | --- | --- |
| Admin (owner) | `/login/admin` | `owner@dfbsmartshop.com` | `admin1234` |
| Buyer | `/login` | `buyer@test.com` | `buyer1234` |
| Guest | `/` | — | — |

---

## 1. Store (public webshop) — mounted at `/`

Uses the store layout with a top navigation bar. No login needed to browse or
order as a guest.

| Page | Path | What's there |
| --- | --- | --- |
| Home | `/` | Landing page, featured products, entry points |
| Catalog | `/catalog` | All visible products (out-of-stock shown, hidden items not) |
| Product detail | `/product/:id` | Product info, **size-based price calculator**, recommendations |
| Quote | `/quote` | Request/estimate flow |
| Visual search | `/visual-search` | **AI photo search** — upload/camera, matches items in-browser |
| Cart | `/cart` | Cart items + "You might also need" suggestions |
| Checkout | `/checkout` | Recipient details, delivery/pickup, submit order |
| Order confirmed | `/order-confirmed` | Confirmation with order number `#DFB-####` |
| About | `/about` | Company info |
| Contact | `/contact` | Contact details |

**Typical guest flow:** `/catalog` → `/product/:id` (calculate price) → `/cart`
→ `/checkout` → `/order-confirmed`.

---

## 2. Buyer app (customer account) — under `/buyer`

Mobile-style app with a **bottom tab bar** (Home / Orders / Alerts / Profile).
Requires a customer login; unauthenticated visits redirect to `/login`.

| Page | Path | Tab | What's there |
| --- | --- | --- | --- |
| Home | `/buyer` | Home | Personalized dashboard |
| My Orders | `/buyer/orders` | Orders | This customer's orders only (RLS-scoped) |
| Order detail | `/buyer/orders/:id` | — | Status, **live delivery tracking**, timeline, items, price, reorder/cancel |
| Notifications | `/buyer/notifications` | Alerts | Personal notifications + mark-read |
| Profile | `/buyer/profile` | Profile | Personal details, save changes |

**Delivery tracking** lives on the order detail page (`/buyer/orders/:id`) for
**delivery** orders — see [TRACKER-WALKTHROUGH.md](TRACKER-WALKTHROUGH.md).

---

## 3. Admin back-office (owner) — under `/admin`

Dashboard layout with a **collapsible sidebar**. Admin-only: non-admin accounts
are rejected even if signed in.

| Page | Path | What's there |
| --- | --- | --- |
| Dashboard | `/admin` | KPIs / overview |
| Orders | `/admin/orders` | All orders, filter/search |
| Order detail | `/admin/orders/:id` | Items + price breakdown, **status update**, confirmed amount, staff note, **Open Rider Tracking**, print slip |
| Inventory | `/admin/inventory` | Product list, stock, visibility |
| Add product | `/admin/inventory/new` | Create a product |
| Edit product | `/admin/inventory/:id/edit` | Edit a product |
| Promos | `/admin/promos` | Promotions |
| Recommendations | `/admin/recommendations` | Curate "Frequently bought together" pairings |
| AI accuracy | `/admin/ai-accuracy` | Visual-search match quality |
| Reports | `/admin/reports` | Sales / activity reports |
| Settings | `/admin/settings` | Shop settings |

---

## 4. Auth (sign-in / register / reset) — under `/login`

| Page | Path |
| --- | --- |
| Buyer sign-in | `/login` |
| Buyer register | `/login/register` |
| Buyer forgot password | `/login/forgot-password` |
| Buyer reset password | `/login/reset` |
| Admin sign-in | `/login/admin` |
| Admin forgot password | `/login/admin/forgot-password` |

---

## 5. Rider tracker (standalone) — `/track/:orderId`

A single full-screen page with **no store/buyer/admin chrome**. The delivery
rider opens it (or an admin opens it via **Open Rider Tracking** on the order
page) and taps **Start sharing** to stream GPS to the buyer's order page. Has a
**Simulate movement** toggle for demos. Full steps in
[TRACKER-WALKTHROUGH.md](TRACKER-WALKTHROUGH.md).

---

## Cross-interface links (how the parts connect)

- Guest order → confirmation → the same order shows in **Admin → Orders** and (if
  linked to a customer) in **Buyer → Orders**.
- Admin order detail → **Open Rider Tracking** opens `/track/:orderId`.
- Rider `/track/:orderId` → broadcasts location → Buyer `/buyer/orders/:id`
  delivery map (same order ID, Supabase Realtime).
- Any unknown path → **404** (`/404`, catch-all `*`).

---

## Quick map

```
/                         Store home
├─ /catalog               Product list
├─ /product/:id           Product + price calculator
├─ /visual-search         AI photo search
├─ /quote                 Quote request
├─ /cart → /checkout → /order-confirmed
├─ /about, /contact

/login                    Buyer sign-in
├─ /login/register, /login/forgot-password, /login/reset
└─ /login/admin, /login/admin/forgot-password

/buyer                    Buyer home  (bottom tabs)
├─ /buyer/orders → /buyer/orders/:id   (live tracking)
├─ /buyer/notifications
└─ /buyer/profile

/admin                    Admin dashboard  (sidebar)
├─ /admin/orders → /admin/orders/:id
├─ /admin/inventory → /new, /:id/edit
├─ /admin/promos, /recommendations, /ai-accuracy, /reports, /settings

/track/:orderId           Rider live-tracking (standalone)
```
