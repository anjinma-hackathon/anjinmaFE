# Coolify 배포 가이드

이 프로젝트를 Coolify를 사용하여 배포하는 방법입니다.

## 1. 준비 사항

### Git 저장소 설정
1. GitHub, GitLab, 또는 다른 Git 호스팅 서비스에 프로젝트를 푸시합니다.
2. 저장소가 공개 또는 Coolify에서 접근 가능한지 확인합니다.

## 2. Coolify에서 프로젝트 생성

### 2.1 새 리소스 생성
1. Coolify 대시보드에 로그인
2. "New Resource" 클릭
3. "Application" 선택

### 2.2 Git 저장소 연결
1. "Git Repository" 선택
2. 저장소 URL 입력 (예: `https://github.com/username/repo.git`)
3. 브랜치 선택 (보통 `main` 또는 `master`)
4. 빌드 패키 설정:
   - **Build Pack**: `Dockerfile` 선택
   - **Dockerfile Location**: `Dockerfile` (기본값)
   - **Port**: `3000` (기본값)

## 3. 환경 변수 설정

Coolify 대시보드에서 다음 환경 변수를 설정하세요:

### 필수 환경 변수
```env
NODE_ENV=production
NEXT_PUBLIC_API_URL=http://your-backend-url:3001
NEXT_PUBLIC_SOCKET_URL=http://your-backend-url:3001
```

### 환경 변수 설정 방법
1. Coolify 대시보드에서 애플리케이션 선택
2. "Environment Variables" 섹션으로 이동
3. 각 환경 변수를 추가:
   - `NODE_ENV` = `production`
   - `NEXT_PUBLIC_API_URL` = 백엔드 API URL
   - `NEXT_PUBLIC_SOCKET_URL` = Socket.io 서버 URL

## 4. 빌드 및 배포

1. "Deploy" 버튼 클릭
2. Coolify가 자동으로:
   - Git 저장소에서 코드를 가져옴
   - Dockerfile을 사용하여 이미지 빌드
   - 컨테이너를 실행하고 배포

## 5. 도메인 설정 (선택사항)

1. Coolify에서 "Domains" 섹션으로 이동
2. 원하는 도메인 입력
3. DNS 설정을 Coolify가 제공하는 값으로 업데이트

## 6. 트러블슈팅

### 빌드 실패 시
- Coolify 로그 확인
- `npm run build` 로컬에서 테스트
- 환경 변수 확인

### 런타임 오류 시
- 애플리케이션 로그 확인
- 환경 변수가 제대로 설정되었는지 확인
- 포트가 올바르게 설정되었는지 확인

## 7. 자동 배포 설정

1. Coolify에서 "Auto Deploy" 활성화
2. Git 저장소에 푸시할 때마다 자동으로 재배포됩니다

## 참고사항

- 백엔드 API와 Socket.io 서버도 함께 배포되어야 합니다
- `NEXT_PUBLIC_*` 접두사가 있는 환경 변수만 클라이언트에서 접근 가능합니다
- 프로덕션 빌드는 최적화된 Standalone 모드로 생성됩니다

