export const BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:5000';
export const SOCKET_URL = process.env.EXPO_PUBLIC_SOCKET_URL ?? 'http://localhost:5000';

export const ALLOWED_REACTIONS = ['👍', '❤️', '😂', '😮', '😢', '🙏'] as const;

export const MESSAGE_PAGE_SIZE = 50;
