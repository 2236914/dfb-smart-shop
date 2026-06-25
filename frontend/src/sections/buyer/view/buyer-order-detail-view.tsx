import type { ReactNode } from 'react';
import type { RiderLoc } from 'src/services/tracking';
import type { LabelColor } from 'src/components/label';
import type { Order, OrderStatus } from 'src/data/types';

import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Alert from '@mui/material/Alert';
import Avatar from '@mui/material/Avatar';
import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
import Collapse from '@mui/material/Collapse';
import Typography from '@mui/material/Typography';
import LinearProgress from '@mui/material/LinearProgress';

import { useRouter } from 'src/routes/hooks';
import { RouterLink } from 'src/routes/components';

import { useAsync } from 'src/hooks/use-async';

import { fDateTime } from 'src/utils/format-time';
import { geocodeAddress } from 'src/utils/geocode';

import { fPeso, computeUnitPrice } from 'src/data/pricing';
import { subscribeRiderLocation } from 'src/services/tracking';
import { ORDER_STATUS_COLOR, RESERVATION_STATUS_LABEL } from 'src/data/status';
import { fetchOrder, cancelOrder, fetchBranches, fetchOrderEvents } from 'src/services/db';

import { useToast } from 'src/components/toast';
import { Iconify } from 'src/components/iconify';
import { LocationMap } from 'src/components/location-map';
import { LiveTrackMap } from 'src/components/live-track-map';
import { ConfirmDialog } from 'src/components/confirm-dialog';

import { useCart } from 'src/sections/store/cart-context';

import { BuyerStatusBadge } from '../buyer-status-badge';
import { BuyerOrderTracker } from '../buyer-order-tracker';

// ----------------------------------------------------------------------
// B-5 / B-6. Order (and Reservation) Detail — a real order summary with live
// delivery tracking: status hero, tracking map, progress timeline, recipient
// + pickup details, itemised price breakdown and order summary.
// ----------------------------------------------------------------------

