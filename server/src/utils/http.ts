const FORM_URL_ENCODED = "application/x-www-form-urlencoded";

async function fetchJson<T>(url: string, options?: RequestInit) {
  const response = await fetch(url, options);
  if (!response.ok) {
    const body = (await response.text().catch(() => "")).slice(0, 1024);
    const message = [response.status, body].filter(Boolean).join(", ");
    throw new Error(`Request to ${url} failed with status ${message}`);
  }
  return response.json() as Promise<T>;
}

export function postForm<T>(url: string, params: URLSearchParams) {
  return fetchJson<T>(url, {
    method: "POST",
    headers: { "Content-Type": FORM_URL_ENCODED },
    body: params,
  });
}

export function getJson<T>(url: string, headers: Record<string, string> = {}) {
  return fetchJson<T>(url, { method: "GET", headers });
}
