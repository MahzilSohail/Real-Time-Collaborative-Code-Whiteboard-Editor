import { io, Socket } from 'socket.io-client';

// Connects via current host proxy to eliminate cross-origin connection issues
const SOCKET_URL = window.location.origin;

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
