// Debug script to test chat API
// This can be run in the browser console to test API endpoints

async function testChatAPI() {
  console.log('Testing Chat API...');
  
  // Test 1: Get auth token
  const token = localStorage.getItem('auth_token');
  console.log('Auth token found:', !!token);
  
  if (!token) {
    console.error('No auth token found. Please login first.');
    return;
  }
  
  // Test 2: Fetch chats
  try {
    console.log('Fetching chats...');
    const chatsResponse = await fetch('/api-proxy/chats', {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (!chatsResponse.ok) {
      throw new Error(`HTTP error! status: ${chatsResponse.status}`);
    }
    
    const chats = await chatsResponse.json();
    console.log('Chats fetched successfully:', chats);
    
    if (chats.length > 0) {
      const firstChat = chats[0];
      console.log('Testing with first chat:', firstChat);
      
      // Test 3: Fetch messages for first chat
      try {
        console.log('Fetching messages for chat:', firstChat.id);
        const messagesResponse = await fetch(`/api-proxy/chats/${firstChat.id}/messages?limit=50&offset=0`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });
        
        if (!messagesResponse.ok) {
          throw new Error(`HTTP error! status: ${messagesResponse.status}`);
        }
        
        const messages = await messagesResponse.json();
        console.log('Messages fetched successfully:', messages);
        
        // Test 4: Send a test message
        try {
          console.log('Sending test message...');
          const sendResponse = await fetch(`/api-proxy/chats/${firstChat.id}/messages`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              text: 'Test message from debug script',
              attachments: []
            })
          });
          
          if (!sendResponse.ok) {
            throw new Error(`HTTP error! status: ${sendResponse.status}`);
          }
          
          const sentMessage = await sendResponse.json();
          console.log('Message sent successfully:', sentMessage);
          
        } catch (sendError) {
          console.error('Error sending message:', sendError);
        }
        
      } catch (messagesError) {
        console.error('Error fetching messages:', messagesError);
      }
    }
    
  } catch (chatsError) {
    console.error('Error fetching chats:', chatsError);
  }
}

// Test WebSocket connection
function testWebSocketConnection() {
  console.log('Testing WebSocket connection...');
  
  const token = localStorage.getItem('auth_token');
  if (!token) {
    console.error('No auth token found for WebSocket test');
    return;
  }
  
  // You need to replace this with an actual chat ID
  const chatId = 1; // Replace with actual chat ID
  
  const wsUrl = `wss://api.kubcrm.kz/chats/${chatId}/ws?token=${token}`;
  console.log('Connecting to WebSocket:', wsUrl);
  
  const ws = new WebSocket(wsUrl);
  
  ws.onopen = () => {
    console.log('WebSocket connected successfully');
  };
  
  ws.onmessage = (event) => {
    console.log('WebSocket message received:', event.data);
  };
  
  ws.onerror = (error) => {
    console.error('WebSocket error:', error);
  };
  
  ws.onclose = (event) => {
    console.log('WebSocket closed:', event.code, event.reason);
  };
  
  // Close after 10 seconds
  setTimeout(() => {
    ws.close();
  }, 10000);
}

// Export functions to be used in browser console
window.testChatAPI = testChatAPI;
window.testWebSocketConnection = testWebSocketConnection;

console.log('Debug functions loaded. Use testChatAPI() and testWebSocketConnection() in console.');
