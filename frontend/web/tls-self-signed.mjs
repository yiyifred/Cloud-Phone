import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import selfsigned from "selfsigned";

const currentDirPath = path.dirname(fileURLToPath(import.meta.url));

// 证书落盘目录：把证书固定下来，用户只需信任一次；每次启动重生成会让浏览器
// 反复告警，用户为了能用就习惯性点「继续访问」，反而放大中间人风险。
const tlsDirPath = path.resolve(currentDirPath, ".tls");
const keyFilePath = path.join(tlsDirPath, "server-key.pem");
const certFilePath = path.join(tlsDirPath, "server-cert.pem");
const metaFilePath = path.join(tlsDirPath, "cert-meta.json");

// 剩余有效期低于该阈值就重生成，避免浏览器端在会话中途遇到过期证书
const minRemainingMs = 7 * 24 * 60 * 60 * 1000;
// 本地自签证书不受公开 CA 的 398 天上限约束，有效期拉长可减少重签次数
const validityDays = 825;

export async function createSelfSignedTlsOptions(extraSans = []) {
  const altNames = buildAltNames(extraSans);
  // SAN 变化（换机器 IP、加域名）会让已信任的证书失效，所以用指纹比对触发重生成
  const sanFingerprint = fingerprintAltNames(altNames);

  const cached = readCachedCertificate(sanFingerprint);

  if (cached) {
    return cached;
  }

  const cert = await selfsigned.generate([{ name: "commonName", value: "Cloud Phone" }], {
    keySize: 2048,
    algorithm: "sha256",
    notAfterDate: new Date(Date.now() + validityDays * 24 * 60 * 60 * 1000),
    extensions: [
      { name: "basicConstraints", cA: true },
      { name: "keyUsage", keyCertSign: true, digitalSignature: true },
      {
        name: "subjectAltName",
        altNames,
      },
    ],
  });

  persistCertificate(cert, altNames, sanFingerprint);

  return { key: cert.private, cert: cert.cert };
}

function buildAltNames(extraSans) {
  const candidates = [
    { type: 2, value: "localhost" },
    { type: 7, ip: "127.0.0.1" },
    ...extraSans.map(parseSanEntry).filter(Boolean),
  ];

  // 去重并排序，保证同一组 SAN 得到的指纹稳定，不会因顺序差异误判为变更
  const seen = new Set();
  const altNames = [];

  for (const entry of candidates) {
    const identity = `${entry.type}:${entry.value ?? entry.ip}`;

    if (seen.has(identity)) {
      continue;
    }

    seen.add(identity);
    altNames.push(entry);
  }

  return altNames.sort((left, right) => {
    const leftKey = `${left.type}:${left.value ?? left.ip}`;
    const rightKey = `${right.type}:${right.value ?? right.ip}`;

    return leftKey.localeCompare(rightKey);
  });
}

function fingerprintAltNames(altNames) {
  const serialized = altNames
    .map((entry) => `${entry.type}:${entry.value ?? entry.ip}`)
    .join("|");

  return crypto.createHash("sha256").update(serialized).digest("hex");
}

function readCachedCertificate(sanFingerprint) {
  try {
    const meta = JSON.parse(fs.readFileSync(metaFilePath, "utf8"));

    // SAN 指纹不一致说明证书覆盖不到当前访问地址，直接重生成
    if (meta?.sanFingerprint !== sanFingerprint) {
      return null;
    }

    const key = fs.readFileSync(keyFilePath, "utf8");
    const cert = fs.readFileSync(certFilePath, "utf8");
    const parsed = new crypto.X509Certificate(cert);

    // 剩余有效期不足 7 天就换新证书，避免浏览器端中途报过期
    if (Date.parse(parsed.validTo) - Date.now() <= minRemainingMs) {
      return null;
    }

    if (!isKeyPairMatched(key, parsed)) {
      return null;
    }

    return { key, cert };
  } catch {
    // 文件缺失/损坏/权限异常都按「无缓存」处理，走重新生成，不阻塞启动
    return null;
  }
}

function isKeyPairMatched(keyPem, certificate) {
  try {
    const privateKey = crypto.createPrivateKey(keyPem);
    const keySpki = crypto.createPublicKey(privateKey).export({ type: "spki", format: "der" });
    const certSpki = certificate.publicKey.export({ type: "spki", format: "der" });

    return keySpki.equals(certSpki);
  } catch {
    return false;
  }
}

function persistCertificate(cert, altNames, sanFingerprint) {
  try {
    // 私钥目录必须 0700：同机其它用户读到 key 就能完整冒充本服务
    fs.mkdirSync(tlsDirPath, { recursive: true, mode: 0o700 });
    fs.chmodSync(tlsDirPath, 0o700);

    writeFileWithMode(keyFilePath, cert.private, 0o600);
    writeFileWithMode(certFilePath, cert.cert, 0o600);
    writeFileWithMode(
      metaFilePath,
      `${JSON.stringify(
        {
          sanFingerprint,
          altNames,
          generatedAt: new Date().toISOString(),
        },
        null,
        2,
      )}\n`,
      0o600,
    );

    // 让 .tls 自忽略：私钥属于运行期机密，绝不能因为误 git add 进仓库
    writeFileWithMode(path.join(tlsDirPath, ".gitignore"), "*\n", 0o644);
  } catch (error) {
    // 磁盘只读等情况下仍用内存证书启动，但必须留下可诊断的告警
    console.warn(`TLS 证书持久化失败，将使用本次启动的内存证书: ${error.message}`);
  }
}

function writeFileWithMode(filePath, content, mode) {
  fs.writeFileSync(filePath, content, { mode });
  // writeFileSync 的 mode 只在新建文件时生效，已有文件需显式收紧权限
  fs.chmodSync(filePath, mode);
}

function parseSanEntry(entry) {
  const value = String(entry).trim();

  if (!value) {
    return null;
  }

  if (/^\d+\.\d+\.\d+\.\d+$/.test(value) || value.includes(":")) {
    return { type: 7, ip: value };
  }

  return { type: 2, value };
}
