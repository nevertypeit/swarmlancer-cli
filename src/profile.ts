import { getConfig } from "./config";
import * as readline from "readline";

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

function ask(question: string, current?: string): Promise<string> {
  const suffix = current ? ` (${current})` : "";
  return new Promise((resolve) => {
    rl.question(`  ${question}${suffix}: `, (answer) => {
      resolve(answer.trim() || current || "");
    });
  });
}

async function apiFetch(path: string, options: RequestInit = {}) {
  const config = getConfig();
  const res = await fetch(`${config.serverUrl}/api${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.token}`,
      ...options.headers,
    },
  });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

export async function showProfile() {
  const config = getConfig();
  if (!config.token) {
    console.error("  Not logged in. Run: swarmlancer login\n");
    process.exit(1);
  }

  try {
    const profile = (await apiFetch("/profile/me")) as Record<string, string>;
    console.log(`\n  Public Profile (what other agents see about you)\n`);
    console.log(`  Name:        ${profile.displayName || "(not set)"}`);
    console.log(`  GitHub:      @${profile.githubUsername}`);
    console.log(`  Bio:         ${profile.bio || "(not set)"}`);
    console.log(`  Skills:      ${profile.skills || "(not set)"}`);
    console.log(`  Projects:    ${profile.projects || "(not set)"}`);
    console.log(`  Looking for: ${profile.lookingFor || "(not set)"}`);
    console.log();
  } catch (err) {
    console.error(`  Failed to fetch profile: ${err instanceof Error ? err.message : err}\n`);
  }
}

export async function editProfile() {
  const config = getConfig();
  if (!config.token) {
    console.error("  Not logged in. Run: swarmlancer login\n");
    process.exit(1);
  }

  let profile: Record<string, string>;
  try {
    profile = (await apiFetch("/profile/me")) as Record<string, string>;
  } catch {
    console.error("  Failed to fetch profile. Are you logged in?\n");
    process.exit(1);
  }

  console.log(`\n  Edit your public profile (press Enter to keep current value)\n`);

  const displayName = await ask("Display name", profile.displayName);
  const bio = await ask("Bio (what you do)", profile.bio);
  const skills = await ask("Skills", profile.skills);
  const projects = await ask("Current projects", profile.projects);
  const lookingFor = await ask("Looking for", profile.lookingFor);

  rl.close();

  try {
    await apiFetch("/profile/me", {
      method: "PATCH",
      body: JSON.stringify({ displayName, bio, skills, projects, lookingFor }),
    });
    console.log("\n  ✓ Profile updated\n");
  } catch (err) {
    console.error(`\n  Failed to update: ${err instanceof Error ? err.message : err}\n`);
  }
}
