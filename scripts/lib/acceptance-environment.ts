import net from 'node:net';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

export type ProbeState='available'|'not_listening'|'permission_blocked'|'unavailable';
export async function probeTcp(port:number):Promise<{port:number;state:ProbeState;code:string}>{
  return new Promise(resolve=>{
    const socket=net.connect({host:'127.0.0.1',port});socket.setTimeout(1200);
    const finish=(state:ProbeState,code:string)=>{socket.destroy();resolve({port,state,code});};
    socket.once('connect',()=>finish('available','CONNECTED'));
    socket.once('error',(error:NodeJS.ErrnoException)=>finish(['EACCES','EPERM'].includes(error.code??'')?'permission_blocked':error.code==='ECONNREFUSED'?'not_listening':'unavailable',error.code??'UNKNOWN'));
    socket.once('timeout',()=>finish('unavailable','TIMEOUT'));
  });
}
export function dockerExecutable():string|undefined{
  return [process.env.DOCKER_EXE,join(process.env.USERPROFILE??'','AppData/Local/Programs/DockerDesktop/resources/bin/docker.exe'),join(process.env.LOCALAPPDATA??'','Programs/DockerDesktop/resources/bin/docker.exe'),'C:/Program Files/Docker/Docker/resources/bin/docker.exe'].find((path):path is string=>Boolean(path&&existsSync(path)));
}
export function probeDocker(){
  const executable=dockerExecutable();
  if(!executable)return {state:'unavailable' as ProbeState,code:'DOCKER_BINARY_NOT_FOUND'};
  if(process.env.DOCKER_HOST&&!/^(npipe|unix):\/\//.test(process.env.DOCKER_HOST))return {state:'unavailable' as ProbeState,code:'REMOTE_DOCKER_DISABLED'};
  const context=spawnSync(executable,['context','inspect','--format','{{.Endpoints.docker.Host}}'],{encoding:'utf8',windowsHide:true,timeout:5000,maxBuffer:65536});
  if(context.status!==0||!/^(npipe|unix):\/\//.test(String(context.stdout??'').trim()))return {state:'unavailable' as ProbeState,code:'LOCAL_DOCKER_CONTEXT_REQUIRED'};
  const result=spawnSync(executable,['version','--format','{{.Server.Version}}'],{encoding:'utf8',windowsHide:true,timeout:5000,maxBuffer:65536});
  const text=String(result.stderr??'');
  return result.status===0?{state:'available' as ProbeState,code:'DOCKER_READY'}:{state:/permission denied|access.*denied|拒绝访问/i.test(text)?'permission_blocked' as ProbeState:'unavailable' as ProbeState,code:/permission denied|access.*denied|拒绝访问/i.test(text)?'DOCKER_PIPE_ACCESS_DENIED':result.error?'DOCKER_EXECUTION_FAILED':'DOCKER_DAEMON_UNAVAILABLE'};
}
export async function acceptanceEnvironment(){
  const tcp=await Promise.all([4175,4178,4181,4198,5432].map(probeTcp));
  return {runtime:process.versions.node,platform:process.platform,sandboxedLocalAppData:/[/\\]Packages[/\\]sandbox\./i.test(process.env.LOCALAPPDATA??''),tcp,docker:probeDocker(),configurationFiles:{appDatabase:existsSync('.local-data/deployment/db-app-url'),ownerDatabase:existsSync('.local-data/deployment/db-owner-url'),structureTestDatabase:existsSync('.local-data/deployment/db-test-url'),businessEnvironment:existsSync('.local-data/deployment/business-local.env')},note:'Availability checks only; no database created, service started, security policy changed, credential contents printed or network restriction bypassed.'};
}
