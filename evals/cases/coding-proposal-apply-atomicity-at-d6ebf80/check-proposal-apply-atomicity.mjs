#!/usr/bin/env node
import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = findRepoRoot(scriptDir);
const args = parseArgs(process.argv.slice(2));
const ownsTempDir = args.keepTemp !== true;
const tempDir = mkdtempSync(resolve(tmpdir(), "greplica-apply-atomicity-"));
const dbPath = resolve(tempDir, "graph.db");
const resultJson = args.resultJson;

const marker = {
  component: "component.atomicity_marker",
  flow: "flow.atomicity_marker",
  claim: "claim.atomicity_marker",
  source: "source.atomicity_marker",
  edges: [
    "edge.atomicity_claim_component",
    "edge.atomicity_claim_source",
    "edge.atomicity_flow_component",
  ],
  title: "Atomicity failure fixture",
};

const repo = {
  remote_url: "eval:proposal-apply-atomicity",
  repo_name: "proposal-apply-atomicity",
  default_branch: "main",
};

const proposal = {
  title: marker.title,
  summary: "This proposal must not leave rows behind when embedding generation fails.",
  creates: {
    components: [
      {
        id: marker.component,
        name: "Atomicity Marker Component",
        code_anchor: "libs/knowledge-graph/service.ts",
      },
    ],
    flows: [
      {
        id: marker.flow,
        name: "Atomicity Marker Flow",
      },
    ],
    claims: [
      {
        id: marker.claim,
        kind: "fact",
        text: "This marker claim should only exist after a successful proposal apply.",
        truth: "code_verified",
        intent: "intended",
      },
    ],
    sources: [
      {
        id: marker.source,
        kind: "session",
        ref: "eval:proposal-apply-atomicity",
        title: "Proposal apply atomicity eval",
      },
    ],
    edges: [
      {
        id: marker.edges[0],
        from_type: "claim",
        from_id: marker.claim,
        to_type: "component",
        to_id: marker.component,
        kind: "about",
      },
      {
        id: marker.edges[1],
        from_type: "claim",
        from_id: marker.claim,
        to_type: "source",
        to_id: marker.source,
        kind: "evidenced_by",
        metadata: {
          reason: "Deterministic fixture evidence.",
        },
      },
      {
        id: marker.edges[2],
        from_type: "flow",
        from_id: marker.flow,
        to_type: "component",
        to_id: marker.component,
        kind: "touches",
      },
    ],
  },
};

let db;
let checks = [];
let commands = [];

try {
  const modules = await importBuiltModules();
  db = modules.openDatabase(dbPath);
  const repository = new modules.SqliteRepository(db);
  const failingService = new modules.KnowledgeGraphService(repository, {
    ensureForGraph: async () => {
      throw new Error("synthetic embedding failure");
    },
  });

  failingService.initRepo(repo);
  const beforeGraph = failingService.readGraph(repo);

  let failureError;
  try {
    await failingService.applyProposal(repo, proposal);
  } catch (error) {
    failureError = error;
  }

  const afterFailedGraph = failingService.readGraph(repo);
  const afterFailedStorage = storageSnapshot(db);

  const successfulService = new modules.KnowledgeGraphService(repository, {
    ensureForGraph: async (_repoId, graph) => ({
      checked_objects: graph.components.length + graph.flows.length + graph.claims.length,
      created: 0,
      reused: graph.components.length + graph.flows.length + graph.claims.length,
    }),
  });

  let successError;
  try {
    await successfulService.applyProposal(repo, proposal);
  } catch (error) {
    successError = error;
  }

  const afterSuccessfulGraph = successfulService.readGraph(repo);

  checks = [
    checkFailedApplyRejected(failureError),
    checkVisibleGraphUnchanged(beforeGraph, afterFailedGraph),
    checkStorageRolledBack(afterFailedStorage),
    checkSameProposalCanApplyAfterFailure(successError, afterSuccessfulGraph),
  ];
} catch (error) {
  checks = [
    {
      id: "verification_script",
      passed: false,
      details: [error instanceof Error ? error.stack ?? error.message : String(error)],
    },
  ];
} finally {
  if (db !== undefined) db.close();

  const passedChecks = checks.filter((check) => check.passed).length;
  const result = {
    success: passedChecks === checks.length,
    correctness: {
      passed_checks: passedChecks,
      total_checks: checks.length,
      ratio: checks.length === 0 ? 0 : passedChecks / checks.length,
    },
    db_path: dbPath,
    commands,
    checks,
  };

  const serialized = `${JSON.stringify(result, null, 2)}\n`;
  if (resultJson !== undefined) writeFileSync(resultJson, serialized);
  process.stdout.write(serialized);

  if (ownsTempDir) rmSync(tempDir, { recursive: true, force: true });
  process.exitCode = result.success ? 0 : 1;
}

async function importBuiltModules() {
  const serviceModule = await import(toFileUrl("dist/libs/knowledge-graph/service.js"));
  const dbModule = await import(toFileUrl("dist/libs/storage/sqlite/db.js"));
  const repositoryModule = await import(toFileUrl("dist/libs/storage/sqlite/repository.js"));
  return {
    KnowledgeGraphService: serviceModule.KnowledgeGraphService,
    openDatabase: dbModule.openDatabase,
    SqliteRepository: repositoryModule.SqliteRepository,
  };
}

