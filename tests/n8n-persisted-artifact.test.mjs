import test from 'node:test';
import assert from 'node:assert/strict';
import {splitPendingQueue,bindPersistedArtifact,selectDeliveryArtifact} from '../lib/n8n-persisted-artifact.mjs';
const id='43969572-c27f-4c83-a77c-68a2b8149e36',other='6ac4b9e7-4275-452c-afce-fd2758269798';
const context={intakeId:id,attachmentIntakeId:id,resultPath:`results-v2/${id}/consolidated.xlsx`,customerEmail:'mock@example.invalid',bytes:6};
const bytes=Buffer.from([80,75,3,4,7,8]);
const response=(c=context)=>[{json:{statusCode:200,headers:{'x-timeease-artifact-context':Buffer.from(JSON.stringify(c)).toString('base64url')}},binary:{data:{id:'synthetic-binary-handle'}}}];
test('persisted delivery takes priority without running conversion or mixing two jobs',()=>{
 const rows=[{json:{intakeIds:[other],deliveryIntakeIds:[id],recoveryIntakeIds:[]}}];
 assert.equal(splitPendingQueue(rows,'conversion').length,0);assert.equal(splitPendingQueue(rows,'delivery')[0].json.intakeId,id);
 assert.throws(()=>splitPendingQueue([{json:{...rows[0].json,recoveryIntakeIds:[id]}}],'delivery'),/CONFLICTING_PENDING_ID/);
 assert.throws(()=>splitPendingQueue([{json:{intakeIds:[]}}],'delivery'),/SINGLE_PENDING_QUEUES_REQUIRED/);
});
test('restart binds downloaded bytes directly to claim context without original conversion state',async()=>{
 const bound=await bindPersistedArtifact(response(),id,async()=>bytes);
 const selected=selectDeliveryArtifact(bound,()=>{throw Error('CONVERSION_STATE_MUST_NOT_BE_USED');});
 assert.equal(selected[0].json.intakeId,id);assert.equal(selected[0].binary.data.fileName,'consolidated.xlsx');
 assert.equal(selected[0].json.persistedArtifact,true);
});
test('new resume boundary rejects wrong IDs, byte sizes, HTML auth pages and missing context',async()=>{
 for(const c of [{...context,intakeId:other},{...context,attachmentIntakeId:other},{...context,resultPath:'other'},{...context,bytes:7},{...context,customerEmail:'invalid'}])
  await assert.rejects(bindPersistedArtifact(response(c),id,async()=>bytes),/PERSISTED_/);
 const html=response();html[0].json.statusCode=302;await assert.rejects(bindPersistedArtifact(html,id,async()=>bytes),/PERSISTED_BINARY_RESPONSE_REQUIRED/);
 const missing=response();delete missing[0].json.headers;await assert.rejects(bindPersistedArtifact(missing,id,async()=>bytes),/PERSISTED_CONTEXT_REQUIRED/);
 await assert.rejects(bindPersistedArtifact(response(),id,async()=>Buffer.from('unsafe')),/PERSISTED_BINARY_MISMATCH/);
});
test('fresh conversion requires successful durable publication before shared claim path',()=>{
 assert.throws(()=>selectDeliveryArtifact([{json:{ok:false,send:false,outbox:'NOT_READY'}}],()=>null),/RESULT_PUBLICATION_REQUIRED/);
 const a={json:context,binary:{data:{}}};
 assert.equal(selectDeliveryArtifact([{json:{ok:true,send:false,outbox:'ENQUEUED'}}],()=>a)[0].json.intakeId,id);
});
