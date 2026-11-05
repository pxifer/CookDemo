import { randomUUID } from 'node:crypto';
import { DomainError } from './recommendation';
import type { AccountIdentity } from './cloudbase-accounts';

export type ErasureStage='intent'|'private_revoked'|'identity_deleted'|'completed';
export interface ErasureEvent {operationId:string;userId:string;stage:ErasureStage}
export interface IndependentErasureJournal {
  // The production adapter must acknowledge independent durable storage before
  // returning. A function's /tmp or a row inside the backed-up DB is insufficient.
  append(event:ErasureEvent):Promise<void>;
  read(operationId:string):Promise<ErasureEvent[]>;
}
export interface AccountErasureBackend {
  begin(identity:AccountIdentity,operationId:string):Promise<void>;
  finish(userId:string,operationId:string):Promise<void>;
  // Administrative retry path, required because the user's JWT can expire or
  // become invalid after the identity deletion succeeds but the response is lost.
  deleteIdentityById(userId:string):Promise<void>;
}
export class AccountErasureWorkflow {
  constructor(private journal:IndependentErasureJournal,private backend:AccountErasureBackend){}
  async erase(identity:AccountIdentity,deleteVerifiedIdentity:()=>Promise<void>){
    const operationId=randomUUID();
    await this.journal.append({operationId,userId:identity.userId,stage:'intent'});
    try{
      await this.backend.begin(identity,operationId);
      await this.journal.append({operationId,userId:identity.userId,stage:'private_revoked'});
      await deleteVerifiedIdentity();
      await this.complete(identity.userId,operationId);
      return {operationId,state:'completed' as const};
    }catch{return {operationId,state:'pending' as const};}
  }
  private async complete(userId:string,operationId:string){
    await this.journal.append({operationId,userId,stage:'identity_deleted'});
    await this.backend.finish(userId,operationId);
    await this.journal.append({operationId,userId,stage:'completed'});
  }
  async resume(operationId:string){
    const events=await this.journal.read(operationId),intent=events.find(e=>e.stage==='intent');
    if(!intent||events.some(e=>e.operationId!==operationId||e.userId!==intent.userId))throw new DomainError('ERASURE_JOURNAL_INVALID',503,'注销记录无法核验');
    if(events.some(e=>e.stage==='completed'))return;
    // begin is idempotent by UID+operation; a backend must recover this step
    // administratively when a crash happened before private_revoked was written.
    if(!events.some(e=>e.stage==='private_revoked'))throw new DomainError('ERASURE_RECONCILIATION_REQUIRED',503,'注销需要核对数据库撤销状态后续作');
    await this.backend.deleteIdentityById(intent.userId);
    await this.complete(intent.userId,operationId);
  }
}
