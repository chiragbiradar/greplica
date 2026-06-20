import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { hookCommand, hookEvents, mergeHookConfig, readJsonObject, writeJson } from "../hook-config.js";
import { copyBundledSkills } from "../skills.js";
import { runCodexAgent } from "../../agent-runner/codex.js";
import {
  copyStringField,
  isRecord,
  parseJsonLine,
  renderSessionTranscriptMarkdown,
  sanitizeTranscriptMessage,
  type SessionTranscriptMessage,
} from "../../session-transcript/markdown.js";
import type { PlatformInstallResult, PlatformInstaller, WorkingMemoryUpdateInput } from "./types.js";

export const codexInstaller: PlatformInstaller = {
  platform: "codex",
  install(): PlatformInstallResult {
    const codexHome = process.env.CODEX_HOME ?? join(homedir(), ".codex");
    const skills = copyBundledSkills(join(codexHome, "skills"));
    const hookConfigPath = join(codexHome, "hooks.json");
    const settingsPath = join(codexHome, "config.toml");
    const command = hookCommand("codex");
    const hookConfig = mergeHookConfig(readJsonObject(hookConfigPath), "codex", command);
    writeJson(hookConfigPath, hookConfig);
    ensureCodexHooksEnabled(settingsPath);

    return {
      skills,
      hooks: {
        platform: "codex",
        configFiles: [hookConfigPath, settingsPath],
        events: [...hookEvents],
        command,
      },
    };
  },
  transcriptToMarkdown(transcript: string): string {
    return codexTranscriptToMarkdown(transcript);
  },
  async runWorkingMemoryUpdate(input: WorkingMemoryUpdateInput): Promise<void> {
    await runCodexAgent(input);
  },
};

function codexTranscriptToMarkdown(jsonl: string): string {
  const metadata: Record<string, string> = {};
  const messages: SessionTranscriptMessage[] = [];

  for (const line of jsonl.split("\n")) {
    const event = parseJsonLine(line);
    if (!isRecord(event)) continue;

    if (event.type === "session_meta" && isRecord(event.payload)) {
      copyStringField(metadata, event.payload, "id", "session_id");
      copyStringField(metadata, event.payload, "timestamp", "session_timestamp");
      copyStringField(metadata, event.payload, "cwd", "cwd");
      copyStringField(metadata, event.payload, "originator", "originator");
      copyStringField(metadata, event.payload, "cli_version", "cli_version");
      copyStringField(metadata, event.payload, "source", "source");
      copyStringField(metadata, event.payload, "model_provider", "model_provider");
      continue;
    }

    if (event.type !== "event_msg" || !isRecord(event.payload)) continue;
    const payloadType = event.payload.type;
    if (payloadType !== "user_message" && payloadType !== "agent_message") continue;

    const message = event.payload.message;
    if (typeof message !== "string" || message.trim().length === 0) continue;
    const sanitizedMessage = sanitizeTranscriptMessage(message);
    if (sanitizedMessage.length === 0) continue;
    messages.push({
      timestamp: typeof event.timestamp === "string" ? event.timestamp : undefined,
      role: payloadType === "user_message" ? "human" : "agent",
      phase: typeof event.payload.phase === "string" ? event.payload.phase : undefined,
      message: sanitizedMessage,
    });
  }

  return renderSessionTranscriptMarkdown({ metadata, messages });
}

function ensureCodexHooksEnabled(path: string): void {
  const content = existsSync(path) ? readFileSync(path, "utf8") : "";
  const lines = content.length === 0 ? [] : content.split(/\r?\n/);
  let found = false;
  const updated = lines.map((line) => {
    if (/^\s*codex_hooks\s*=/.test(line)) {
      found = true;
      return "codex_hooks = true";
    }
    return line;
  });

  if (!found) {
    if (updated.length > 0 && updated[updated.length - 1] !== "") updated.push("");
    updated.push("codex_hooks = true");
  }

  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${updated.join("\n").replace(/\n+$/, "")}\n`, "utf8");
}
