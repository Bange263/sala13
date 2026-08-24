# Deployment guide

## Recommended exposure model

Use Tailscale for a school project. Every invited player installs Tailscale and
joins the same private tailnet; the Raspberry Pi is not reachable by arbitrary
internet users and no router port forwarding is required. Tailscale Serve can
also terminate HTTPS and reverse-proxy WebSockets to Sala13.

| Method | Who can reach it | TLS | Router change | Recommendation |
| --- | --- | --- | --- | --- |
| same LAN | devices on local Wi-Fi | usually no | no | first smoke test |
| Tailscale Serve | authorized tailnet users | automatic HTTPS | no | best default |
| ZeroTier | authorized virtual-network members | application URL may be HTTP | no | valid VPN alternative |
| ngrok | anyone with/protected by public tunnel policy | managed HTTPS | no | temporary demo only |
| public domain/IP | entire internet | you must configure it | usually yes | only after hardening |

## 1. Raspberry Pi baseline

Recommended hardware/software:

- Raspberry Pi 4 or 5 with at least 2 GB RAM;
- Raspberry Pi OS Lite 64-bit, current supported release;
- wired Ethernet when possible;
- reserved LAN address from the router;
- accurate system time and automatic security updates;
- Node.js 24 LTS, which is the maintained LTS line as of August 2026.

Update the operating system:

```bash
sudo apt update
sudo apt full-upgrade -y
sudo reboot
```

After reconnecting, choose native Node or Docker. Do not run both copies on port
3000.

## 2A. Native Node deployment

Install Node.js 24 LTS for ARM64 from a maintained distribution source. Verify
the runtime rather than assuming the OS package is current:

```bash
node --version
npm --version
```

