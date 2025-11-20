# 학생 입장이 교수 화면에 안 보이는 예상 문제점

## 🔴 1. 학생 입장 메시지 발행 주소 변환 문제

**위치**: `components/ClassRoom.tsx:107`

```typescript
const attendancePublishUrl = subscribeUrl.replace('/sub/rooms/', '/pub/attendance/');
```

**문제점**:
- `subscribeUrl`이 정확히 `/sub/rooms/{roomId}` 형식이 아닐 수 있음
- 예: `/sub/rooms/1` → `/pub/attendance/1` (정상)
- 예: `/sub/rooms/1/` → `/pub/attendance/1/` (슬래시 문제)
- 예: 다른 형식이면 replace가 실패

**확인 방법**:
- 브라우저 콘솔에서 `[ClassRoom] Student join message sent to:` 로그 확인
- 실제 발행 주소가 `/pub/attendance/{roomId}` 형식인지 확인

**해결책**:
```typescript
// roomId를 직접 사용하거나, 더 안전한 변환 로직
const roomId = subscribeUrl.match(/\/(\d+)$/)?.[1];
const attendancePublishUrl = `/pub/attendance/${roomId}`;
```

---

## 🔴 2. 타이밍 문제 (Race Condition)

**문제점**:
- 학생이 입장 메시지를 보낼 때와 교수가 구독을 완료하는 시점의 타이밍 문제
- 학생이 먼저 입장 메시지를 보내면, 교수가 아직 구독을 완료하지 않았을 수 있음

**현재 코드**:
- 학생: `waitForConnection` 후 즉시 발행
- 교수: `waitForConnection` 후 구독 시작

**확인 방법**:
- 교수 화면 콘솔에서 `[TeacherRoom] Subscribed to attendance:` 로그 확인
- 학생 화면 콘솔에서 `[ClassRoom] Student join message sent to:` 로그 확인
- 시간 순서 확인

**해결책**:
- 백엔드가 구독 시점에 초기 스냅샷을 보내야 함 (백엔드 확인 필요)

---

## 🔴 3. 초기 스냅샷 미수신 문제

**문제점**:
- 교수 화면이 구독할 때 백엔드가 초기 스냅샷을 보내지 않으면, 이미 입장한 학생들이 안 보임
- 백엔드가 구독 시점에 현재 입장한 학생 목록을 스냅샷으로 보내는지 확인 필요

**확인 방법**:
- 교수 화면 콘솔에서 `[TeacherRoom] Received attendance snapshot:` 로그 확인
- 구독 직후 스냅샷이 오는지 확인

**해결책**:
- 백엔드가 구독 시점에 초기 스냅샷을 보내도록 요청
- 또는 REST API로 초기 목록 조회 후 WebSocket으로 실시간 업데이트

---

## 🔴 4. WebSocket 연결 상태 문제

**문제점**:
- 학생과 교수 모두 WebSocket 연결이 제대로 되지 않았을 수 있음
- `waitForConnection`이 타임아웃되거나 실패할 수 있음

**확인 방법**:
- 학생 화면 콘솔: `[STOMP] Connected successfully` 로그 확인
- 교수 화면 콘솔: `[TeacherRoom] WebSocket connected successfully` 로그 확인
- `[STOMP] WebSocket Error occurred` 에러 로그 확인

**해결책**:
- WebSocket URL이 올바른지 확인
- 백엔드 WebSocket 서버가 실행 중인지 확인
- CORS 설정 확인

---

## 🔴 5. 구독 주소 불일치 문제

**문제점**:
- 교수 화면이 구독하는 주소: `${subscribeUrl}/attendance`
- 예: `/sub/rooms/1/attendance` (정상)
- 하지만 `subscribeUrl`이 다른 형식이면 문제 발생

**확인 방법**:
- 교수 화면 콘솔에서 `[TeacherRoom] Subscribed to attendance:` 로그 확인
- 실제 구독 주소가 `/sub/rooms/{roomId}/attendance` 형식인지 확인

**해결책**:
- `subscribeUrl` 형식 확인 및 안전한 주소 생성

---

## 🔴 6. 메시지 형식 불일치 문제

**문제점**:
- 학생이 보내는 메시지: `{ studentId, studentName, language }`
- 교수가 받는 메시지: `{ type: "snapshot", students: [...] }`
- 학생이 개별 메시지를 보내지만, 교수는 스냅샷만 받음
- 백엔드가 학생 입장 메시지를 받아서 스냅샷을 생성하는지 확인 필요

**확인 방법**:
- 학생 화면 콘솔: 발행 메시지 형식 확인
- 교수 화면 콘솔: 수신 메시지 형식 확인
- 백엔드 로그 확인

**해결책**:
- 백엔드가 학생 입장 메시지를 받아서 스냅샷을 생성하고 브로드캐스트하는지 확인

---

## 🔴 7. REST API 폴백 문제

**현재 코드**:
- 교수 화면이 5초마다 REST API로 학생 목록을 조회함
- 하지만 WebSocket이 정상 동작하면 REST API는 폴백일 뿐

**확인 방법**:
- REST API 응답 확인: `[TeacherRoom] Attendance response:` 로그
- WebSocket 메시지 수신 확인: `[TeacherRoom] Received attendance snapshot:` 로그

**문제점**:
- REST API는 정상 동작하지만 WebSocket이 안 되면 실시간 업데이트가 안 됨

---

## 🔴 8. 클로저 문제 (students 상태)

**위치**: `components/TeacherRoom.tsx:339`

```typescript
const previousStudentIds = new Set(students.map(s => s.studentId));
```

**문제점**:
- `students` 상태가 클로저로 캡처되어 이전 값만 참조할 수 있음
- `setStudents`를 호출해도 클로저 내부의 `students`는 업데이트되지 않음

**해결책**:
- `useRef`를 사용하거나 함수형 업데이트 사용

---

## ✅ 디버깅 체크리스트

1. **학생 화면 콘솔 확인**:
   - `[ClassRoom] Student join message sent to:` 로그 확인
   - 발행 주소가 올바른지 확인
   - WebSocket 연결 상태 확인

2. **교수 화면 콘솔 확인**:
   - `[TeacherRoom] Subscribed to attendance:` 로그 확인
   - `[TeacherRoom] Received attendance snapshot:` 로그 확인
   - WebSocket 연결 상태 확인

3. **네트워크 탭 확인**:
   - WebSocket 연결 확인
   - 메시지 전송/수신 확인

4. **백엔드 로그 확인**:
   - 학생 입장 메시지 수신 확인
   - 스냅샷 생성 및 브로드캐스트 확인

---

## 🛠️ 즉시 확인할 사항

1. 브라우저 콘솔 로그 전체 확인
2. WebSocket 연결 상태 확인
3. 발행/구독 주소가 올바른지 확인
4. 백엔드가 메시지를 받고 있는지 확인
5. 백엔드가 스냅샷을 브로드캐스트하는지 확인

