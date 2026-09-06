import { createContext, useContext, useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import type { RootState } from '../store/store';
import { WS_BASE_URL } from '../../config';

const SocketContext = createContext<WebSocket | null>(null);

export const useSocket = () => useContext(SocketContext);

const getWebSocketUrl = (token: string) =>
  `${WS_BASE_URL}/ws?token=${token}`;

export const SocketProvider = ({ children }: { children: React.ReactNode }) => {
  const { token } = useSelector((state: RootState) => state.auth);
  const [socket, setSocket] = useState<WebSocket | null>(null);

  useEffect(() => {
    if (!token) return;

    console.log('🧠 Creating WebSocket instance');
    const socketInstance = new WebSocket(getWebSocketUrl(token));
    setSocket(socketInstance);

    socketInstance.onopen = () => {
      console.log('✅ WebSocket connected');
    };

    socketInstance.onerror = e => {
      console.error('🚨 WebSocket error:', e);
    };

    socketInstance.onclose = () => {
      console.log('❌ WebSocket disconnected');
    };

    return () => {
      socketInstance.close(); // clean up
    };
  }, [token]);

  return (
    <SocketContext.Provider value={socket}>{children}</SocketContext.Provider>
  );
};
