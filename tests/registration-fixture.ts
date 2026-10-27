import { randomBytes } from "node:crypto";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { CloudBaseAccounts } from "../server/cloudbase-accounts";
export async function fixture(enabled=true){
  const db=new PGlite();
  await db.exec(`CREATE ROLE anon;CREATE ROLE authenticated;CREATE ROLE service_role;CREATE SCHEMA auth;
    CREATE FUNCTION auth.uid() RETURNS text LANGUAGE sql AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'') $$;
    GRANT USAGE ON SCHEMA auth TO authenticated;GRANT EXECUTE ON FUNCTION auth.uid() TO authenticated;`);
  await db.exec(await readFile('deploy/db/account-sync.sql','utf8'));
  await db.exec(await readFile('deploy/db/health-chat.sql','utf8'));
  const users=new Map<string,{uid:string;password:string}>(),pending=new Map<string,string>(),verified=new Map<string,string>();
  let count=0,mailCount=0,captchaRequired=false;
  const requests:{path:string;body:any;headers:Headers}[]=[];
  const fetcher:typeof fetch=async(input,init)=>{
    const path=new URL(String(input)).pathname,headers=new Headers(init?.headers),body=init?.body?JSON.parse(String(init.body)):{};
    requests.push({path,headers,body});
    const result=(value:unknown,status=200)=>new Response(JSON.stringify(value),{status});
    if(path==='/auth/v1/captcha/data')return result({data:'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==',token:'image-token',expires_in:300});
    if(path==='/auth/v1/captcha/data/verify')return body.token==='image-token'&&body.key==='AB12'?result({captcha_token:'captcha-proof'}):result({error:'invalid_captcha'},400);
    if(path==='/auth/v1/verification'){
      if(captchaRequired&&headers.get('x-captcha-token')!=='captcha-proof')return result({error:'captcha_required'},400);
      const id=`verification-${++mailCount}`;pending.set(id,body.email);return result({verification_id:id,expires_in:600,is_user:false});
    }
    if(path==='/auth/v1/verification/verify'){
      const email=pending.get(body.verification_id);
      if(!email||body.verification_code!=='123456')return result({error:'invalid_verification_code'},400);
      pending.delete(body.verification_id);const token=`verified-${body.verification_id}`;verified.set(token,email);return result({verification_token:token});
    }
    if(path==='/auth/v1/signup'){
      if(verified.get(body.verification_token)!==body.email)return result({error:'invalid_verification_token'},400);
      verified.delete(body.verification_token);
      if(users.has(body.username))return result({error:'user_already_exists'},409);
      const uid=`new-user-${++count}`;users.set(body.username,{uid,password:body.password});return result({access_token:`token:${uid}`,sub:uid,expires_in:7200});
    }
    if(path==='/auth/v1/signin'){
      if(captchaRequired&&headers.get('x-captcha-token')!=='captcha-proof')return result({error:'captcha_required'},400);
      const user=users.get(body.username);if(!user||user.password!==body.password)return result({},401);
      return result({access_token:`token:${user.uid}`,sub:user.uid,expires_in:7200});
    }
    const uid=headers.get('authorization')?.slice('Bearer token:'.length);
    if(![...users.values()].some(user=>user.uid===uid))return result({},401);
    if(path==='/auth/v1/token/introspect')return result({sub:uid});
    const name=path.split('/').at(-1)!;
    const params=Object.keys(body);
    await db.exec('RESET ROLE');await db.query("SELECT set_config('request.jwt.claim.sub',$1,false)",[uid]);await db.exec('SET ROLE authenticated');
    try{const response=await db.query<{value:unknown}>(`SELECT public.${name}(${params.map((key,i)=>`${key}=>$${i+1}`).join(',')}) AS value`,params.map(key=>body[key]));return result(response.rows[0].value);}
    finally{await db.exec('RESET ROLE');}
  };
  const options={envId:'shiwei-d2gmiun66b7dc6a4f',cookieKey:randomBytes(32),profileKey:randomBytes(32),keyVersion:'signup-test-v1',registrationEnabled:enabled,fetch:fetcher};
  return {db,accounts:new CloudBaseAccounts(options),options,requests,users,requireCaptcha:()=>{captchaRequired=true;}};
}
