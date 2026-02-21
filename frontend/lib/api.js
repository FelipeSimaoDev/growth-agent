const BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
const API_KEY = process.env.NEXT_PUBLIC_API_KEY || '';

async function request(path, options = {}) {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': API_KEY,
      ...(options.headers || {}),
    },
  });

  const json = await res.json();

  if (!res.ok) {
    throw new Error(json.error || `Request failed: ${res.status}`);
  }

  return json;
}

export const api = {
  // Config
  getConfig: () => request('/api/config'),
  updateConfig: (body) => request('/api/config', { method: 'PUT', body: JSON.stringify(body) }),

  // Daily input
  getTodayInput: () => request('/api/daily-input/today'),
  saveTodayInput: (what_was_built) =>
    request('/api/daily-input', { method: 'POST', body: JSON.stringify({ what_was_built }) }),

  // Posts
  getPosts: () => request('/api/posts'),
  getPendingPost: () => request('/api/posts/pending'),
  generatePost: () => request('/api/posts/generate', { method: 'POST' }),
  regeneratePost: (id) => request(`/api/posts/${id}/regenerate`, { method: 'POST' }),
  markPosted: (id) => request(`/api/posts/${id}/mark-posted`, { method: 'POST' }),
};
