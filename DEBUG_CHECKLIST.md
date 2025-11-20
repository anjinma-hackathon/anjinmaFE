# SockJS 연결 문제 디버깅 체크리스트

## 🔍 즉시 확인할 사항

### 1. 브라우저 콘솔 확인
다음 로그들이 순서대로 나타나는지 확인:

```
[STOMP] Initializing SockJS connection...
[STOMP] SOCKET_URL: https://anjinma-bak.bluerack.org
[STOMP] wsEndpoint: /ws/lecture
[STOMP] Final SockJS URL: https://anjinma-bak.bluerack.org/ws/lecture
[STOMP] Creating SockJS instance with URL: https://anjinma-bak.bluerack.org/ws/lecture
```

**에러가 나타나면**:
- `[STOMP] SockJS Error occurred` → 오리진 문제 가능성 높음
- `[STOMP] SockJS connection closed` → 연결이 거부됨

### 2. 네트워크 탭 확인 (F12 → Network)

**확인할 요청들**:
1. **SockJS info 요청**: `https://anjinma-bak.bluerack.org/ws/lecture/info`
   - 상태 코드: `200` (성공) 또는 `403` (오리진 거부) 또는 `404` (경로 없음)
   - 응답: JSON 형식의 SockJS 정보

2. **WebSocket 연결 시도**: `wss://anjinma-bak.bluerack.org/ws/lecture/...`
   - 상태 코드: `101` (성공) 또는 `403` (오리진 거부)

**에러 코드별 의미**:
- `403 Forbidden`: 오리진(Origin) 불일치
- `404 Not Found`: 경로가 잘못됨
- `101 Switching Protocols`: 연결 성공

### 3. 현재 페이지 오리진 확인

브라우저 콘솔에서 실행:
```javascript
console.log('Current origin:', window.location.origin);
```

**확인 사항**:
- 현재 오리진이 `https://anjinma.bluerack.org` 또는 `http://localhost:3000`인가?
- `https://anjinma-bak.bluerack.org`에서 실행 중이면 **오리진 문제**일 가능성 높음

### 4. SockJS info 엔드포인트 테스트

브라우저에서 직접 호출:
```
https://anjinma-bak.bluerack.org/ws/lecture/info
```

**예상 응답** (성공 시):
```json
{
  "websocket": true,
  "origins": ["*:*"],
  "cookie_needed": false,
  "entropy": 1234567890
}
```

**에러 응답**:
- `403 Forbidden`: 오리진 문제
- `404 Not Found`: 경로 문제
- `CORS error`: CORS 설정 문제

## 🛠️ 문제별 해결 방법

### 문제 1: 오리진(Origin) 불일치

**증상**:
- 네트워크 탭에서 `403 Forbidden` 에러
- 콘솔에 `[STOMP] SockJS Error occurred` 로그

**해결**:
1. **옵션 A**: 프론트를 허용된 도메인에서 실행
   - `https://anjinma.bluerack.org`에서 열기
   - 또는 `http://localhost:3000`에서 실행

2. **옵션 B**: 백엔드 설정 변경 (백엔드 수정 가능한 경우)
   - 백엔드 CORS 설정에 `https://anjinma-bak.bluerack.org` 추가

### 문제 2: 경로 문제

**증상**:
- 네트워크 탭에서 `404 Not Found` 에러
- SockJS info 요청이 실패

**해결**:
- 백엔드에서 `/ws/lecture` 경로가 올바르게 설정되어 있는지 확인
- `https://anjinma-bak.bluerack.org/ws/lecture/info`가 정상 응답하는지 확인

### 문제 3: 연결은 되지만 메시지가 안 감

**증상**:
- `[STOMP] Connected successfully` 로그는 나타남
- 하지만 구독/발행이 안 됨

**확인**:
- 구독 주소가 올바른지 확인: `/sub/rooms/{roomId}`, `/sub/rooms/{roomId}/attendance`
- 발행 주소가 올바른지 확인: `/pub/attendance/{roomId}`, `/pub/lecture/{roomId}`

## 📋 디버깅 명령어

브라우저 콘솔에서 실행:

```javascript
// 현재 환경 변수 확인
console.log('SOCKET_URL:', process.env.NEXT_PUBLIC_SOCKET_URL);

// SockJS info 테스트
fetch('https://anjinma-bak.bluerack.org/ws/lecture/info')
  .then(r => r.json())
  .then(console.log)
  .catch(console.error);

// 현재 오리진 확인
console.log('Origin:', window.location.origin);
```

## 🚨 가장 흔한 문제

**오리진 불일치**가 가장 흔한 문제입니다.

현재 상황:
- 프론트: `https://anjinma-bak.bluerack.org`에서 실행
- 백엔드: `https://anjinma.bluerack.org`만 허용
- 결과: `403 Forbidden` 에러

**즉시 해결 방법**:
1. 프론트를 `http://localhost:3000`에서 실행
2. 또는 백엔드에 `https://anjinma-bak.bluerack.org` 추가 요청

