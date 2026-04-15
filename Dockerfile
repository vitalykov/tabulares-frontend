# Build
FROM node:22-alpine AS builder

WORKDIR /app

COPY package-lock.json package.json ./
RUN npm ci

COPY . .

RUN npm run build

RUN npm prune --production

# Serve
FROM alpine:3.21

RUN apk add --no-cache \
    busybox-extras

RUN addgroup -g 1000 -S tabulares && \
    adduser -u 1000 -G tabulares -S -H juggler

RUN mkdir -p /app && \
    chown juggler:tabulares /app

WORKDIR /app

COPY --from=builder --chown=juggler:tabulares /app/dist /app/

USER juggler

EXPOSE 7777

ENTRYPOINT [ "/bin/busybox-extras", "httpd" ]
CMD [ "-f", "-p", "7777", "-h", "/app" ]
