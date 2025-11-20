// STOMP WebSocket 클라이언트 연결 유틸리티

import { Client, IMessage } from '@stomp/stompjs';
import { SOCKET_URL } from './api';

let stompClient: Client | null = null;

export interface StompConfig {
  wsEndpoint: string;
  subscribeUrl: string;
  publishUrl: string;
}

// 연결 완료 콜백 배열
const connectCallbacks: Array<() => void> = [];

// STOMP 클라이언트 초기화
export function initStompClient(config: StompConfig): Client {
  if (stompClient?.active) {
    // 이미 활성화된 클라이언트가 있으면 그대로 반환
    return stompClient;
  }

  // 기존 클라이언트가 있으면 해제
  if (stompClient) {
    stompClient.deactivate();
    stompClient = null;
  }

  // WebSocket URL 구성 (wsEndpoint 사용)
  // HTTP를 WSS로, HTTPS를 WSS로 변환
  let wsUrl = `${SOCKET_URL}${config.wsEndpoint}`;
  
  // HTTP를 WS로 변환
  if (wsUrl.startsWith('http://')) {
    wsUrl = wsUrl.replace('http://', 'ws://');
  } else if (wsUrl.startsWith('https://')) {
    wsUrl = wsUrl.replace('https://', 'wss://');
  }
  
  // 기본 프로토콜이 없으면 wss:// 추가
  if (!wsUrl.startsWith('ws://') && !wsUrl.startsWith('wss://')) {
    wsUrl = `wss://${wsUrl}`;
  }
  
  console.log('[STOMP] WebSocket URL:', wsUrl);

  // 네이티브 WebSocket 사용 (SockJS 대신)
  stompClient = new Client({
    brokerURL: wsUrl,
    reconnectDelay: 5000,
    heartbeatIncoming: 4000,
    heartbeatOutgoing: 4000,
    debug: (str: string) => {
      if (process.env.NODE_ENV === 'development') {
        console.log('[STOMP]', str);
      }
    },
  });

  stompClient.onConnect = (frame) => {
    console.log('[STOMP] Connected:', frame);
    // 연결 완료 시 등록된 콜백 실행
    connectCallbacks.forEach(callback => callback());
    connectCallbacks.length = 0; // 콜백 배열 초기화
  };

  stompClient.onStompError = (frame) => {
    console.error('[STOMP] Error:', frame);
  };

  stompClient.onWebSocketError = (event: any) => {
    console.error('[STOMP] WebSocket Error:', event);
  };

  stompClient.onDisconnect = () => {
    console.log('[STOMP] Disconnected');
  };

  stompClient.activate();

  return stompClient;
}

// 연결 완료를 기다리는 함수
export function waitForConnection(timeout: number = 10000): Promise<void> {
  return new Promise((resolve, reject) => {
    // 이미 활성화되어 있으면 바로 resolve
    if (stompClient?.active) {
      resolve();
      return;
    }

    // 클라이언트가 없으면 에러
    if (!stompClient) {
      reject(new Error('STOMP client is not initialized'));
      return;
    }

    // 연결 완료 콜백 등록
    const timer = setTimeout(() => {
      reject(new Error('STOMP connection timeout'));
    }, timeout);

    connectCallbacks.push(() => {
      clearTimeout(timer);
      resolve();
    });

    // 이미 연결 시도 중이면 대기 (connectCallbacks가 onConnect에서 호출됨)
  });
}

// STOMP 클라이언트 연결 해제
export function disconnectStompClient() {
  if (stompClient?.active) {
    stompClient.deactivate();
    stompClient = null;
  }
}

// STOMP 클라이언트 인스턴스 가져오기
export function getStompClient(): Client | null {
  return stompClient;
}

// 구독 (subscribeUrl로 메시지 수신)
export async function subscribeToChannel(
  subscribeUrl: string,
  callback: (message: IMessage) => void
): Promise<() => void> {
  // 연결이 활성화될 때까지 대기
  if (!stompClient?.active) {
    console.log('[STOMP] Waiting for connection before subscribing to:', subscribeUrl);
    try {
      await waitForConnection(10000);
    } catch (error) {
      console.error('[STOMP] Failed to wait for connection:', error);
      return () => {};
    }
  }

  if (!stompClient?.active) {
    console.warn('[STOMP] Client is not active. Cannot subscribe to:', subscribeUrl);
    return () => {};
  }

  try {
    const subscription = stompClient.subscribe(subscribeUrl, callback);
    console.log('[STOMP] Subscribed to:', subscribeUrl);

    // 구독 해제 함수 반환
    return () => {
      try {
        subscription.unsubscribe();
        console.log('[STOMP] Unsubscribed from:', subscribeUrl);
      } catch (error) {
        console.error('[STOMP] Failed to unsubscribe:', error);
      }
    };
  } catch (error) {
    console.error('[STOMP] Failed to subscribe:', error);
    return () => {};
  }
}

// 발행 (publishUrl로 메시지 전송)
export function publishToChannel(publishUrl: string, body: any) {
  if (!stompClient?.active) {
    console.warn('[STOMP] Client is not active. Cannot publish to:', publishUrl);
    return;
  }

  stompClient.publish({
    destination: publishUrl,
    body: JSON.stringify(body),
  });

  console.log('[STOMP] Published to:', publishUrl, body);
}

