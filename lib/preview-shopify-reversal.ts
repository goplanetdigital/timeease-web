import {createHmac,timingSafeEqual,createHash} from 'node:crypto';
import {previewOrderEnvironment} from './preview-order-fixture';
// Public synthetic signing fixture, never a Live secret or an authorization key.
// Existing Preview bearer + Deployment Protection remain independently required.
export const FIXTURE_SIGNING_KEY='timeease-preview-reversal-public-fixture-v1';
export const REVERSAL_LOGIN='timeease_preview_reversal_20261108';
export const REVERSAL_FIXTURES={
 'orders/cancelled':{intakeId:'831a428d-fb7b-4dfc-a025-0486478c4201',orderId:'900000001108001',reason:'CANCELLED'},
 'refunds/create':{intakeId:'831a428d-fb7b-4dfc-a025-0486478c4202',orderId:'900000001108002',reason:'REFUNDED'},
} as const;
export function reversalPayload(topic:keyof typeof REVERSAL_FIXTURES):string{
 const f=REVERSAL_FIXTURES[topic];
 return JSON.stringify(topic==='refunds/create'?{id:'900000001108003',order_id:f.orderId,synthetic:'preview-pr20-reversal-20261108'}:{id:f.orderId,test:false,synthetic:'preview-pr20-reversal-20261108'});
}
export function reversalEnvironment(env:Record<string,string|undefined>,host:string):boolean{
 return previewOrderEnvironment(env,host)&&env.VERCEL_PROJECT_ID===env.TIMEEASE_PREVIEW_PROJECT_ID&&Boolean(env.TIMEEASE_PREVIEW_PROJECT_ID);
}
export function reversalBearer(auth:string,secret:string|undefined):boolean{
 return Boolean(secret&&secret.length>=32&&auth.startsWith('Bearer ')&&auth.length<=519&&timingSafeEqual(createHash('sha256').update(auth.slice(7)).digest(),createHash('sha256').update(secret).digest()));
}
export function reversalSignature(raw:string,signature:string|null):boolean{
 if(!signature||!/^[A-Za-z0-9+/]{43}=$/.test(signature))return false;
 const expected=createHmac('sha256',FIXTURE_SIGNING_KEY).update(raw,'utf8').digest();
 const supplied=Buffer.from(signature,'base64');return supplied.length===expected.length&&timingSafeEqual(expected,supplied);
}
