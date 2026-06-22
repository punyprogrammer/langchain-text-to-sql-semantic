import "./config/env.js";
import express from "express";
import cors from "cors";
import chatRouter from "./routes/chat.js";
import dataQualityRouter from "./routes/dataQuality.js";
import { closeDb } from "./db/db.js";

const app = express();
const port = Number(process.env.PORT) || 3000;

app.use(
  cors({
    origin: process.env.CORS_ORIGIN ?? "http://localhost:5173",
  }),
);
app.use(express.json());

app.get("/health", (_req, res) => {
  res.send("ok");
});

app.use("/chat", chatRouter);
app.use("/data-quality", dataQualityRouter);

const server = app.listen(port, () => {
  console.log(`Server listening on http://localhost:${port}`);
});

let isShuttingDown = false;

async function shutdown(signal: string): Promise<void> {
  if (isShuttingDown) {
    process.exit(1);
    return;
  }

  isShuttingDown = true;
  console.log(`\nShutting down (${signal})...`);

  const forceExitTimer = setTimeout(() => {
    console.error("Forced exit after shutdown timeout");
    process.exit(1);
  }, 5_000);
  forceExitTimer.unref();

  await new Promise<void>((resolve) => {
    server.close(() => resolve());
  });

  await closeDb().catch((error) => {
    console.error("Error closing database:", error);
  });

  clearTimeout(forceExitTimer);
  process.exit(0);
}

process.on("SIGINT", () => {
  void shutdown("SIGINT");
});

process.on("SIGTERM", () => {
  void shutdown("SIGTERM");
});
