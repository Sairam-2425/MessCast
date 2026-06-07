// EXPO_PUBLIC_API_URL / EXPO_PUBLIC_SOCKET_URL are injected at build time via eas.json.
// The fallback must point at the deployed backend, never localhost — a physical device
// can't reach the developer machine's loopback address.
export const BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'https://messcast-1.onrender.com';
export const SOCKET_URL = process.env.EXPO_PUBLIC_SOCKET_URL ?? 'https://messcast-1.onrender.com';

export const ALLOWED_REACTIONS = ['👍', '❤️', '😂', '😮', '😢', '🙏'] as const;

export const MESSAGE_PAGE_SIZE = 50;
