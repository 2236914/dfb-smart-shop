import type { OrderStatus } from 'src/data/types';

import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Grid from '@mui/material/Grid';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import Avatar from '@mui/material/Avatar';
import Button from '@mui/material/Button';
import Select from '@mui/material/Select';
import Divider from '@mui/material/Divider';
import MenuItem from '@mui/material/MenuItem';
import TableRow from '@mui/material/TableRow';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import CardHeader from '@mui/material/CardHeader';
import TableContainer from '@mui/material/TableContainer';
import LinearProgress from '@mui/material/LinearProgress';

import { RouterLink } from 'src/routes/components';

import { useAsync } from 'src/hooks/use-async';

import { fDateTime } from 'src/utils/format-time';

import { DashboardContent } from 'src/layouts/dashboard';
import { fetchOrder, updateOrder } from 'src/services/db';
import { fPeso, formatItemSize, computeUnitPrice } from 'src/data/pricing';
import {
  ORDER_STATUS_LABEL,
  ORDER_STATUS_COLOR,
  ORDER_STATUS_OPTIONS,
} from 'src/data/status';

import { Label } from 'src/components/label';
import { useToast } from 'src/components/toast';
import { Iconify } from 'src/components/iconify';
import { Scrollbar } from 'src/components/scrollbar';
import { ConfirmDialog } from 'src/components/confirm-dialog';

// ----------------------------------------------------------------------
// A-4. Order Detail (Admin View) — full price breakdown + manual status.
// ----------------------------------------------------------------------

