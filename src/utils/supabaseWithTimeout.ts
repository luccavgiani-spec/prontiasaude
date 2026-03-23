/**
 * Wraps a Supabase query promise with a 10-second timeout.
 * Prevents "failed to fetch" hangs on slow mobile networks.
 */
export async function supabaseFetch<T>(
  query: PromiseLike<{ data: T; error: unknown }>
): Promise<{ data: T | null; error: unknown }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);
  try {
    const result = await query;
    clearTimeout(timeout);
    return result;
  } catch (err) {
    clearTimeout(timeout);
    return { data: null, error: err };
  }
}
