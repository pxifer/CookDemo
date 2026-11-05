import { createHash } from 'node:crypto';
import type { AccountErasureBackend } from './account-lifecycle';
import { DomainError } from './recommendation';
export function cloudBaseErasureBackend(options:{envId:string;serviceRoleKey:string;deleteIdentityById:(uid:string)=>Promise<void>;fetcher?:typeof fetch}):AccountErasureBackend{
  if(!/^shiwei-[a-z0-9-]{1,60}$/.test(options.envId)||!options.serviceRoleKey)throw Error('ERASURE_BACKEND_CONFIGURATION');
  const call=async(name:string,args:Record<string,string>)=>{
    try{
      const response=await (options.fetcher??fetch)(`https://${options.envId}.api.tcloudbasegateway.com/v1/rdb/rest/rpc/${name}`,{method:'POST',headers:{Authorization:`Bearer ${options.serviceRoleKey}`,'Content-Type':'application/json'},body:JSON.stringify(args),redirect:'error',signal:AbortSignal.timeout(8000)});
      if(!response.ok)throw Error();const result=await response.json();if(result?.revoked!==true&&result?.completed!==true)throw Error();
    }catch{throw new DomainError('ERASURE_BACKEND_UNAVAILABLE',503,'注销状态暂时无法确认，未自动重复执行');}
  };
  return {begin:(identity,operationId)=>call('shiwei_erasure_begin',{p_owner:identity.userId,p_session:createHash('sha256').update(identity.sid).digest('hex'),p_operation:operationId}),finish:(uid,op)=>call('shiwei_erasure_finish',{p_owner:uid,p_operation:op}),deleteIdentityById:options.deleteIdentityById};
}
