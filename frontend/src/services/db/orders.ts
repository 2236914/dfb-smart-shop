import type { Order, OrderType, Fulfilment, OrderStatus, OrderSource } from 'src/data/types';

import { supabase } from 'src/lib/supabase';

import { mapOrder } from './mappers';

// ----------------------------------------------------------------------
// Orders data access (Admin A-3/A-4). Orders are fetched with their line
// items via a nested select. Status/amount/note updates are admin-only.
// ----------------------------------------------------------------------

const ORDER_SELECT = '*, order_items(*)';

export async function fetchOrders(): Promise<Order[]> {
  const { data, error } = await supabase
    .from('orders')
    .select(ORDER_SELECT)
    .order('created_at', { ascending: false })
    .order('id', { ascending: true });
  if (error) throw error;
  return (data ?? []).map(mapOrder);
}

// Buyer's own orders. RLS already restricts rows to the signed-in buyer, but
// we also filter explicitly so an admin session doesn't pull everything here.
export async function fetchMyOrders(customerId: string): Promise<Order[]> {
  const { data, error } = await supabase
    .from('orders')
    .select(ORDER_SELECT)
    .eq('customer_id', customerId)
    .order('created_at', { ascending: false })
    .order('id', { ascending: true });
  if (error) throw error;
  return (data ?? []).map(mapOrder);
}

export type OrderEvent = { status: OrderStatus; createdAt: string };

// Status history for the point-by-point tracker (oldest first). Best-effort:
// returns [] if the table isn't there yet so the order page never breaks.
export async function fetchOrderEvents(orderId: string): Promise<OrderEvent[]> {
  const { data, error } = await supabase
    .from('order_status_events')
    .select('status, created_at')
    .eq('order_id', orderId)
    .order('created_at', { ascending: true });
  if (error) return [];
  return ((data ?? []) as { status: OrderStatus; created_at: string }[]).map((r) => ({
    status: r.status,
    createdAt: r.created_at,
  }));
}

export async function fetchOrder(id: string): Promise<Order | null> {
  const { data, error } = await supabase
    .from('orders')
    .select(ORDER_SELECT)
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  return data ? mapOrder(data) : null;
}

export type OrderUpdate = {
  status?: OrderStatus;
  confirmedAmount?: number | null;
  staffNote?: string | null;
};

export async function updateOrder(id: string, update: OrderUpdate): Promise<void> {
  const row: Record<string, unknown> = {};
  if (update.status !== undefined) row.status = update.status;
  if (update.confirmedAmount !== undefined) row.confirmed_amount = update.confirmedAmount;
  if (update.staffNote !== undefined) row.staff_note = update.staffNote;

  const { error } = await supabase.from('orders').update(row).eq('id', id);
  if (error) throw error;
}

// Buyer-initiated cancel of their own still-pending order. Backed by the
// cancel_order SECURITY DEFINER RPC (buyers have no direct UPDATE on orders).
export async function cancelOrder(orderId: string): Promise<void> {
  const { error } = await supabase.rpc('cancel_order', { order_id: orderId });
  if (error) throw error;
}

// ----------------------------------------------------------------------
// Webshop checkout (W-6). A guest (or signed-in buyer) places an order with
// its line items. Done via the place_order SECURITY DEFINER RPC so the insert
// is atomic and returns the generated #DFB-#### code even for guests (whose
// RLS would otherwise block reading their own just-inserted row).
// ----------------------------------------------------------------------

export type PlaceOrderItem = {
  productId?: string | null;
  name: string;
  image?: string;
  width: number;
  height: number;
  qty: number;
  basePrice: number;
  unitPrice: number;
  lineTotal: number;
  source?: OrderSource;
  referencePhoto?: string;
};

export type PlaceOrderInput = {
  customerName: string;
  customerMobile: string;
  customerEmail?: string;
  fulfilment: Fulfilment;
  address?: string;
  notes?: string;
  type?: OrderType;
  source?: OrderSource;
  estTotal: number;
  items: PlaceOrderItem[];
};

export async function placeOrder(input: PlaceOrderInput): Promise<{ id: string; code: string }> {
  const payload = {
    customer_name: input.customerName,
    customer_mobile: input.customerMobile,
    customer_email: input.customerEmail ?? '',
    fulfilment: input.fulfilment,
    address: input.address ?? '',
    notes: input.notes ?? '',
    type: input.type ?? 'order',
    source: input.source ?? 'manual',
    est_total: input.estTotal,
    items: input.items.map((i, idx) => ({
      product_id: i.productId ?? '',
      name: i.name,
      image: i.image ?? '',
      width: i.width,
      height: i.height,
      qty: i.qty,
      base_price: i.basePrice,
      unit_price: i.unitPrice,
      line_total: i.lineTotal,
      source: i.source ?? 'manual',
      reference_photo: i.referencePhoto ?? '',
      sort_order: idx,
    })),
  };

  const { data, error } = await supabase.rpc('place_order', { payload });
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  return { id: row.id, code: row.code };
}
