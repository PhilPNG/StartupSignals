import { database } from '@/lib/supabase';

export async function GET() {
  if (process.env.DEMO_SAMPLE_MODE === 'true') return Response.json({ ok: true, mode: 'sample' });
  try {
    const db = database();
    const [companies, runs, signals] = await Promise.all([
      db.from('companies').select('id', { count: 'exact', head: true }).eq('active', true).eq('is_sample', false),
      db.from('ingestion_runs').select('source,status,started_at,completed_at,rows_accepted').order('started_at', { ascending: false }).limit(100),
      db.from('signals').select('type').limit(1000),
    ]);
    if (companies.error || runs.error || signals.error) throw new Error(companies.error?.message ?? runs.error?.message ?? signals.error?.message);
    const latest = new Map<string, unknown>();
    for (const run of runs.data ?? []) if (!latest.has(run.source)) latest.set(run.source, run);
    return Response.json({ ok: true, mode: 'real', companies: companies.count ?? 0,
      activeSignalTypes: [...new Set((signals.data ?? []).map((row) => row.type))],
      sources: [...latest.values()] });
  } catch (error) {
    console.error('Data health unavailable', error);
    return Response.json({ ok: false, error: 'Data store unavailable' }, { status: 503 });
  }
}
