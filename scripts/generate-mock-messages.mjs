/**
 * Script to generate mock messages for performance testing in hula.
 * Can be run in the browser console while the app is running in dev mode.
 */

export function generateMockMessages(roomId, count = 5000) {
  const pinia = window.pinia;
  if (!pinia) {
    console.error('Pinia not found on window. Ensure you are in dev mode and pinia is exposed.');
    return;
  }

  // Assuming useChatStore is accessible or we can get it from pinia
  // In hula dev mode, we might need to expose the stores for testing.
  // For now, let's assume we can use the window.hulaStores if we add them.
  
  const chatStore = window.hulaChatStore;
  if (!chatStore) {
    console.error('hulaChatStore not found on window. Please expose it for testing.');
    return;
  }

  console.log(`Generating ${count} mock messages for room ${roomId}...`);
  
  const startTime = performance.now();
  
  for (let i = 0; i < count; i++) {
    const msgId = `mock-msg-${Date.now()}-${i}`;
    const timestamp = Date.now() - (count - i) * 1000;
    
    const mockMsg = {
      id: msgId,
      roomId: roomId,
      senderId: '@mock-user:matrix.test',
      timestamp: timestamp,
      message: {
        type: 'text',
        body: `Mock message number ${i + 1}. This is a performance test message to verify large list rendering.`,
        status: 'sent'
      },
      originEvent: {
        event_id: msgId,
        type: 'm.room.message',
        content: {
          body: `Mock message number ${i + 1}.`,
          msgtype: 'm.text'
        },
        origin_server_ts: timestamp,
        sender: '@mock-user:matrix.test'
      }
    };
    
    chatStore.pushMsg(mockMsg);
  }
  
  const endTime = performance.now();
  console.log(`Successfully generated ${count} messages in ${(endTime - startTime).toFixed(2)}ms`);
}
