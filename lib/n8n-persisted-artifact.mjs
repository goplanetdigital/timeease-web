export function splitPendingQueue(rows,lane){
 if(rows.length!==1||!['conversion','delivery'].includes(lane))throw Error('ONE_PENDING_RESPONSE_REQUIRED');
 const b=rows[0].json,seen=new Set(),uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
 for(const key of ['intakeIds','deliveryIntakeIds','recoveryIntakeIds']){
  if(!Array.isArray(b?.[key])||b[key].length>1)throw Error('SINGLE_PENDING_QUEUES_REQUIRED');
  for(const id of b[key]){if(typeof id!=='string'||!uuid.test(id)||seen.has(id.toLowerCase()))throw Error('CONFLICTING_PENDING_ID');seen.add(id.toLowerCase());}
 }
 const ids=lane==='delivery'?b.deliveryIntakeIds:b.deliveryIntakeIds.length?[]:b.intakeIds;
 return ids.map(intakeId=>({json:{intakeId},pairedItem:{item:0}}));
}
export async function bindPersistedArtifact(rows,expectedId,readBinary){
 if(rows.length!==1||rows[0].json?.statusCode!==200||!rows[0].binary?.data)throw Error('PERSISTED_BINARY_RESPONSE_REQUIRED');
 const row=rows[0],encoded=row.json.headers?.['x-timeease-artifact-context'];
 if(typeof encoded!=='string'||encoded.length>2048||!/^[A-Za-z0-9_-]+$/.test(encoded))throw Error('PERSISTED_CONTEXT_REQUIRED');
 const raw=Buffer.from(encoded,'base64url');if(raw.toString('base64url')!==encoded)throw Error('PERSISTED_CONTEXT_REQUIRED');
 let c;try{c=JSON.parse(raw.toString('utf8'));}catch{throw Error('PERSISTED_CONTEXT_REQUIRED');}
 if(c?.intakeId!==expectedId||c.attachmentIntakeId!==expectedId||c.resultPath!==`results-v2/${expectedId}/consolidated.xlsx`||
  typeof c.customerEmail!=='string'||c.customerEmail.length>254||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(c.customerEmail)||
  !Number.isSafeInteger(c.bytes)||c.bytes<4||c.bytes>20*1024*1024)throw Error('PERSISTED_ORDER_BINDING_REQUIRED');
 const bytes=await readBinary();
 if(bytes.length!==c.bytes||bytes.subarray(0,4).toString('hex')!=='504b0304')throw Error('PERSISTED_BINARY_MISMATCH');
 row.binary.data.mimeType='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
 row.binary.data.fileName='consolidated.xlsx';
 return [{json:{...c,persistedArtifact:true},binary:row.binary,pairedItem:{item:0}}];
}
export function selectDeliveryArtifact(rows,converted){
 if(rows.length!==1)throw Error('ONE_DELIVERY_ARTIFACT_REQUIRED');
 let artifact;
 if(rows[0].json.persistedArtifact===true)artifact=rows[0];
 else{
  const r=rows[0].json;
  if(r.ok!==true||r.send!==false||!['ENQUEUED','IDEMPOTENT'].includes(r.outbox))throw Error('RESULT_PUBLICATION_REQUIRED');
  artifact=converted();
 }
 const c=artifact?.json;
 if(!artifact?.binary?.data||!c||c.attachmentIntakeId!==c.intakeId||c.resultPath!==`results-v2/${c.intakeId}/consolidated.xlsx`)throw Error('ATTACHMENT_BINDING_REQUIRED');
 return [{json:c,binary:artifact.binary,pairedItem:{item:0}}];
}
