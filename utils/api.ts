// API 엔드포인트 및 Socket.io 연결 유틸리티

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:3001';

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

