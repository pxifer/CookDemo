import test from 'node:test';
import assert from 'node:assert/strict';
import { LocalEmbeddingProvider, sameEmbeddingIdentity, validateEmbeddingIdentity, validateEmbeddingVector } from '../backend/src/rag/embedding';
import type { EmbeddingIdentity } from '../backend/src/rag/types';

const identity: EmbeddingIdentity = {modelId:'fixture/local',revision:'a'.repeat(40),dimensions:2,normalization:'l2',pooling:'mean',queryInstruction:'Query: ',documentInstruction:'',representationVersion:'fixture-v1',runtimeVersion:'fixture-only'};
test('Embedding adapter accepts only loopback HTTP without arbitrary path, credentials or redirects', async () => {
  for (const url of ['https://127.0.0.1:4199','http://remote.example','http://127.0.0.1:4199/private','http://user:secret@localhost:4199','http://localhost:4199/?url=remote']) assert.throws(()=>new LocalEmbeddingProvider(url),/LOOPBACK/);
  let requests=0;
  const fetcher=async (input: RequestInfo | URL, init?: RequestInit)=>{
    assert.equal(init?.redirect,'error');
    requests++;
    if(new URL(String(input)).pathname==='/health')return Response.json({status:'ready',identity});
    assert.deepEqual(JSON.parse(String(init?.body)),{texts:['public evidence'],role:'document'});
    return Response.json({identity,vectors:[[.6,.8]],tokenCounts:[3]});
  };
  const provider=new LocalEmbeddingProvider('http://127.0.0.1:4199',fetcher);
  assert.deepEqual(await provider.embed(['public evidence'],'document'),{identity,vectors:[[.6,.8]],tokenCounts:[3]});
  assert.equal(requests,2);
});
test('Identity locks model revision, normalization, instructions and runtime independently', async()=>{
  assert.throws(()=>validateEmbeddingIdentity({...identity,revision:'main'}),/IDENTITY/);
  assert.throws(()=>validateEmbeddingIdentity({...identity,normalization:'none'}),/IDENTITY/);
  assert(!sameEmbeddingIdentity(identity,{...identity,queryInstruction:'Changed: '}));
  let calls=0;
  const provider=new LocalEmbeddingProvider(undefined,async()=>Response.json({status:'ready',identity:{...identity,revision:(calls++?'b':'a').repeat(40)}}));
  await provider.describe();
  await assert.rejects(()=>provider.describe(),/IDENTITY_CHANGED/);
});
test('Non-finite, zero, truncated or wrongly sized embedding vectors are rejected',async()=>{
  for(const vector of [[0,0],[1],[Infinity,0],[2,0],[NaN,0]])assert.throws(()=>validateEmbeddingVector(vector,2));
  const provider=new LocalEmbeddingProvider(undefined,async(input)=>new URL(String(input)).pathname==='/health'?Response.json({status:'ready',identity}):Response.json({identity,vectors:[[1,0]],tokenCounts:[]}));
  await assert.rejects(()=>provider.embed(['question'],'query'),/BATCH_INVALID/);
  await assert.rejects(()=>provider.embed([],'query'),/INPUT_INVALID/);
});
