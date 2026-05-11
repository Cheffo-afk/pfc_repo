import "dotenv/config";
import WebSocket from "ws";

const BACKEND_URL = (process.env.BACKEND_URL ?? "http://127.0.0.1:3000").trim();
const LOGIN_EMAIL = (process.env.WS_SMOKE_EMAIL ?? process.env.ADMIN_EMAIL ?? "admin@local.dev").trim();
const LOGIN_PASSWORD = (
  process.env.WS_SMOKE_PASSWORD ??
  process.env.ADMIN_PASSWORD ??
  "ChangeMeNow!123"
).trim();
const TIMEOUT_MS = Number(process.env.WS_SMOKE_TIMEOUT_MS ?? 8000);

function toWebSocketUrl(httpUrl: string) {
  const parsed = new URL(httpUrl);
  parsed.protocol = parsed.protocol === "https:" ? "wss:" : "ws:";
  parsed.pathname = "/ws";
  parsed.search = "";
  parsed.hash = "";
  return parsed.toString();
}

function timeout<T>(ms: number, label: string) {
  return new Promise<T>((_, reject) => {
    setTimeout(() => reject(new Error(`Timeout while waiting for ${label}`)), ms);
  });
}

async function loginAndGetCookie(baseUrl: string) {
  const response = await fetch(new URL("/auth/login", baseUrl), {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({ email: LOGIN_EMAIL, password: LOGIN_PASSWORD }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Login failed (${response.status}): ${body}`);
  }

  const setCookie = response.headers.get("set-cookie");
  if (!setCookie) {
    throw new Error("Missing session cookie from /auth/login response");
  }

  return setCookie.split(";")[0];
}

async function run() {
  const cookieHeader = await loginAndGetCookie(BACKEND_URL);
  const wsUrl = toWebSocketUrl(BACKEND_URL);

  process.stdout.write(`Smoke test WS URL: ${wsUrl}\n`);

  const ws = new WebSocket(wsUrl, {
    headers: {
      Cookie: cookieHeader,
    },
  });

  const snapshotPromise = new Promise<void>((resolve, reject) => {
    ws.on("open", () => {
      process.stdout.write("WebSocket open\n");
    });

    ws.on("message", (raw) => {
      let parsed: unknown;
      try {
        parsed = JSON.parse(String(raw));
      } catch {
        return;
      }

      if (!parsed || typeof parsed !== "object") {
        return;
      }

      const msg = parsed as {
        channel?: string;
        action?: string;
        payload?: Record<string, unknown>;
      };

      if (msg.channel === "system" && msg.action === "error") {
        reject(new Error(`Server error: ${JSON.stringify(msg.payload)}`));
        return;
      }

      if (msg.channel === "system" && msg.action === "bound") {
        process.stdout.write("Received system.bound\n");
        ws.send(JSON.stringify({ channel: "presence", action: "snapshot" }));
        return;
      }

      if (msg.channel === "presence" && msg.action === "snapshot") {
        const users = Array.isArray(msg.payload?.users) ? msg.payload.users : [];
        process.stdout.write(`Received presence.snapshot (${users.length} users)\n`);
        resolve();
      }
    });

    ws.on("error", (error) => {
      reject(error);
    });

    ws.on("close", () => {
      reject(new Error("WebSocket closed before receiving presence snapshot"));
    });
  });

  await Promise.race([snapshotPromise, timeout<void>(TIMEOUT_MS, "presence snapshot")]);

  ws.close();
  process.stdout.write("Smoke test passed\n");
}

void run().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`Smoke test failed: ${message}\n`);
  process.exitCode = 1;
});
