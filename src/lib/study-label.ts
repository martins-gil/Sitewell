/** "RCN-101 — Full title", or just the acronym when the study has no separate title
 * (a blank title is stored as the acronym itself). */
export function studyLabel(protocolId: string, title: string | null | undefined): string {
  const name = (title ?? "").trim();
  return name && name !== protocolId ? `${protocolId} — ${name}` : protocolId;
}
