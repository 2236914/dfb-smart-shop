import { useMemo } from 'react';
import { varAlpha } from 'minimal-shared/utils';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Grid from '@mui/material/Grid';
import Table from '@mui/material/Table';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import TableRow from '@mui/material/TableRow';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import CardHeader from '@mui/material/CardHeader';
import Typography from '@mui/material/Typography';
import TableContainer from '@mui/material/TableContainer';
import LinearProgress from '@mui/material/LinearProgress';

import { RouterLink } from 'src/routes/components';

import { useAsync } from 'src/hooks/use-async';
import { useRealtimeRefetch } from 'src/hooks/use-realtime';

import { fDate } from 'src/utils/format-time';

import { useAuth } from 'src/auth';
import { fPeso } from 'src/data/pricing';
import { DashboardContent } from 'src/layouts/dashboard';
import { fetchOrders, fetchProducts } from 'src/services/db';
import { getStockStatus, ORDER_STATUS_LABEL, ORDER_STATUS_COLOR } from 'src/data/status';

import { Label } from 'src/components/label';
import { Iconify } from 'src/components/iconify';
import { Scrollbar } from 'src/components/scrollbar';

import { DfbSummaryCard } from '../dfb-summary-card';

// ----------------------------------------------------------------------
// A-2. Admin Dashboard (Overview) — the owner's at-a-glance view.
// ----------------------------------------------------------------------

export function OverviewAnalyticsView() {
  const { profile } = useAuth();
  const ownerName = profile?.full_name?.trim() || 'Owner';

  const { data, loading, error, refetch } = useAsync(async () => {
    const [products, orders] = await Promise.all([fetchProducts(), fetchOrders()]);
    return { products, orders };
  }, []);
  useRealtimeRefetch(['orders', 'products'], refetch);

  const products = useMemo(() => data?.products ?? [], [data]);
  const orders = useMemo(() => data?.orders ?? [], [data]);

  const stats = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    const newToday = orders.filter(
      (o) => o.status === 'new' || o.createdAt.slice(0, 10) === today
    ).length;
    const pending = orders.filter((o) => o.status === 'pending').length;
    const reservations = orders.filter(
      (o) => o.type === 'reservation' && !['completed', 'cancelled'].includes(o.status)
    ).length;
    const lowStock = products.filter((p) => getStockStatus(p) === 'low_stock').length;
    const outOfStock = products.filter((p) => getStockStatus(p) === 'out_of_stock').length;
    return { newToday, pending, reservations, lowStock, outOfStock };
  }, [orders, products]);

  const recentOrders = useMemo(
    () => [...orders].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 5),
    [orders]
  );

  return (
    <DashboardContent maxWidth="xl">
      <Typography variant="h4" sx={{ mb: 1 }}>
        Welcome back, {ownerName} 👋
      </Typography>
      <Typography variant="body2" sx={{ color: 'text.secondary', mb: { xs: 3, md: 5 } }}>
        Here is what&apos;s happening in your shop today.
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          Couldn&apos;t load shop data: {error}
        </Alert>
      )}
      {loading && <LinearProgress sx={{ mb: 3 }} />}

      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid size={{ xs: 12, sm: 6, md: 2.4 }}>
          <DfbSummaryCard
            title="New Orders Today"
            total={stats.newToday}
            color="info"
            icon="solar:bag-check-bold-duotone"
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 2.4 }}>
          <DfbSummaryCard
            title="Pending Confirmation"
            total={stats.pending}
            color="warning"
            icon="solar:hourglass-bold-duotone"
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 2.4 }}>
          <DfbSummaryCard
            title="Active Reservations"
            total={stats.reservations}
            color="primary"
            icon="solar:bookmark-bold-duotone"
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 2.4 }}>
          <DfbSummaryCard
            title="Low Stock Items"
            total={stats.lowStock}
            color="secondary"
            icon="solar:box-minimalistic-bold-duotone"
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 2.4 }}>
          <DfbSummaryCard
            title="Out of Stock"
            total={stats.outOfStock}
            color="error"
            icon="solar:close-circle-bold-duotone"
          />
        </Grid>
      </Grid>

      <Grid container spacing={3}>
        <Grid size={{ xs: 12, md: 8 }}>
          <Card>
            <CardHeader
              title="Recent Orders"
              action={
                <Button component={RouterLink} href="/admin/orders" size="small" color="inherit">
                  View all
                </Button>
              }
            />
            <Scrollbar>
              <TableContainer sx={{ overflow: 'unset', mt: 1 }}>
                <Table sx={{ minWidth: 720 }}>
                  <TableHead>
                    <TableRow>
                      <TableCell>Order #</TableCell>
                      <TableCell>Customer</TableCell>
                      <TableCell>Items</TableCell>
                      <TableCell>Est. Total</TableCell>
                      <TableCell>Status</TableCell>
                      <TableCell>Date</TableCell>
                      <TableCell align="right" />
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {recentOrders.map((order) => (
                      <TableRow key={order.id} hover>
                        <TableCell sx={{ fontWeight: 'fontWeightSemiBold' }}>
                          {order.code}
                        </TableCell>
                        <TableCell>{order.customerName}</TableCell>
                        <TableCell>
                          {order.items.reduce((n, i) => n + i.qty, 0)} item(s)
                        </TableCell>
                        <TableCell>{fPeso(order.estTotal)}</TableCell>
                        <TableCell>
                          <Label color={ORDER_STATUS_COLOR[order.status]}>
                            {ORDER_STATUS_LABEL[order.status]}
                          </Label>
                        </TableCell>
                        <TableCell>{fDate(order.createdAt)}</TableCell>
                        <TableCell align="right">
                          <Button
                            component={RouterLink}
                            href={`/admin/orders/${order.id}`}
                            size="small"
                            color="inherit"
                          >
                            View
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Scrollbar>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, md: 4 }}>
          <Card
            sx={(theme) => ({
              p: 3,
              height: 1,
              bgcolor: varAlpha(theme.vars.palette.grey['500Channel'], 0.04),
            })}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
              <Iconify icon="solar:bell-bing-bold-duotone" width={24} />
              <Typography variant="h6">Alerts</Typography>
            </Box>

            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <Alert
                severity="warning"
                action={
                  <Button component={RouterLink} href="/admin/inventory" color="inherit" size="small">
                    Review
                  </Button>
                }
              >
                {stats.lowStock + stats.outOfStock} item(s) are low on stock — review inventory.
              </Alert>
              <Alert
                severity="info"
                action={
                  <Button component={RouterLink} href="/admin/orders" color="inherit" size="small">
                    Open
                  </Button>
                }
              >
                {stats.pending} order(s) are waiting for confirmation.
              </Alert>
            </Box>
          </Card>
        </Grid>
      </Grid>
    </DashboardContent>
  );
}
