const baseUrl = process.argv[2] || "http://127.0.0.1:3000";

try {
  const response = await fetch(`${baseUrl.replace(/\/$/, "")}/api/health`, {
    signal: AbortSignal.timeout(4_000)
  });
  const body = await response.json();
  if (!response.ok || body.ok !== true) throw new Error(`HTTP ${response.status}`);
  console.log(`Sala13 healthy: ${body.rooms} rooms, ${body.clients} clients, ${body.uptimeSeconds}s uptime`);
} catch (error) {
  console.error(`Sala13 healthcheck failed: ${error.message}`);
  process.exitCode = 1;
}
