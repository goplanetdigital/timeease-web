import {createHash,timingSafeEqual} from 'node:crypto';
import {NextRequest,NextResponse} from 'next/server';
import {head} from '@vercel/blob';
import {blobAccessOptions} from '../../../../lib/blob-access';
import {productionReleaseBound,acceptingProductionWork,productionSendEnabled} from '../../../../lib/production-release';
import {withProductionOrder} from '../../../../lib/production-database';
import {reportProductionDelivery,type DeliveryReport} from '../../../../lib/production-delivery';
export const runtime='nodejs';
const reply=(body:unknown,status:number)=>NextResponse.json(body,{status,headers:{'Cache-Control':'no-store'}});
export async function POST(req:NextRequest){
 if(!productionReleaseBound())return reply({error:'PRODUCTION_RELEASE_CLOSED',send:false},503);
 const secret=process.env.TIMEEASE_V2_WORKER_SECRET,auth=req.headers.get('authorization')||'';
 if(!secret||secret.length<32)return reply({error:'WORKER_NOT_CONFIGURED'},503);
 if(!auth.startsWith('Bearer ')||auth.length>519||!timingSafeEqual(createHash('sha256').update(auth.slice(7)).digest(),createHash('sha256').update(secret).digest()))return reply({error:'UNAUTHORIZED'},401);
 let raw='';if(!req.body)return reply({error:'INVALID_JSON'},400);
 const reader=req.body.getReader();const decoder=new TextDecoder();let size=0;
 while(true){const r=await reader.read();if(r.done)break;size+=r.value.byteLength;
  if(size>4096){await reader.cancel();return reply({error:'REQUEST_TOO_LARGE'},413);}raw+=decoder.decode(r.value,{stream:true});}
 raw+=decoder.decode();let b:DeliveryReport;
 try{b=JSON.parse(raw);}catch{return reply({error:'INVALID_JSON'},400);}
 if(!b||typeof b!=='object'||Array.isArray(b)||typeof b.intakeId!=='string'||
  !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(b.intakeId)||
  Object.keys(b).some(k=>!['intakeId','action','resultPath','deliveryId','messageId'].includes(k)))return reply({error:'INVALID_REPORT'},400);
 if(b.action==='result_ready'&&!acceptingProductionWork())return reply({error:'NEW_WORK_FROZEN',send:false},503);
 try{
  const result=await withProductionOrder(b.intakeId,(client,held)=>reportProductionDelivery(b,client,held,productionSendEnabled(),async path=>{
   try{const stored=await head(path,await blobAccessOptions(process.env));return stored.size>0&&stored.size<=20*1024*1024&&
    stored.contentType==='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';}catch{return false;}
  }));
  return reply(result.body,result.status);
 }catch{return reply({error:'OUTBOX_REPORT_UNAVAILABLE',send:false},503);}
}
