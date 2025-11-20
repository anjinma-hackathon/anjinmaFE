// Socket.io 클라이언트 연결 유틸리티

import { io, Socket } from 'socket.io-client';
import { SOCKET_URL } from './api';

let socket: Socket | null = null;

export interface SocketEvents {
  // 교수가 STT 텍스트를 보낼 때
  'stt:text': (data: { studentCode: string; text: string }) => void;
  
  // 학생이 번역된 텍스트를 받을 때
  'translation:update': (data: { 
    studentCode: string; 
    translatedText: string; 
    targetLanguage: string;
  }) => void;
  
  // 학생이 방에 입장할 때
  'room:join': (data: { studentCode: string; studentInfo: { name: string; studentId: string } }) => void;
  
  // 학생이 방에서 나갈 때
  'room:leave': (data: { studentCode: string; studentId: string }) => void;
  
  // 연결 성공
  'connect': () => void;
  
  // 연결 끊김
  'disconnect': () => void;
  
  // 에러
  'error': (error: string) => void;
}

// Socket.io 연결 초기화
export function initSocket(studentCode?: string): Socket {
  if (socket?.connected) {
    return socket;
  }

  socket = io(SOCKET_URL, {
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionAttempts: 5,
  });

  socket.on('connect', () => {
    console.log('Socket connected:', socket?.id);
    
    // 학생코드로 방에 입장
    if (studentCode && socket) {
      socket.emit('room:join', { studentCode });
    }
  });

  socket.on('disconnect', () => {
    console.log('Socket disconnected');
  });

  socket.on('error', (error: string) => {
    console.error('Socket error:', error);
  });

  return socket;
}

// Socket.io 연결 해제
export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}

// Socket 인스턴스 가져오기
export function getSocket(): Socket | null {
  return socket;
}

// 이벤트 리스너 등록
export function onSocketEvent<T extends keyof SocketEvents>(
  event: T,
  handler: SocketEvents[T]
) {
  if (socket) {
    socket.on(event, handler as any);
  }
}

// 이벤트 리스너 제거
export function offSocketEvent<T extends keyof SocketEvents>(
  event: T,
  handler?: SocketEvents[T]
) {
  if (socket) {
    if (handler) {
      socket.off(event, handler as any);
    } else {
      socket.off(event);
    }
  }
}

// 이벤트 발생
export function emitSocketEvent<T extends keyof SocketEvents>(
  event: T,
  data?: Parameters<SocketEvents[T]>[0]
) {
  if (socket?.connected) {
    socket.emit(event, data);
  } else {
    console.warn('Socket is not connected. Cannot emit event:', event);
  }
}

