import { config } from "./config.js";
import { createApplication } from "./create-application.js";
import { getAccessUrls, isLoopbackOnlyHost } from "./network-access.js";

const application = createApplication(config);

application.httpServer.listen(config.port, config.host, () => {
  const address = application.httpServer.address();
  const port = typeof address === "object" && address ? address.port : config.port;
  const accessUrls = getAccessUrls({ host: config.host, port });

  console.log(`Sala13 ${config.environment} avviato su ${config.host}:${port}`);
  console.log("Apri uno di questi indirizzi:");
  for (const entry of accessUrls) {
    console.log(`  ${entry.label}: ${entry.url}`);
  }
  if (isLoopbackOnlyHost(config.host)) {
    console.warn("ATTENZIONE: HOST è limitato a questo PC. Imposta HOST=0.0.0.0 per accettare connessioni LAN/VPN.");
  } else {
    console.log("Condividi l'indirizzo del PC che esegue Sala13, non l'indirizzo del dispositivo ospite.");
  }
});

application.httpServer.on("error", (error) => {
  console.error(`Impossibile avviare Sala13 su ${config.host}:${config.port}: ${error.message}`);
  process.exitCode = 1;
});

async function shutdown(signal) {
  console.log(`${signal} received; shutting down Sala13.`);
  await application.close();
  process.exit(0);
}

process.once("SIGINT", () => shutdown("SIGINT"));
process.once("SIGTERM", () => shutdown("SIGTERM"));
