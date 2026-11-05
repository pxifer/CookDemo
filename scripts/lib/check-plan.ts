export interface CheckSummary {sourceStable:boolean;results:{id:string;status:string}[]}
const preflight=['validation','types','acceptance-types','web-build'];
export function checkPlan(ids:string[],previous?:CheckSummary){
  if(!previous)return {mode:'full' as const,selected:[...ids]};
  if(previous.sourceStable!==true||!Array.isArray(previous.results))throw Error('RETRY_REQUIRES_STABLE_COMPLETED_REPORT');
  const seen=new Set<string>();
  for(const row of previous.results){
    if(!row||!ids.includes(row.id)||seen.has(row.id)||!['passed','failed','permission_blocked','not_run'].includes(row.status))throw Error('RETRY_REPORT_INVALID');
    seen.add(row.id);
  }
  if(seen.size!==ids.length)throw Error('RETRY_REQUIRES_ALL_STAGE_RESULTS');
  const failed=previous.results.filter(row=>row.status==='failed').map(row=>row.id);
  if(!failed.length)throw Error('RETRY_REPORT_HAS_NO_FAILED_STAGES');
  const selected=new Set([...preflight,...failed]);
  return {mode:'retry_failed' as const,selected:ids.filter(id=>selected.has(id))};
}
