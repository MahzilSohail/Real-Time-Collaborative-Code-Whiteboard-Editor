import { io, Socket } from 'socket.io-client';

// In production (Vercel), Vercel cannot proxy WebSocket upgrades — connect directly to backend.
// In development, Vite's proxy handles /socket.io so we use window.location.origin.
const BACKEND_URL = import.meta.env.VITE_BACKEND_URL;
const SOCKET_URL = BACKEND_URL || window.location.origin;

let socketInstance: Socket | null = null;

export function getSocket(): Socket {
  const token = localStorage.getItem('collab_token');

  if (!socketInstance) {
    socketInstance = io(SOCKET_URL, {
      auth: { token },
      autoConnect: false,
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      // Always try WebSocket first; fall back to polling only if needed
      transports: ['websocket', 'polling'],
    });
  } else if (token) {
    socketInstance.auth = { token };
  }

  return socketInstance;
}

export function disconnectSocket() {
  if (socketInstance) {
    socketInstance.disconnect();
    socketInstance = null;
  }
}
