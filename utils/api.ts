// API 엔드포인트 및 Socket.io 연결 유틸리티

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://anjinma.bluerack.org';
const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL || 'http://anjinma.bluerack.org';

// API 타입 정의
export interface StudentInfo {
  studentId: string;
  studentName: string;
}

export interface AttendanceResponse {
  type: 'snapshot';
  students: StudentInfo[];
}

export interface CreateRoomRequest {
  roomName: string;
}

export interface CreateRoomResponse {
  roomId: number;
  roomName: string;
  professorAuthCode: string;
  studentAuthCode: string;
  wsEndpoint: string;
  subscribeUrl: string;
  publishUrl: string;
}

export interface RoomInfoResponse {
  roomId: number;
  roomName: string;
  professorAuthCode: string;
  studentAuthCode: string;
  wsEndpoint: string;
  subscribeUrl: string;
  publishUrl: string;
}

export interface JoinRoomResponse {
  roomId: number;
  roomName: string;
  professorAuthCode: string;
  studentAuthCode: string;
  role: 'PROFESSOR' | 'STUDENT';
}

export interface SttRequest {
  studentCode: string;
  text: string;
  language?: string; // 원본 언어 (기본값: 'ko')
}

export interface TranslationResponse {
  success: boolean;
  translatedText: string;
  targetLanguage: string;
  originalText?: string;
}

// 1. 교수 화면에서 현재 입장 학생 목록 조회
export async function getAttendance(roomId: number): Promise<AttendanceResponse> {
  try {
    const response = await fetch(`${API_BASE_URL}/rooms/${roomId}/attendance`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to get attendance: ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Error getting attendance:', error);
    throw error;
  }
}

// 2. 방 생성
export async function createRoom(data: CreateRoomRequest): Promise<CreateRoomResponse> {
  try {
    const response = await fetch(`${API_BASE_URL}/rooms`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      throw new Error(`Failed to create room: ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Error creating room:', error);
    throw error;
  }
}

// 3. 방 정보 조회
export async function getRoomInfo(roomId: number): Promise<RoomInfoResponse> {
  try {
    const response = await fetch(`${API_BASE_URL}/rooms/${roomId}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to get room info: ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Error getting room info:', error);
    throw error;
  }
}

// 4. 코드로 입장 (교수/학생 모두 사용)
export async function joinRoomByCode(code: string): Promise<JoinRoomResponse> {
  try {
    const response = await fetch(`${API_BASE_URL}/rooms/join?code=${encodeURIComponent(code)}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to join room: ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Error joining room:', error);
    throw error;
  }
}

// STT 텍스트를 백엔드로 전송
export async function sendSttText(data: SttRequest): Promise<TranslationResponse> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/stt/translate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      throw new Error('Failed to send STT text');
    }

    return await response.json();
  } catch (error) {
    console.error('Error sending STT text:', error);
    throw error;
  }
}

export { API_BASE_URL, SOCKET_URL };

