import assert from "node:assert/strict";
import test from "node:test";
import { formatAccessUrl, getAccessUrls, isLoopbackOnlyHost, listNetworkAddresses } from "../src/network-access.js";

const interfaces = {
  "Loopback Pseudo-Interface 1": [
    { address: "127.0.0.1", family: "IPv4", internal: true }
  ],
  "vEthernet (WSL)": [
    { address: "172.28.16.1", family: "IPv4", internal: false }
  ],
  "Wi-Fi": [
    { address: "192.168.1.42", family: "IPv4", internal: false },
    { address: "fe80::1234", family: "IPv6", internal: false }
  ],
  Tailscale: [
    { address: "100.101.102.103", family: 4, internal: false }
  ]
};

test("lists usable LAN and VPN addresses before virtual adapters", () => {
  assert.deepEqual(listNetworkAddresses(interfaces), [
    { name: "Tailscale", address: "100.101.102.103", family: "IPv4" },
    { name: "Wi-Fi", address: "192.168.1.42", family: "IPv4" },
    { name: "vEthernet (WSL)", address: "172.28.16.1", family: "IPv4" }
  ]);
});

test("wildcard binding prints localhost plus every usable interface", () => {
  assert.deepEqual(getAccessUrls({ host: "0.0.0.0", port: 3000, interfaces }), [
    { label: "Questo PC", url: "http://localhost:3000" },
    { label: "Tailscale", url: "http://100.101.102.103:3000" },
    { label: "Wi-Fi", url: "http://192.168.1.42:3000" },
    { label: "vEthernet (WSL)", url: "http://172.28.16.1:3000" }
  ]);
});

test("formats IPv6 safely and detects loopback-only bindings", () => {
  assert.equal(formatAccessUrl("2001:db8::13", 3000), "http://[2001:db8::13]:3000");
  assert.equal(isLoopbackOnlyHost("127.0.0.1"), true);
  assert.equal(isLoopbackOnlyHost("localhost"), true);
  assert.equal(isLoopbackOnlyHost("0.0.0.0"), false);
});
