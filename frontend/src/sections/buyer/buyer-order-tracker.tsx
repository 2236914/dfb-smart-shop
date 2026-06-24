import type { OrderEvent } from 'src/services/db';
import type { Order, OrderStatus } from 'src/data/types';

import Card from '@mui/material/Card';
import Timeline from '@mui/lab/Timeline';
import TimelineDot from '@mui/lab/TimelineDot';
import Typography from '@mui/material/Typography';
import TimelineContent from '@mui/lab/TimelineContent';
import TimelineSeparator from '@mui/lab/TimelineSeparator';
import TimelineConnector from '@mui/lab/TimelineConnector';
import TimelineItem, { timelineItemClasses } from '@mui/lab/TimelineItem';

import { fDateTime } from 'src/utils/format-time';

import { ORDER_STATUS_LABEL, RESERVATION_STATUS_LABEL } from 'src/data/status';

// ----------------------------------------------------------------------
// B-5/B-6. Point-by-point order tracker — a vertical timeline of the shop-set
// status changes (newest on top), each with its timestamp. Driven by the
// order_status_events history.
// ----------------------------------------------------------------------

type DotColor = 'grey' | 'primary' | 'success' | 'error';

export function BuyerOrderTracker({ order, events }: { order: Order; events: OrderEvent[] }) {
  const isReservation = order.type === 'reservation';

  const labelFor = (status: OrderStatus) => {
    if (status === 'new') return isReservation ? 'Reserved' : 'Order placed';
    return (isReservation ? RESERVATION_STATUS_LABEL : ORDER_STATUS_LABEL)[status];
  };

  // Newest first; fall back to a single "placed" point if history is empty.
  const items = (events.length ? [...events] : [{ status: 'new' as OrderStatus, createdAt: order.createdAt }])
    .slice()
    .reverse();

  return (
    <Card sx={{ p: 2.5, mb: 2 }}>
      <Typography variant="subtitle2" sx={{ mb: 1 }}>
        Order Status
      </Typography>

      <Timeline
        sx={{
          m: 0,
          p: 0,
          [`& .${timelineItemClasses.root}:before`]: { flex: 0, p: 0 },
        }}
      >
        {items.map((event, i) => {
          const latest = i === 0;
          const color: DotColor =
            event.status === 'cancelled'
              ? 'error'
              : event.status === 'completed'
                ? 'success'
                : latest
                  ? 'primary'
                  : 'grey';

          return (
            <TimelineItem key={`${event.status}-${event.createdAt}`}>
              <TimelineSeparator>
                <TimelineDot color={color} variant={latest ? 'filled' : 'outlined'} />
                {i < items.length - 1 && <TimelineConnector />}
              </TimelineSeparator>
              <TimelineContent sx={{ pb: 2.5 }}>
                <Typography variant="body2" sx={{ fontWeight: latest ? 700 : 500 }}>
                  {labelFor(event.status)}
                </Typography>
                <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                  {fDateTime(event.createdAt)}
                </Typography>
              </TimelineContent>
            </TimelineItem>
          );
        })}
      </Timeline>
    </Card>
  );
}
