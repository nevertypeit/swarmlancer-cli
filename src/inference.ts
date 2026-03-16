import {
  AuthStorage,
  ModelRegistry,
  createAgentSession,
  SessionManager,
  SettingsManager,
  createExtensionRuntime,
  type ResourceLoader,
} from "@mariozechner/pi-coding-agent";
import type { Model } from "@mariozechner/pi-ai";
import { getAgentInstructions } from "./config";

let authStorage: ReturnType<typeof AuthStorage.create>;
let modelRegistry: ModelRegistry;
let currentModel: Model | undefined;

export async function initInference(modelPattern?: string): Promise<{ model: Model }> {
  authStorage = AuthStorage.create(); // reads ~/.pi/agent/auth.json
  modelRegistry = new ModelRegistry(authStorage);

  const available = await modelRegistry.getAvailable();
  if (available.length === 0) {
    throw new Error(
      "No models available. Run `pi` first and authenticate with a provider (Anthropic, OpenAI, Google, Ollama, etc.)"
    );
  }

  if (modelPattern) {
    const match = available.find(
      (m) =>
        m.id.includes(modelPattern) ||
        m.name.toLowerCase().includes(modelPattern.toLowerCase()) ||
        `${m.provider}/${m.id}`.includes(modelPattern)
    );
    if (!match) {
      console.error(`  Model "${modelPattern}" not found. Available:`);
      for (const m of available) console.error(`    ${m.provider}/${m.id}`);
      process.exit(1);
    }
    currentModel = match;
  } else {
    // Pick cheapest reasonable model — prefer latest small models
    const preferences = ["haiku-4", "flash", "gpt-4o-mini", "haiku"];
    for (const pref of preferences) {
      const match = available.find((m) => m.id.includes(pref));
      if (match) {
        currentModel = match;
        break;
      }
    }
    if (!currentModel) currentModel = available[0];
  }

  return { model: currentModel! };
}

export function getAvailableModels() {
  return modelRegistry?.getAvailable() ?? Promise.resolve([]);
}

export async function runInference(
  systemPrompt: string,
  messages: { role: "user" | "assistant"; content: string }[]
): Promise<string> {
  if (!currentModel || !authStorage) {
    throw new Error("Inference not initialized. Call initInference() first.");
  }

  // Prepend local agent instructions to server-provided system prompt
  const agentInstructions = getAgentInstructions();
  const fullSystemPrompt = agentInstructions
    ? `${agentInstructions}\n\n---\n\n${systemPrompt}`
    : systemPrompt;

  const resourceLoader: ResourceLoader = {
    getExtensions: () => ({ extensions: [], errors: [], runtime: createExtensionRuntime() }),
    getSkills: () => ({ skills: [], diagnostics: [] }),
    getPrompts: () => ({ prompts: [], diagnostics: [] }),
    getThemes: () => ({ themes: [], diagnostics: [] }),
    getAgentsFiles: () => ({ agentsFiles: [] }),
    getSystemPrompt: () => fullSystemPrompt,
    getAppendSystemPrompt: () => [],
    getPathMetadata: () => new Map(),
    extendResources: () => {},
    reload: async () => {},
  };

  const { session } = await createAgentSession({
    model: currentModel,
    thinkingLevel: "off",
    tools: [],
    authStorage,
    modelRegistry,
    resourceLoader,
    sessionManager: SessionManager.inMemory(),
    settingsManager: SettingsManager.inMemory({
      compaction: { enabled: false },
      retry: { enabled: true, maxRetries: 2 },
    }),
  });

  // Inject conversation history (all but last message)
  if (messages.length > 1) {
    for (const msg of messages.slice(0, -1)) {
      session.agent.state.messages.push(
        msg.role === "user"
          ? { role: "user", content: [{ type: "text", text: msg.content }], timestamp: Date.now() }
          : ({
              role: "assistant",
              content: [{ type: "text", text: msg.content }],
              timestamp: Date.now(),
            } as any)
      );
    }
  }

  let responseText = "";
  session.subscribe((event) => {
    if (event.type === "message_update" && event.assistantMessageEvent.type === "text_delta") {
      responseText += event.assistantMessageEvent.delta;
    }
  });

  // Prompt with the last message
  const lastMessage = messages[messages.length - 1];
  await session.prompt(lastMessage.content);
  session.dispose();

  return responseText || "(no response)";
}
