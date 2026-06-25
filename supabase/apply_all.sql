-- DFB Smart Shop — Phase 1, one-shot apply (schema + RLS + seed)
-- Paste this whole file into the Supabase SQL Editor and Run.
--
-- SAFE TO RE-RUN: the CLEAN SLATE block below drops every object this script
-- creates before recreating it, so you never hit an "already exists" error.
-- NOTE: that means it RESETS the DFB tables each run — fine during Phase 1
-- (only demo/seed data exists). Do NOT run this once the shop has real data.
begin;

-- ============================================================================
-- CLEAN SLATE — drop everything this script creates (guarantees no "already
-- exists" errors whether the database is empty or partially set up).
-- ============================================================================
drop trigger if exists on_auth_user_created on auth.users;

drop table if exists public.order_items     cascade;
drop table if exists public.orders          cascade;
drop table if exists public.notifications   cascade;
drop table if exists public.recommendations cascade;
drop table if exists public.promos          cascade;
drop table if exists public.products        cascade;
drop table if exists public.branches        cascade;
drop table if exists public.settings        cascade;
drop table if exists public.profiles        cascade;
drop table if exists public.admins          cascade;

drop function if exists public.handle_new_user()                                  cascade;
drop function if exists public.set_updated_at()                                   cascade;
drop function if exists public.is_admin(uuid)                                     cascade;
drop function if exists public.compute_unit_price(numeric,numeric,numeric,numeric,numeric) cascade;
drop function if exists public.next_order_code()                                  cascade;

drop sequence if exists dfb_order_code_seq cascade;

drop type if exists product_category  cascade;
drop type if exists order_status      cascade;
drop type if exists order_type        cascade;
drop type if exists fulfilment        cascade;
drop type if exists order_source      cascade;
drop type if exists banner_status     cascade;
drop type if exists notification_type cascade;
-- ============================================================================

-- ============================================================================
-- DFB Smart Shop — Phase 1: initial schema
-- Translates database/schema.md (originally Firebase Realtime DB) into a
-- relational PostgreSQL schema for Supabase. Tables, enums, helper functions,
-- and triggers only. RLS policies live in 20260618000002_rls.sql; seed data in
-- supabase/seed.sql.
-- ============================================================================

create extension if not exists pgcrypto; -- gen_random_uuid()

-- ----------------------------------------------------------------------------
-- Enums (values mirror frontend/src/data/types.ts exactly)
-- ----------------------------------------------------------------------------
create type product_category as enum (
  'Glass', 'Aluminum Profiles', 'Hardware & Accessories', 'Screens'
);
create type order_status   as enum ('new','pending','confirmed','ready','completed','cancelled');
create type order_type      as enum ('order','reservation');
create type fulfilment      as enum ('pickup','delivery');
create type order_source    as enum ('manual','visual_search');
create type banner_status   as enum ('active','scheduled','inactive');
create type notification_type as enum ('order','promo');

-- ----------------------------------------------------------------------------
-- Helper functions
-- ----------------------------------------------------------------------------

-- Generic updated_at maintenance.
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Dynamic price (Objective 3). Mirrors frontend/src/data/pricing.ts:
--   unit = base + (W*H*surfaceMult) + (2*(W+H)*perimeterMult)
-- Defaults match Settings (surface 1.5, perimeter 2).
create or replace function public.compute_unit_price(
  base numeric, w numeric, h numeric,
  surface_mult numeric default 1.5, perimeter_mult numeric default 2
) returns numeric language sql immutable as $$
  select round(base + (w * h * surface_mult) + (2 * (w + h) * perimeter_mult), 2);
$$;

-- ----------------------------------------------------------------------------
-- admins  (mirrors schema.md `admins/<uid>: true` — the write-gate for staff)
-- Rows are managed by the service role / SQL only (no client write policy).
-- ----------------------------------------------------------------------------
create table public.admins (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  label      text,                 -- e.g. 'Owner', 'Staff'
  created_at timestamptz not null default now()
);

-- is_admin(): SECURITY DEFINER so RLS policies can call it without recursion.
create or replace function public.is_admin(uid uuid default auth.uid())
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.admins a where a.user_id = uid);
$$;

