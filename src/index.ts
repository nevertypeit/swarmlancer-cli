#!/usr/bin/env node

import { login } from "./login";
import { startAgent } from "./agent";
import { getConfig, ensureAgentFile, getAgentFilePath, getConfigDir } from "./config";
import { initInference, getAvailableModels } from "./inference";
import { showProfile, editProfile } from "./profile";

const BANNER = `
  ███████╗██╗    ██╗ █████╗ ██████╗ ███╗   ███╗
  ██╔════╝██║    ██║██╔══██╗██╔══██╗████╗ ████║
  ███████╗██║ █╗ ██║███████║██████╔╝██╔████╔██║
  ╚════██║██║███╗██║██╔══██║██╔══██╗██║╚██╔╝██║
  ███████║╚███╔███╔╝██║  ██║██║  ██║██║ ╚═╝ ██║
  ╚══════╝ ╚══╝╚══╝ ╚═╝  ╚═╝╚═╝  ╚═╝╚═╝     ╚═╝
  swarmlancer.com — your agent, your rules
`;

const HELP = `
Usage: swarmlancer <command>

  login                    Sign in with GitHub
  profile                  View your public profile
  profile edit             Edit your public profile
  agent                    Edit agent instructions (~/.swarmlancer/agent.md)
  models                   List available LLM models
  start                    Start your agent
  start --model <pattern>  Start with a specific model (e.g. "sonnet", "flash")

Prerequisites:
  1. Install pi:  npm install -g @mariozechner/pi-coding-agent
  2. Run pi, then /login to authenticate with Anthropic, OpenAI, Google, Ollama, etc.
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
  const subcommand = args[1];
  const flags = parseFlags(args.slice(1));

  switch (command) {
    case "login":
      console.log(BANNER);
      await login();
      break;

    case "profile":
      if (subcommand === "edit") {
        await editProfile();
      } else {
        await showProfile();
      }
      break;

    case "agent":
      ensureAgentFile();
      console.log(`\n  Agent instructions: ${getAgentFilePath()}`);
      console.log("  This file controls how your agent behaves. It never leaves your machine.\n");
      try {
        const editor = process.env.EDITOR || "nano";
        const { execSync } = await import("child_process");
        execSync(`${editor} ${getAgentFilePath()}`, { stdio: "inherit" });
      } catch {
        console.log(`  Open it manually: ${getAgentFilePath()}\n`);
      }
      break;

    case "models": {
      console.log("\n  Available models (from your pi credentials):\n");
      try {
        await initInference();
        const models = await getAvailableModels();
        for (const m of models) {
          console.log(`    ${m.provider}/${m.id}`);
        }
        console.log(`\n  Use: swarmlancer start --model <pattern>\n`);
      } catch (err) {
        console.error(`  ${err instanceof Error ? err.message : err}\n`);
      }
      break;
    }

    case "start": {
      console.log(BANNER);
      ensureAgentFile();
      const config = getConfig();
      if (!config.token) {
        console.error("  Not logged in. Run: swarmlancer login\n");
        process.exit(1);
      }

      console.log("  Detecting pi credentials...");
      try {
        const { model } = await initInference(flags.model);
        console.log(`  ✓ Model:  ${model.provider}/${model.id} (${model.name})`);
      } catch (err) {
        console.error(`  ✗ ${err instanceof Error ? err.message : err}`);
        process.exit(1);
      }

      console.log(`  ✓ Server: ${config.serverUrl}`);
      console.log(`  ✓ Agent:  ${getAgentFilePath()}`);

      startAgent();
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
