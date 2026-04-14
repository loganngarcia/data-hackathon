/**
 * Base URL for the public nonprofit-data Cloudflare Worker (D1-backed GET APIs).
 * No secret required for reads — admin POSTs still use `X-Admin-Key` on the Worker only.
 *
 * Override with `NONPROFIT_WORKER_URL` or `NEXT_PUBLIC_NONPROFIT_WORKER_URL` when pointing at your own deployment.
 */
const DEFAULT_NONPROFIT_WORKER_URL = "https://nonprofit-data.logangarcia102.workers.dev";

export function getNonprofitWorkerBaseUrl(): string {
  return (
    process.env.NONPROFIT_WORKER_URL?.trim() ||
    process.env.NEXT_PUBLIC_NONPROFIT_WORKER_URL?.trim() ||
    DEFAULT_NONPROFIT_WORKER_URL
  );
}
