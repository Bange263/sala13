# Security policy

Sala13 is intended for a small trusted group and currently stores rooms only in
memory. Report vulnerabilities privately to the repository owner rather than
opening a public issue containing exploit details.

Before exposing the service beyond a VPN:

1. set `NODE_ENV=production` and an exact `ALLOWED_ORIGINS` list;
2. terminate TLS at Tailscale Serve or a maintained reverse proxy;
3. keep Node and dependencies patched;
4. add authenticated accounts or signed guest sessions if rooms persist;
5. move rate limits and sessions to a central store before running multiple
   server processes;
6. never log room passwords, private cards, words or drawing prompts;
7. validate and cap every uploaded message, point list and custom category;
8. add moderation controls before accepting untrusted public users.

Room codes are invitations, not strong authentication. Optional passwords help
against accidental discovery, but a public internet service needs real account
and authorization controls.
