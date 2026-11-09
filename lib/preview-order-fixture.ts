import {isIsolatedPreview,isAllowedTestRecipient} from './test-worker-guards';
import {MOCK_DELIVERY_CASE,MOCK_DELIVERY_ID,MOCK_DELIVERY_RECIPIENT} from './preview-mock-delivery';
export const PREVIEW_ORDER_BRANCH='feature/isolated-worker-diagnostics-20261026';
export const TEST_RECIPIENT='jcaiworker@gmail.com';
export const ORDER_FIXTURES={
 delivery:'d7438959-82c2-4d9a-959c-b065ecc12720',
 failure:'5b6b7ad4-3ff3-409c-a584-d47c6d77ca97',
 race:'29a22afd-a1d7-47d2-b97b-03d2a3eaa0c8',
 reservation:'37a129e0-e879-4f6a-b306-3c112afd3d5a',
 delivery_v2:'6b2322d8-c7a0-45ff-9ab3-082e2684a067',
 outbox_persist:'b8f0b839-e0ff-4ef5-bf90-c32513c83fbf',
 outbox_failure:'712fb48a-03e8-470f-82fe-e8a5dbe12b7e',
 outbox_timeout:'52c899ce-3ea0-4d03-b9df-7e5ae2d83d99',
 outbox_mock_delivery:MOCK_DELIVERY_ID,
} as const;
export type PreviewFixtureCase=keyof typeof ORDER_FIXTURES;
export function isPreviewFixtureCase(value:unknown):value is PreviewFixtureCase{
 return typeof value==='string'&&Object.prototype.hasOwnProperty.call(ORDER_FIXTURES,value);
}
export function isFreshPreviewFixture(kind:PreviewFixtureCase):boolean{
 return kind==='race'||kind==='reservation'||kind==='delivery_v2';
}
export function isOutboxPreviewFixture(kind:PreviewFixtureCase):boolean{
 return kind==='outbox_persist'||kind==='outbox_failure'||kind==='outbox_timeout'||kind===MOCK_DELIVERY_CASE;
}
export function isRecoveryPreviewFixture(id:string):boolean{
 return [ORDER_FIXTURES.failure,ORDER_FIXTURES.race,ORDER_FIXTURES.delivery_v2].some(fixed=>fixed===id);
}
/** Auth-only probes never access the payment ledger; its flag must not gate them. */
export function previewAuthEnvironment(env:Record<string,string|undefined>,hostname:string):boolean{
 return env.VERCEL_ENV==='preview'&&env.TIMEEASE_ISOLATED_TEST_MODE==='true'&&
  env.TIMEEASE_V2_CHECKOUT_ENABLED==='false'&&env.VERCEL_GIT_COMMIT_REF===PREVIEW_ORDER_BRANCH&&
  Boolean(env.VERCEL_URL)&&hostname===env.VERCEL_URL&&
  isAllowedTestRecipient(TEST_RECIPIENT,env.TIMEEASE_TEST_ALLOWED_RECIPIENT);
}
export function previewOrderEnvironment(env:Record<string,string|undefined>,hostname:string):boolean{
 return isIsolatedPreview(env)&&previewAuthEnvironment(env,hostname);
}
export function fixtureMatches(row:Record<string,unknown>,kind:keyof typeof ORDER_FIXTURES):boolean{
 const id=ORDER_FIXTURES[kind];
 const reference=kind===MOCK_DELIVERY_CASE?`preview-pr20-mock-20261108:${id}`:isOutboxPreviewFixture(kind)
  ?`preview-pr20-outbox-20261107:${kind}:${id}`
  :isFreshPreviewFixture(kind)
  ?`preview-pr20-20261106-r1:${kind==='delivery_v2'?'delivery':kind}:${id}`
  :`preview-e2e:${kind}:${id}`;
 return row.intake_id===id&&row.shopify_order_id===reference&&
  row.shopify_shop_domain==='preview.invalid'&&row.variant_id==='synthetic-invoice'&&
  Number(row.amount_usd)===1&&row.customer_email===(kind===MOCK_DELIVERY_CASE?MOCK_DELIVERY_RECIPIENT:TEST_RECIPIENT)&&
  row.source_manifest_path===`intake-v2/${id}/manifest.json`;
}
/** Same small synthetic invoice format as the existing n8n PDF acceptance fixture. */
export function syntheticInvoicePdf():Buffer{
 const lines=['INVOICE TEST-004','Supplier: Sample Supplier','Invoice Number: TEST-004',
  'Date: 2026-10-27','Currency: USD','Item: Sample service, quantity 2, unit price 4.50, amount 9.00',
  'Subtotal: USD 9.00','Tax: USD 0.00','Total: USD 9.00'];
 const escape=(s:string)=>s.replace(/[\\()]/g,c=>'\\'+c);
 const stream='BT /F1 12 Tf 16 TL 50 750 Td '+lines.map((s,i)=>(i?'T* ':'')+'('+escape(s)+') Tj').join(' ')+' ET';
 const objects=['<< /Type /Catalog /Pages 2 0 R >>','<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
  '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
  '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',`<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`];
 let pdf='%PDF-1.4\n';const offsets=[0];
 for(let i=0;i<objects.length;i++){offsets.push(Buffer.byteLength(pdf));pdf+=`${i+1} 0 obj\n${objects[i]}\nendobj\n`;}
 const xref=Buffer.byteLength(pdf);pdf+=`xref\n0 ${objects.length+1}\n0000000000 65535 f \n`;
 for(const offset of offsets.slice(1))pdf+=String(offset).padStart(10,'0')+' 00000 n \n';
 pdf+=`trailer\n<< /Size ${objects.length+1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
 return Buffer.from(pdf);
}

