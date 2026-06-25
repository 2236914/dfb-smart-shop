import { useRef, useEffect } from 'react';

import { subscribeTable } from 'src/services/realtime';

// ----------------------------------------------------------------------
// Objective 4 helper: re-runs `refetch` whenever the given table(s) change in
// Supabase. Bursts of events are debounced into a single refetch. Pair with
// useAsync's refetch(), e.g.:
//   const { data, refetch } = useAsync(fetchOrders, []);
//   useRealtimeRefetch('orders', refetch);
// ----------------------------------------------------------------------

export function useRealtimeRefetch(tables: string | string[], refetch: () => void) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const key = (Array.isArray(tables) ? tables : [tables]).join(',');

  useEffect(() => {
    const list = key.split(',');
    const trigger = () => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(refetch, 400);
    };
    const unsubs = list.map((t) => subscribeTable(t, trigger));
    return () => {
      if (timer.current) clearTimeout(timer.current);
      unsubs.forEach((u) => u());
    };
  }, [key, refetch]);
}
