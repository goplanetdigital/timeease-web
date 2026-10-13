import {strict as assert} from "node:assert";
import {test} from "node:test";
import {calculateQuote} from "../lib/upload-first-pricing.ts";

test("consolidation: 1-10 PDFs cost $9, then $1 each additional PDF",()=>{
 for(const [count,expected] of [[1,9],[3,9],[10,9],[11,10],[100,99]]){
  assert.equal(calculateQuote({service:"consolidation",fileCount:count}).amountUsd,expected);
 }
});
test("invoice package prices",()=>{
 for(const [tier,price] of [["basic",9],["complex",39],["batch",99]] as const){
  assert.equal(calculateQuote({service:"invoice",fileCount:1,tier}).amountUsd,price);
 }
});
test("catalogue row brackets",()=>{
 for(const [rows,price] of [[1,19],[100,19],[101,39],[500,39],[501,79],[2000,79]]){
  assert.equal(calculateQuote({service:"catalogue",fileCount:1,catalogueRows:rows}).amountUsd,price);
 }
});
test("resume package prices",()=>{
 assert.equal(calculateQuote({service:"resume",fileCount:1,tier:"resume"}).amountUsd,19);
 assert.equal(calculateQuote({service:"resume",fileCount:1,tier:"full"}).amountUsd,39);
});
test("invalid or unsupported quantities cannot receive a quote",()=>{
 assert.throws(()=>calculateQuote({service:"consolidation",fileCount:0}));
 assert.throws(()=>calculateQuote({service:"consolidation",fileCount:101}));
 assert.throws(()=>calculateQuote({service:"catalogue",fileCount:1,catalogueRows:2001}));
 assert.throws(()=>calculateQuote({service:"invoice",fileCount:2,tier:"basic"}));
});
