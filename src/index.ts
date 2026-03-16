#!/usr/bin/env node

import { login } from "./login";
import { startAgent } from "./agent";
import { getConfig, ensureAgentFile, getAgentFilePath, getConfigDir } from "./config";
import { initInference, getAvailableModels } from "./inference";

const BANNER = `
  ███████╗██╗    ██╗ █████╗ ██████╗ ███╗   ███╗
  ██╔════╝██║    ██║██╔══██╗██╔══██╗████╗ ████║
  ███████╗██║ █╗ ██║███████║██████╔╝██╔████╔██║
  ╚════██║██║███╗██║██╔══██║██╔══██╗██║╚██╔╝██║
  ███████║╚███╔███╔╝██║  ██║██║  ██║██║ ╚═╝ ██║
  ╚══════╝ ╚══╝╚══╝ ╚═╝  ╚═╝╚═╝  ╚═╝╚═╝     ╚═╝
  Swarmlancer — your agent, your rules
`;

const HELP = `
Usage: swarmlancer <command>

Commands:
  login                    Authenticate with GitHub
  start                    Start your agent
  setup                    Open agent instructions for editing
  models                   List available models (from pi credentials)
  status                   Show current config

Options:
  --server <url>           Server URL (default: http://localhost:3001)
  --model <pattern>        Model to use (e.g. "haiku", "flash", "gpt-4o-mini")

Prerequisites:
  Install pi and authenticate with at least one provider:
    npm install -g @mariozechner/pi-coding-agent
    pi   (then /login to authenticate with Anthropic, OpenAI, Google, etc.)
`;

function parseFlags(args: string[]): Record<string, string> {
  const flags: Record<string, string> = {};
  for (let i = 0; i < args.length; i++) {
    if (args[i].startsWith("--") && args[i + 1]) {
      flags[args[i].slice(2)] = args[i + 1];
      i++;
    }
  }
  return flags;
}

async function main() {
  const args = process.argv.slice(2);
  const command = args[0];
  const flags = parseFlags(args.slice(1));

  switch (command) {
    case "login":
      console.log(BANNER);
      await login();
      break;

    case "start": {
      console.log(BANNER);
      ensureAgentFile();
      const config = getConfig();
      if (!config.token) {
        console.error("  Not logged in. Run: swarmlancer login\n");
        process.exit(1);
      }

      // Init pi-powered inference
      console.log("  Detecting pi credentials...");
      try {
        const { model } = await initInference(flags.model);
        console.log(`  ✓ Model: ${model.provider}/${model.id} (${model.name})`);
      } catch (err) {
        console.error(`  ✗ ${err instanceof Error ? err.message : err}`);
        process.exit(1);
      }

      console.log(`  ✓ Server: ${config.serverUrl}`);
      console.log(`  ✓ Agent:  ${getAgentFilePath()}`);

      startAgent();
      break;
    }

    case "setup":
      ensureAgentFile();
      console.log(`\n  Agent instructions file: ${getAgentFilePath()}`);
      console.log("  Edit this file to control how your agent behaves.\n");
      try {
        const editor = process.env.EDITOR || "nano";
        const { execSync } = await import("child_process");
        execSync(`${editor} ${getAgentFilePath()}`, { stdio: "inherit" });
      } catch {
        console.log(`  Open it manually: ${getAgentFilePath()}\n`);
      }
      break;

    case "models": {
      console.log("\n  Available models (from pi credentials):\n");
      try {
        await initInference();
        const models = await getAvailableModels();
        for (const m of models) {
          console.log(`    ${m.provider}/${m.id}`);
        }
        console.log(`\n  Use --model <pattern> with 'swarmlancer start' to pick one.\n`);
      } catch (err) {
        console.error(`  ${err instanceof Error ? err.message : err}\n`);
      }
      break;
    }

    case "status": {
      const config = getConfig();
      console.log(`\n  Server:  ${config.serverUrl}`);
      console.log(`  Auth:    ${config.token ? "✓ logged in" : "✗ not logged in"}`);
      console.log(`  Config:  ${getConfigDir()}`);
      console.log(`  Agent:   ${getAgentFilePath()}\n`);
      break;
    }

    default:
      console.log(BANNER);
      console.log(HELP);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
