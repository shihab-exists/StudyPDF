/**
 * The app is 100% client-side. This module only exists for the optional
 * serverless smoke-test endpoint (/api/health) used to verify a deployment.
 * No document data is ever sent anywhere.
 */
export async function health(): Promise<{ ok: boolean; runtime: string }> {
  const r = await fetch('/api/health');
  if (!r.ok) throw new Error(`health check failed (${r.status})`);
  return r.json();
}
