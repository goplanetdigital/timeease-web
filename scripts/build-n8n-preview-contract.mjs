import {readFileSync,writeFileSync} from 'node:fs';
const functions=readFileSync('lib/n8n-outbox-contract.mjs','utf8').replaceAll('export function','function');
const checks=`
const now=Date.now(),id='30ddfe75-a571-4baa-b2d5-5b4ecf963304',deliveryId='fdcb1ded-9aad-4226-957e-bbc3938f4483';
const good=()=>({expected:{intakeId:id,attachmentIntakeId:id,resultPath:'results-v2/'+id+'/consolidated.xlsx',customerEmail:'synthetic@example.invalid'},response:{statusCode:200,body:{ok:true,send:true,outbox:'CLAIMED',intakeId:id,deliveryId,leaseUntil:new Date(now+300000).toISOString()}}});
let checked=0;
const c=authorizeOneDelivery([good()],now);if(c.deliveryId!==deliveryId)throw Error('POSITIVE_BINDING_FAILED');checked++;
const negative=[x=>x.response.statusCode=302,x=>x.response.body='<html>SSO</html>',x=>x.response.body.send=false,x=>x.response.body.outbox='IN_FLIGHT',x=>x.expected.attachmentIntakeId=deliveryId,x=>x.response.body.intakeId=deliveryId,x=>x.response.body.leaseUntil=new Date(now-1).toISOString(),x=>x.response.body.leaseUntil=new Date(now+30000).toISOString()];
for(const mutate of negative){const x=good();mutate(x);let refused=false;try{authorizeOneDelivery([x],now);}catch{refused=true;}if(!refused)throw Error('UNSAFE_AUTHORIZATION');checked++;}
for(const items of [[],[good(),good()]]){let refused=false;try{authorizeOneDelivery(items,now);}catch{refused=true;}if(!refused)throw Error('BATCH_NOT_REJECTED');checked++;}
const report=boundReceiptReport(c,{id:'abcdef0123456789'});if(report.intakeId!==id||report.deliveryId!==deliveryId)throw Error('RECEIPT_BINDING_FAILED');checked++;
let noReceipt=false;try{boundReceiptReport(c,{id:123456789012});}catch{noReceipt=true;}if(!noReceipt)throw Error('INVALID_RECEIPT_ACCEPTED');checked++;
const counts=exceptionCounts({statusCode:200,body:{ledgerReachable:true,expiredLeases:1,outbox:[{status:'FAILED',count:2}],deliveryLedger:[{status:'UNKNOWN',count:3}]}});if(counts.unknown!==3)throw Error('MONITOR_BINDING_FAILED');checked++;
return [{json:{status:'PASS',checks:checked,simulationOnly:true,send:false,noEmailSent:true,networkCalls:0,databaseWrites:0,receiptIsSynthetic:true}}];
`;
const code=`import {workflow,node,trigger} from '@n8n/workflow-sdk';
const start=trigger({type:'n8n-nodes-base.manualTrigger',version:1,config:{name:'Manual synthetic contract only'},output:[{json:{}}]});
const check=node({type:'n8n-nodes-base.code',version:2,config:{name:'Check sender bindings without I/O',parameters:{mode:'runOnceForAllItems',language:'javaScript',jsCode:${JSON.stringify(functions+checks)}}},output:[{json:{status:'PASS',simulationOnly:true,send:false}}]});
export default workflow('timeease-pr20-preview-sender-contract','TimeEase PR20 Preview Sender Contract - No I/O').add(start).to(check);
`;
writeFileSync('workflows/preview-outbox-contract.sdk.js',code);
