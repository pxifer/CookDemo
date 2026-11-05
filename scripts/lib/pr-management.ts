export type ReviewPhase = 'preflight' | 'pre-merge' | 'post-merge';

export function reviewVerdict(input: {
  phase: ReviewPhase;
  expectedHead: string;
  actualHead: string;
  branch: string;
  cleanBefore: boolean;
  cleanAfter: boolean;
  sourceStable: boolean;
  baseIsAncestor: boolean;
  stages: { status: 'passed' | 'failed' }[];
}): 'passed' | 'failed' | 'incomplete' {
  if (input.stages.some(stage => stage.status === 'failed')) return 'failed';
  if (input.phase === 'preflight' || !input.stages.length ||
    input.expectedHead !== input.actualHead || !input.cleanBefore || !input.cleanAfter ||
    !input.sourceStable || !input.baseIsAncestor ||
    (input.phase === 'post-merge' && input.branch !== 'main')) return 'incomplete';
  return 'passed';
}