`node --version` should begin with `v24.`. If Node is missing, use the current
[Node.js download instructions](https://nodejs.org/en/download) or the maintained
[NodeSource Debian packages](https://github.com/nodesource/distributions), and
select the ARM64 build. Avoid an EOL Node version merely because it is in an old
OS repository.

Install the project:

```bash
sudo useradd --system --home /opt/sala13 --shell /usr/sbin/nologin sala13
sudo mkdir -p /opt/sala13
sudo chown -R sala13:sala13 /opt/sala13
sudo -u sala13 git clone YOUR_GITHUB_REPOSITORY_URL /opt/sala13
cd /opt/sala13
sudo -u sala13 npm ci --omit=dev
sudo cp .env.example /etc/sala13.env
sudo chmod 640 /etc/sala13.env
sudo chown root:sala13 /etc/sala13.env
```

For Tailscale-only access, edit `/etc/sala13.env`:

```dotenv
NODE_ENV=production
HOST=127.0.0.1
PORT=3000
ALLOWED_ORIGINS=https://YOUR-PI-NAME.YOUR-TAILNET.ts.net
```

If `/usr/bin/node` is not the path returned by `command -v node`, edit
`deploy/systemd/sala13.service` before installation.

Install and start the service:

```bash
sudo cp deploy/systemd/sala13.service /etc/systemd/system/sala13.service
sudo systemctl daemon-reload
sudo systemctl enable --now sala13
sudo systemctl status sala13 --no-pager
curl -fsS http://127.0.0.1:3000/api/health
```

Logs:

```bash
sudo journalctl -u sala13 -f
```

Safe update:

```bash
cd /opt/sala13
sudo -u sala13 git fetch --all --prune
sudo -u sala13 git pull --ff-only
sudo -u sala13 npm ci --omit=dev
sudo -u sala13 npm test
sudo systemctl restart sala13
curl -fsS http://127.0.0.1:3000/api/health
```

Active rooms are in memory, so announce and stop games before restarting.

## 2B. Docker deployment

Use 64-bit Raspberry Pi OS and follow Docker's current
[Debian ARM64 installation guide](https://docs.docker.com/engine/install/debian/).
Docker documents 64-bit ARM support; current Docker versions have dropped new
major releases for Raspberry Pi OS 32-bit, so a new setup should be 64-bit.

```bash
git clone YOUR_GITHUB_REPOSITORY_URL sala13
cd sala13
cp .env.example .env
nano .env
sudo docker compose up -d --build
sudo docker compose ps
curl -fsS http://127.0.0.1:3000/api/health
```

The supplied Compose file binds only to host loopback. This is intentional for
Tailscale Serve or Nginx. To allow direct LAN access, change:

```yaml
ports:
  - "3000:3000"
```

Then allow TCP 3000 only from the LAN in your firewall. Do not expose that port
through the router.

Update the container:

```bash
git pull --ff-only
sudo docker compose build --pull
sudo docker compose up -d
sudo docker image prune
```

Review images before pruning if the previous image is your rollback plan.

## 3. Tailscale access with HTTPS

The official Linux installer supports Raspberry Pi OS:

```bash
curl -fsSL https://tailscale.com/install.sh | sh
sudo tailscale up
tailscale status
tailscale ip -4
```

Open the authentication URL printed by `tailscale up`. Install Tailscale on the
other players' devices and invite their accounts into the tailnet. Restrict
access with tailnet grants/ACLs rather than inviting unrelated users.

Confirm Sala13 responds locally, then configure persistent HTTPS reverse proxy:

```bash
curl -fsS http://127.0.0.1:3000/api/health
sudo tailscale serve --bg localhost:3000
tailscale serve status
```

The command prints an `https://...ts.net` URL. Set that exact origin in
`ALLOWED_ORIGINS` and restart Sala13. Tailscale's current Serve syntax and
background persistence are documented in the
[official CLI reference](https://tailscale.com/docs/reference/tailscale-cli/serve).

Players open the HTTPS URL. Socket.IO automatically upgrades to WebSocket
through the reverse proxy. Verify with two networks, for example the Pi on home
internet and a phone on mobile data with Tailscale enabled.

To inspect or disable Serve:

```bash
tailscale serve status
sudo tailscale serve reset
```

Do not confuse Serve with Funnel. Serve is tailnet-only. Funnel intentionally
publishes to the entire internet and changes the threat model.

## 4. Windows host

1. Install Node.js 24 LTS from the official Node.js Windows installer.
2. Download/clone the repository.
3. Open PowerShell in the project root.
4. Run:

```powershell
Copy-Item .env.example .env
npm ci
npm test
npm start
```

Open `http://localhost:3000`. For LAN access, keep `HOST=0.0.0.0`, find the
address with `ipconfig`, and create a Windows Defender Firewall inbound rule for
TCP 3000 limited to the Private profile/local subnet. Do not create a router
port forward.

For remote classmates, install Tailscale on Windows, sign in, and from an
Administrator PowerShell run the current Serve command:

```powershell
tailscale serve --bg localhost:3000
tailscale serve status
```

Keep the terminal running for `npm start`, or configure a dedicated Windows
scheduled task/service only after confirming the command and working directory.

## 5. ZeroTier alternative

Install ZeroTier on the Pi and every player device from the
[official downloads page](https://www.zerotier.com/download/). Create one
private network, authorize only known member devices, and bind Sala13 to
`0.0.0.0:3000`. Players use the Pi's assigned ZeroTier address:

```text
http://ZEROTIER_PI_IP:3000
```

Restrict port 3000 to the ZeroTier interface/firewall zone. ZeroTier supplies
the private network, but not automatically a browser-trusted HTTPS domain in
this simple mode. For a classroom prototype that may be acceptable; Tailscale
Serve gives the cleaner HTTPS path.

## 6. ngrok temporary demo

ngrok creates a public internet endpoint. Install and authenticate the agent
using the [official quickstart](https://ngrok.com/docs/share-localhost/quickstart),
then:

```bash
ngrok http 3000
```

Set the printed HTTPS origin in `ALLOWED_ORIGINS` and restart Sala13. Use ngrok
authentication/traffic policy so possession of a random URL is not the only
barrier. Free endpoint URLs may change, requiring the origin to be updated.
This is suitable for a supervised demonstration, not an unattended permanent
server.

## 7. Public domain and public IP

Only choose this after implementing the “public launch” items in `SECURITY.md`.

1. Point the domain's A/AAAA record to the public address.
2. Give the host a reserved LAN address.
3. Forward router TCP 80/443 to Nginx, never port 3000 directly.
4. Copy and edit `deploy/nginx/sala13.conf`.
5. Obtain an automatically renewed trusted TLS certificate.
6. Set `ALLOWED_ORIGINS=https://games.example.com`.
7. Apply a host firewall allowing SSH only from trusted networks and HTTP/S from
   the intended audience.
8. Add real authentication, distributed IP/account rate limits, moderation and
   structured monitoring.
9. Test WebSocket upgrade, reconnect, payload limits and certificate renewal.

The Nginx template contains the required HTTP/1.1 `Upgrade` and `Connection`
headers for Socket.IO. If a CDN/proxy is added, WebSocket support and timeout
settings must also be enabled there.

## 8. Verification checklist

Run this after every deployment:

```bash
node scripts/healthcheck.mjs http://127.0.0.1:3000
```

Then verify manually:

- homepage and all Info dialogs load without console errors;
- a public lobby appears on a second browser;
- a private room is absent from the public list;
- a wrong password is rejected;
- players cannot start until every connected participant is ready;
- at least one visible-state, hidden-card and drawing game can be completed;
- a third player cannot join a two-player room;
- refreshing one player within 30 seconds restores the room;
- closing both clients removes the lobby after the configured grace/TTL;
- the Tailscale HTTPS URL works on a different physical network;
- server logs contain no passwords or game secrets.

## 9. Capacity and reliability

Do not advertise a player capacity based on assumptions. Run a Socket.IO load
test against the actual Pi while monitoring CPU, memory, event-loop delay and
outbound bandwidth. Drawing traffic is usually the first bottleneck; batch
stroke points and cap rates before increasing room count.

Use Ethernet, a quality power supply, adequate cooling and a reliable storage
device. Enable automatic OS security updates and rehearse restoring the Git
repository and environment file. Current active games cannot survive a restart
until durable snapshots are implemented.
