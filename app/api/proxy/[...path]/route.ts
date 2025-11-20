import { NextRequest, NextResponse } from 'next/server';

// 서버 측에서는 NEXT_PUBLIC_ 접두사가 없는 환경 변수를 사용해야 합니다
const BACKEND_URL = process.env.API_URL || process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, '') || '';

// Node.js 환경 변수 설정 (SSL 검증 우회 - 개발 환경에서만)
if (typeof process !== 'undefined' && process.env.NODE_TLS_REJECT_UNAUTHORIZED !== '1') {
  // 개발 환경에서만 SSL 검증 우회
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
}

export async function GET(
  request: NextRequest,
  { params }: { params: { path: string[] } }
) {
  try {
    const path = params.path.join('/');
    const searchParams = request.nextUrl.searchParams;
    const queryString = searchParams.toString();
    const url = `${BACKEND_URL}/${path}${queryString ? `?${queryString}` : ''}`;

    console.log('[Proxy] GET:', url);
    console.log('[Proxy] BACKEND_URL:', BACKEND_URL);
    console.log('[Proxy] Path segments:', params.path);

    if (!BACKEND_URL) {
      return NextResponse.json(
        { error: 'Backend URL not configured' },
        { status: 500 }
      );
    }

    // Node.js의 fetch는 기본적으로 SSL 검증을 수행합니다
    // 개발 환경에서만 SSL 검증을 우회하려면 https 모듈을 사용해야 합니다
    let response;
    try {
      response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
      });
    } catch (fetchError) {
      console.error('[Proxy] GET Fetch Error:', fetchError);
      console.error('[Proxy] Error details:', {
        message: fetchError instanceof Error ? fetchError.message : 'Unknown',
        stack: fetchError instanceof Error ? fetchError.stack : undefined,
        cause: fetchError instanceof Error ? fetchError.cause : undefined,
      });
      return NextResponse.json(
        { 
          error: 'Proxy request failed', 
          message: fetchError instanceof Error ? fetchError.message : 'Unknown error',
          details: 'Failed to connect to backend server',
          url: url
        },
        { status: 502 }
      );
    }

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[Proxy] GET Error:', response.status, errorText);
      return NextResponse.json(
        { error: 'Backend request failed', status: response.status, message: errorText },
        { status: response.status }
      );
    }

    const data = await response.json();

    return NextResponse.json(data, {
      status: response.status,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Accept',
      },
    });
  } catch (error) {
    console.error('[Proxy] GET Error:', error);
    return NextResponse.json(
      { 
        error: 'Proxy request failed', 
        message: error instanceof Error ? error.message : 'Unknown error',
        details: error instanceof Error ? error.stack : undefined
      },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { path: string[] } }
) {
  try {
    const path = params.path.join('/');
    const url = `${BACKEND_URL}/${path}`;
    const contentType = request.headers.get('content-type') || '';

    console.log('[Proxy] POST:', url);
    console.log('[Proxy] Content-Type:', contentType);
    console.log('[Proxy] BACKEND_URL:', BACKEND_URL);
    console.log('[Proxy] Path segments:', params.path);

    if (!BACKEND_URL) {
      console.error('[Proxy] BACKEND_URL is empty!');
      return NextResponse.json(
        { error: 'Backend URL not configured', details: 'BACKEND_URL is empty' },
        { status: 500 }
      );
    }

    // multipart/form-data인 경우 (PDF 번역 등)
    const isMultipart = contentType.includes('multipart/form-data');
    const isPdfTranslate = path === 'translate/pdf';
    let requestBody: BodyInit;
    let requestHeaders: HeadersInit = {};

    if (isMultipart || isPdfTranslate) {
      // FormData로 읽기
      const formData = await request.formData();
      requestBody = formData;
      // multipart/form-data는 Content-Type을 설정하지 않음 (브라우저가 boundary 포함하여 자동 설정)
      // Node.js fetch는 FormData를 자동으로 처리하므로 헤더를 설정하지 않음
      console.log('[Proxy] Multipart request detected, path:', path);
      const formDataEntries = Array.from(formData.entries());
      console.log('[Proxy] FormData entries count:', formDataEntries.length);
      formDataEntries.forEach(([key, value]) => {
        if (value instanceof File) {
          console.log(`[Proxy] FormData[${key}]: File - name: ${value.name}, size: ${value.size}, type: ${value.type}`);
        } else {
          console.log(`[Proxy] FormData[${key}]: ${value}`);
        }
      });
    } else {
      // JSON 요청
      const body = await request.json();
      requestBody = JSON.stringify(body);
      requestHeaders = {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      };
      console.log('[Proxy] JSON Body:', body);
    }

    let response;
    try {
      response = await fetch(url, {
        method: 'POST',
        headers: requestHeaders,
        body: requestBody,
      });
    } catch (fetchError) {
      console.error('[Proxy] POST Fetch Error:', fetchError);
      console.error('[Proxy] Error details:', {
        message: fetchError instanceof Error ? fetchError.message : 'Unknown',
        stack: fetchError instanceof Error ? fetchError.stack : undefined,
        cause: fetchError instanceof Error ? fetchError.cause : undefined,
      });
      return NextResponse.json(
        { 
          error: 'Proxy request failed', 
          message: fetchError instanceof Error ? fetchError.message : 'Unknown error',
          details: 'Failed to connect to backend server',
          url: url
        },
        { status: 502 }
      );
    }

    console.log('[Proxy] Response status:', response.status);
    console.log('[Proxy] Response Content-Type:', response.headers.get('content-type'));

    // 응답이 PDF 바이너리인 경우 (application/pdf)
    const responseContentType = response.headers.get('content-type') || '';
    const isPdfResponse = responseContentType.includes('application/pdf');

    if (!response.ok) {
      let errorText = '';
      let errorDetails: any = {};
      try {
        // 에러 응답이 JSON인지 확인
        const errorContentType = response.headers.get('content-type') || '';
        if (errorContentType.includes('application/json')) {
          try {
            errorDetails = await response.json();
            errorText = JSON.stringify(errorDetails);
          } catch (e) {
            errorText = await response.text();
          }
        } else {
          errorText = await response.text();
        }
        console.error('[Proxy] POST Error Response:', response.status, errorText);
        console.error('[Proxy] Error URL:', url);
        console.error('[Proxy] Error path:', path);
      } catch (e) {
        console.error('[Proxy] Failed to read error response:', e);
        errorText = `Failed to read error response: ${e instanceof Error ? e.message : 'Unknown'}`;
      }
      return NextResponse.json(
        { error: 'Backend request failed', status: response.status, message: errorText, details: errorDetails },
        { status: response.status }
      );
    }

    // PDF 바이너리 응답인 경우 바이너리로 패스스루
    if (isPdfResponse) {
      console.log('[Proxy] PDF binary response detected, passing through');
      const arrayBuffer = await response.arrayBuffer();
      
      // 응답 헤더 복사
      const responseHeaders = new Headers();
      response.headers.forEach((value, key) => {
        responseHeaders.set(key, value);
      });
      
      // CORS 헤더 추가
      responseHeaders.set('Access-Control-Allow-Origin', '*');
      responseHeaders.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
      responseHeaders.set('Access-Control-Allow-Headers', 'Content-Type, Accept');

      return new NextResponse(arrayBuffer, {
        status: response.status,
        headers: responseHeaders,
      });
    }

    // JSON 응답인 경우
    const data = await response.json();
    console.log('[Proxy] Success Response (JSON):', typeof data);

    return NextResponse.json(data, {
      status: response.status,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Accept',
      },
    });
  } catch (error) {
    console.error('[Proxy] POST Error:', error);
    console.error('[Proxy] Error details:', {
      message: error instanceof Error ? error.message : 'Unknown',
      stack: error instanceof Error ? error.stack : undefined,
      cause: error instanceof Error ? error.cause : undefined,
    });
    return NextResponse.json(
      { 
        error: 'Proxy request failed', 
        message: error instanceof Error ? error.message : 'Unknown error',
        details: error instanceof Error ? error.stack : undefined
      },
      { status: 500 }
    );
  }
}

export async function OPTIONS() {
  return NextResponse.json({}, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Accept',
    },
  });
}

