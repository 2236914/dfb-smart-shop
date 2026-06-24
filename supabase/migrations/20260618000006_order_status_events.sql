-- ============================================================================
-- DFB Smart Shop — Order status history (point-by-point tracker)
-- Logs every status change with a timestamp so the buyer sees a Shopee-style
-- timeline. Events are written automatically by a trigger on `orders`, so all
-- code paths (admin update, cancel_order RPC, place_order) are captured.
-- Run once in the Supabase SQL Editor.
-- ============================================================================

create table if not exists public.order_status_events (
  id         uuid primary key default gen_random_uuid(),
  order_id   uuid not null references public.orders(id) on delete cascade,
  status     order_status not null,
  created_at timestamptz not null default now()
);
create index if not exists order_status_events_order_idx
  on public.order_status_events (order_id, created_at);

alter table public.order_status_events enable row level security;

-- Read: admins see all; a buyer sees events for their own orders.
drop policy if exists order_status_events_read on public.order_status_events;
create policy order_status_events_read on public.order_status_events
  for select using (
    exists (
      select 1 from public.orders o
      where o.id = order_id and (public.is_admin() or o.customer_id = auth.uid())
    )
  );

-- Auto-log status changes. SECURITY DEFINER so the insert always succeeds
-- regardless of which role triggered the change.
create or replace function public.log_order_status()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    insert into public.order_status_events (order_id, status) values (new.id, new.status);
  elsif tg_op = 'UPDATE' and new.status is distinct from old.status then
    insert into public.order_status_events (order_id, status) values (new.id, new.status);
  end if;
  return new;
end;
$$;

drop trigger if exists trg_log_order_status_ins on public.orders;
drop trigger if exists trg_log_order_status_upd on public.orders;
create trigger trg_log_order_status_ins after insert on public.orders
  for each row execute function public.log_order_status();
create trigger trg_log_order_status_upd after update on public.orders
  for each row execute function public.log_order_status();

-- Backfill existing orders with a plausible progression (interpolated between
-- created_at and updated_at) so demo orders show a full timeline immediately.
insert into public.order_status_events (order_id, status, created_at)
select
  o.id,
  s.status,
  o.created_at
    + (o.updated_at - o.created_at)
      * ((s.ord - 1)::numeric / greatest(array_length(seq.arr, 1) - 1, 1))
from public.orders o
cross join lateral (
  select case o.status
    when 'new'       then array['new']::order_status[]
    when 'pending'   then array['new','pending']::order_status[]
    when 'confirmed' then array['new','pending','confirmed']::order_status[]
    when 'ready'     then array['new','pending','confirmed','ready']::order_status[]
    when 'completed' then array['new','pending','confirmed','ready','completed']::order_status[]
    when 'cancelled' then array['new','cancelled']::order_status[]
  end as arr
) seq
cross join lateral unnest(seq.arr) with ordinality as s(status, ord)
where not exists (
  select 1 from public.order_status_events e where e.order_id = o.id
);
