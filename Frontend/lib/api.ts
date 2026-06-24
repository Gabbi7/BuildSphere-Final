export {
  API_URL,
  getApiConfigurationError,
  isLocalApiUrl,
  isTemporaryTunnelApiUrl,
} from './apiConfig';

import { API_URL } from './apiConfig';

export async function checkApiHealth(timeoutMs = 5000) {
  if (!API_URL) return false;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    let response = await fetch(`${API_URL}/health`, {
      method: 'GET',
      signal: controller.signal,
    });

    if (response.status === 404) {
      response = await fetch(`${API_URL}/`, {
        method: 'GET',
        signal: controller.signal,
      });
      if (!response.ok) return false;
      const text = await response.text();
      return text.includes('BuildSphere API is running');
    }

    if (!response.ok) return false;

    const data = await response.json();
    return data?.status === 'ok' && data?.service === 'BuildSphere API';
  } catch (error) {
    return false;
  } finally {
    clearTimeout(timeout);
  }
}

export async function loadStoredApiUrl() {
  return API_URL;
}

