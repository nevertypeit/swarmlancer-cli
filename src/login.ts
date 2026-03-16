import { getConfig, saveConfig } from "./config";
import open from "open";
import http from "http";

export async function login() {
  const config = getConfig();

  // Request GitHub OAuth URL from server, telling it this is a CLI login
  const res = await fetch(`${config.serverUrl}/api/auth/github?source=cli`);
  const { url } = (await res.json()) as { url: string };

  console.log("\n  Opening GitHub in your browser...\n");
  await open(url);

  // Start a temporary local server to catch the token callback
  // The server-side OAuth callback will try to POST the token here
  const callbackPort = 9876;

  return new Promise<void>((resolve, reject) => {
    const server = http.createServer(async (req, res) => {
      const reqUrl = new URL(req.url || "/", `http://localhost:${callbackPort}`);

      if (reqUrl.pathname === "/callback") {
        const token = reqUrl.searchParams.get("token");
        const userId = reqUrl.searchParams.get("userId");

        if (token && userId) {
          // CORS headers so the browser page can reach us
          res.writeHead(200, {
            "Content-Type": "text/plain",
            "Access-Control-Allow-Origin": "*",
          });
          res.end("ok");

          saveConfig({ ...config, token, userId });
          server.close();
          console.log("  ✓ Logged in successfully!");
          console.log(`  ✓ Token saved to ~/.swarmlancer/config.json\n`);
          resolve();
          return;
        }
      }

      // CORS preflight
      if (req.method === "OPTIONS") {
        res.writeHead(200, {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET",
        });
        res.end();
        return;
      }

      res.writeHead(404);
      res.end("Not found");
    });

    server.listen(callbackPort, () => {
      console.log("  Waiting for GitHub authorization...");
      console.log("  (If the browser doesn't open, visit the URL above manually)\n");
    });

    // Timeout after 2 minutes
    setTimeout(() => {
      server.close();
      reject(new Error("Login timed out. Try again."));
    }, 120_000);
  });
}
