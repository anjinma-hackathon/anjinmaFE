# TransClass - 실시간 자막 서비스

교육 소외 계층을 위한 실시간 번역 자막 서비스입니다.

## 환경 변수 설정

프로젝트 루트에 `.env.local` 파일을 생성하고 다음 환경 변수를 설정하세요:

### 옵션 1: 프록시 사용 (SSL 인증서 오류 발생 시)

```env
NEXT_PUBLIC_API_URL=https://anjinma-bak.bluerack.org
API_URL=https://anjinma-bak.bluerack.org
NEXT_PUBLIC_SOCKET_URL=https://anjinma-bak.bluerack.org
NEXT_PUBLIC_USE_PROXY=true
NODE_TLS_REJECT_UNAUTHORIZED=0
```

**중요**: 
- 프록시를 사용하는 경우 서버 측에서 `API_URL` 환경 변수도 설정해야 합니다 (클라이언트 측 `NEXT_PUBLIC_API_URL`과 동일한 값).
- `NODE_TLS_REJECT_UNAUTHORIZED=0`은 개발 환경에서만 사용하세요. 프로덕션에서는 백엔드 서버의 SSL 인증서를 올바르게 설정하는 것이 권장됩니다.
- 503 에러가 발생하는 경우 백엔드 서버가 실행 중인지 확인하세요.

### 옵션 2: 직접 호출 (정상적인 SSL 인증서가 있는 경우)

```env
NEXT_PUBLIC_API_URL=https://anjinma-bak.bluerack.org
NEXT_PUBLIC_SOCKET_URL=https://anjinma-bak.bluerack.org
NEXT_PUBLIC_USE_PROXY=false
```

### 필수 환경 변수

- `NEXT_PUBLIC_API_URL`: 백엔드 API 서버 URL
- `NEXT_PUBLIC_SOCKET_URL`: Socket.io 서버 URL
- `NEXT_PUBLIC_USE_PROXY`: 프록시 사용 여부 (`true` 또는 `false`, 기본값: `false`)

**중요**: 
- 환경 변수가 설정되지 않으면 애플리케이션이 실행되지 않습니다.
- SSL 인증서 오류(`ERR_CERT_AUTHORITY_INVALID`)가 발생하는 경우 `NEXT_PUBLIC_USE_PROXY=true`로 설정하세요.
- 프록시는 개발 환경에서 SSL 인증서 문제를 우회하기 위한 것입니다. 프로덕션에서는 백엔드 서버의 SSL 인증서를 수정하는 것이 권장됩니다.

## 설치 및 실행

```bash
# 의존성 설치
npm install

# 개발 서버 실행
npm run dev

# 프로덕션 빌드
npm run build

# 프로덕션 서버 실행
npm start
```

## 배포

배포 방법은 `DEPLOY.md` 파일을 참고하세요.
