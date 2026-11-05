import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve,sep } from 'node:path';
import { evaluateReleaseGate,type ReleaseEvidence } from './lib/release-gate';
import { sourceHashes,sourceFingerprint } from './lib/source-fingerprint';
const path=process.argv[2];if(!path)throw Error('Provide a release evidence manifest path; no deployment is performed');
const manifest=JSON.parse(await readFile(path,'utf8')) as {sourceFingerprint:string;evidence:ReleaseEvidence[]};
const scope=JSON.parse(await readFile('datasets/release/scope-v1.json','utf8'));
const current=await sourceHashes();
if(sourceFingerprint(current)!==manifest.sourceFingerprint)throw Error('RELEASE_EVIDENCE_SOURCE_IS_STALE');
const kinds:Record<string,string>={local_check:'local',postgres_integrations:'postgres',browser_regressions:'browser',account_recovery_erasure:'account',business_restore_drill:'restore',independent_ai_quality:'human_review',staging_acceptance:'staging',rollback_drill:'rollback'};
for(const e of manifest.evidence){
  if(e.status!=='passed')continue;
  try{
    const path=resolve(e.report);if(!path.startsWith(resolve('artifacts/acceptance')+sep)||e.kind!==kinds[e.id])throw Error();
    const bytes=await readFile(path);if(createHash('sha256').update(bytes).digest('hex')!==e.reportSha256)throw Error();
    const report=JSON.parse(bytes.toString());if(report.sourceFingerprint!==manifest.sourceFingerprint)throw Error();
    if(e.kind==='local'){
      if(report.sourceStable!==true||report.failed!==0)throw Error();
      if(JSON.stringify(report.hashes)!==JSON.stringify(current))throw Error();
      const required=['validation','types','acceptance-types','web-build','unit','knowledge-integrity','retrieval-editorial','recipe-evidence','ai-contract','agent-candidates-contract'];
      if(required.some(id=>report.results?.filter((r:{id:string;status:string})=>r.id===id&&r.status==='passed').length!==1))throw Error();
    }else if(e.kind==='postgres'||e.kind==='browser'){
      const rows=report.results?.filter((r:{id:string})=>e.kind==='postgres'?r.id.startsWith('pg-'):r.id.includes('browser'));
      const required=e.kind==='postgres'?['pg-structure','pg-business','pg-candidates','pg-community','pg-health-and-tasks','pg-cloud-migrations']:['browser','health-browser','registration-browser','business-browser'];
      if(!rows?.length||rows.some((r:{status:string})=>r.status!=='passed')||required.some(id=>rows.filter((r:{id:string})=>r.id===id).length!==1))throw Error();
    }else if(e.kind==='human_review'){
      if(report.mode!=='real_provider_public_synthetic_tasks'||report.qualityApproved!==true||report.criticalViolations!==0||!report.independentReviewers?.length||report.endToEndApiValidated!==true||report.frozenDatasetStatus!=='independently_reviewed_frozen'||report.actualProviderAttempts<1||!Number.isFinite(report.reservedMicroCny)||report.reservedMicroCny>5000000)throw Error();
      const dimensions={recognition:40,allergy:50,disease:50,reasonableness:30,method:30};
      if(Object.entries(dimensions).some(([id,count])=>report.dimensions?.[id]?.reviewed!==count||report.dimensions[id].passed!==count))throw Error();
    }else if(e.kind==='restore'){if(report.fullRecoveryAccepted!==true||report.isolatedTargetVerified!==true||report.latestRevocationVerified!==true)throw Error();
    }else if(e.kind==='account'){if(report.realProviderValidated!==true||report.recoveryPassed!==true||report.erasurePassed!==true)throw Error();
    }else if(e.kind==='staging'){if(report.stagingValidated!==true||report.realAccountsOnly!==true)throw Error();
    }else if(e.kind==='rollback'){if(report.rollbackPassed!==true||report.withdrawalsPreserved!==true||report.accountRevocationsPreserved!==true)throw Error();}
  }catch{e.status='failed';}
}
const report=evaluateReleaseGate(scope.requiredEvidence,manifest.evidence,manifest.sourceFingerprint);
console.log(JSON.stringify({...report,scope:scope.id,productionReleaseAuthorized:scope.productionReleaseAuthorized,note:'Evidence assessment only; never deploys or overrides a required missing check'},null,2));
if(!report.ready)process.exitCode=2;
