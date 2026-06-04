import type { Claim } from "../claim.js";
import type { Source } from "../schema.js";
import type {
  ClaimContextResult,
  ComponentContextResult,
  FlowContextResult,
  GraphContextResult,
} from "./types.js";

interface CompactGraphContextResult {
  query: string;
  components: CompactComponentResult[];
  flows: CompactFlowResult[];
  claims: CompactClaimResult[];
  sources: Source[];
}

interface CompactComponentResult {
  id: string;
  name: string;
  code_anchor?: string;
  matched_claim_ids: string[];
}

interface CompactFlowResult {
  id: string;
  name: string;
  matched_claim_ids: string[];
}

interface CompactClaimResult {
  id: string;
  kind: Claim["kind"];
  text: string;
  truth: Claim["truth"];
  intent: Claim["intent"];
  about: ClaimContextResult["about"];
  evidence: Array<{
    source_id: string;
    title?: string;
    ref: string;
    reason?: string;
  }>;
}

export function renderGraphContextMarkdown(result: GraphContextResult): string {
  const claimById = new Map(result.claims.map((claim) => [claim.object.id, claim]));
  const shownClaimIds = new Set<string>();
  const content = [
    "# Graph Context",
    "",
    `Query: ${result.query}`,
    "",
    "## Components",
    "",
    ...renderComponents(result.components),
    "",
    "## Flows",
    "",
    ...renderFlows(result.flows, claimById, shownClaimIds),
  ];
  const remainingClaims = result.claims.filter((claim) => !shownClaimIds.has(claim.object.id));
  if (remainingClaims.length > 0) {
    content.push("", "## Other Relevant Claims", "", ...renderClaimItems(remainingClaims));
  }
  if (result.sources.length > 0) {
    content.push("", "## Sources", "", ...renderSources(result.sources));
  }

  return lines(...content);
}

export function compactGraphContextResult(result: GraphContextResult): CompactGraphContextResult {
  return {
    query: result.query,
    components: result.components.map((component) => ({
      id: component.object.id,
      name: component.object.name,
      code_anchor: component.object.code_anchor,
      matched_claim_ids: component.matched_claim_ids,
    })),
    flows: result.flows.map((flow) => ({
      id: flow.object.id,
      name: flow.object.name,
      matched_claim_ids: flow.matched_claim_ids,
    })),
    claims: result.claims.map((claim) => ({
      id: claim.object.id,
      kind: claim.object.kind,
      text: claim.object.text,
      truth: claim.object.truth,
      intent: claim.object.intent,
      about: claim.about,
      evidence: claim.evidence.map((evidence) => ({
        source_id: evidence.source.id,
        title: evidence.source.title,
        ref: evidence.source.ref,
        reason: evidence.reason.length > 0 ? evidence.reason : undefined,
      })),
    })),
    sources: result.sources,
  };
}

function renderComponents(components: ComponentContextResult[]): string[] {
  if (components.length === 0) return ["- None."];
  return components.map((component) => {
    const anchor = component.object.code_anchor === undefined ? "" : `\n  Anchor: \`${component.object.code_anchor}\``;
    return `- \`${component.object.id}\` ${component.object.name}${anchor}`;
  });
}

function renderFlows(
  flows: FlowContextResult[],
  claimById: Map<string, ClaimContextResult>,
  shownClaimIds: Set<string>,
): string[] {
  if (flows.length === 0) return ["- None."];
  return flows.flatMap((flow) => {
    const claims = claimsForFlow(flow, claimById);
    for (const claim of claims) shownClaimIds.add(claim.object.id);
    return [
      `### ${flow.object.name}`,
      "",
      `ID: \`${flow.object.id}\``,
      "",
      "Claims:",
      ...renderClaimItems(claims),
      "",
    ];
  });
}

function claimsForFlow(flow: FlowContextResult, claimById: Map<string, ClaimContextResult>): ClaimContextResult[] {
  const claims = new Map<string, ClaimContextResult>();
  for (const claimId of flow.matched_claim_ids) {
    const claim = claimById.get(claimId);
    if (claim !== undefined) claims.set(claim.object.id, claim);
  }
  for (const claim of claimById.values()) {
    if (claim.about.some((subject) => subject.type === "flow" && subject.id === flow.object.id)) {
      claims.set(claim.object.id, claim);
    }
  }
  return [...claims.values()].sort((left, right) => left.object.kind.localeCompare(right.object.kind) || left.object.id.localeCompare(right.object.id));
}

function renderClaimItems(claims: ClaimContextResult[]): string[] {
  if (claims.length === 0) return ["- None."];
  return claims.map((claim) => {
    const evidence = claim.evidence.length === 0 ? "" : ` Source: ${claim.evidence.map(evidenceLabel).join("; ")}.`;
    return `- \`${claim.object.id}\` (${claim.object.kind}, ${claim.object.truth}): ${claim.object.text}${evidence}`;
  });
}

function evidenceLabel(evidence: ClaimContextResult["evidence"][number]): string {
  return evidence.source.title ?? evidence.source.ref ?? evidence.source.id;
}

function renderSources(sources: Source[]): string[] {
  return sources.map((source) => `- \`${source.id}\` ${source.title ?? source.ref}`);
}

function lines(...values: string[]): string {
  return `${values.join("\n").replace(/\n{3,}/g, "\n\n").trimEnd()}\n`;
}
