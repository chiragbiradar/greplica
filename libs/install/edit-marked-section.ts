export function replaceOrAppendSection(content: string, marker: string, newSection: string): string {
  const section = newSection.trim();
  if (!content.includes(marker)) {
    return content.trim().length === 0 ? `${section}\n` : `${content.trimEnd()}\n\n${section}\n`;
  }

  const lines = content.split("\n");
  const start = lines.findIndex((line) => line.includes(marker));
  if (start < 0) return `${content.trimEnd()}\n\n${section}\n`;

  let end = lines.length;
  for (let index = start + 1; index < lines.length; index += 1) {
    if (lines[index].startsWith("## ")) {
      end = index;
      break;
    }
  }

  const before = lines.slice(0, start).join("\n").trimEnd();
  const after = lines.slice(end).join("\n").trimStart();
  const parts = [before, section, after].filter((part) => part.length > 0);
  return `${parts.join("\n\n")}\n`;
}
