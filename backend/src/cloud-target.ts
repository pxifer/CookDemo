import { validEmail } from '../../shared/registration';
const productionEnvironment='shiwei-d2gmiun66b7dc6a4f';
export function cloudTarget(env:NodeJS.ProcessEnv){
  const stage=env.APP_STAGE??'production',envId=env.CLOUDBASE_ENV_ID??'',origin=env.APP_ORIGIN??'';
  if(!['production','staging'].includes(stage)||!/^shiwei-[a-z0-9-]{1,60}$/.test(envId)||!origin.startsWith('https://')||new URL(origin).origin!==origin)throw Error('CLOUD_TARGET_INVALID');
  if(stage==='production'&&envId!==productionEnvironment)throw Error('PRODUCTION_TARGET_MISMATCH');
  const testUsers=(env.STAGING_ALLOWED_USER_IDS??'').split(',').map(s=>s.trim()).filter(Boolean);
  if(stage==='staging'&&(envId===productionEnvironment||env.STAGING_ENV_ID!==envId||!testUsers.length))throw Error('ISOLATED_STAGING_TARGET_REQUIRED');
  const testRecoveryEmails=stage==='staging'?(env.STAGING_RECOVERY_EMAILS??'').split(',').map(s=>s.trim().toLowerCase()).filter(Boolean):[];
  if(stage==='staging'&&(testRecoveryEmails.length>20||testRecoveryEmails.some(email=>!validEmail(email))||(env.PASSWORD_RECOVERY_ENABLED==='1'&&!testRecoveryEmails.length)))throw Error('STAGING_RECOVERY_EMAILS_REQUIRED');
  return {stage:stage as 'production'|'staging',envId,origin,testUsers,testRecoveryEmails};
}
