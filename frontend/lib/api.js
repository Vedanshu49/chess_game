const base = typeof window !== 'undefined' ? '' : 'http://localhost:8000';
export async function py(path, opts = {}) {
  const res = await fetch(`${base}/py${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...opts
  });
  const data = await res.json().catch(()=>({ ok:false, error:'invalid json'}));
  if (!res.ok || data.ok === false) throw new Error(data.error || 'API error');
  return data;
}
