FROM node:22-bookworm-slim

WORKDIR /app

# T-415：容器内以非 root 运行。uid/gid 固定 10001，方便宿主机 bind mount 对齐权限。
# 所有需要 root 的步骤（apt / npm / pip / chmod）都必须留在末尾 USER 之前。
RUN groupadd --gid 10001 cloudphone \
  && useradd --uid 10001 --gid 10001 --create-home \
    --home-dir /home/cloudphone --shell /usr/sbin/nologin cloudphone

RUN apt-get update \
  && apt-get install -y --no-install-recommends \
    android-tools-adb \
    python3 \
    python3-pip \
    openssl \
    libusb-1.0-0 \
  && rm -rf /var/lib/apt/lists/*

COPY backend/node/package*.json ./backend/node/
RUN npm --prefix backend/node ci --omit=dev

COPY backend/assets/ios/requirements.txt ./backend/assets/ios/requirements.txt
RUN apt-get update \
  && apt-get install -y --no-install-recommends \
    gcc \
    g++ \
    python3-dev \
    libffi-dev \
    libssl-dev \
  && python3 -m pip install --no-cache-dir --break-system-packages \
    -r backend/assets/ios/requirements.txt \
  && apt-get purge -y --auto-remove gcc g++ python3-dev libffi-dev libssl-dev \
  && rm -rf /var/lib/apt/lists/*

COPY . .

# Bundled platform-tools may ship without +x on some platforms; fix when present.
RUN set -e; \
  for adb in \
    backend/bin/adb/platform-tools-latest-linux/platform-tools/adb \
    backend/bin/adb/platform-tools-latest-darwin/platform-tools/adb; \
  do \
    if [ -f "$adb" ]; then chmod +x "$adb"; fi; \
  done

# T-415：把运行期需要写的位置交给 cloudphone，再落 USER。
# /app 之所以也要可写：adb-path.js:41 会在运行时对自带 adb 补 +x，scrcpy 构建脚本
# 也会往 backend/bin 下写产物；/data 是持久化数据目录（auth.key、sqlite）。
# HOME 必须可写，否则 adb 无法生成 ~/.android/adbkey，容器内 adb 直接起不来。
RUN mkdir -p /data \
  && chown -R 10001:10001 /app /data /home/cloudphone

ENV NODE_ENV=production
ENV CLOUD_PHONE_PREFER_SYSTEM_ADB=1
ENV CLOUD_PHONE_PYTHON=python3
# T-415：数据目录外置为卷，避免容器重建丢数据；权限已在上一步交给 10001
ENV CLOUD_PHONE_DATA_DIR=/data
ENV HOME=/home/cloudphone
VOLUME ["/data"]

USER 10001
CMD ["npm", "--prefix", "backend/node", "run", "start"]
