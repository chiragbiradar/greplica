export const greplicaInstructionBlock = `## Greplica

Use Greplica when you need repo context that is not already in the conversation, especially before working on unfamiliar code, tracing how something works, or making changes that depend on prior decisions.

\`\`\`bash
greplica graph context "<natural-language question about the current task>"
\`\`\`

Use the returned claims, components, flows, and code anchors to choose what to inspect next. Treat Greplica as navigation and prior context, not final truth: verify facts against current files before editing.

Run \`greplica-bootstrap\` once per repo to initialize memory. Near the end of useful sessions, run \`greplica-update-working-memory\` to save durable decisions, changed flows, constraints, and follow-up work.
`;
