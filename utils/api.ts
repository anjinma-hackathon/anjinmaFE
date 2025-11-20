// API 엔드포인트 및 Socket.io 연결 유틸리티

let API_BASE_URL = process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, '') || ''; // 마지막 슬래시 제거
let SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL?.replace(/\/$/, '') || ''; // 마지막 슬래시 제거

// 개발 환경에서 프록시 사용 여부 결정
const USE_PROXY = process.env.NEXT_PUBLIC_USE_PROXY === 'true' || false;

// 프록시를 사용하는 경우 Next.js API Routes 사용
const getApiUrl = (path: string) => {
  if (typeof window !== 'undefined' && USE_PROXY) {
    // 클라이언트 측에서 프록시 사용
    return `/api/proxy/${path}`;
  }
  // 직접 백엔드 호출
  return `${API_BASE_URL}/${path}`;
};

// HTTP를 HTTPS로 자동 변환 (CORS 및 redirect 문제 방지)
// 단, 프록시를 사용하는 경우에는 변환하지 않음
if (!USE_PROXY) {
  if (API_BASE_URL.startsWith('http://') && !API_BASE_URL.includes('localhost') && !API_BASE_URL.includes('127.0.0.1')) {
    const originalUrl = API_BASE_URL;
    API_BASE_URL = API_BASE_URL.replace('http://', 'https://');
    if (typeof window !== 'undefined') {
      console.warn('[API] HTTP가 HTTPS로 자동 변환되었습니다:', originalUrl, '->', API_BASE_URL);
    }
  }

  if (SOCKET_URL.startsWith('http://') && !SOCKET_URL.includes('localhost') && !SOCKET_URL.includes('127.0.0.1')) {
    const originalUrl = SOCKET_URL;
    SOCKET_URL = SOCKET_URL.replace('http://', 'https://');
    if (typeof window !== 'undefined') {
      console.warn('[API] Socket URL이 HTTPS로 자동 변환되었습니다:', originalUrl, '->', SOCKET_URL);
    }
  }
}

if (!API_BASE_URL && !USE_PROXY) {
  throw new Error('NEXT_PUBLIC_API_URL 환경 변수가 설정되지 않았습니다.');
}

if (!SOCKET_URL && !USE_PROXY) {
  throw new Error('NEXT_PUBLIC_SOCKET_URL 환경 변수가 설정되지 않았습니다.');
}

// 디버깅용: 환경 변수 확인 (개발 환경에서만)
if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
  console.log('[API] USE_PROXY:', USE_PROXY);
  console.log('[API] API_BASE_URL:', API_BASE_URL);
  console.log('[API] SOCKET_URL:', SOCKET_URL);
}

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
    const url = getApiUrl(`rooms/${roomId}/attendance`);
    console.log('[API] GET Attendance:', url);
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      mode: 'cors',
      credentials: 'omit',
    });

    if (!response.ok) {
      console.error('[API] Attendance Error:', response.status, response.statusText);
      throw new Error(`Failed to get attendance: ${response.status} ${response.statusText}`);
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
    const url = getApiUrl('rooms');
    console.log('[API] POST Create Room:', url, data);
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify(data),
      mode: 'cors', // CORS 모드 명시
      credentials: 'omit', // CORS 문제 방지
    });

    if (!response.ok) {
      console.error('[API] Create Room Error:', response.status, response.statusText);
      let errorText = '';
      try {
        errorText = await response.text();
        console.error('[API] Error Response:', errorText);
      } catch (e) {
        // 응답 본문을 읽을 수 없는 경우 무시
      }
      throw new Error(`Failed to create room: ${response.status} ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Error creating room:', error);
    if (error instanceof TypeError && error.message.includes('Failed to fetch')) {
      throw new Error('API 서버에 연결할 수 없습니다. 서버 주소와 CORS 설정을 확인해주세요.');
    }
    throw error;
  }
}

// 3. 방 정보 조회
export async function getRoomInfo(roomId: number): Promise<RoomInfoResponse> {
  try {
    const url = getApiUrl(`rooms/${roomId}`);
    console.log('[API] GET Room Info:', url);
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      mode: 'cors',
      credentials: 'omit',
    });

    if (!response.ok) {
      console.error('[API] Room Info Error:', response.status, response.statusText);
      throw new Error(`Failed to get room info: ${response.status} ${response.statusText}`);
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
    const url = getApiUrl(`rooms/join?code=${encodeURIComponent(code)}`);
    console.log('[API] GET Join Room:', url);
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      mode: 'cors',
      credentials: 'omit',
    });

    if (!response.ok) {
      console.error('[API] Join Room Error:', response.status, response.statusText);
      let errorText = '';
      try {
        errorText = await response.text();
        console.error('[API] Error Response:', errorText);
      } catch (e) {
        // 응답 본문을 읽을 수 없는 경우 무시
      }
      throw new Error(`Failed to join room: ${response.status} ${response.statusText}`);
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
    const url = getApiUrl(`api/stt/translate`);
    console.log('[API] POST Send STT Text:', url, data);
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify(data),
      mode: 'cors',
      credentials: 'omit',
    });

    if (!response.ok) {
      console.error('[API] Send STT Text Error:', response.status, response.statusText);
      let errorText = '';
      try {
        errorText = await response.text();
        console.error('[API] Error Response:', errorText);
      } catch (e) {
        // 응답 본문을 읽을 수 없는 경우 무시
      }
      throw new Error(`Failed to send STT text: ${response.status} ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Error sending STT text:', error);
    throw error;
  }
}

// PDF 번역 요청 인터페이스
export interface TranslatePdfRequest {
  file: File;
  language?: string; // 번역 대상 언어 코드 (ko, en, ja, zh, vi, es)
  mode?: string; // 엔드포인트 선택: generate | chat
  filename?: string;
  progressToken?: string;
}

// PDF 번역 (multipart/form-data)
export async function translatePdf(data: TranslatePdfRequest): Promise<Blob> {
  try {
    const url = getApiUrl('translate/pdf');
    console.log('[API] POST Translate PDF:', url, {
      filename: data.file.name,
      language: data.language,
      mode: data.mode,
    });
    
    const formData = new FormData();
    formData.append('file', data.file);
    if (data.language) {
      formData.append('language', data.language);
    }
    if (data.mode) {
      formData.append('mode', data.mode);
    }
    if (data.filename) {
      formData.append('filename', data.filename);
    }
    if (data.progressToken) {
      formData.append('progressToken', data.progressToken);
    }
    
    const response = await fetch(url, {
      method: 'POST',
      body: formData,
      mode: 'cors',
      credentials: 'omit',
      // multipart/form-data는 브라우저가 자동으로 Content-Type을 설정하므로 헤더에 명시하지 않음
    });

    if (!response.ok) {
      console.error('[API] Translate PDF Error:', response.status, response.statusText);
      let errorText = '';
      try {
        errorText = await response.text();
        console.error('[API] Error Response:', errorText);
      } catch (e) {
        // 응답 본문을 읽을 수 없는 경우 무시
      }
      throw new Error(`PDF 번역 실패: ${response.status} ${response.statusText}`);
    }

    // 응답은 application/pdf (binary)
    const blob = await response.blob();
    console.log('[API] PDF translation completed, blob size:', blob.size);
    return blob;
  } catch (error) {
    console.error('Error translating PDF:', error);
    throw error;
  }
}

export { API_BASE_URL, SOCKET_URL };

