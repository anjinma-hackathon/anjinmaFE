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
    const body = await request.json();
    const url = `${BACKEND_URL}/${path}`;

    console.log('[Proxy] POST:', url);
    console.log('[Proxy] Body:', body);
    console.log('[Proxy] BACKEND_URL:', BACKEND_URL);
    console.log('[Proxy] Path segments:', params.path);
    console.log('[Proxy] All env vars:', {
      API_URL: process.env.API_URL,
      NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
      NODE_TLS_REJECT_UNAUTHORIZED: process.env.NODE_TLS_REJECT_UNAUTHORIZED,
    });

    if (!BACKEND_URL) {
      console.error('[Proxy] BACKEND_URL is empty!');
      return NextResponse.json(
        { error: 'Backend URL not configured', details: 'BACKEND_URL is empty' },
        { status: 500 }
      );
    }

    let response;
    try {
      response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify(body),
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
      console.log('[Proxy] Response headers:', Object.fromEntries(response.headers.entries()));

      if (!response.ok) {
        let errorText = '';
        try {
          errorText = await response.text();
          console.error('[Proxy] POST Error Response:', response.status, errorText);
        } catch (e) {
          console.error('[Proxy] Failed to read error response:', e);
        }
        return NextResponse.json(
          { error: 'Backend request failed', status: response.status, message: errorText },
          { status: response.status }
        );
      }

      const data = await response.json();
      console.log('[Proxy] Success Response:', data);

      return NextResponse.json(data, {
        status: response.status,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Accept',
        },
      });
    } catch (fetchError) {
      console.error('[Proxy] Fetch error:', fetchError);
      console.error('[Proxy] Fetch error details:', {
        message: fetchError instanceof Error ? fetchError.message : 'Unknown',
        stack: fetchError instanceof Error ? fetchError.stack : undefined,
        cause: fetchError instanceof Error ? fetchError.cause : undefined,
      });
      throw fetchError;
    }
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

