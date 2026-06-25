import type { OrderStatus } from 'src/data/types';

import { useMemo, useState, useCallback } from 'react';

import Box from '@mui/material/Box';
import Tab from '@mui/material/Tab';
import Card from '@mui/material/Card';
import Tabs from '@mui/material/Tabs';
import Table from '@mui/material/Table';
import Alert from '@mui/material/Alert';
import TableRow from '@mui/material/TableRow';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import InputAdornment from '@mui/material/InputAdornment';
import TableContainer from '@mui/material/TableContainer';
import LinearProgress from '@mui/material/LinearProgress';

import { useAsync } from 'src/hooks/use-async';
import { useRealtimeRefetch } from 'src/hooks/use-realtime';

import { ORDER_STATUS_LABEL } from 'src/data/status';
import { DashboardContent } from 'src/layouts/dashboard';
import { fetchOrders, updateOrder } from 'src/services/db';

import { useToast } from 'src/components/toast';
import { Iconify } from 'src/components/iconify';
import { Scrollbar } from 'src/components/scrollbar';

import { OrderTableRow } from '../order-table-row';

// ----------------------------------------------------------------------
// A-3. Orders Management — admin retrieves and updates orders (Objective 4).
// ----------------------------------------------------------------------

type FilterTab =
  | 'all'
  | 'new'
  | 'pending'
  | 'confirmed'
  | 'ready'
  | 'completed'
  | 'cancelled'
  | 'reservations';

const TABS: { value: FilterTab; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'new', label: 'New' },
  { value: 'pending', label: 'Pending' },
  { value: 'confirmed', label: 'Confirmed' },
  { value: 'ready', label: 'Ready for Pickup' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
  { value: 'reservations', label: 'Reservations' },
];

export function OrdersView() {
  const { showToast, toast } = useToast();

  const { data, loading, error, refetch } = useAsync(fetchOrders, []);
  useRealtimeRefetch('orders', refetch);
  const orders = useMemo(() => data ?? [], [data]);

  const [tab, setTab] = useState<FilterTab>('all');
  const [search, setSearch] = useState('');

  const handleStatusChange = useCallback(
    async (id: string, status: OrderStatus) => {
      try {
        await updateOrder(id, { status });
        showToast(`Order updated to "${ORDER_STATUS_LABEL[status]}".`);
        refetch();
      } catch {
        showToast('Could not update order.', 'error');
      }
    },
    [refetch, showToast]
  );

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return orders.filter((o) => {
      const matchTab =
        tab === 'all'
          ? true
          : tab === 'reservations'
            ? o.type === 'reservation'
            : o.status === tab;
      const matchSearch =
        !query ||
        o.code.toLowerCase().includes(query) ||
        o.customerName.toLowerCase().includes(query);
      return matchTab && matchSearch;
    });
  }, [orders, tab, search]);

  return (
    <DashboardContent>
      <Typography variant="h4" sx={{ mb: 5 }}>
        Orders
      </Typography>

      <Card>
        <Tabs
          value={tab}
          onChange={(_, value) => setTab(value)}
          variant="scrollable"
          scrollButtons="auto"
          sx={{ px: 2, borderBottom: (theme) => `1px solid ${theme.vars.palette.divider}` }}
        >
          {TABS.map((t) => (
            <Tab key={t.value} value={t.value} label={t.label} />
          ))}
        </Tabs>

        <Box sx={{ p: 2.5 }}>
          <TextField
            fullWidth
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by order # or customer name…"
            slotProps={{
              input: {
                startAdornment: (
                  <InputAdornment position="start">
                    <Iconify icon="eva:search-fill" sx={{ color: 'text.disabled' }} />
                  </InputAdornment>
                ),
              },
            }}
          />
        </Box>

        {error && (
          <Alert severity="error" sx={{ mx: 2.5, mb: 2 }}>
            Couldn&apos;t load orders: {error}
          </Alert>
        )}
        {loading && <LinearProgress />}

        <Scrollbar>
          <TableContainer sx={{ overflow: 'unset' }}>
            <Table sx={{ minWidth: 980 }}>
              <TableHead>
                <TableRow>
                  <TableCell>Order #</TableCell>
                  <TableCell>Customer</TableCell>
                  <TableCell>Items</TableCell>
                  <TableCell>Est. Total</TableCell>
                  <TableCell>Type</TableCell>
                  <TableCell>Fulfilment</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Date</TableCell>
                  <TableCell align="right" />
                </TableRow>
              </TableHead>
              <TableBody>
                {filtered.map((order) => (
                  <OrderTableRow
                    key={order.id}
                    row={order}
                    onStatusChange={handleStatusChange}
                  />
                ))}

                {!loading && filtered.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={9} align="center" sx={{ py: 8 }}>
                      <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                        No orders in this category.
                      </Typography>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </Scrollbar>
      </Card>

      {toast}
    </DashboardContent>
  );
}
