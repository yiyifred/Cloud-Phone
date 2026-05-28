import mdns from "multicast-dns";
import { encode } from "dns-packet";
import os from "node:os";

function toTxtRecords(txt) {
  return Object.entries(txt)
    .filter(([, value]) => value !== undefined && value !== null)
    .map(([key, value]) => {
      const safeValue = String(value);
      return Buffer.from(`${key}=${safeValue}`);
    });
}

function pickLanIpv4(hostHint) {
  const forced = process.env.CLOUD_PHONE_LAN_IP?.trim();
  if (forced) {
    return forced;
  }

  if (hostHint && hostHint !== "0.0.0.0" && hostHint !== "::" && hostHint !== "127.0.0.1") {
    return hostHint;
  }

  const isIpv4InCidr = (ip, prefix, bits) => {
    const a = ip.split(".").map((n) => Number(n));
    const b = prefix.split(".").map((n) => Number(n));
    if (a.length !== 4 || b.length !== 4 || a.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) {
      return false;
    }
    const toInt = (p) => ((p[0] << 24) | (p[1] << 16) | (p[2] << 8) | p[3]) >>> 0;
    const mask = bits === 0 ? 0 : (0xffffffff << (32 - bits)) >>> 0;
    return (toInt(a) & mask) === (toInt(b) & mask);
  };

  const isPreferredLanIpv4 = (ip) => {
    // RFC1918
    if (isIpv4InCidr(ip, "192.168.0.0", 16)) return true;
    if (isIpv4InCidr(ip, "10.0.0.0", 8)) return true;
    if (isIpv4InCidr(ip, "172.16.0.0", 12)) return true;
    return false;
  };

  const isExcludedIpv4 = (ip) => {
    // Link-local, loopback, benchmarking nets
    if (isIpv4InCidr(ip, "127.0.0.0", 8)) return true;
    if (isIpv4InCidr(ip, "169.254.0.0", 16)) return true;
    if (isIpv4InCidr(ip, "198.18.0.0", 15)) return true;
    return false;
  };

  const nets = os.networkInterfaces();
  const candidates = [];
  for (const items of Object.values(nets)) {
    for (const item of items ?? []) {
      if (item && item.family === "IPv4" && !item.internal) {
        const ip = item.address;
        if (isExcludedIpv4(ip)) {
          continue;
        }
        candidates.push(ip);
      }
    }
  }

  const preferred = candidates.find(isPreferredLanIpv4);
  if (preferred) {
    return preferred;
  }

  return candidates[0] ?? "127.0.0.1";
}

function buildServiceRecords({ serviceName, serviceType, port, txt, ipv4 }) {
  const instance = `${serviceName}.${serviceType}`;
  const hostname = `cloud-phone-${port}.local`;

  return {
    ptr: { name: serviceType, type: "PTR", data: instance, ttl: 120 },
    srv: {
      name: instance,
      type: "SRV",
      data: { priority: 0, weight: 0, port, target: hostname },
      ttl: 120,
    },
    txt: { name: instance, type: "TXT", data: toTxtRecords(txt), ttl: 120 },
    a: { name: hostname, type: "A", data: ipv4, ttl: 120 },
  };
}

export function startMdnsService({ host, port, version }) {
  const ipv4 = pickLanIpv4(host);
  const mdnsServer = mdns();

  const cloudphone = buildServiceRecords({
    serviceName: `Cloud-Phone-${port}`,
    serviceType: "_cloudphone._tcp.local",
    port,
    ipv4,
    txt: {
      version,
      path: "/api/ping",
      lan: ipv4,
      port,
    },
  });

  const http = buildServiceRecords({
    serviceName: `Cloud-Phone-HTTP-${port}`,
    serviceType: "_http._tcp.local",
    port,
    ipv4,
    txt: {
      version,
      path: "/api/ping",
      lan: ipv4,
      port,
    },
  });

  function respond(query) {
    const q = query?.questions ?? [];
    const answers = [];

    for (const question of q) {
      if (!question?.name) continue;

      if (question.name === "_cloudphone._tcp.local" && question.type === "PTR") {
        answers.push(cloudphone.ptr, cloudphone.srv, cloudphone.txt, cloudphone.a);
      }

      if (question.name === "_http._tcp.local" && question.type === "PTR") {
        answers.push(http.ptr, http.srv, http.txt, http.a);
      }

      if (question.name === cloudphone.srv.name && (question.type === "SRV" || question.type === "ANY")) {
        answers.push(cloudphone.srv, cloudphone.txt, cloudphone.a);
      }

      if (question.name === http.srv.name && (question.type === "SRV" || question.type === "ANY")) {
        answers.push(http.srv, http.txt, http.a);
      }
    }

    if (answers.length === 0) {
      return;
    }

    mdnsServer.respond({ answers });
  }

  mdnsServer.on("query", respond);
  mdnsServer.on("error", (error) => {
    console.error("[mdns] Broadcast error:", error);
  });

  // Proactively announce once to help caches populate.
  try {
    const packet = encode({ answers: [cloudphone.ptr, cloudphone.srv, cloudphone.txt, cloudphone.a] });
    mdnsServer.send(packet);
    const packet2 = encode({ answers: [http.ptr, http.srv, http.txt, http.a] });
    mdnsServer.send(packet2);
  } catch (error) {
    console.warn("[mdns] Initial announce failed:", error);
  }

  console.log(`[mdns] Broadcast ready: _cloudphone._tcp on port ${port} (${ipv4})`);
  console.log(`[mdns] Broadcast ready: _http._tcp on port ${port} (${ipv4})`);

  return async () => {
    try {
      mdnsServer.removeListener("query", respond);
      mdnsServer.destroy();
    } catch (error) {
      console.warn("[mdns] Stop failed:", error);
    }
  };
}
