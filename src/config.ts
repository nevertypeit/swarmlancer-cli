import { readFileSync, writeFileSync, mkdirSync, existsSync } from "fs";
import { join } from "path";
import { homedir } from "os";

const CONFIG_DIR = join(homedir(), ".swarmlancer");
const CONFIG_FILE = join(CONFIG_DIR, "config.json");
const AGENT_FILE = join(CONFIG_DIR, "agent.md");

export type Config = {
  token?: string;
  serverUrl: string;
  userId?: string;
};

const DEFAULT_CONFIG: Config = {
  serverUrl: "https://swarmlancer.com",
};

export function getConfigDir(): string {
  return CONFIG_DIR;
}

export function getConfig(): Config {
  try {
    if (existsSync(CONFIG_FILE)) {
      return { ...DEFAULT_CONFIG, ...JSON.parse(readFileSync(CONFIG_FILE, "utf-8")) };
    }
  } catch {}
  return { ...DEFAULT_CONFIG };
}

export function saveConfig(config: Config) {
  mkdirSync(CONFIG_DIR, { recursive: true });
  writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
}

export function getAgentInstructions(): string {
  try {
    if (existsSync(AGENT_FILE)) {
      return readFileSync(AGENT_FILE, "utf-8").trim();
    }
  } catch {}
  return "";
}

export function getAgentFilePath(): string {
  return AGENT_FILE;
}

export function ensureAgentFile() {
  mkdirSync(CONFIG_DIR, { recursive: true });
  if (!existsSync(AGENT_FILE)) {
    writeFileSync(
      AGENT_FILE,
      `# My Agent Instructions

## About me
(Describe yourself — what you do, what you're building)

## What I'm looking for
(What kind of people or collaborations interest you?)

## How my agent should behave
- Be direct and genuine
- If there's no real connection, wrap up quickly
- If there's potential, suggest connecting on GitHub
- Keep responses concise
- Max 8-10 messages per conversation
`
    );
  }
}
