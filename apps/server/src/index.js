import { config } from "./config.js";
import { createApplication } from "./create-application.js";

const application = createApplication(config);

application.httpServer.listen(config.port, config.host, () => {
  console.log(`Sala13 server listening on http://${config.host}:${config.port}`);
});

async function shutdown(signal) {
  console.log(`${signal} received; shutting down Sala13.`);
  await application.close();
  process.exit(0);
}

process.once("SIGINT", () => shutdown("SIGINT"));
process.once("SIGTERM", () => shutdown("SIGTERM"));
