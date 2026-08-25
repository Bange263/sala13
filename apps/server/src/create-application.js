import { createServer } from "node:http";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { GAME_CATALOG, toPublicGame } from "@sala13/shared";
import express from "express";
import helmet from "helmet";
import { Server as SocketIOServer } from "socket.io";
import { config as defaultConfig, isOriginAllowed } from "./config.js";
import { registerSocketHandlers } from "./realtime/register-socket-handlers.js";
import { RoomManager } from "./rooms/room-manager.js";

const sourceDirectory = dirname(fileURLToPath(import.meta.url));
const webRoot = resolve(sourceDirectory, "../../web/public");
const sharedRoot = resolve(sourceDirectory, "../../../packages/shared/src");

export function createApplication(config = defaultConfig) {
  const app = express();
  const httpServer = createServer(app);
  const roomManager = new RoomManager(config);
  const io = new SocketIOServer(httpServer, {
    cors: {
      origin(origin, callback) {
        const allowed = isOriginAllowed(origin, config.allowedOrigins);
        callback(allowed ? null : new Error("Origin not allowed"), allowed);
      },
      methods: ["GET", "POST"]
    },
    maxHttpBufferSize: 100_000,
    pingInterval: 25_000,
    pingTimeout: 20_000,
    transports: ["websocket", "polling"]
  });

  app.disable("x-powered-by");
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'"],
          imgSrc: ["'self'", "data:"],
          connectSrc: ["'self'", "ws:", "wss:"],
          objectSrc: ["'none'"],
          frameAncestors: ["'none'"],
          upgradeInsecureRequests: config.environment === "production" ? [] : null
        }
      },
      crossOriginEmbedderPolicy: false,
      strictTransportSecurity: config.environment === "production" ? undefined : false
    })
  );
  app.use(express.json({ limit: "16kb" }));

  app.get("/api/health", (_request, response) => {
    response.json({
      ok: true,
      service: "sala13",
      version: "0.3.0",
      uptimeSeconds: Math.floor(process.uptime()),
      rooms: roomManager.rooms.size,
      clients: io.engine.clientsCount
    });
  });
  app.get("/api/games", (_request, response) => {
    response.json(GAME_CATALOG.map(toPublicGame));
  });
  app.get("/api/lobbies", (_request, response) => {
    response.json(roomManager.getPublicLobbies());
  });

  app.use(
    "/shared",
    express.static(sharedRoot, { etag: true, maxAge: config.environment === "production" ? "1h" : 0 })
  );
  app.use(express.static(webRoot, { etag: true, maxAge: config.environment === "production" ? "1h" : 0 }));

  app.use((error, _request, response, _next) => {
    console.error(error);
    response.status(500).json({ ok: false, error: "Internal server error" });
  });

  registerSocketHandlers(io, roomManager, config);

  return {
    app,
    httpServer,
    io,
    roomManager,
    async close() {
      roomManager.close();
      await new Promise((resolveClose) => io.close(resolveClose));
      if (httpServer.listening) {
        await new Promise((resolveClose, reject) => {
          httpServer.close((error) => (error ? reject(error) : resolveClose()));
        });
      }
    }
  };
}
