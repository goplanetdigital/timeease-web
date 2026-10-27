import {NextRequest,NextResponse} from 'next/server';
import {POST as orderPost} from '../test-worker/order-e2e/route';
import {previewOrderEnvironment,ORDER_FIXTURES,TEST_RECIPIENT} from '../../../lib/preview-order-fixture';
export const runtime='nodejs';
export const dynamic='force-dynamic';
const ACTIONS=['status','prepare','claim','source','result','delivered','review','recover','cleanup'];
const reply=(body:unknown,status:number)=>NextResponse.json(body,{status,headers:{'Cache-Control':'no-store'}});
/** Explicit operator delegation under Deployment Protection. Never a general HTTP proxy.
 * No SQL INSERT, email, payment, external HTTP, caller-selected ID/path/recipient/credential.
 * The unchanged auth-only probe remains separate. A public nonce is correlation, not auth.
 */
export async function POST(req:NextRequest){
 const env=process.env;
 if(!previewOrderEnvironment(env,new URL(req.url).hostname))return reply({error:'PREVIEW_TEST_ONLY'},404);
 if(req.headers.get('origin')!==`https://${env.VERCEL_URL}`||req.headers.get('sec-fetch-site')!=='same-origin')
  return reply({error:'SAME_ORIGIN_REQUIRED'},403);
 if(req.headers.get('content-type')!=='application/x-www-form-urlencoded')return reply({error:'FORM_REQUIRED'},415);
 const length=req.headers.get('content-length');
 if(length&&(!/^\d+$/.test(length)||Number(length)>2000000))return reply({error:'INVALID_FORM'},413);
 if(!req.body)return reply({error:'INVALID_FORM'},400);
 const reader=req.body.getReader();const chunks:Buffer[]=[];let size=0;
 try{
  while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;
   if(size>2000000)return reply({error:'INVALID_FORM'},413);chunks.push(Buffer.from(value));}
 }catch{return reply({error:'INVALID_FORM'},400);}
 finally{await reader.cancel().catch(()=>{});}
 const form=new URLSearchParams(Buffer.concat(chunks,size).toString('utf8'));
 const keys=['confirm','nonce','action','case','payload','receiptReviewed'];
 if([...form.keys()].some(k=>!keys.includes(k))||keys.some(k=>form.getAll(k).length!==1))
  return reply({error:'INVALID_FORM'},400);
 const action=form.get('action')!,kind=form.get('case')!,nonce=form.get('nonce')!,payload=form.get('payload')!;
 if(form.get('confirm')!=='preview-fixed-order-only'||!ACTIONS.includes(action)||!['delivery','failure'].includes(kind)||
  !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(nonce)||
  !['no','yes'].includes(form.get('receiptReviewed')!)||
  (action==='recover'&&kind!=='failure')||(!['result','delivered'].includes(action)&&payload!==''))
  return reply({error:'INVALID_FORM'},400);
 if(action==='delivered'&&(kind!=='delivery'||form.get('receiptReviewed')!=='yes'||!/^[a-f0-9]{10,64}$/i.test(payload)))
  return reply({error:'CURRENT_RUN_RECEIPT_REVIEW_REQUIRED'},400);
 if(action==='result'&&(kind!=='delivery'||payload.length>1400000||!payload||
  Buffer.from(payload,'base64').toString('base64')!==payload))return reply({error:'INVALID_XLSX'},400);
 const secret=env.TIMEEASE_TEST_WORKER_SECRET;
 if(!secret||secret.length<32)return reply({error:'TEST_AUTH_MISSING'},503);
 const body={action,case:kind,...(action==='result'?{xlsxBase64:payload}:{}),...(action==='delivered'?{messageId:payload}:{})};
 try{
  const result=await orderPost(new NextRequest(`https://${env.VERCEL_URL}/api/test-worker/order-e2e`,{
   method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${secret}`},body:JSON.stringify(body)}));
  if(![200,201].includes(result.status))return reply({error:'ORDER_ACTION_REJECTED',action,case:kind,requestNonce:nonce,
   workerStatus:result.status},[400,409,413,415,503].includes(result.status)?result.status:503);
  const data=await result.json(),id=ORDER_FIXTURES[kind as keyof typeof ORDER_FIXTURES];
  if(data.synthetic!==true||data.productionTokenUsed!==false)throw Error('UNEXPECTED_RESPONSE');
  let safe:Record<string,unknown>;
  switch(action){
   case 'status':
    if(data.intakeId!==id||!['PAID','PROCESSING','DELIVERED','REVIEW_REQUIRED'].includes(data.status)||
     !Number.isInteger(data.processingAttempts)||data.processingAttempts<0||
     !(data.resultPath===null||data.resultPath===`results-v2/${id}/consolidated.xlsx`)||
     !(data.deliveryMessageId===null||typeof data.deliveryMessageId==='string'&&/^[a-f0-9]{10,64}$/i.test(data.deliveryMessageId)))throw Error('UNEXPECTED_RESPONSE');
    safe={intakeId:id,status:data.status,processingAttempts:data.processingAttempts,resultPath:data.resultPath,
     deliveryMessageId:data.deliveryMessageId};break;
   case 'claim':
    if(data.status!=='CLAIMED'||data.job?.intake_id!==id||data.job.processing_attempts!==1)throw Error('UNEXPECTED_RESPONSE');
    safe={intakeId:id,status:'CLAIMED',processingAttempts:1};break;
   case 'source':
    if(data.intakeId!==id||data.recipient!==TEST_RECIPIENT||typeof data.pdfBase64!=='string'||data.pdfBase64.length>16000)
     throw Error('UNEXPECTED_RESPONSE');
    safe={intakeId:id,pdfBase64:data.pdfBase64,recipient:TEST_RECIPIENT};break;
   case 'prepare':
    if(data.prepared!==true||data.intakeId!==id)throw Error('UNEXPECTED_RESPONSE');safe={intakeId:id,prepared:true};break;
   case 'result':
    if(result.status!==201||data.resultReady!==true||data.readBackVerified!==true)throw Error('UNEXPECTED_RESPONSE');
    safe={resultReady:true,readBackVerified:true};break;
   case 'delivered':
    if(data.delivered!==true||data.providerReceiptRequiresExternalVerification!==true)throw Error('UNEXPECTED_RESPONSE');
    safe={delivered:true,providerReceiptRequiresExternalVerification:true};break;
   case 'review':
    if(data.reviewRequired!==true)throw Error('UNEXPECTED_RESPONSE');safe={reviewRequired:true};break;
   case 'recover':
    if(data.recovered!==true||data.noAutoRetry!==true||data.noEmailSent!==true)throw Error('UNEXPECTED_RESPONSE');
    safe={recovered:true,noAutoRetry:true};break;
   case 'cleanup':
    if(data.cleanupVerified!==true)throw Error('UNEXPECTED_RESPONSE');safe={cleanupVerified:true};break;
   default:throw Error('UNEXPECTED_RESPONSE');
  }
  return reply({synthetic:true,productionTokenUsed:false,environment:'preview',branch:env.VERCEL_GIT_COMMIT_REF,
   commit:env.VERCEL_GIT_COMMIT_SHA,deploymentHost:env.VERCEL_URL,action,case:kind,requestNonce:nonce,
   transport:'protected-browser-post-with-in-process-bearer-verification',externalWorkerHttpVerified:false,emailSent:false,...safe},result.status);
 }catch{return reply({error:'ORDER_CONSOLE_UNAVAILABLE',action,case:kind,requestNonce:nonce},503);}
}
