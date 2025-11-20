/** @type {import('next').NextConfig} */
const nextConfig = {
  // Standalone 빌드 활성화 (Docker 배포 최적화)
  output: 'standalone',
};

export default nextConfig;
