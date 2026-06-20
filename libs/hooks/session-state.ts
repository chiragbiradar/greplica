import type Database from "better-sqlite3";
import { createHash } from "node:crypto";
import type { InstallPlatform } from "../install/paths.js";

export interface AgentSession {
  platform: InstallPlatform;
  session_id: string;
  repo_id: string;
  transcript_path: string | null;
  cwd: string | null;
  guidance_injected_at: string | null;
  stops_since_memory_update_attempt: number;
  last_seen_at: string;
  last_memory_update_attempt_at: string | null;
}

export interface RecordHookInput {
  platform: InstallPlatform;
  sessionId?: string;
  repoId: string;
  transcriptPath?: string;
  cwd?: string;
  eventName?: string;
  now?: Date;
}

export interface RecordHookResult {
  session: AgentSession;
  shouldInjectGuidance: boolean;
}

export interface ClaimedMemoryUpdateAttempt {
  session: AgentSession;
  reason: "stop_threshold" | "time_threshold";
}

export interface MarkMemoryUpdatedInput {
  repoId: string;
  platform?: string;
  sessionId?: string;
  now?: Date;
}

const stopAttemptInterval = 5;
const timeAttemptIntervalMs = 40 * 60 * 1000;

export class HookSessionStore {
  constructor(private readonly db: Database.Database) {}

  recordHook(input: RecordHookInput): RecordHookResult {
    const now = iso(input.now);
    const sessionId = input.sessionId ?? fallbackSessionId(input);
    const existing = this.find(input.platform, sessionId);
    const shouldInjectGuidance = input.eventName === "UserPromptSubmit" && existing?.guidance_injected_at == null;
    const incrementStop = input.eventName === "Stop" ? 1 : 0;

    if (existing === undefined) {
      const session: AgentSession = {
        platform: input.platform,
        session_id: sessionId,
        repo_id: input.repoId,
        transcript_path: input.transcriptPath ?? null,
        cwd: input.cwd ?? null,
        guidance_injected_at: shouldInjectGuidance ? now : null,
        stops_since_memory_update_attempt: incrementStop,
        last_seen_at: now,
        last_memory_update_attempt_at: null,
      };
      this.insert(session);
      return { session, shouldInjectGuidance };
    }

    const session: AgentSession = {
      ...existing,
      repo_id: input.repoId,
      transcript_path: input.transcriptPath ?? existing.transcript_path,
      cwd: input.cwd ?? existing.cwd,
      guidance_injected_at: shouldInjectGuidance ? now : existing.guidance_injected_at,
      stops_since_memory_update_attempt: existing.stops_since_memory_update_attempt + incrementStop,
      last_seen_at: now,
    };
    this.updateSessionState(session);
    return { session, shouldInjectGuidance };
  }

  claimDueMemoryUpdateAttempts(now = new Date()): ClaimedMemoryUpdateAttempt[] {
    return this.db.transaction((claimedAt: Date) => {
      const sessions = this.listSessions();
      const claimed: ClaimedMemoryUpdateAttempt[] = [];

      for (const session of sessions) {
        const reason = shouldAttemptUpdate(session, claimedAt);
        if (reason === undefined) continue;
        const updated = this.markMemoryUpdateAttempt(session, reason, claimedAt);
        claimed.push({ session: updated, reason });
      }

      return claimed;
    })(now) as ClaimedMemoryUpdateAttempt[];
  }

  markMemoryUpdated(input: MarkMemoryUpdatedInput): boolean {
    const updatedAt = iso(input.now);
    if (isInstallPlatform(input.platform) && input.sessionId !== undefined && input.sessionId.length > 0) {
      const updated = this.db
        .prepare(
          `UPDATE agent_sessions
           SET last_memory_update_attempt_at = ?,
               stops_since_memory_update_attempt = 0
           WHERE repo_id = ? AND platform = ? AND session_id = ?`,
        )
        .run(updatedAt, input.repoId, input.platform, input.sessionId);
      if (updated.changes > 0) return true;
    }

    const updated = this.db
      .prepare(
        `UPDATE agent_sessions
         SET last_memory_update_attempt_at = ?,
             stops_since_memory_update_attempt = 0
         WHERE rowid = (
           SELECT rowid
           FROM agent_sessions
           WHERE repo_id = ?
           ORDER BY last_seen_at DESC
           LIMIT 1
         )`,
      )
      .run(updatedAt, input.repoId);
    return updated.changes > 0;
  }

