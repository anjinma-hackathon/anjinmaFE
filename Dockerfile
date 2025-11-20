# Next.js 앱을 위한 Dockerfile
FROM node:20-alpine AS base

# 의존성 설치를 위한 단계
FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

# package.json과 package-lock.json 복사
COPY package.json package-lock.json* ./
RUN npm ci

# 빌드 단계
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Next.js 빌드 (Standalone 모드)
# 빌드 시 환경 변수는 선택사항 (런타임에 설정될 수 있음)
ENV NEXT_TELEMETRY_DISABLED 1
# 빌드 시 환경 변수가 없어도 빌드가 성공하도록 설정
ARG NEXT_PUBLIC_API_URL=""
ARG NEXT_PUBLIC_SOCKET_URL=""
ARG NEXT_PUBLIC_USE_PROXY="false"
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_SOCKET_URL=$NEXT_PUBLIC_SOCKET_URL
ENV NEXT_PUBLIC_USE_PROXY=$NEXT_PUBLIC_USE_PROXY
RUN npm run build

# 프로덕션 실행 단계
FROM base AS runner
WORKDIR /app

ENV NODE_ENV production
ENV NEXT_TELEMETRY_DISABLED 1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Standalone 빌드 결과물 복사
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000

ENV PORT 3000
ENV HOSTNAME "0.0.0.0"

CMD ["node", "server.js"]

