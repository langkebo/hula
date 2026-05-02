import { chromium } from '@playwright/test';

async function testLargeListPerf() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  try {
    // 1. Load the app
    console.log('Loading app...');
    await page.goto('http://127.0.0.1:4174/', { waitUntil: 'load', timeout: 60000 });
    await page.waitForTimeout(5000); 
    
    // 2. Setup state and Inject 5000 messages
    console.log('Setting up state and Injecting 5000 mock messages...');
    const roomId = '!mock-room:matrix.test';
    await page.evaluate(async (roomId) => {
      // 1. Mock Auth State
      if (window.hulaUserStore) {
        window.hulaUserStore.userInfo = { uid: '@test:matrix.test', name: 'Test User' };
        window.hulaUserStore.isLogin = true;
      }
      
      // 2. Force Session
      if (window.hulaGlobalStore) {
        window.hulaGlobalStore.currentSessionRoomId = roomId;
        window.hulaGlobalStore.showChatBox = true;
        window.hulaGlobalStore.activeRoomId = roomId;
      }
      
      // 3. Force Route via Router
      if (window.hulaRouter) {
        window.hulaRouter.push('/home').catch(e => console.error('Router push failed:', e));
      }

      // 4. Inject messages
      const count = 5000;
      const chatStore = window.hulaChatStore;
      if (chatStore) {
        chatStore.clearRoomMessages(roomId);
        const mockMessages = [];
        for (let i = 0; i < count; i++) {
          const msgId = `mock-msg-${Date.now()}-${i}`;
          const timestamp = Date.now() - (count - i) * 1000;
          mockMessages.push({
            id: msgId,
            roomId: roomId,
            senderId: `@mock-user-${i % 5}:matrix.test`,
            timestamp: timestamp,
            message: {
              id: msgId,
              type: 'text',
              body: `Mock message number ${i + 1}. Performance test.`,
              status: 'sent',
              sendTime: timestamp
            },
            fromUser: { uid: `@mock-user-${i % 5}:matrix.test`, name: `Mock User ${i % 5}` },
            originEvent: {
              event_id: msgId,
              type: 'm.room.message',
              content: { body: `Mock message ${i + 1}` },
              origin_server_ts: timestamp,
              sender: `@mock-user-${i % 5}:matrix.test`
            }
          });
        }
        mockMessages.forEach(msg => chatStore.pushMsg(msg));
      }
    }, roomId);
    
    await page.waitForTimeout(5000); 

    console.log('Starting scroll performance test...');
    
    // 3. Measure FPS during scroll
    const fpsResult = await page.evaluate(async () => {
      const scrollContainer = document.querySelector('.scroller') || 
                             document.querySelector('.scrollbar-container') ||
                             document.querySelector('#image-chat-main') ||
                             document.querySelector('.n-scrollbar-container') ||
                             document.querySelector('.chat-list') ||
                             document.querySelector('.chat-content');
      
      if (!scrollContainer) {
        const allDivs = Array.from(document.querySelectorAll('div')).map(d => ({
          class: d.className,
          id: d.id,
          text: d.innerText?.slice(0, 20)
        })).slice(0, 50);
        
        return { 
          error: 'Scroll container not found',
          domSummary: allDivs,
          url: window.location.href
        };
      }
      
      const frames = [];
      let lastTime = performance.now();
      const trackFrame = (time) => {
        frames.push(time - lastTime);
        lastTime = time;
        if (frames.length < 100) requestAnimationFrame(trackFrame);
      };
      requestAnimationFrame(trackFrame);
      
      for (let i = 0; i < 50; i++) {
        scrollContainer.scrollTop += 100;
        await new Promise(r => setTimeout(r, 16));
      }
      
      const avgFrameTime = frames.reduce((a, b) => a + b, 0) / frames.length;
      return {
        avgFps: 1000 / avgFrameTime,
        maxFrameTime: Math.max(...frames),
        frameCount: frames.length
      };
    });
    
    console.log('---PERF_RESULT_START---');
    console.log(JSON.stringify(fpsResult, null, 2));
    console.log('---PERF_RESULT_END---');
    
  } catch (e) {
    console.error('Test failed:', e.message);
  } finally {
    await browser.close();
  }
}

testLargeListPerf().catch(console.error);