  private find(platform: InstallPlatform, sessionId: string): AgentSession | undefined {
    return this.db
      .prepare("SELECT * FROM agent_sessions WHERE platform = ? AND session_id = ?")
      .get(platform, sessionId) as AgentSession | undefined;
  }

  private listSessions(): AgentSession[] {
    return this.db.prepare("SELECT * FROM agent_sessions").all() as AgentSession[];
  }

  private insert(session: AgentSession): void {
    this.db
      .prepare(
        `INSERT INTO agent_sessions (
          platform, session_id, repo_id, transcript_path, cwd, guidance_injected_at,
          stops_since_memory_update_attempt, last_seen_at, last_memory_update_attempt_at
        ) VALUES (
          @platform, @session_id, @repo_id, @transcript_path, @cwd, @guidance_injected_at,
          @stops_since_memory_update_attempt, @last_seen_at, @last_memory_update_attempt_at
        )`,
      )
      .run(session);
  }

  private updateSessionState(session: AgentSession): void {
    this.db
      .prepare(
        `UPDATE agent_sessions
         SET repo_id = @repo_id,
             transcript_path = @transcript_path,
             cwd = @cwd,
             guidance_injected_at = @guidance_injected_at,
             stops_since_memory_update_attempt = @stops_since_memory_update_attempt,
             last_seen_at = @last_seen_at
         WHERE platform = @platform AND session_id = @session_id`,
      )
      .run(session);
  }

  private markMemoryUpdateAttempt(
    session: AgentSession,
    reason: ClaimedMemoryUpdateAttempt["reason"],
    now: Date,
  ): AgentSession {
    const updated: AgentSession = {
      ...session,
      last_memory_update_attempt_at: iso(now),
      stops_since_memory_update_attempt: 0,
    };
    this.db
      .prepare(
        `UPDATE agent_sessions
         SET last_memory_update_attempt_at = @last_memory_update_attempt_at,
             stops_since_memory_update_attempt = @stops_since_memory_update_attempt
         WHERE platform = @platform AND session_id = @session_id`,
      )
      .run(updated);
    return updated;
  }
}

export function shouldAttemptUpdate(
  session: AgentSession,
  now = new Date(),
): ClaimedMemoryUpdateAttempt["reason"] | undefined {
  if (session.stops_since_memory_update_attempt >= stopAttemptInterval) {
    return "stop_threshold";
  }

  const lastAttemptAt = parseTime(session.last_memory_update_attempt_at);
  const lastSeenAt = parseTime(session.last_seen_at);
  if (lastSeenAt === undefined) return undefined;

  if (lastAttemptAt === undefined) {
    return now.getTime() - lastSeenAt.getTime() >= timeAttemptIntervalMs
      ? "time_threshold"
      : undefined;
  }

  if (lastSeenAt <= lastAttemptAt) return undefined;
  return now.getTime() - lastAttemptAt.getTime() >= timeAttemptIntervalMs ? "time_threshold" : undefined;
}

function fallbackSessionId(input: RecordHookInput): string {
  const identity = `${input.platform}:${input.repoId}:${input.transcriptPath ?? ""}:${input.cwd ?? ""}`;
  const hash = createHash("sha1").update(identity).digest("hex").slice(0, 16);
  return `unknown_${hash}`;
}

function iso(date: Date | undefined): string {
  return (date ?? new Date()).toISOString();
}

function parseTime(value: string | null): Date | undefined {
  if (value === null) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

function isInstallPlatform(value: string | undefined): value is InstallPlatform {
  return value === "codex" || value === "claude" || value === "opencode";
}
