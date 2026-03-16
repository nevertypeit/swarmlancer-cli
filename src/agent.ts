import WebSocket from "ws";
import { getConfig, getAgentFilePath } from "./config";
import { runInference } from "./inference";

type ServerMessage = {
  type: string;
  [key: string]: unknown;
};

export function startAgent() {
  const config = getConfig();
  if (!config.token) {
    console.error("Not logged in. Run: swarmlancer login");
    process.exit(1);
  }

  const wsUrl = config.serverUrl.replace(/^http/, "ws") + "/ws";
  let ws: WebSocket;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  let alive = true;

  function connect() {
    console.log(`\n  ▸ Connecting to ${wsUrl}...`);
    ws = new WebSocket(wsUrl);

    ws.on("open", () => {
      // Authenticate
      ws.send(JSON.stringify({ type: "auth", token: config.token }));
    });

    ws.on("message", async (raw) => {
      const msg: ServerMessage = JSON.parse(raw.toString());

      switch (msg.type) {
        case "authenticated":
          console.log(`  ✓ Agent online`);
          console.log(`  ✓ Agent instructions: ${getAgentFilePath()}`);
          console.log(`\n  Waiting for conversations...\n`);
          // Request current online users
          ws.send(JSON.stringify({ type: "get_online_users" }));
          break;

        case "online_users": {
          const users = msg.users as { displayName: string; githubUsername: string }[];
          if (users.length > 0) {
            console.log(
              `  📡 Online agents: ${users.map((u) => `${u.displayName} (@${u.githubUsername})`).join(", ")}`
            );
          }
          break;
        }

        case "inference_request": {
          const { requestId, conversationId, systemPrompt, messages } = msg as {
            requestId: string;
            conversationId: string;
            systemPrompt: string;
            messages: { role: "user" | "assistant"; content: string }[];
          };

          console.log(`  💬 Inference request for conversation ${conversationId.slice(0, 8)}...`);

          try {
            const response = await runInference(systemPrompt, messages);
            console.log(`  ✓ Response: ${response.slice(0, 80)}...`);
            ws.send(
              JSON.stringify({
                type: "inference_response",
                requestId,
                content: response,
              })
            );
          } catch (err) {
            const errorMsg = err instanceof Error ? err.message : "Unknown error";
            console.error(`  ✗ Inference failed: ${errorMsg}`);
            ws.send(
              JSON.stringify({
                type: "inference_error",
                requestId,
                error: errorMsg,
              })
            );
          }
          break;
        }

        case "conversation_started": {
          const { conversationId, withUser } = msg as {
            conversationId: string;
            withUser: { displayName: string; githubUsername: string };
          };
          console.log(
            `  🤝 Conversation started with ${withUser.displayName} (@${withUser.githubUsername})`
          );
          break;
        }

        case "error":
          console.error(`  ✗ Server error: ${msg.message}`);
          break;
      }
    });

    ws.on("close", () => {
      if (alive) {
        console.log("  ⚡ Disconnected. Reconnecting in 5s...");
        reconnectTimer = setTimeout(connect, 5000);
      }
    });

    ws.on("error", (err) => {
      console.error(`  ✗ WebSocket error: ${err.message}`);
    });
  }

  connect();

  // Graceful shutdown
  process.on("SIGINT", () => {
    alive = false;
    if (reconnectTimer) clearTimeout(reconnectTimer);
    console.log("\n  Agent shutting down...");
    ws?.close();
    process.exit(0);
  });
}
