# 교육약자를 위한 실시간 번역 서비스

경청이 어려운 학생들을 위해 강의 음성을 자막·번역으로 실시간 제공하는 서비스입니다.

## 기술 스택

- **프론트엔드**: Next.js 14, TypeScript, Tailwind CSS
- **디자인**: Atomic Design Pattern

## 프로젝트 구조

```
├── app/                  # Next.js App Router
│   ├── student/         # 학생 페이지
│   ├── teacher/         # 교수 페이지
│   └── page.tsx         # 메인 페이지
├── components/          # Atomic Design 컴포넌트
│   ├── atoms/          # 가장 작은 단위 컴포넌트
│   ├── molecules/      # atoms 조합
│   └── organisms/      # molecules 조합
└── utils/              # 유틸리티 함수
```

## 시작하기

### 설치

```bash
npm install
```

### 개발 서버 실행

```bash
npm run dev
```

브라우저에서 [http://localhost:3000](http://localhost:3000)를 열어 확인하세요.

## 주요 기능

### 학생 페이지
- 기존 방 목록 (LocalStorage 저장)
- 학생코드로 새로운 방 입장

### 교수 페이지
- 방 만들기 (교수 이름, 과목명 입력)
- 교수코드로 기존 방 입장

## 개발 참고

- PRD 문서: `PROJECTPRD.md` 참고
- Figma 디자인을 참고하여 UI 구현
