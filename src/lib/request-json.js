// Use a timer rather than AbortSignal.timeout for older mobile browsers.
export async function requestJson(url, { signal, timeoutMs = 20000, ...options } = {}) {
  const controller = new AbortController();
  let timedOut = false;
  const abort = () => controller.abort();
  if (signal?.aborted) controller.abort();
  else signal?.addEventListener('abort', abort, { once: true });
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    const value = await response.json();
    if (!response.ok) throw new Error(value.message || 'The request failed. Please try again.');
    return value;
  } catch (error) {
    if (timedOut) throw new Error('The request took too long. Please try again.');
    if (controller.signal.aborted) throw error;
    throw new Error(
      error.message === 'Failed to fetch' || error instanceof SyntaxError
        ? 'Could not reach the movie service. Please try again.'
        : error.message
    );
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', abort);
  }
}
