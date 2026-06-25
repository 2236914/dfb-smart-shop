import { supabase } from 'src/lib/supabase';

// ----------------------------------------------------------------------
// Objective 4 — real-time data pipeline. Subscribes to Postgres changes
// (insert / update / delete) on a table via Supabase Realtime and invokes a
// callback so the UI can refresh live. Respects Row-Level Security: a client
// only receives changes for rows it is allowed to read.
//
// NOTE: each table must be added to the `supabase_realtime` publication once,
// in the Supabase SQL editor:
//   alter publication supabase_realtime add table public.orders;
//   alter publication supabase_realtime add table public.products;
//   alter publication supabase_realtime add table public.promos;
// ----------------------------------------------------------------------

export function subscribeTable(table: string, onChange: () => void): () => void {
  const channel = supabase
    .channel(`realtime:${table}`)
    .on('postgres_changes', { event: '*', schema: 'public', table }, () => onChange())
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}
