import { networkInterfaces } from "node:os";

const wildcardHosts = new Set(["0.0.0.0", "::", "[::]"]);
const loopbackHosts = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);

function normalizedFamily(family) {
  if (family === 4) return "IPv4";
  if (family === 6) return "IPv6";
  return family;
}

function isUsableAddress(entry) {
  if (!entry || entry.internal) return false;
  const family = normalizedFamily(entry.family);
  if (family === "IPv4") return !entry.address.startsWith("169.254.");
  if (family === "IPv6") return !entry.address.toLowerCase().startsWith("fe80:");
  return false;
}

function addressPriority({ name, address }) {
  const interfaceName = name.toLowerCase();
  if (/docker|veth|vmware|virtualbox|wsl|hyper-v|vethernet/.test(interfaceName)) return 2;
  if (/wi-?fi|wireless|ethernet|tailscale|zerotier/.test(interfaceName)) return 0;
  if (/^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|100\.(6[4-9]|[789]\d|1[01]\d|12[0-7])\.)/.test(address)) return 1;
  return 1;
}

export function listNetworkAddresses(interfaces = networkInterfaces()) {
  const addresses = [];
  for (const [name, entries = []] of Object.entries(interfaces)) {
    for (const entry of entries) {
      if (!isUsableAddress(entry)) continue;
      addresses.push({
        name,
        address: entry.address,
        family: normalizedFamily(entry.family)
      });
    }
  }

  return addresses
    .sort((left, right) => addressPriority(left) - addressPriority(right) || left.name.localeCompare(right.name))
    .filter((entry, index, all) => all.findIndex((candidate) => candidate.address === entry.address) === index);
}

export function formatAccessUrl(address, port, protocol = "http") {
  const host = address.includes(":") && !address.startsWith("[") ? `[${address}]` : address;
  return `${protocol}://${host}:${port}`;
}

export function getAccessUrls({ host, port, interfaces, protocol = "http" }) {
  const normalizedHost = String(host || "0.0.0.0").trim().toLowerCase();
  const urls = [{ label: "Questo PC", url: formatAccessUrl("localhost", port, protocol) }];

  if (wildcardHosts.has(normalizedHost)) {
    for (const entry of listNetworkAddresses(interfaces)) {
      urls.push({ label: entry.name, url: formatAccessUrl(entry.address, port, protocol) });
    }
  } else if (!loopbackHosts.has(normalizedHost)) {
    urls.push({ label: "Rete", url: formatAccessUrl(host, port, protocol) });
  }

  return urls.filter((entry, index, all) => all.findIndex((candidate) => candidate.url === entry.url) === index);
}

export function isLoopbackOnlyHost(host) {
  return loopbackHosts.has(String(host || "").trim().toLowerCase());
}
