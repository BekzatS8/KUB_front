import { useEffect, useRef, useState } from 'react';

const useWebSocket = (chatId: number | null, onMessage: (message: any) => void) => {
    const ws = useRef<WebSocket | null>(null);
    const [isConnected, setIsConnected] = useState(false);

    useEffect(() => {
        if (!chatId) {
            console.log('No chatId provided, skipping WebSocket connection');
            return;
        }

        const token = localStorage.getItem('auth_token');
        if (!token) {
            console.log('No auth token found, skipping WebSocket connection');
            return;
        }

        const wsUrl = `${process.env.NEXT_PUBLIC_WS_BASE_URL || 'wss://api.kubcrm.kz'}/chats/${chatId}/ws?token=${token}`;
        console.log('Connecting to WebSocket:', wsUrl);
        
        ws.current = new WebSocket(wsUrl);

        ws.current.onopen = () => {
            console.log('WebSocket connected successfully for chat:', chatId);
            setIsConnected(true);
        };

        ws.current.onmessage = (event) => {
            console.log('WebSocket message received:', event.data);
            try {
                const message = JSON.parse(event.data);
                console.log('Parsed message:', message);
                onMessage(message);
            } catch (error) {
                console.error('Error parsing WebSocket message:', error);
            }
        };

        ws.current.onclose = (event) => {
            console.log('WebSocket disconnected', {
                code: event.code,
                reason: event.reason,
                wasClean: event.wasClean
            });
            setIsConnected(false);
        };

        ws.current.onerror = (error) => {
            console.error('WebSocket error:', error);
            setIsConnected(false);
        };

        return () => {
            if (ws.current) {
                console.log('Cleaning up WebSocket connection');
                ws.current.close();
            }
        };
    }, [chatId, onMessage]);

    return { isConnected };
};

export default useWebSocket;
