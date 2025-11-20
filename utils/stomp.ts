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
  // Spring Boot STOMP는 일반적으로 /ws/lecture와 같은 경로를 사용
  let wsUrl = `${SOCKET_URL}${config.wsEndpoint}`;
  
  // HTTP를 WS로 변환
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
  
  console.log('[STOMP] Initializing WebSocket connection...');
  console.log('[STOMP] SOCKET_URL:', SOCKET_URL);
  console.log('[STOMP] wsEndpoint:', config.wsEndpoint);
  console.log('[STOMP] Final WebSocket URL:', wsUrl);

  // 네이티브 WebSocket 사용
  // Spring Boot STOMP는 네이티브 WebSocket도 지원하지만, 
  // 연결이 실패하면 백엔드 설정을 확인해야 함
  stompClient = new Client({
    brokerURL: wsUrl,
    reconnectDelay: 5000,
    heartbeatIncoming: 4000,
    heartbeatOutgoing: 4000,
    // 연결 시도 횟수 제한
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
    console.error('[STOMP] WebSocket Error occurred');
    console.error('[STOMP] Error event:', event);
    console.error('[STOMP] Error type:', event?.type);
    console.error('[STOMP] Error target:', event?.target);
    
    // WebSocket 연결 실패 시 더 자세한 정보 제공
    if (event?.target) {
      const ws = event.target as WebSocket;
      console.error('[STOMP] WebSocket readyState:', ws?.readyState);
      console.error('[STOMP] WebSocket URL:', ws?.url);
      console.error('[STOMP] WebSocket protocol:', ws?.protocol);
      console.error('[STOMP] WebSocket extensions:', ws?.extensions);
    }
    
    // 백엔드 서버가 WebSocket을 지원하는지, URL이 올바른지 확인 필요
    console.error('[STOMP] ========== WebSocket 연결 실패 ==========');
    console.error('[STOMP] 연결 실패 URL:', wsUrl);
    console.error('[STOMP] 연결 실패 가능 원인:');
    console.error('[STOMP] 1. 백엔드 서버가 네이티브 WebSocket을 지원하지 않음 (SockJS만 지원 가능)');
    console.error('[STOMP] 2. 백엔드 CORS 설정이 WebSocket Upgrade 요청을 허용하지 않음');
    console.error('[STOMP] 3. WebSocket 엔드포인트 경로가 잘못됨 (현재: ' + config.wsEndpoint + ')');
    console.error('[STOMP] 4. 리버스 프록시(nginx/Apache)가 WebSocket 연결을 차단');
    console.error('[STOMP] 5. SSL/TLS 인증서 문제');
    console.error('[STOMP] 6. 백엔드 서버가 다운되었거나 접근 불가');
    console.error('[STOMP]');
    console.error('[STOMP] 🔍 백엔드 개발자에게 확인 요청:');
    console.error('[STOMP] - 네이티브 WebSocket 지원 여부 확인');
    console.error('[STOMP] - WebSocket 엔드포인트 경로 확인: ' + config.wsEndpoint);
    console.error('[STOMP] - CORS 설정 확인 (WebSocket Upgrade 포함)');
    console.error('[STOMP] - 리버스 프록시 WebSocket 설정 확인');
    console.error('[STOMP] - 서버 로그에서 연결 시도 기록 확인');
    console.error('[STOMP] =========================================');
    
    // 사용자에게 알림 (브라우저 환경에서만)
    if (typeof window !== 'undefined') {
      // toast는 컴포넌트에서 처리하도록 함
      console.warn('[STOMP] WebSocket 연결에 실패했습니다. 백엔드 서버 설정을 확인해주세요.');
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

