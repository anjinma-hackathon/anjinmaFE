import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "교육약자 실시간 번역 서비스",
  description: "경청이 어려운 학생들을 위한 실시간 번역 자막 서비스",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <head>
        <link rel="stylesheet" as="style" crossOrigin="" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard.min.css" />
      </head>
      <body>{children}</body>
    </html>
  );
}
