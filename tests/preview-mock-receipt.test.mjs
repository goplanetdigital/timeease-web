import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import vm from 'node:vm';
import ts from 'typescript';
import * as crypto from 'node:crypto';
function load(path,cache=new Map()){
 path=resolve(path.replace(/\.ts$/,'')+'.ts');if(cache.has(path))return cache.get(path);const exports={};cache.set(path,exports);
 vm.runInNewContext(ts.transpileModule(readFileSync(path,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,Buffer,require:n=>n==='node:crypto'?crypto:n.startsWith('.')?load(resolve(dirname(path),n),cache):(()=>{throw Error('I_O_FORBIDDEN');})()});return exports;
}
const m=load('lib/preview-mock-delivery'),f=load('lib/preview-order-fixture');
test('new mock inbox accepts only the exact fixed synthetic row binding',()=>{
 const row={intake_id:m.MOCK_DELIVERY_ID,shopify_order_id:'preview-pr20-mock-20261108:'+m.MOCK_DELIVERY_ID,shopify_shop_domain:'preview.invalid',variant_id:'synthetic-invoice',amount_usd:1,customer_email:m.MOCK_DELIVERY_RECIPIENT,source_manifest_path:'intake-v2/'+m.MOCK_DELIVERY_ID+'/manifest.json'};
 assert.equal(f.fixtureMatches(row,m.MOCK_DELIVERY_CASE),true);
 for(const patch of [{customer_email:'customer@example.com'},{intake_id:'another-id'},{shopify_order_id:'1033'}])assert.equal(f.fixtureMatches({...row,...patch},m.MOCK_DELIVERY_CASE),false);
});
test('synthetic provider receipt cannot bind to another delivery UUID or a real receipt',()=>{
 const delivery='550e8400-e29b-41d4-a716-446655440001',other='550e8400-e29b-41d4-a716-446655440002';
 const receipt=crypto.createHash('sha256').update('mock-provider:'+delivery).digest('hex');
 assert.equal(m.mockReceiptMatches(delivery,receipt),true);assert.equal(m.mockReceiptMatches(other,receipt),false);assert.equal(m.mockReceiptMatches(delivery,'abcdef0123456789'),false);assert.equal(m.mockReceiptMatches('1033',receipt),false);
});