-- ----------------------------------------------------------------------------
-- profiles  (buyer accounts — schema.md `users/<uid>`)
-- One row per auth user, created automatically on sign-up.
-- ----------------------------------------------------------------------------
create table public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  full_name   text not null default '',
  mobile      text,
  email       text,
  preference  fulfilment default 'pickup',
  address     text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

-- Auto-create a profile row whenever a new auth user is created.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name, email)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name',''), new.email)
  on conflict (id) do nothing;
  return new;
end;
$$;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ----------------------------------------------------------------------------
-- products  (inventory — Admin A-5/A-6)
-- ----------------------------------------------------------------------------
create table public.products (
  id                        uuid primary key default gen_random_uuid(),
  name                      text not null,
  category                  product_category not null,
  description               text not null default '',
  base_price                numeric(12,2) not null check (base_price >= 0), -- P_base
  stock_qty                 integer not null default 0 check (stock_qty >= 0),
  low_stock_threshold       integer not null default 10 check (low_stock_threshold >= 0),
  images                    text[] not null default '{}',  -- high-res photo URLs
  keywords                  text[] not null default '{}',  -- visual-search bridge tags
  visible_in_shop           boolean not null default true,
  available_for_reservation boolean not null default true,
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now()
);
create index products_category_idx on public.products (category);
create index products_visible_idx  on public.products (visible_in_shop);
create trigger products_updated_at before update on public.products
  for each row execute function public.set_updated_at();

