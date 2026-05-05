FROM harbor.nori.local/library/nginx:stable-alpine

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
