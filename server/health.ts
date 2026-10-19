// Testable publication mechanism. No production health release is supplied.
export interface HealthRule { id: string; version: string; evidenceVersion: string; status: 'approved' | 'draft'; condition?: string; }
export interface HealthRelease {
  id: string; diseases: string[]; status: 'approved' | 'draft'; reviewer: string | null;
  rules: { id: string; version: string; evidenceVersion: string }[];
}
export function verifyHealthRelease(release: HealthRelease | undefined, diseases: string[], rules: HealthRule[], revoked: Set<string>, conditions: Record<string, string | undefined>) {
  if (!release || release.status !== 'approved' || !release.reviewer || !release.rules.length) return { state: 'unavailable', reasons: ['缺少经审核的完整发布清单'] };
  if ([...diseases].sort().join(',') !== [...release.diseases].sort().join(',')) return { state: 'unavailable', reasons: ['疾病组合不在审核范围'] };
  if (revoked.has(release.id)) return { state: 'unavailable', reasons: ['发布已撤回'] };
  const missing: string[] = [];
  for (const expected of release.rules) {
    const actual = rules.find(r => r.id === expected.id && r.version === expected.version && r.evidenceVersion === expected.evidenceVersion);
    if (!actual || actual.status !== 'approved' || revoked.has(`${expected.id}@${expected.version}`) || revoked.has(expected.evidenceVersion)) return { state: 'unavailable', reasons: ['必要规则、审核或证据版本无法核验'] };
    if (actual.condition && (!conditions[actual.condition] || conditions[actual.condition] === 'unknown')) missing.push(actual.condition);
  }
  return missing.length ? { state: 'needs_confirmation', reasons: missing } : { state: 'verified', reasons: [] };
}