-- ----------------------------------------------------------------------------
-- promos  (promo banners — Admin A-7 → Webshop W-1)
-- ----------------------------------------------------------------------------
create table public.promos (
  id          uuid primary key default gen_random_uuid(),
  image       text not null,
  caption     text not null default '',
  link        text,                       -- product id or category (optional)
  status      banner_status not null default 'inactive',
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create trigger promos_updated_at before update on public.promos
  for each row execute function public.set_updated_at();

-- ----------------------------------------------------------------------------
-- recommendations  (admin-curated "frequently bought together" — A-8)
-- Join table: each row = one add-on suggested for a product.
-- ----------------------------------------------------------------------------
create table public.recommendations (
  product_id  uuid not null references public.products(id) on delete cascade,
  addon_id    uuid not null references public.products(id) on delete cascade,
  sort_order  integer not null default 0,
  primary key (product_id, addon_id),
  check (product_id <> addon_id)
);
create index recommendations_addon_idx on public.recommendations (addon_id);

-- ----------------------------------------------------------------------------
-- settings  (singleton shop profile + pricing constants — Admin A-10)
-- ----------------------------------------------------------------------------
create table public.settings (
  id                  integer primary key default 1 check (id = 1),
  shop_name           text not null,
  proprietor          text,
  email               text,
  store_hours         text,
  surface_multiplier  numeric(6,2) not null default 1.5,
  perimeter_multiplier numeric(6,2) not null default 2,
  low_stock_threshold integer not null default 10,
  updated_at          timestamptz not null default now()
);
create trigger settings_updated_at before update on public.settings
  for each row execute function public.set_updated_at();

-- ----------------------------------------------------------------------------
-- branches  (physical locations — real business has Main + a branch)
-- ----------------------------------------------------------------------------
create table public.branches (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,            -- 'Main', 'Branch'
  address     text not null,
  telephone   text,
  mobile      text,
  is_main     boolean not null default false,
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- orders  (orders & reservations — Admin A-3/A-4, Buyer B-4/B-5, Webshop W-6)
-- customer_id is NULL for guest checkouts (Webshop allows ordering without an
-- account); set to the buyer's uid when they are signed in.
-- ----------------------------------------------------------------------------
create sequence if not exists dfb_order_code_seq start 1043;  -- seeded codes end at 1042
create or replace function public.next_order_code()
returns text language sql as $$
  select '#DFB-' || nextval('dfb_order_code_seq')::text;
$$;

create table public.orders (
  id               uuid primary key default gen_random_uuid(),
  code             text unique not null default public.next_order_code(),
  customer_id      uuid references public.profiles(id) on delete set null,
  customer_name    text not null,
  customer_mobile  text not null,
  customer_email   text,
  type             order_type not null default 'order',
  fulfilment       fulfilment not null default 'pickup',
  address          text,
  notes            text,
  staff_note       text,                 -- internal, not shown to customer
  est_total        numeric(12,2) not null default 0,
  confirmed_amount numeric(12,2),
  status           order_status not null default 'new',
  source           order_source not null default 'manual',
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index orders_customer_idx on public.orders (customer_id);
create index orders_status_idx   on public.orders (status);
create index orders_created_idx  on public.orders (created_at desc);
create trigger orders_updated_at before update on public.orders
  for each row execute function public.set_updated_at();

-- ----------------------------------------------------------------------------
-- order_items  (denormalized line items — pricing frozen at write time)
-- ----------------------------------------------------------------------------
create table public.order_items (
  id              uuid primary key default gen_random_uuid(),
  order_id        uuid not null references public.orders(id) on delete cascade,
  product_id      uuid references public.products(id) on delete set null,
  name            text not null,        -- snapshot of product name
  image           text,                 -- snapshot of product image
  width           numeric(10,2) not null,  -- inches
  height          numeric(10,2) not null,  -- inches
  qty             integer not null check (qty > 0),
  base_price      numeric(12,2) not null,
  unit_price      numeric(12,2) not null,  -- computed via the dynamic formula
  line_total      numeric(12,2) not null,
  source          order_source not null default 'manual',
  reference_photo text,                  -- customer's uploaded photo (optional)
  sort_order      integer not null default 0
);
create index order_items_order_idx on public.order_items (order_id);

-- ----------------------------------------------------------------------------
-- notifications  (per-buyer in-app alerts — Buyer B-8)
-- ----------------------------------------------------------------------------
create table public.notifications (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  text        text not null,
  type        notification_type not null default 'order',
  read        boolean not null default false,
  created_at  timestamptz not null default now()
);
create index notifications_user_idx on public.notifications (user_id, read);

-- ============================================================================
-- DFB Smart Shop — Phase 1: Row-Level Security
-- Mirrors database/database.rules.json. Public can read the catalogue; only
-- admins write it. Buyers see only their own orders / profile / notifications.
-- Guests (anon) may place orders (Webshop checkout requires no account).
-- ============================================================================

alter table public.admins          enable row level security;
alter table public.profiles        enable row level security;
alter table public.products        enable row level security;
alter table public.promos          enable row level security;
alter table public.recommendations enable row level security;
alter table public.settings        enable row level security;
alter table public.branches        enable row level security;
alter table public.orders          enable row level security;
alter table public.order_items     enable row level security;
alter table public.notifications   enable row level security;

-- ---------------------------------------------------------------------------
-- admins: no client policies. is_admin() is SECURITY DEFINER so it still works;
-- rows are managed by the service role / SQL only. (RLS on with no policy =
-- deny all client access.)
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- products: public reads visible items; admins read all and write.
-- ---------------------------------------------------------------------------
create policy products_read on public.products
  for select using (visible_in_shop or public.is_admin());
create policy products_admin_write on public.products
  for all using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- promos: public reads active banners; admins read all and write.
-- ---------------------------------------------------------------------------
create policy promos_read on public.promos
  for select using (status = 'active' or public.is_admin());
create policy promos_admin_write on public.promos
  for all using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- recommendations / settings / branches: public read, admin write.
-- ---------------------------------------------------------------------------
create policy recommendations_read on public.recommendations
  for select using (true);
create policy recommendations_admin_write on public.recommendations
  for all using (public.is_admin()) with check (public.is_admin());

create policy settings_read on public.settings
  for select using (true);
create policy settings_admin_write on public.settings
  for all using (public.is_admin()) with check (public.is_admin());

create policy branches_read on public.branches
  for select using (true);
create policy branches_admin_write on public.branches
  for all using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- profiles: a user sees/edits only their own row; admins see all.
-- (No role column here, so self-update cannot escalate privileges.)
-- ---------------------------------------------------------------------------
create policy profiles_self_read on public.profiles
  for select using (id = auth.uid() or public.is_admin());
create policy profiles_self_insert on public.profiles
  for insert with check (id = auth.uid());
create policy profiles_self_update on public.profiles
  for update using (id = auth.uid() or public.is_admin())
  with check (id = auth.uid() or public.is_admin());

-- ---------------------------------------------------------------------------
-- orders: buyer sees own; admin sees all. Anyone may create an order for
-- themselves or as a guest. Status/amount updates are admin-only in Phase 1
-- (buyer "cancel while pending" will be added as a SECURITY DEFINER RPC later).
-- ---------------------------------------------------------------------------
create policy orders_read on public.orders
  for select using (public.is_admin() or customer_id = auth.uid());
create policy orders_insert on public.orders
  for insert with check (
    public.is_admin() or customer_id is null or customer_id = auth.uid()
  );
create policy orders_admin_update on public.orders
  for update using (public.is_admin()) with check (public.is_admin());
create policy orders_admin_delete on public.orders
  for delete using (public.is_admin());

-- ---------------------------------------------------------------------------
-- order_items: visibility/insert follow the parent order.
-- ---------------------------------------------------------------------------
create policy order_items_read on public.order_items
  for select using (
    exists (
      select 1 from public.orders o
      where o.id = order_id
        and (public.is_admin() or o.customer_id = auth.uid())
    )
  );
create policy order_items_insert on public.order_items
  for insert with check (
    exists (
      select 1 from public.orders o
      where o.id = order_id
        and (public.is_admin() or o.customer_id is null or o.customer_id = auth.uid())
    )
  );
create policy order_items_admin_write on public.order_items
  for update using (public.is_admin()) with check (public.is_admin());
create policy order_items_admin_delete on public.order_items
  for delete using (public.is_admin());

-- ---------------------------------------------------------------------------
-- notifications: buyer reads own & marks own read; admins create them.
-- ---------------------------------------------------------------------------
create policy notifications_read on public.notifications
  for select using (user_id = auth.uid() or public.is_admin());
create policy notifications_admin_insert on public.notifications
  for insert with check (public.is_admin());
create policy notifications_owner_update on public.notifications
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy notifications_owner_delete on public.notifications
  for delete using (user_id = auth.uid() or public.is_admin());

-- ===== SEED =====
-- ============================================================================
-- DFB Smart Shop — Phase 1 seed data
-- Catalogue + shop profile that do NOT depend on auth users. Uses the real
-- business details (DFB Glass and Aluminum Supply, proprietress Lorie Bandong,
-- Pasig main + Cainta branch). Demo orders are seeded as guest orders
-- (customer_id NULL); buyer/admin accounts, profile links, and notifications
-- are added in Phase 2 once auth users exist. Fixed UUIDs are used so demo rows
-- can reference each other; production rows use gen_random_uuid().
-- Idempotent: safe to re-run (uses upserts / delete-then-insert for demo rows).
-- ============================================================================



-- ---------------------------------------------------------------------------
-- Shop profile (singleton) + branches — REAL business data
-- ---------------------------------------------------------------------------
insert into public.settings (id, shop_name, proprietor, email, store_hours,
                             surface_multiplier, perimeter_multiplier, low_stock_threshold)
values (1, 'DFB Glass and Aluminum Supply', 'Lorie Bandong',
        'dfbglassandaluminumsupply@gmail.com', 'Mon–Sat, 8:00 AM – 6:00 PM',
        1.5, 2, 10)
on conflict (id) do update set
  shop_name = excluded.shop_name,
  proprietor = excluded.proprietor,
  email = excluded.email,
  store_hours = excluded.store_hours,
  surface_multiplier = excluded.surface_multiplier,
  perimeter_multiplier = excluded.perimeter_multiplier,
  low_stock_threshold = excluded.low_stock_threshold;

delete from public.branches;
insert into public.branches (name, address, telephone, mobile, is_main, sort_order) values
  ('Main',
   'B5 L4 P. Gomez St., Reyes Comp., Brgy. Manggahan, Pasig City',
   '(02) 8682-08-74 / (02) 8697-18-86', '0942-016-1332', true, 1),
  ('Branch',
   'L6 Bl Uni B-A, Greenheights Executive Homes Phase 3 (Along F. Manalo St.), San Isidro, Cainta, Rizal',
   '(02) 8668-73-62', null, false, 2);

-- ---------------------------------------------------------------------------
-- Products  (ported from frontend/src/data/mock.ts)
-- ---------------------------------------------------------------------------
delete from public.products where id in (
  '11111111-1111-1111-1111-000000000001','11111111-1111-1111-1111-000000000002',
  '11111111-1111-1111-1111-000000000003','11111111-1111-1111-1111-000000000004',
  '11111111-1111-1111-1111-000000000005','11111111-1111-1111-1111-000000000006',
  '11111111-1111-1111-1111-000000000007','11111111-1111-1111-1111-000000000008');

insert into public.products
  (id, name, category, description, base_price, stock_qty, low_stock_threshold, images, keywords, visible_in_shop, available_for_reservation)
values
  ('11111111-1111-1111-1111-000000000001','Clear Float Glass 5mm','Glass',
   'Standard clear float glass, ideal for windows and table tops.',150,48,10,
   '{/assets/images/product/product-1.webp}','{glass,window,clear,sheet}',true,true),
  ('11111111-1111-1111-1111-000000000002','Tinted Bronze Glass 6mm','Glass',
   'Heat-reducing tinted glass for façades and partitions.',250,6,8,
   '{/assets/images/product/product-2.webp}','{glass,tinted,bronze,window}',true,true),
  ('11111111-1111-1111-1111-000000000003','Aluminum Sliding Profile','Aluminum Profiles',
   'Powder-coated sliding track profile for windows and doors.',350,120,20,
   '{/assets/images/product/product-3.webp}','{aluminum,profile,frame,metal,track}',true,true),
  ('11111111-1111-1111-1111-000000000004','Aluminum Casement Profile','Aluminum Profiles',
   'Durable casement window profile, mill finish.',420,0,15,
   '{/assets/images/product/product-4.webp}','{aluminum,profile,frame,casement,metal}',true,false),
  ('11111111-1111-1111-1111-000000000005','Window Lock Set','Hardware & Accessories',
   'Crescent lock set for sliding windows.',120,7,12,
   '{/assets/images/product/product-5.webp}','{lock,hardware,window,accessory}',true,false),
  ('11111111-1111-1111-1111-000000000006','Stainless Door Handle','Hardware & Accessories',
   'Brushed stainless handle for aluminum doors.',280,35,10,
   '{/assets/images/product/product-6.webp}','{handle,hardware,door,stainless}',true,false),
  ('11111111-1111-1111-1111-000000000007','Fiberglass Window Screen','Screens',
   'Insect screen mesh, charcoal, sold per panel.',180,22,10,
   '{/assets/images/product/product-7.webp}','{screen,mesh,window,insect,fiberglass}',true,true),
  ('11111111-1111-1111-1111-000000000008','Aluminum Mosquito Screen Frame','Screens',
   'Pre-cut screen frame kit with corner connectors.',350,4,6,
   '{/assets/images/product/product-8.webp}','{screen,frame,aluminum,window,mosquito}',false,true);

-- ---------------------------------------------------------------------------
-- Recommendations (frequently bought together — A-8)
-- ---------------------------------------------------------------------------
delete from public.recommendations;
insert into public.recommendations (product_id, addon_id, sort_order) values
  ('11111111-1111-1111-1111-000000000001','11111111-1111-1111-1111-000000000005',0),
  ('11111111-1111-1111-1111-000000000001','11111111-1111-1111-1111-000000000003',1),
  ('11111111-1111-1111-1111-000000000003','11111111-1111-1111-1111-000000000005',0),
  ('11111111-1111-1111-1111-000000000003','11111111-1111-1111-1111-000000000006',1),
  ('11111111-1111-1111-1111-000000000007','11111111-1111-1111-1111-000000000008',0);

-- ---------------------------------------------------------------------------
-- Promo banners (A-7 → W-1)
-- ---------------------------------------------------------------------------
delete from public.promos where id in (
  '33333333-3333-3333-3333-000000000001','33333333-3333-3333-3333-000000000002',
  '33333333-3333-3333-3333-000000000003','33333333-3333-3333-3333-000000000004');
insert into public.promos (id, image, caption, link, status, sort_order) values
  ('33333333-3333-3333-3333-000000000001','/assets/images/cover/cover-1.webp',
   'Rainy season sale — 10% off all window screens','Screens','active',1),
  ('33333333-3333-3333-3333-000000000002','/assets/images/cover/cover-2.webp',
   'New tinted glass arrivals now in stock','11111111-1111-1111-1111-000000000002','active',2),
  ('33333333-3333-3333-3333-000000000003','/assets/images/cover/cover-3.webp',
   'Fiesta promo — free measurement service',null,'scheduled',3),
  ('33333333-3333-3333-3333-000000000004','/assets/images/cover/cover-4.webp',
   'Old Christmas banner',null,'inactive',4);

-- ---------------------------------------------------------------------------
-- Demo orders (guest orders: customer_id NULL). Phase 2 links the four
-- "Marites Santos" orders (1042, 1031, 1025, 1009) to her buyer account.
-- ---------------------------------------------------------------------------
delete from public.orders where code in
  ('#DFB-1042','#DFB-1041','#DFB-1040','#DFB-1039','#DFB-1038',
   '#DFB-1037','#DFB-1036','#DFB-1031','#DFB-1025','#DFB-1009');

insert into public.orders
  (id, code, customer_name, customer_mobile, customer_email, type, fulfilment,
   address, notes, staff_note, confirmed_amount, status, created_at)
values
  ('22222222-2222-2222-2222-000000000001','#DFB-1042','Marites Santos','0917 555 0142','marites.santos@gmail.com','order','pickup',
   null,'Please call before cutting, will confirm final size.',null,null,'new','2026-06-11T08:30:00Z'),
  ('22222222-2222-2222-2222-000000000002','#DFB-1041','Jun Dela Cruz','0918 222 7781','jun.delacruz@yahoo.com','order','delivery',
   '12 Rizal St., Brgy. San Andres, Cainta, Rizal',null,null,null,'pending','2026-06-10T14:10:00Z'),
  ('22222222-2222-2222-2222-000000000003','#DFB-1040','Aileen Reyes','0920 998 1234','aileen.reyes@gmail.com','reservation','pickup',
   null,'Reserving for next week installation.',null,5200,'confirmed','2026-06-09T10:00:00Z'),
  ('22222222-2222-2222-2222-000000000004','#DFB-1039','Ramil Aquino','0921 445 6620','ramil.aquino@gmail.com','order','pickup',
   null,null,null,3850,'ready','2026-06-08T09:20:00Z'),
  ('22222222-2222-2222-2222-000000000005','#DFB-1038','Grace Lim','0917 100 2030','grace.lim@gmail.com','order','delivery',
   '88 Ortigas Ext., Cainta, Rizal',null,null,7400,'completed','2026-06-05T16:45:00Z'),
  ('22222222-2222-2222-2222-000000000006','#DFB-1037','Noel Bautista','0908 776 5541','noel.bautista@gmail.com','order','pickup',
   null,null,'Customer found stock elsewhere.',null,'cancelled','2026-06-04T11:05:00Z'),
  ('22222222-2222-2222-2222-000000000007','#DFB-1036','Divina Cruz','0915 332 9087','divina.cruz@gmail.com','reservation','pickup',
   null,null,null,null,'pending','2026-06-11T07:15:00Z'),
  ('22222222-2222-2222-2222-000000000008','#DFB-1031','Marites Santos','0917 555 0142','marites.santos@gmail.com','order','pickup',
   null,null,null,4200,'confirmed','2026-06-07T09:40:00Z'),
  ('22222222-2222-2222-2222-000000000009','#DFB-1025','Marites Santos','0917 555 0142','marites.santos@gmail.com','reservation','pickup',
   null,'Holding these for our renovation next week.',null,null,'confirmed','2026-06-06T13:20:00Z'),
  ('22222222-2222-2222-2222-000000000010','#DFB-1009','Marites Santos','0917 555 0142','marites.santos@gmail.com','order','delivery',
   '24 Mabini St., Brgy. San Isidro, Cainta, Rizal',null,null,6800,'completed','2026-05-28T10:15:00Z');

-- Line items — unit_price/line_total computed via the dynamic pricing function.
delete from public.order_items where order_id in (
  select id from public.orders where code in
    ('#DFB-1042','#DFB-1041','#DFB-1040','#DFB-1039','#DFB-1038',
     '#DFB-1037','#DFB-1036','#DFB-1031','#DFB-1025','#DFB-1009'));

insert into public.order_items (order_id, product_id, name, image, width, height, qty, base_price, unit_price, line_total, sort_order)
select v.order_id, p.id, p.name, p.images[1], v.w, v.h, v.qty, p.base_price,
       public.compute_unit_price(p.base_price, v.w, v.h),
       round(public.compute_unit_price(p.base_price, v.w, v.h) * v.qty, 2), v.sort_order
from (values
  -- order_id, product_id, w, h, qty, sort
  ('22222222-2222-2222-2222-000000000001'::uuid,'11111111-1111-1111-1111-000000000001'::uuid,36,48,2,0),
  ('22222222-2222-2222-2222-000000000001'::uuid,'11111111-1111-1111-1111-000000000005'::uuid,4,4,2,1),
  ('22222222-2222-2222-2222-000000000002'::uuid,'11111111-1111-1111-1111-000000000003'::uuid,60,24,4,0),
  ('22222222-2222-2222-2222-000000000003'::uuid,'11111111-1111-1111-1111-000000000007'::uuid,30,40,3,0),
  ('22222222-2222-2222-2222-000000000004'::uuid,'11111111-1111-1111-1111-000000000002'::uuid,24,36,2,0),
  ('22222222-2222-2222-2222-000000000005'::uuid,'11111111-1111-1111-1111-000000000006'::uuid,6,8,4,0),
  ('22222222-2222-2222-2222-000000000005'::uuid,'11111111-1111-1111-1111-000000000003'::uuid,48,24,2,1),
  ('22222222-2222-2222-2222-000000000006'::uuid,'11111111-1111-1111-1111-000000000001'::uuid,24,24,1,0),
  ('22222222-2222-2222-2222-000000000007'::uuid,'11111111-1111-1111-1111-000000000008'::uuid,30,36,2,0),
  ('22222222-2222-2222-2222-000000000008'::uuid,'11111111-1111-1111-1111-000000000006'::uuid,6,8,2,0),
  ('22222222-2222-2222-2222-000000000009'::uuid,'11111111-1111-1111-1111-000000000007'::uuid,30,40,2,0),
  ('22222222-2222-2222-2222-000000000010'::uuid,'11111111-1111-1111-1111-000000000001'::uuid,36,48,2,0)
) as v(order_id, product_id, w, h, qty, sort_order)
join public.products p on p.id = v.product_id;

-- Roll up estimated totals from the seeded line items.
update public.orders o
set est_total = coalesce((select sum(i.line_total) from public.order_items i where i.order_id = o.id), 0)
where o.code in
  ('#DFB-1042','#DFB-1041','#DFB-1040','#DFB-1039','#DFB-1038',
   '#DFB-1037','#DFB-1036','#DFB-1031','#DFB-1025','#DFB-1009');



commit;
