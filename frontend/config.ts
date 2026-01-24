// Get API URL from environment or detect automatically
const getApiUrl = (): string => {
  // For production build: VITE_API_URL should be set in .env.production
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL as string;
  }
  
  // Auto-detect based on current location
  const hostname = window.location.hostname;
  const protocol = window.location.protocol;
  
  // If accessing via remote host (not localhost), use same origin for API
  if (hostname !== 'localhost' && hostname !== '127.0.0.1') {
    return `${protocol}//${hostname}`;
  }
  
  // Local development - use localhost:3001
  return 'https://arie-diversiform-hilde.ngrok-free.dev';
};

// Get callback URL for N8N
const getCallbackUrl = (): string => {
  // For debugging, explicitly set the ngrok URL
  return "https://arie-diversiform-hilde.ngrok-free.dev/api/webhook/n8n/callback";
};

export const SETTINGS = {
  // Set this to false to attempt real N8N calls
  MOCK: import.meta.env.VITE_MOCK === 'true',
  N8N_WEBHOOK_URL: (import.meta.env.VITE_N8N_WEBHOOK_URL as string) || "https://n8n.avatara.id/webhook/fluxlabs",
  CALLBACK_URL: getCallbackUrl()
};

// Expose API URL for backendService
export const API_CONFIG = {
  BASE_URL: getApiUrl()
};