export function OrderDetailView() {
  const { id } = useParams();
  const { showToast, toast } = useToast();

  const { data: order, loading, refetch } = useAsync(
    () => (id ? fetchOrder(id) : Promise.resolve(null)),
    [id]
  );

  const [status, setStatus] = useState<OrderStatus>('pending');
  const [confirmedAmount, setConfirmedAmount] = useState('');
  const [staffNote, setStaffNote] = useState('');
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!order) return;
    setStatus(order.status);
    setConfirmedAmount(order.confirmedAmount != null ? String(order.confirmedAmount) : '');
    setStaffNote(order.staffNote ?? '');
  }, [order]);

  if (loading) {
    return (
      <DashboardContent>
        <LinearProgress sx={{ mt: 2 }} />
      </DashboardContent>
    );
  }

  if (!order) {
    return (
      <DashboardContent>
        <Typography variant="h4" sx={{ mb: 2 }}>
          Order not found
        </Typography>
        <Button component={RouterLink} href="/admin/orders" color="inherit">
          Back to Orders
        </Button>
      </DashboardContent>
    );
  }

  const handleUpdateStatus = async () => {
    if (!id) return;
    setSaving(true);
    try {
      await updateOrder(id, { status });
      showToast('Order updated. Customer will see the new status.');
      refetch();
    } catch {
      showToast('Could not update order.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleSave = async () => {
    if (!id) return;
    setSaving(true);
    try {
      await updateOrder(id, {
        confirmedAmount: confirmedAmount === '' ? null : Number(confirmedAmount),
        staffNote: staffNote.trim() || null,
      });
      showToast('Changes saved.');
      refetch();
    } catch {
      showToast('Could not save changes.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleCancelOrder = async () => {
    if (!id) return;
    try {
      await updateOrder(id, { status: 'cancelled' });
      setStatus('cancelled');
      showToast('Order cancelled.', 'warning');
      refetch();
    } catch {
      showToast('Could not cancel order.', 'error');
    }
  };

  return (
    <DashboardContent>
      <Box sx={{ mb: 4 }}>
        <Button
          component={RouterLink}
          href="/admin/orders"
          color="inherit"
          startIcon={<Iconify icon="eva:arrow-ios-back-fill" />}
          sx={{ mb: 2 }}
        >
          Orders
        </Button>

        <Box
          sx={{
            gap: 2,
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
          }}
        >
          <Typography variant="h4">Order {order.code}</Typography>
          <Label color={ORDER_STATUS_COLOR[status]}>{ORDER_STATUS_LABEL[status]}</Label>
          {order.source === 'visual_search' && (
            <Label color="info" startIcon={<Iconify icon="solar:camera-bold" />}>
              Matched via Visual Search
            </Label>
          )}
          <Box sx={{ flexGrow: 1 }} />
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            {fDateTime(order.createdAt)}
          </Typography>
        </Box>
      </Box>

      <Grid container spacing={3}>
        {/* Left: items + summary */}
        <Grid size={{ xs: 12, md: 8 }}>
          <Card sx={{ mb: 3 }}>
            <CardHeader title="Items" />
            <Scrollbar>
              <TableContainer sx={{ overflow: 'unset', mt: 1 }}>
                <Table sx={{ minWidth: 640 }}>
                  <TableHead>
                    <TableRow>
                      <TableCell>Product</TableCell>
                      <TableCell>Custom Size</TableCell>
                      <TableCell align="center">Qty</TableCell>
                      <TableCell>Unit Price</TableCell>
                      <TableCell align="right">Line Total</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {order.items.map((item, index) => {
                      const breakdown = computeUnitPrice({
                        base: item.basePrice,
                        width: item.width,
                        height: item.height,
                      });
                      return (
                        <TableRow key={index}>
                          <TableCell>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                              <Avatar
                                variant="rounded"
                                src={item.image}
                                alt={item.name}
                                sx={{ width: 56, height: 56, bgcolor: 'background.neutral' }}
                              >
                                <Iconify icon="solar:box-bold" width={24} sx={{ color: 'text.disabled' }} />
                              </Avatar>
                              <Typography variant="subtitle2">{item.name}</Typography>
                            </Box>
                          </TableCell>
                          <TableCell sx={{ whiteSpace: 'nowrap' }}>
                            {formatItemSize(item.width, item.height)}
                          </TableCell>
                          <TableCell align="center">{item.qty}</TableCell>
                          <TableCell>
                            <Typography variant="body2">{fPeso(item.unitPrice)}</Typography>
                            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                              base {fPeso(breakdown.base)} · surface {fPeso(breakdown.surface)} ·
                              perimeter {fPeso(breakdown.perimeter)}
                            </Typography>
                          </TableCell>
                          <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
                            {fPeso(item.lineTotal)}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </TableContainer>
            </Scrollbar>

            <Divider sx={{ borderStyle: 'dashed' }} />

            <Stack spacing={1} sx={{ p: 3, alignItems: 'flex-end' }}>
              <Box sx={{ display: 'flex', gap: 4 }}>
                <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                  Estimated Total
                </Typography>
                <Typography variant="subtitle1">{fPeso(order.estTotal)}</Typography>
              </Box>
              <Box sx={{ width: 260 }}>
                <TextField
                  fullWidth
                  size="small"
                  type="number"
                  label="Final Confirmed Amount"
                  placeholder="Enter confirmed price"
                  value={confirmedAmount}
                  onChange={(e) => setConfirmedAmount(e.target.value)}
                  slotProps={{ inputLabel: { shrink: true } }}
                />
              </Box>
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                Payment is arranged with the customer offline.
              </Typography>
            </Stack>
          </Card>

          {/* Visual-search reference: customer's photo + the size they entered */}
          {order.items.some((item) => item.referencePhoto) && (
            <Card sx={{ mb: 3 }}>
              <CardHeader
                title="Customer Reference Photo"
                subheader="Submitted via AI visual search"
              />
              <Stack spacing={2} sx={{ p: 3 }}>
                {order.items
                  .filter((item) => item.referencePhoto)
                  .map((item, index) => (
                    <Box key={index} sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
                      <Box
                        component="img"
                        src={item.referencePhoto}
                        alt={`Reference for ${item.name}`}
                        sx={{
                          width: 96,
                          height: 96,
                          objectFit: 'cover',
                          borderRadius: 1.5,
                          border: (theme) => `1px solid ${theme.vars.palette.divider}`,
                        }}
                      />
                      <Box>
                        <Typography variant="subtitle2">{item.name}</Typography>
                        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                          Customer-entered size: {formatItemSize(item.width, item.height)} · Qty {item.qty}
                        </Typography>
                        <Typography variant="caption" sx={{ color: 'text.disabled' }}>
                          Matched to this product from the customer&apos;s photo.
                        </Typography>
                      </Box>
                    </Box>
                  ))}
              </Stack>
            </Card>
          )}
        </Grid>

        {/* Right: customer + status + actions */}
        <Grid size={{ xs: 12, md: 4 }}>
          <Card sx={{ p: 3, mb: 3 }}>
            <Typography variant="h6" sx={{ mb: 2 }}>
              Customer
            </Typography>
            <Stack spacing={1.5}>
              <InfoRow icon="solar:user-bold" text={order.customerName} />
              <InfoRow icon="solar:phone-bold" text={order.customerMobile} />
              <InfoRow icon="solar:letter-bold" text={order.customerEmail} />
              <Divider sx={{ borderStyle: 'dashed' }} />
              <InfoRow
                icon={
                  order.fulfilment === 'delivery'
                    ? 'solar:delivery-bold'
                    : 'solar:shop-bold'
                }
                text={
                  order.fulfilment === 'delivery'
                    ? 'Delivery requested (quote separately)'
                    : 'Pickup at store'
                }
              />
              {order.fulfilment === 'delivery' && order.address && (
                <InfoRow icon="solar:map-point-bold" text={order.address} />
              )}
              {order.notes && (
                <Box
                  sx={{
                    p: 1.5,
                    borderRadius: 1.5,
                    display: 'flex',
                    gap: 1,
                    bgcolor: 'warning.lighter',
                  }}
                >
                  <Iconify
                    icon="solar:notes-bold"
                    width={18}
                    sx={{ color: 'warning.darker', mt: 0.25, flexShrink: 0 }}
                  />
                  <Box>
                    <Typography
                      variant="caption"
                      sx={{ color: 'warning.darker', display: 'block', fontWeight: 700 }}
                    >
                      Customer notes
                    </Typography>
                    <Typography variant="body2" sx={{ color: 'warning.darker' }}>
                      {order.notes}
                    </Typography>
                  </Box>
                </Box>
              )}
            </Stack>
          </Card>

          <Card sx={{ p: 3, mb: 3 }}>
            <Typography variant="h6" sx={{ mb: 2 }}>
              Status
            </Typography>
            <Select
              fullWidth
              size="small"
              value={status}
              onChange={(e) => setStatus(e.target.value as OrderStatus)}
              sx={{ mb: 2 }}
            >
              {ORDER_STATUS_OPTIONS.map((s) => (
                <MenuItem key={s} value={s}>
                  {ORDER_STATUS_LABEL[s]}
                </MenuItem>
              ))}
            </Select>
            <Button
              fullWidth
              variant="contained"
              color="inherit"
              onClick={handleUpdateStatus}
              loading={saving}
            >
              Update Status
            </Button>

            <TextField
              fullWidth
              multiline
              rows={3}
              label="Staff note (not shown to customer)"
              value={staffNote}
              onChange={(e) => setStaffNote(e.target.value)}
              sx={{ mt: 3 }}
              slotProps={{ inputLabel: { shrink: true } }}
            />
          </Card>

          <Card sx={{ p: 3 }}>
            <Stack spacing={1.5}>
              <Button variant="contained" onClick={handleSave} loading={saving}>
                Save Changes
              </Button>
              <Button
                variant="outlined"
                color="error"
                disabled={status === 'cancelled'}
                onClick={() => setConfirmCancel(true)}
              >
                Cancel Order
              </Button>
              <Button
                variant="outlined"
                color="inherit"
                startIcon={<Iconify icon="solar:printer-bold" />}
                onClick={() => window.print()}
              >
                Print Order Slip
              </Button>
              {order.fulfilment === 'delivery' && order.status !== 'cancelled' && (
                <Button
                  variant="outlined"
                  color="inherit"
                  startIcon={<Iconify icon="solar:map-arrow-up-bold" />}
                  href={`/track/${order.id}`}
                  target="_blank"
                  rel="noopener"
                >
                  Open Rider Tracking
                </Button>
              )}
            </Stack>
          </Card>
        </Grid>
      </Grid>

      <ConfirmDialog
        open={confirmCancel}
        title="Cancel this order?"
        content="This will mark the order as cancelled. This can't be undone."
        confirmLabel="Cancel Order"
        cancelLabel="Keep Order"
        onClose={() => setConfirmCancel(false)}
        onConfirm={handleCancelOrder}
      />

      {toast}
    </DashboardContent>
  );
}

// ----------------------------------------------------------------------

function InfoRow({ icon, text }: { icon: string; text: string }) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
      <Iconify icon={icon} width={18} sx={{ color: 'text.secondary', flexShrink: 0 }} />
      <Typography variant="body2">{text}</Typography>
    </Box>
  );
}