export function BuyerOrderDetailView() {
  const { id } = useParams();
  const router = useRouter();
  const { addItem } = useCart();
  const { showToast, toast } = useToast();

  const { data, loading } = useAsync(
    () =>
      id
        ? Promise.all([fetchOrder(id), fetchOrderEvents(id), fetchBranches()]).then(
            ([o, events, branches]) => ({ o, events, branches })
          )
        : Promise.resolve(null),
    [id]
  );
  const order = data?.o ?? null;
  const events = data?.events ?? [];
  const pickupBranch = (data?.branches ?? []).find((b) => b.isMain) ?? (data?.branches ?? [])[0];

  const [expanded, setExpanded] = useState<number | null>(null);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [riderLoc, setRiderLoc] = useState<RiderLoc | null>(null);
  const [destination, setDestination] = useState<{ lat: number; lng: number } | null>(null);
  const [eta, setEta] = useState<{ distanceM: number; durationS: number } | null>(null);
  const [now, setNow] = useState(() => Date.now());

  // Live rider tracking for delivery orders that are on the way.
  const isDelivery = order?.fulfilment === 'delivery';
  const inTransit = order ? ['confirmed', 'ready'].includes(order.status) : false;
  const deliveryAddress = isDelivery ? order?.address : undefined;

  useEffect(() => {
    if (!id || !isDelivery) return undefined;
    return subscribeRiderLocation(id, setRiderLoc);
  }, [id, isDelivery]);

  // Geocode the delivery address once to drop the destination pin.
  useEffect(() => {
    if (!deliveryAddress) return undefined;
    let active = true;
    geocodeAddress(deliveryAddress).then((d) => {
      if (active && d) setDestination(d);
    });
    return () => {
      active = false;
    };
  }, [deliveryAddress]);

  // Tick so the "last seen" / live-vs-paused indicator stays current.
  useEffect(() => {
    if (!isDelivery) return undefined;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [isDelivery]);

  const handleReorder = () => {
    order?.items.forEach((item) =>
      addItem({
        productId: item.productId,
        name: item.name,
        image: item.image,
        basePrice: item.basePrice,
        width: item.width,
        height: item.height,
        qty: item.qty,
        unitPrice: item.unitPrice,
      })
    );
    showToast('Items added to your cart.');
    setTimeout(() => router.push('/cart'), 600);
  };

  if (loading) {
    return <LinearProgress sx={{ mt: 2 }} />;
  }

  if (!order) {
    return (
      <Box>
        <Typography variant="h6" sx={{ mb: 2 }}>
          Order not found
        </Typography>
        <Button component={RouterLink} href="/buyer/orders" color="inherit">
          Back to My Orders
        </Button>
      </Box>
    );
  }

  const isReservation = order.type === 'reservation';
  const canCancel = order.status === 'new' || order.status === 'pending';
  const hero = statusHero(order);
  const accent: LabelColor = hero.color === 'default' ? 'primary' : hero.color;

  const riderAgeMs = riderLoc ? now - riderLoc.at : null;
  const riderLive = riderAgeMs != null && riderAgeMs < 20000;

  const itemCount = order.items.reduce((s, i) => s + i.qty, 0);
  const itemsSubtotal = order.items.reduce((s, i) => s + i.unitPrice * i.qty, 0);

  return (
    <Box sx={{ pb: 2 }}>
      <Button
        component={RouterLink}
        href="/buyer/orders"
        color="inherit"
        size="small"
        startIcon={<Iconify icon="eva:arrow-ios-back-fill" />}
        sx={{ mb: 2 }}
      >
        My Orders
      </Button>

      {/* Status hero */}
      <Card sx={{ p: 2.5, mb: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Avatar sx={{ width: 56, height: 56, bgcolor: `${accent}.lighter`, color: `${accent}.main` }}>
            <Iconify icon={hero.icon} width={30} />
          </Avatar>
          <Box sx={{ flexGrow: 1, minWidth: 0 }}>
            <Typography variant="h6" sx={{ lineHeight: 1.3 }}>
              {hero.title}
            </Typography>
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              {hero.sub}
            </Typography>
          </Box>
        </Box>

        <Divider sx={{ my: 2, borderStyle: 'dashed' }} />

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Box sx={{ flexGrow: 1, minWidth: 0 }}>
            <Typography variant="subtitle1">{order.code}</Typography>
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
              Placed {fDateTime(order.createdAt)}
            </Typography>
          </Box>
          <BuyerStatusBadge order={order} />
        </Box>
      </Card>

      {/* Helper note */}
      {order.status !== 'cancelled' && order.status !== 'completed' && (
        <Alert severity="info" icon={<Iconify icon="solar:info-circle-bold" />} sx={{ mb: 2 }}>
          {isReservation
            ? 'Reserved items are held for you. The shop will confirm pickup and payment — reservations may expire if not confirmed.'
            : `The shop confirms each stage. You'll be contacted at ${order.customerMobile} for confirmation and payment.`}
        </Alert>
      )}

      {/* Delivery tracking (delivery orders) */}
      {isDelivery && (
        <Section
          icon="solar:delivery-bold"
          title="Delivery tracking"
          action={
            riderLoc ? (
              <Chip
                size="small"
                color={riderLive ? 'success' : 'warning'}
                label={riderLive ? 'Live' : `Paused • ${Math.round((riderAgeMs ?? 0) / 1000)}s ago`}
                icon={<Iconify icon={riderLive ? 'solar:gps-bold' : 'solar:gps-broken'} width={14} />}
              />
            ) : undefined
          }
        >
          {riderLoc || destination ? (
            <>
              {riderLoc && riderLive && eta && (
                <Box
                  sx={{
                    mb: 1.5,
                    p: 1.25,
                    borderRadius: 1.5,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1,
                    bgcolor: 'success.lighter',
                    color: 'success.darker',
                  }}
                >
                  <Iconify icon="solar:map-arrow-square-bold" width={22} />
                  <Typography variant="subtitle2">
                    Rider is on the way · ≈ {(eta.distanceM / 1000).toFixed(1)} km away
                    {eta.durationS ? ` (${Math.max(1, Math.round(eta.durationS / 60))} min)` : ''}
                  </Typography>
                </Box>
              )}
              <LiveTrackMap rider={riderLoc} destination={destination} height={240} onEta={setEta} />
              {riderLoc && !riderLive && (
                <Typography variant="caption" sx={{ color: 'warning.darker', mt: 1, display: 'block' }}>
                  The rider&apos;s location paused (they may have lost signal or backgrounded the
                  app). Showing their last known spot.
                </Typography>
              )}
            </>
          ) : (
            <Box
              sx={{
                py: 4,
                px: 2,
                textAlign: 'center',
                color: 'text.secondary',
                bgcolor: 'background.neutral',
                borderRadius: 1.5,
              }}
            >
              <Iconify icon="solar:map-point-wave-bold-duotone" width={40} />
              <Typography variant="body2" sx={{ mt: 1 }}>
                {inTransit
                  ? 'Waiting for the rider to start sharing their location…'
                  : 'Live tracking will appear here once your order is on the way.'}
              </Typography>
            </Box>
          )}
        </Section>
      )}

      {/* Pickup location (pickup orders) */}
      {!isDelivery && pickupBranch && (
        <Section icon="solar:shop-bold" title="Pickup location">
          <LocationMap query={pickupBranch.address} height={220} />
          <Typography variant="subtitle2" sx={{ mt: 1.5 }}>
            {pickupBranch.name}
          </Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            {pickupBranch.address}
          </Typography>
        </Section>
      )}

      {/* Progress timeline */}
      <BuyerOrderTracker order={order} events={events} />

      {/* Recipient / fulfilment details */}
      <Section
        icon={isDelivery ? 'solar:map-point-bold' : 'solar:user-bold'}
        title={isDelivery ? 'Delivery details' : 'Contact details'}
      >
        <Stack spacing={0.5}>
          <InfoRow icon="solar:user-bold" label="Recipient" value={order.customerName} />
          <InfoRow icon="solar:phone-bold" label="Mobile" value={order.customerMobile} />
          {isDelivery && order.address && (
            <InfoRow icon="solar:map-point-bold" label="Delivery address" value={order.address} />
          )}
          {!isDelivery && (
            <InfoRow
              icon="solar:bag-smile-bold"
              label="Fulfilment"
              value="Pickup at store"
            />
          )}
          {order.notes && (
            <InfoRow icon="solar:notes-bold" label="Notes for the shop" value={order.notes} />
          )}
        </Stack>
      </Section>

      {/* Items */}
      <Section icon="solar:box-bold" title={`Items (${itemCount})`}>
        <Stack divider={<Divider sx={{ borderStyle: 'dashed' }} />} spacing={2}>
          {order.items.map((item, index) => {
            const breakdown = computeUnitPrice({
              base: item.basePrice,
              width: item.width,
              height: item.height,
            });
            const open = expanded === index;
            return (
              <Box key={index}>
                <Box sx={{ display: 'flex', gap: 2 }}>
                  <Avatar variant="rounded" src={item.image} alt={item.name} sx={{ width: 56, height: 56 }} />
                  <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                    <Typography variant="subtitle2">{item.name}</Typography>
                    <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }}>
                      {item.width} in × {item.height} in · Qty {item.qty}
                    </Typography>
                    <Typography variant="subtitle2" sx={{ mt: 0.5 }}>
                      {fPeso(item.unitPrice)}{' '}
                      <Typography component="span" variant="caption" sx={{ color: 'text.secondary' }}>
                        / unit
                      </Typography>
                    </Typography>
                  </Box>
                  <Typography variant="subtitle2" sx={{ whiteSpace: 'nowrap' }}>
                    {fPeso(item.unitPrice * item.qty)}
                  </Typography>
                </Box>

                <Button
                  size="small"
                  color="inherit"
                  onClick={() => setExpanded(open ? null : index)}
                  endIcon={
                    <Iconify icon={open ? 'eva:arrow-ios-upward-fill' : 'eva:arrow-ios-downward-fill'} />
                  }
                  sx={{ mt: 0.5 }}
                >
                  See price breakdown
                </Button>
                <Collapse in={open}>
                  <Box
                    sx={{
                      mt: 1,
                      p: 1.5,
                      borderRadius: 1,
                      bgcolor: (theme) => theme.vars.palette.background.neutral,
                    }}
                  >
                    <BreakdownRow label="Base price" value={breakdown.base} />
                    <BreakdownRow label="Surface area" value={breakdown.surface} />
                    <BreakdownRow label="Perimeter" value={breakdown.perimeter} />
                    <Divider sx={{ my: 0.5, borderStyle: 'dashed' }} />
                    <BreakdownRow label="Unit price" value={breakdown.unit} bold />
                  </Box>
                </Collapse>
              </Box>
            );
          })}
        </Stack>
      </Section>

      {/* Order summary */}
      <Section icon="solar:wallet-money-bold" title="Order summary">
        <Stack spacing={1}>
          <BreakdownRow label={`Items subtotal (${itemCount})`} value={itemsSubtotal} />
          <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              {isDelivery ? 'Delivery fee' : 'Pickup'}
            </Typography>
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              {isDelivery ? 'Quoted separately' : 'Free'}
            </Typography>
          </Box>
          {order.confirmedAmount != null && (
            <BreakdownRow label="Estimated total" value={order.estTotal} />
          )}
          <Divider sx={{ borderStyle: 'dashed' }} />
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <Typography variant="subtitle1" sx={{ flexGrow: 1 }}>
              {order.confirmedAmount != null ? 'Total to pay' : 'Estimated total'}
            </Typography>
            <Typography variant="h6" sx={{ color: `${accent}.main` }}>
              {fPeso(order.confirmedAmount ?? order.estTotal)}
            </Typography>
          </Box>
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
            {order.confirmedAmount != null
              ? 'Final amount confirmed by the shop.'
              : 'Final amount is confirmed by the shop.'}
          </Typography>
        </Stack>
      </Section>

      {/* Actions */}
      <Stack spacing={1.5}>
        <Button
          variant="contained"
          startIcon={<Iconify icon="solar:refresh-bold" />}
          onClick={handleReorder}
        >
          Reorder
        </Button>
        <Button
          variant="outlined"
          color="inherit"
          startIcon={<Iconify icon="solar:chat-round-line-bold" />}
          onClick={() => showToast('Opening a message to the shop…', 'info')}
        >
          Contact shop about this order
        </Button>
        {canCancel && (
          <Button variant="text" color="error" onClick={() => setConfirmCancel(true)}>
            Cancel order
          </Button>
        )}
      </Stack>

      <ConfirmDialog
        open={confirmCancel}
        title="Cancel this order?"
        content="This can't be undone."
        confirmLabel="Yes, cancel"
        cancelLabel="Keep order"
        onClose={() => setConfirmCancel(false)}
        onConfirm={async () => {
          if (!order) return;
          try {
            await cancelOrder(order.id);
            showToast('Order cancelled.', 'warning');
            setTimeout(() => router.push('/buyer/orders'), 600);
          } catch {
            showToast('Could not cancel this order.', 'error');
          }
        }}
      />

      {toast}
    </Box>
  );
}

// ----------------------------------------------------------------------

function Section({
  icon,
  title,
  action,
  children,
}: {
  icon: string;
  title: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <Card sx={{ p: 2.5, mb: 2 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
        <Iconify icon={icon} width={20} sx={{ color: 'primary.main' }} />
        <Typography variant="subtitle1" sx={{ flexGrow: 1 }}>
          {title}
        </Typography>
        {action}
      </Box>
      {children}
    </Card>
  );
}

function InfoRow({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <Box sx={{ display: 'flex', gap: 1.5, py: 0.75 }}>
      <Iconify icon={icon} width={20} sx={{ color: 'text.disabled', mt: 0.25, flexShrink: 0 }} />
      <Box sx={{ minWidth: 0 }}>
        <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }}>
          {label}
        </Typography>
        <Typography variant="body2">{value}</Typography>
      </Box>
    </Box>
  );
}

function BreakdownRow({ label, value, bold }: { label: string; value: number; bold?: boolean }) {
  return (
    <Box sx={{ display: 'flex', justifyContent: 'space-between', py: 0.25 }}>
      <Typography
        variant={bold ? 'subtitle2' : 'body2'}
        sx={{ color: bold ? 'text.primary' : 'text.secondary' }}
      >
        {label}
      </Typography>
      <Typography variant={bold ? 'subtitle2' : 'body2'}>{fPeso(value)}</Typography>
    </Box>
  );
}

// ----------------------------------------------------------------------

function statusHero(order: Order): { icon: string; title: string; sub: string; color: LabelColor } {
  const color = ORDER_STATUS_COLOR[order.status];
  const delivery = order.fulfilment === 'delivery';

  if (order.type === 'reservation') {
    const subs: Record<OrderStatus, string> = {
      new: 'Your items are reserved and held for you.',
      pending: 'The shop is reviewing your reservation.',
      confirmed: 'Your reservation is confirmed.',
      ready: 'Your reserved items are ready at the store.',
      completed: 'Reservation completed. Thank you!',
      cancelled: 'This reservation was released.',
    };
    return {
      icon: 'solar:bookmark-bold',
      title: RESERVATION_STATUS_LABEL[order.status],
      sub: subs[order.status],
      color,
    };
  }

  switch (order.status) {
    case 'new':
      return { icon: 'solar:bag-check-bold', title: 'Order placed', sub: 'We’ve received your order.', color };
    case 'pending':
      return {
        icon: 'solar:clock-circle-bold',
        title: 'Awaiting confirmation',
        sub: 'The shop is reviewing your order.',
        color,
      };
    case 'confirmed':
      return {
        icon: 'solar:box-bold',
        title: 'Order confirmed',
        sub: delivery ? 'Being prepared for delivery.' : 'Being prepared for pickup.',
        color,
      };
    case 'ready':
      return delivery
        ? { icon: 'solar:delivery-bold', title: 'Out for delivery', sub: 'Your order is on the way.', color }
        : { icon: 'solar:shop-bold', title: 'Ready for pickup', sub: 'Ready at the store for pickup.', color };
    case 'completed':
      return { icon: 'solar:check-circle-bold', title: 'Completed', sub: 'Thank you for your order!', color };
    case 'cancelled':
      return { icon: 'solar:close-circle-bold', title: 'Cancelled', sub: 'This order was cancelled.', color };
    default:
      return { icon: 'solar:bag-check-bold', title: 'Order', sub: '', color };
  }
}
