# WebSocket 연결 문제 해결 가이드

## 현재 문제 상황

프론트엔드에서 `wss://anjinma-bak.bluerack.org/ws/lecture`로 WebSocket 연결을 시도하지만 연결이 실패하고 있습니다.

- **연결 URL**: `wss://anjinma-bak.bluerack.org/ws/lecture`
- **오류 상태**: WebSocket readyState: 3 (CLOSED)
- **재연결 시도**: 5초마다 자동 재연결 시도 중

## 백엔드 확인 필요 사항

### 1. WebSocket 엔드포인트 설정 확인

Spring Boot STOMP에서 WebSocket 엔드포인트가 올바르게 설정되어 있는지 확인하세요.

```java
@Configuration
@EnableWebSocketMessageBroker
public class WebSocketConfig implements WebSocketMessageBrokerConfigurer {
    
    @Override
    public void registerStompEndpoints(StompEndpointRegistry registry) {
        // 네이티브 WebSocket 지원 여부 확인
        registry.addEndpoint("/ws/lecture")
                .setAllowedOrigins("*") // 또는 특정 도메인
                .withSockJS(); // SockJS만 지원하는 경우
        
        // 네이티브 WebSocket을 지원하려면:
        // registry.addEndpoint("/ws/lecture")
        //         .setAllowedOrigins("*"); // SockJS 없이
    }
    
    @Override
    public void configureMessageBroker(MessageBrokerRegistry config) {
        config.enableSimpleBroker("/sub"); // 구독 경로
        config.setApplicationDestinationPrefixes("/pub"); // 발행 경로
    }
}
```

### 2. CORS 설정 확인

WebSocket 연결에도 CORS 설정이 필요합니다. 특히 WebSocket Upgrade 요청에 대한 CORS 허용이 필요합니다.

```java
@Configuration
public class CorsConfig {
    @Bean
    public WebMvcConfigurer corsConfigurer() {
        return new WebMvcConfigurer() {
            @Override
            public void addCorsMappings(CorsRegistry registry) {
                registry.addMapping("/**")
                        .allowedOrigins("*") // 또는 특정 도메인
                        .allowedMethods("*")
                        .allowedHeaders("*")
                        .allowCredentials(true);
            }
        };
    }
}
```

### 3. SSL/TLS 인증서 확인

HTTPS를 사용하는 경우 WebSocket도 WSS로 연결해야 합니다. SSL 인증서가 유효한지 확인하세요.

### 4. 네이티브 WebSocket vs SockJS

**현재 프론트엔드는 네이티브 WebSocket을 사용하고 있습니다.**

만약 백엔드가 **SockJS만 지원**하는 경우:
- 프론트엔드에서 `sockjs-client` 패키지를 사용해야 합니다
- URL이 `/ws/lecture`가 아니라 `/ws/lecture/info` 같은 SockJS 엔드포인트를 사용해야 할 수 있습니다

만약 백엔드가 **네이티브 WebSocket을 지원**하는 경우:
- `/ws/lecture` 경로로 직접 연결해야 합니다
- SockJS 설정 없이 엔드포인트를 등록해야 합니다

### 5. 방화벽/프록시 설정

리버스 프록시(nginx, Apache 등)를 사용하는 경우 WebSocket 연결을 허용하도록 설정해야 합니다.

**Nginx 예시:**
```nginx
location /ws/ {
    proxy_pass http://backend;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}
```

## 테스트 방법

### 1. 백엔드에서 직접 테스트

브라우저 콘솔에서 다음 명령으로 테스트:

```javascript
const ws = new WebSocket('wss://anjinma-bak.bluerack.org/ws/lecture');
ws.onopen = () => console.log('Connected!');
ws.onerror = (e) => console.error('Error:', e);
ws.onclose = (e) => console.log('Closed:', e.code, e.reason);
```

### 2. 백엔드 로그 확인

백엔드 서버 로그에서:
- WebSocket 연결 요청이 도달하는지 확인
- 101 Switching Protocols 응답이 있는지 확인
- 에러 메시지 확인

## 요청 사항

백엔드 개발자에게 다음을 확인해주세요:

1. ✅ **백엔드가 네이티브 WebSocket을 지원하나요, 아니면 SockJS만 지원하나요?**
   - 네이티브 WebSocket: `/ws/lecture` 경로로 직접 연결 가능
   - SockJS만: `sockjs-client` 패키지 사용 필요

2. ✅ **WebSocket 엔드포인트 경로가 정확히 `/ws/lecture`인가요?**
   - API 응답에서 받은 `wsEndpoint: "/ws/lecture"` 값 확인

3. ✅ **CORS 설정이 WebSocket 연결을 허용하나요?**
   - 특히 WebSocket Upgrade 요청에 대한 CORS 허용 확인

4. ✅ **SSL 인증서가 유효한가요?**
   - `wss://` 프로토콜을 사용하는 경우

5. ✅ **리버스 프록시 설정이 WebSocket을 허용하나요?**
   - nginx/Apache 등의 WebSocket 프록시 설정 확인

6. ✅ **백엔드 서버 로그에 WebSocket 연결 시도가 기록되나요?**
   - 연결 요청이 서버에 도달하지 않는 경우 네트워크/프록시 문제

## 참고 자료

- Spring Boot WebSocket: https://spring.io/guides/gs/messaging-stomp-websocket/
- STOMP Protocol: https://stomp.github.io/
- WebSocket API: https://developer.mozilla.org/en-US/docs/Web/API/WebSocket

