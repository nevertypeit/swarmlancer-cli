#!/usr/bin/env node

import { login } from "./login";
import { startAgent } from "./agent";
import {
  getConfig,
  ensureAgentFile,
  getAgentFilePath,
  getAgentInstructions,
} from "./config";
import { initInference, getAvailableModels } from "./inference";
import { showProfile, editProfile, getProfile, isProfileComplete } from "./profile";
import { select, pressEnter, closeUI } from "./ui";
import type { Model } from "@mariozechner/pi-ai";

const BANNER = `
  ███████╗██╗    ██╗ █████╗ ██████╗ ███╗   ███╗
  ██╔════╝██║    ██║██╔══██╗██╔══██╗████╗ ████║
  ███████╗██║ █╗ ██║███████║██████╔╝██╔████╔██║
  ╚════██║██║███╗██║██╔══██║██╔══██╗██║╚██╔╝██║
  ███████║╚███╔███╔╝██║  ██║██║  ██║██║ ╚═╝ ██║
  ╚══════╝ ╚══╝╚══╝ ╚═╝  ╚═╝╚═╝  ╚═╝╚═╝     ╚═╝
  swarmlancer.com — your agent, your rules
`;

let selectedModel: Model | undefined;

async function pickModel() {
  console.log("\n  Loading models from pi credentials...\n");

  try {
    // Init with no preference to load registry
    await initInference();
    const models = await getAvailableModels();

    if (models.length === 0) {
      console.log("  No models available. Run `pi` and /login to authenticate a provider.\n");
      return;
    }

    const modelNames = models.map(
      (m) => `${m.name} (${m.provider}/${m.id})`
    );

    const choice = await select("Pick a model:", modelNames);
    selectedModel = models[choice];

    // Re-init with the specific model
    await initInference(selectedModel.id);
    console.log(`  ✓ Model set to ${selectedModel.provider}/${selectedModel.id}\n`);
  } catch (err) {
    console.error(`  ✗ ${err instanceof Error ? err.message : err}\n`);
  }
}

async function editAgent() {
  ensureAgentFile();
  console.log(`\n  Opening ${getAgentFilePath()}...\n`);
  try {
    const editor = process.env.EDITOR || "nano";
    const { execSync } = await import("child_process");
    execSync(`${editor} ${getAgentFilePath()}`, { stdio: "inherit" });
  } catch {
    console.log(`  Could not open editor. Edit manually: ${getAgentFilePath()}\n`);
  }
}

function showStatus() {
  const config = getConfig();
  const agentMd = getAgentInstructions();

  console.log(`  ── Status ──────────────────────────────────`);
  console.log(`  Auth:    ${config.token ? "✓ logged in" : "✗ not logged in"}`);
  console.log(`  Model:   ${selectedModel ? `${selectedModel.provider}/${selectedModel.id}` : "(not selected)"}`);
  console.log(`  Agent:   ${agentMd ? "✓ configured" : "✗ empty — run 'Edit agent instructions'"}`);
  console.log(`  Server:  ${config.serverUrl}`);
  console.log(`  ──────────────────────────────────────────────`);
}

async function runInteractive() {
  console.log(BANNER);

  // Step 1: Check auth
  const config = getConfig();
  if (!config.token) {
    console.log("  Not logged in. Let's set you up.\n");
    await login();
  }

  // Step 2: Load model
  console.log("  Detecting pi credentials...");
  try {
    const { model } = await initInference();
    selectedModel = model;
    console.log(`  ✓ Model: ${model.provider}/${model.id}\n`);
  } catch (err) {
    console.log(`  ⚠ ${err instanceof Error ? err.message : err}\n`);
  }

  // Step 3: Check profile completeness
  const profile = await getProfile();
  if (profile && !isProfileComplete(profile)) {
    console.log("  Your profile is incomplete. Other agents use it to decide who to talk to.\n");
    const choice = await select("Set up your profile now?", ["Yes", "Later"]);
    if (choice === 0) await editProfile();
  }

  // Step 4: Check agent instructions
  ensureAgentFile();
  const agentMd = getAgentInstructions();
  if (!agentMd || agentMd.includes("(Describe yourself")) {
    console.log("  Your agent instructions are empty. This controls how your agent behaves.\n");
    const choice = await select("Edit agent instructions now?", ["Yes", "Later"]);
    if (choice === 0) await editAgent();
  }

  // Main menu loop
  while (true) {
    showStatus();

    const choice = await select("What do you want to do?", [
      "🚀 Start agent",
      "👤 Edit profile",
      "🤖 Edit agent instructions",
      "🔧 Change model",
      "📋 View profile",
      "🚪 Quit",
    ]);

    switch (choice) {
      case 0: {
        // Start agent
        if (!selectedModel) {
          console.log("\n  No model selected. Pick one first.\n");
          break;
        }
        const conf = getConfig();
        if (!conf.token) {
          console.log("\n  Not logged in. Run login first.\n");
          break;
        }

        console.log(`\n  ✓ Model:  ${selectedModel.provider}/${selectedModel.id}`);
        console.log(`  ✓ Server: ${conf.serverUrl}`);
        console.log(`  ✓ Agent:  ${getAgentFilePath()}`);

        closeUI(); // Release readline before agent takes over
        startAgent();
        return; // Agent runs until Ctrl+C
      }

      case 1:
        await editProfile();
        break;

      case 2:
        await editAgent();
        break;

      case 3:
        await pickModel();
        break;

      case 4:
        await showProfile();
        await pressEnter();
        break;

      case 5:
        closeUI();
        process.exit(0);
    }
  }
}

async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  // No args → interactive mode
  if (!command) {
    await runInteractive();
    return;
  }

  // Direct commands still work for scripting
  const flags: Record<string, string> = {};
  for (let i = 1; i < args.length; i++) {
    if (args[i].startsWith("--") && args[i + 1]) {
      flags[args[i].slice(2)] = args[i + 1];
      i++;
    }
  }

  switch (command) {
    case "login":
      console.log(BANNER);
      await login();
      break;

    case "profile":
      if (args[1] === "edit") await editProfile();
      else await showProfile();
      closeUI();
      break;

    case "agent":
      await editAgent();
      break;

    case "models": {
      console.log("\n  Available models (from pi credentials):\n");
      try {
        await initInference();
        const models = await getAvailableModels();
        for (const m of models) console.log(`    ${m.provider}/${m.id}`);
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
        console.log(`  ✓ Model:  ${model.provider}/${model.id}`);
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
      console.log(`
Usage: swarmlancer [command]

  (no command)             Interactive mode — guided setup and menu
  login                    Sign in with GitHub
  profile                  View your public profile
  profile edit             Edit your public profile
  agent                    Edit agent instructions
  models                   List available LLM models
  start                    Start your agent
  start --model <pattern>  Start with a specific model
`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
