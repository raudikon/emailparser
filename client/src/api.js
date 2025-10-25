const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '';

async function fetchWithAuth(endpoint, token, options = {}) {
  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers ?? {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      'ngrok-skip-browser-warning': '1'
    }
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error ?? `Request failed with ${response.status}`);
  }

  return response.json();
}

export async function getEmails(token) {
  const { data } = await fetchWithAuth('/api/emails', token);
  return data;
}

export async function getDailyPosts(token) {
  const { data } = await fetchWithAuth('/api/daily-posts', token);
  return data;
}
