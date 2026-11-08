FROM node:20-bookworm-slim

WORKDIR /app

# T-415：与后端镜像同一 uid（10001），便于共享宿主机目录时不打架；
# 需要 root 的 npm 安装在 USER 之前完成。
RUN groupadd --gid 10001 cloudphone \
  && useradd --uid 10001 --gid 10001 --create-home \
    --home-dir /home/cloudphone --shell /usr/sbin/nologin cloudphone

COPY frontend/web/package*.json ./frontend/web/
RUN npm --prefix frontend/web ci

COPY . .

# T-415：npm run start 会先 vite build 写 frontend/web/dist，再启动 server.mjs，
# 而证书缓存落在 frontend/web/.tls，两处都在 /app 下，所以整棵 /app 交给 10001。
RUN chown -R 10001:10001 /app /home/cloudphone

ENV NODE_ENV=production
ENV HOME=/home/cloudphone

USER 10001
CMD ["npm", "--prefix", "frontend/web", "run", "start"]
