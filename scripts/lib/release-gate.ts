export interface ReleaseEvidence {id:string;status:'passed'|'failed'|'permission_blocked'|'not_run';sourceFingerprint:string;report:string;reportSha256?:string;kind:'local'|'postgres'|'browser'|'human_review'|'staging'|'restore'|'rollback'|'account'}
export function evaluateReleaseGate(required:string[],evidence:ReleaseEvidence[],fingerprint:string){
  const missing=required.filter(id=>!evidence.some(e=>e.id===id));
  const duplicate=required.filter(id=>evidence.filter(e=>e.id===id).length>1);
  const invalid=evidence.filter(e=>required.includes(e.id)&&(e.status!=='passed'||e.sourceFingerprint!==fingerprint||!e.report||!/^[a-f0-9]{64}$/.test(e.reportSha256??'')));
  return {ready:missing.length===0&&duplicate.length===0&&invalid.length===0,missing,duplicate,invalid:invalid.map(e=>({id:e.id,status:e.status,reason:e.sourceFingerprint!==fingerprint?'source_version_mismatch':!e.report?'report_missing':!/^[a-f0-9]{64}$/.test(e.reportSha256??'')?'report_hash_missing':'not_passed'}))};
}
