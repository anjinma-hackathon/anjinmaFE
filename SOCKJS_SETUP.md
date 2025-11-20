# SockJS 설정 완료 및 주의사항

## ✅ 완료된 작업

1. **SockJS 패키지 설치**: `sockjs-client` 및 타입 정의 설치 완료
2. **코드 수정**: `utils/stomp.ts`를 SockJS 사용하도록 변경

## 🔴 중요: 오리진(Origin) 문제

백엔드가 허용하는 오리진:
- ✅ `https://anjinma.bluerack.org`
- ✅ `http://localhost:*`
- ✅ `http://127.0.0.1:*`
- ❌ `https://anjinma-bak.bluerack.org` (거부됨)

### 해결 방법

**옵션 1: 프론트를 허용된 도메인에서 실행 (권장)**
- 프론트 페이지를 `https://anjinma.bluerack.org` 또는 `http://localhost:3000`에서 열기

**옵션 2: 백엔드 설정 변경 (백엔드 수정 가능한 경우)**
- 백엔드 CORS 설정에 `https://anjinma-bak.bluerack.org` 추가

## 📋 변경 사항

### 이전 (네이티브 WebSocket)
```typescript
brokerURL: `wss://anjinma-bak.bluerack.org/ws/lecture`
```

### 현재 (SockJS)
```typescript
webSocketFactory: () => new SockJS(`https://anjinma-bak.bluerack.org/ws/lecture`)
```

## 🧪 테스트 방법

1. **브라우저 콘솔 확인**:
   - `[STOMP] Initializing SockJS connection...` 로그 확인
   - `[STOMP] Connected successfully` 로그 확인

2. **네트워크 탭 확인**:
   - SockJS 연결 요청 확인
   - 응답 코드 확인 (403이면 오리진 문제, 404면 경로 문제)

3. **SockJS info 엔드포인트 테스트**:
   - 브라우저에서 `https://anjinma-bak.bluerack.org/ws/lecture/info` 호출
   - JSON 응답이 오는지 확인

## ⚠️ 주의사항

- SockJS는 `https://` 또는 `http://`를 사용 (wss:// 또는 ws://가 아님)
- 백엔드가 `withSockJS()`로 설정되어 있어야 함
- 오리진이 백엔드 허용 목록에 있어야 함

