import { useState } from 'react';
import { useParams } from 'react-router-dom';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
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

import { fPeso, computeUnitPrice } from 'src/data/pricing';
import { fetchOrder, cancelOrder, fetchOrderEvents } from 'src/services/db';

import { useToast } from 'src/components/toast';
import { Iconify } from 'src/components/iconify';
import { ConfirmDialog } from 'src/components/confirm-dialog';

import { useCart } from 'src/sections/store/cart-context';

import { BuyerStatusBadge } from '../buyer-status-badge';
import { BuyerOrderTracker } from '../buyer-order-tracker';

// ----------------------------------------------------------------------
// B-5 / B-6. Order (and Reservation) Detail — computed price breakdown +
// shop-set status (no courier tracking).
// ----------------------------------------------------------------------

export function BuyerOrderDetailView() {
  const { id } = useParams();
  const router = useRouter();
  const { addItem } = useCart();
  const { showToast, toast } = useToast();

  const { data, loading } = useAsync(
    () =>
      id
        ? Promise.all([fetchOrder(id), fetchOrderEvents(id)]).then(([o, events]) => ({ o, events }))
        : Promise.resolve(null),
    [id]
  );
  const order = data?.o ?? null;
  const events = data?.events ?? [];

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
  const [expanded, setExpanded] = useState<number | null>(null);
  const [confirmCancel, setConfirmCancel] = useState(false);

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

  return (
    <Box>
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

      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
        <Typography variant="h5" sx={{ flexGrow: 1 }}>
          {order.code}
        </Typography>
        <BuyerStatusBadge order={order} />
      </Box>
      <Typography variant="caption" sx={{ color: 'text.secondary' }}>
        {fDateTime(order.createdAt)}
      </Typography>

      {/* Status tracker */}
      <Box sx={{ mt: 2 }}>
        <BuyerOrderTracker order={order} events={events} />
      </Box>

      {/* Status helper */}
      <Alert severity="info" icon={<Iconify icon="solar:info-circle-bold" />} sx={{ my: 2 }}>
        {isReservation
          ? 'Reserved items are held for you. The shop will confirm pickup and payment. Reservations may expire if not confirmed — the shop will contact you.'
          : `The shop updates this status. You'll be contacted at ${order.customerMobile} for confirmation and payment.`}
      </Alert>

      {/* Items */}
      <Card sx={{ p: 2, mb: 2 }}>
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
                  <Avatar
                    variant="rounded"
                    src={item.image}
                    alt={item.name}
                    sx={{ width: 56, height: 56 }}
                  />
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
                </Box>

                <Button
                  size="small"
                  color="inherit"
                  onClick={() => setExpanded(open ? null : index)}
                  endIcon={
                    <Iconify
                      icon={open ? 'eva:arrow-ios-upward-fill' : 'eva:arrow-ios-downward-fill'}
                    />
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
      </Card>

      {/* Summary */}
      <Card sx={{ p: 2, mb: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center' }}>
          <Typography variant="subtitle1" sx={{ flexGrow: 1 }}>
            Estimated Total
          </Typography>
          <Typography variant="h6">{fPeso(order.estTotal)}</Typography>
        </Box>
        <Typography variant="caption" sx={{ color: 'text.secondary' }}>
          Final amount confirmed by the shop.
        </Typography>
      </Card>

      {/* Fulfilment */}
      <Card sx={{ p: 2, mb: 2 }}>
        <Typography variant="subtitle2" sx={{ mb: 1 }}>
          Fulfilment
        </Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Iconify
            icon={order.fulfilment === 'delivery' ? 'solar:delivery-bold' : 'solar:shop-bold'}
            sx={{ color: 'text.secondary' }}
          />
          <Typography variant="body2">
            {order.fulfilment === 'delivery'
              ? 'Delivery requested — shop will quote separately'
              : 'Pickup at store'}
          </Typography>
        </Box>
        {order.fulfilment === 'delivery' && order.address && (
          <Typography variant="body2" sx={{ color: 'text.secondary', mt: 1 }}>
            {order.address}
          </Typography>
        )}
        {order.notes && (
          <Box sx={{ mt: 1.5 }}>
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
              Notes for the shop
            </Typography>
            <Typography variant="body2">{order.notes}</Typography>
          </Box>
        )}
      </Card>

      {/* Actions */}
      <Stack spacing={1.5}>
        <Button
          variant="contained"
          startIcon={<Iconify icon="solar:refresh-bold" />}
          onClick={handleReorder}
        >
          Reorder
        </Button>
        {canCancel && (
          <Button variant="outlined" color="error" onClick={() => setConfirmCancel(true)}>
            Cancel Order
          </Button>
        )}
        <Button
          variant="outlined"
          color="inherit"
          startIcon={<Iconify icon="solar:chat-round-line-bold" />}
          onClick={() => showToast('Opening a message to the shop…', 'info')}
        >
          Contact Shop About This Order
        </Button>
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

function BreakdownRow({ label, value, bold }: { label: string; value: number; bold?: boolean }) {
  return (
    <Box sx={{ display: 'flex', justifyContent: 'space-between', py: 0.25 }}>
      <Typography variant={bold ? 'subtitle2' : 'body2'} sx={{ color: bold ? 'text.primary' : 'text.secondary' }}>
        {label}
      </Typography>
      <Typography variant={bold ? 'subtitle2' : 'body2'}>{fPeso(value)}</Typography>
    </Box>
  );
}
