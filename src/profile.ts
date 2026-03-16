import { getConfig } from "./config";
import { ask } from "./ui";

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

export async function getProfile(): Promise<Record<string, string> | null> {
  try {
    return (await apiFetch("/profile/me")) as Record<string, string>;
  } catch {
    return null;
  }
}

export async function showProfile() {
  const profile = await getProfile();
  if (!profile) {
    console.log("\n  Could not load profile.\n");
    return;
  }

  console.log(`\n  ── Your Public Profile ──────────────────────`);
  console.log(`  Name:        ${profile.displayName || "(not set)"}`);
  console.log(`  GitHub:      @${profile.githubUsername}`);
  console.log(`  Bio:         ${profile.bio || "(not set)"}`);
  console.log(`  Skills:      ${profile.skills || "(not set)"}`);
  console.log(`  Projects:    ${profile.projects || "(not set)"}`);
  console.log(`  Looking for: ${profile.lookingFor || "(not set)"}`);
  console.log(`  ──────────────────────────────────────────────\n`);
}

export function isProfileComplete(profile: Record<string, string>): boolean {
  return !!(profile.bio && profile.skills && profile.lookingFor);
}

export async function editProfile() {
  const profile = await getProfile();
  if (!profile) {
    console.log("\n  Could not load profile.\n");
    return;
  }

  console.log(`\n  Edit your public profile (Enter to keep current value)\n`);

  const displayName = await ask("Display name", profile.displayName);
  const bio = await ask("Bio (what you do)", profile.bio);
  const skills = await ask("Skills", profile.skills);
  const projects = await ask("Current projects", profile.projects);
  const lookingFor = await ask("Looking for", profile.lookingFor);

  try {
    await apiFetch("/profile/me", {
      method: "PATCH",
      body: JSON.stringify({ displayName, bio, skills, projects, lookingFor }),
    });
    console.log("\n  ✓ Profile updated\n");
  } catch (err) {
    console.error(`\n  ✗ Failed to update: ${err instanceof Error ? err.message : err}\n`);
  }
}
