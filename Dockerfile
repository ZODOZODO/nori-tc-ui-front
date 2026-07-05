FROM harbor.nori.local/library/nginx:stable-alpine

# alpine 베이스 패키지를 빌드시점 최신 패치로 갱신(Trivy HIGH/CRITICAL 스캔 게이트 대응).
RUN apk upgrade --no-cache

ENV TZ=Asia/Seoul

WORKDIR /app/build

COPY dist/ ./

RUN mkdir -p /tmp/client_body /tmp/proxy /tmp/fastcgi /tmp/uwsgi /tmp/scgi && \
    chown -R nginx:nginx /app /tmp /var/cache/nginx /var/log/nginx /etc/nginx

COPY nginx.conf /etc/nginx/nginx.conf
RUN nginx -t

USER nginx

EXPOSE 8080

CMD ["nginx", "-g", "daemon off;"]
