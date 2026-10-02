const TOKEN_KEY = 'lz_token';
const USER_KEY = 'lz_user';

// sessionStorage: the login ends when the tab is closed (nothing is kept on a shared office computer).
export const getToken = () => sessionStorage.getItem(TOKEN_KEY);
export const getUser = () => {
  try {
    return JSON.parse(sessionStorage.getItem(USER_KEY));
  } catch (e) {
    return null;
  }
};
export const setSession = (token, user) => {
  sessionStorage.setItem(TOKEN_KEY, token);
  sessionStorage.setItem(USER_KEY, JSON.stringify(user));
};
export const clearSession = () => {
  sessionStorage.removeItem(TOKEN_KEY);
  sessionStorage.removeItem(USER_KEY);
};

let onUnauthorized = () => {};
export const setUnauthorizedHandler = (fn) => {
  onUnauthorized = fn;
};

const buildUrl = (path, params) => {
  const url = new URL(`/api${path}`, window.location.origin);
  Object.entries(params || {}).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, v);
  });
  return url.toString();
};

// JSON helper. Throws Error(server message) on failure; a 401 on a logged-in session signs the user out.
export async function api(path, { method = 'GET', body, params } = {}) {
  const token = getToken();
  const res = await fetch(buildUrl(path, params), {
    method,
    headers: {
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  let data = {};
  try {
    data = await res.json();
  } catch (e) {
    // no JSON body
  }
  if (res.status === 401 && token) {
    clearSession();
    onUnauthorized();
  }
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

// Photos need the login token, so they are fetched as a blob and shown from an object URL.
export async function fetchPhotoBlobUrl(photoPath) {
  const res = await fetch(photoPath, { headers: { Authorization: `Bearer ${getToken()}` } });
  if (!res.ok) throw new Error('Could not load the photo');
  return URL.createObjectURL(await res.blob());
}

// Download a CSV (or any file) the API returns, using the login token.
export async function downloadFile(path, params, filename) {
  const res = await fetch(buildUrl(path, params), { headers: { Authorization: `Bearer ${getToken()}` } });
  if (!res.ok) {
    let msg = `Download failed (${res.status})`;
    try {
      msg = (await res.json()).error || msg;
    } catch (e) {
      // keep default
    }
    throw new Error(msg);
  }
  const url = URL.createObjectURL(await res.blob());
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
