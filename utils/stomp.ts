// STOMP WebSocket 클라이언트 연결 유틸리티 (네이티브 WebSocket 사용)

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

  // 네이티브 WebSocket URL 구성
  // 중요: 네이티브 WebSocket은 wss:// 또는 ws://를 사용하며, /websocket, /info를 붙이지 않음
  // 예: wss://anjinma-bak.bluerack.org/ws/lecture
  const endpoint = config.wsEndpoint.startsWith('/') 
    ? config.wsEndpoint 
    : `/${config.wsEndpoint}`;
  
  // SOCKET_URL의 마지막 슬래시 제거 후 endpoint 추가
  const baseUrl = SOCKET_URL.endsWith('/') 
    ? SOCKET_URL.slice(0, -1) 
    : SOCKET_URL;
  
  let wsUrl = `${baseUrl}${endpoint}`;
  
  // HTTP를 WSS/WS로 변환 (네이티브 WebSocket 프로토콜)
  if (wsUrl.startsWith('http://')) {
    wsUrl = wsUrl.replace('http://', 'ws://');
  } else if (wsUrl.startsWith('https://')) {
    wsUrl = wsUrl.replace('https://', 'wss://');
  }
  
  // 기본 프로토콜이 없으면 wss:// 추가
  if (!wsUrl.startsWith('ws://') && !wsUrl.startsWith('wss://')) {
    // HTTPS를 사용 중이면 WSS, 아니면 WS 사용
    if (SOCKET_URL.startsWith('https://')) {
      wsUrl = `wss://${wsUrl}`;
    } else {
      wsUrl = `ws://${wsUrl}`;
    }
  }
  
  // 최종 WebSocket URL (네이티브 WebSocket용)
  const brokerURL = wsUrl;
  
  console.log('[STOMP] Initializing native WebSocket connection...');
  console.log('[STOMP] SOCKET_URL:', SOCKET_URL);
  console.log('[STOMP] wsEndpoint:', config.wsEndpoint);
  console.log('[STOMP] Broker URL (native WebSocket):', brokerURL);
  console.log('[STOMP] Note: Native WebSocket does NOT use /info endpoint');

  // 네이티브 WebSocket 사용 (SockJS 사용 안 함)
  // brokerURL을 직접 지정하여 네이티브 WebSocket 연결
  stompClient = new Client({
    brokerURL: brokerURL, // wss://.../ws/lecture 형식
    reconnectDelay: 5000,
    heartbeatIncoming: 10000,
    heartbeatOutgoing: 10000,
    connectionTimeout: 10000,
    debug: (str: string) => {
      if (process.env.NODE_ENV === 'development') {
        console.log('[STOMP]', str);
      }
    },
  });

  stompClient.onConnect = (frame) => {
    console.log('[STOMP] Connected successfully:', frame);
    // 연결 완료 시 등록된 콜백 실행
    connectCallbacks.forEach(callback => callback());
    connectCallbacks.length = 0; // 콜백 배열 초기화
  };

  stompClient.onStompError = (frame) => {
    console.error('[STOMP] STOMP Error:', frame);
    console.error('[STOMP] Error details:', frame.headers);
    console.error('[STOMP] Error message:', frame.body);
  };

  stompClient.onWebSocketError = (event: any) => {
    console.error('[STOMP] ========== Native WebSocket Error 발생 ==========');
    console.error('[STOMP] Error event:', event);
    console.error('[STOMP] Error type:', event?.type);
    console.error('[STOMP] Error target:', event?.target);
    
    // 현재 페이지 오리진 확인
    if (typeof window !== 'undefined') {
      console.error('[STOMP] Current page origin:', window.location.origin);
      console.error('[STOMP] Current page URL:', window.location.href);
    }
    
    // WebSocket 연결 실패 시 더 자세한 정보 제공
    if (event?.target) {
      const ws = event.target as WebSocket;
      console.error('[STOMP] WebSocket readyState:', ws?.readyState);
      console.error('[STOMP] WebSocket URL:', ws?.url || brokerURL);
      console.error('[STOMP] WebSocket protocol:', ws?.protocol);
      console.error('[STOMP] WebSocket extensions:', ws?.extensions);
    }
    
    // 백엔드 서버가 WebSocket 연결을 지원하는지, URL이 올바른지 확인 필요
    console.error('[STOMP] ========== 네이티브 WebSocket 연결 실패 가능 원인 ==========');
    console.error('[STOMP] 1. WebSocket URL이 잘못됨:', brokerURL);
    console.error('[STOMP]    올바른 형식: wss://anjinma-bak.bluerack.org/ws/lecture');
    console.error('[STOMP]    잘못된 형식: wss://.../ws/lecture/info (SockJS 전용)');
    console.error('[STOMP] 2. 백엔드 서버가 네이티브 WebSocket 연결을 허용하지 않음');
    console.error('[STOMP] 3. 방화벽 또는 프록시가 WebSocket 연결을 차단');
    console.error('[STOMP] 4. SSL/TLS 인증서 문제');
    console.error('[STOMP] 5. 리버스 프록시(Nginx/ALB)의 Upgrade 헤더 미설정');
    console.error('[STOMP] 6. 브라우저 네트워크 탭에서 wss://.../ws/lecture 101 Switching Protocols 확인 필요');
    console.error('[STOMP] 7. /ws/lecture/info 요청이 발생하면 SockJS를 사용 중인 것임 (제거 필요)');
    console.error('[STOMP] ============================================================');
    
    // 사용자에게 알림 (브라우저 환경에서만)
    if (typeof window !== 'undefined') {
      console.warn('[STOMP] 네이티브 WebSocket 연결에 실패했습니다.');
      console.warn('[STOMP] 브라우저 네트워크 탭에서 다음을 확인해주세요:');
      console.warn('[STOMP] - wss://.../ws/lecture로 101 Switching Protocols 응답');
      console.warn('[STOMP] - /ws/lecture/info 요청이 없어야 함 (SockJS 사용 시 발생)');
    }
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
    // 클라이언트가 없으면 에러
    if (!stompClient) {
      reject(new Error('STOMP client is not initialized'));
      return;
    }

    // 이미 활성화되어 있고 연결되어 있으면 바로 resolve
    // @stomp/stompjs에서 connected 상태 확인
    if (stompClient.active && (stompClient as any).connected) {
      console.log('[STOMP] Already connected, resolving immediately');
      resolve();
      return;
    }

    // 연결 완료 콜백 등록
    const timer = setTimeout(() => {
      console.error('[STOMP] Connection timeout after', timeout, 'ms');
      reject(new Error('STOMP connection timeout'));
    }, timeout);

    const onConnect = () => {
      clearTimeout(timer);
      console.log('[STOMP] Connection confirmed in waitForConnection');
      resolve();
    };

    connectCallbacks.push(onConnect);

    // 클라이언트가 활성화되지 않았으면 활성화
    if (!stompClient.active) {
      console.log('[STOMP] Client not active, activating...');
      stompClient.activate();
    }

    // 이미 연결 중이면 짧은 간격으로 확인
    let checkInterval: NodeJS.Timeout | null = null;
    if (stompClient.active) {
      checkInterval = setInterval(() => {
        if (stompClient && stompClient.active && (stompClient as any).connected) {
          clearInterval(checkInterval!);
          clearTimeout(timer);
          resolve();
        }
      }, 100);
    }
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
  // 연결이 완료될 때까지 대기
  if (!stompClient) {
    console.error('[STOMP] Client is not initialized. Cannot subscribe to:', subscribeUrl);
    return () => {};
  }

  // 연결 상태 확인 및 대기
  const isConnected = stompClient.active && (stompClient as any).connected;
  if (!isConnected) {
    console.log('[STOMP] Waiting for connection before subscribing to:', subscribeUrl);
    try {
      await waitForConnection(10000);
    } catch (error) {
      console.error('[STOMP] Failed to wait for connection:', error);
      return () => {};
    }
  }

  // 최종 연결 상태 확인
  if (!stompClient || !stompClient.active || !(stompClient as any).connected) {
    console.warn('[STOMP] Client is not connected. Cannot subscribe to:', subscribeUrl);
    console.warn('[STOMP] Active:', stompClient?.active, 'Connected:', (stompClient as any)?.connected);
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
  if (!stompClient) {
    console.warn('[STOMP] Client is not initialized. Cannot publish to:', publishUrl);
    return;
  }

  const isConnected = stompClient.active && (stompClient as any).connected;
  if (!isConnected) {
    console.warn('[STOMP] Client is not connected. Cannot publish to:', publishUrl);
    console.warn('[STOMP] Active:', stompClient.active, 'Connected:', (stompClient as any).connected);
    return;
  }

  try {
    stompClient.publish({
      destination: publishUrl,
      body: JSON.stringify(body),
    });

    console.log('[STOMP] Published to:', publishUrl, body);
  } catch (error) {
    console.error('[STOMP] Failed to publish:', error);
  }
}

