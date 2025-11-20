/** @type {import('next').NextConfig} */
const nextConfig = {
  // Standalone 빌드 활성화 (Docker 배포 최적화)
  output: 'standalone',
  // 빌드 시 환경 변수가 없어도 빌드가 성공하도록 설정
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || '',
    NEXT_PUBLIC_SOCKET_URL: process.env.NEXT_PUBLIC_SOCKET_URL || '',
    NEXT_PUBLIC_USE_PROXY: process.env.NEXT_PUBLIC_USE_PROXY || 'false',
  },
};

export default nextConfig;