function toFileUrl(path) {
  return pathToFileURL(resolve(repoRoot, path)).href;
}

function findRepoRoot(startDir) {
  let current = startDir;
  for (let depth = 0; depth < 8; depth += 1) {
    if (existsSync(resolve(current, "package.json")) && existsSync(resolve(current, "libs/knowledge-graph/service.ts"))) {
      return current;
    }
    const parent = dirname(current);
    if (parent === current) break;
    current = parent;
  }
  throw new Error(`Could not find repo root from ${startDir}`);
}

function checkFailedApplyRejected(error) {
  const details = [];
  if (error === undefined) {
    details.push("applyProposal resolved even though embedding generation failed");
  } else if (!String(error.message ?? error).includes("synthetic embedding failure")) {
    details.push(`applyProposal failed with unexpected error: ${String(error.message ?? error)}`);
  }

  return {
    id: "failed_apply_rejects",
    passed: details.length === 0,
    details,
  };
}

function checkVisibleGraphUnchanged(beforeGraph, afterFailedGraph) {
  const details = [];
  for (const type of ["components", "flows", "claims", "sources", "edges"]) {
    const beforeIds = ids(beforeGraph[type]);
    const afterIds = ids(afterFailedGraph[type]);
    if (beforeIds.join("\n") !== afterIds.join("\n")) {
      details.push(`${type} changed after failed apply: before=[${beforeIds.join(", ")}] after=[${afterIds.join(", ")}]`);
    }
  }

  return {
    id: "visible_graph_unchanged",
    passed: details.length === 0,
    details,
  };
}

function checkStorageRolledBack(snapshot) {
  const details = [];
  for (const [name, value] of Object.entries(snapshot)) {
    if (value !== 0) details.push(`${name} has ${value} leaked row(s)`);
  }

  return {
    id: "storage_rows_rolled_back",
    passed: details.length === 0,
    details,
  };
}

function checkSameProposalCanApplyAfterFailure(error, graph) {
  const details = [];
  if (error !== undefined) {
    details.push(`same proposal could not be applied after failed apply: ${String(error.message ?? error)}`);
  }

  const expected = [
    ["components", marker.component],
    ["flows", marker.flow],
    ["claims", marker.claim],
    ["sources", marker.source],
    ...marker.edges.map((edgeId) => ["edges", edgeId]),
  ];

  for (const [type, id] of expected) {
    if (!ids(graph[type]).includes(id)) details.push(`${type} missing ${id} after successful retry`);
  }

  return {
    id: "same_proposal_can_apply_after_failure",
    passed: details.length === 0,
    details,
  };
}

function storageSnapshot(dbHandle) {
  return {
    components: scalarCount(dbHandle, "SELECT COUNT(*) AS count FROM components WHERE id = ?", marker.component),
    flows: scalarCount(dbHandle, "SELECT COUNT(*) AS count FROM flows WHERE id = ?", marker.flow),
    claims: scalarCount(dbHandle, "SELECT COUNT(*) AS count FROM claims WHERE id = ?", marker.claim),
    sources: scalarCount(dbHandle, "SELECT COUNT(*) AS count FROM sources WHERE id = ?", marker.source),
    edges: scalarCount(
      dbHandle,
      `SELECT COUNT(*) AS count FROM edges WHERE id IN (${marker.edges.map(() => "?").join(", ")})`,
      ...marker.edges,
    ),
    memberships: scalarCount(
      dbHandle,
      `SELECT COUNT(*) AS count
       FROM graph_memberships
       WHERE subject_id IN (${[marker.component, marker.flow, marker.claim, ...marker.edges].map(() => "?").join(", ")})`,
      marker.component,
      marker.flow,
      marker.claim,
      ...marker.edges,
    ),
    memory_commits: scalarCount(dbHandle, "SELECT COUNT(*) AS count FROM memory_commits WHERE title = ?", marker.title),
    embeddings: scalarCount(
      dbHandle,
      `SELECT COUNT(*) AS count
       FROM graph_object_embeddings
       WHERE object_id IN (?, ?, ?)`,
      marker.component,
      marker.flow,
      marker.claim,
    ),
  };
}

function scalarCount(dbHandle, sql, ...params) {
  const row = dbHandle.prepare(sql).get(...params);
  return Number(row?.count ?? 0);
}

function ids(items) {
  return [...items.map((item) => item.id)].sort();
}

function parseArgs(values) {
  const parsed = {};
  for (let index = 0; index < values.length; index += 1) {
    const value = values[index];
    if (value === "--result-json") parsed.resultJson = requireValue(values, index += 1, value);
    else if (value === "--keep-temp") parsed.keepTemp = true;
    else throw new Error(`Unknown argument: ${value}`);
  }
  return parsed;
}

function requireValue(values, index, flag) {
  const value = values[index];
  if (value === undefined || value.startsWith("--")) throw new Error(`Expected value after ${flag}`);
  return value;
}
