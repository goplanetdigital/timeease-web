"use client";
import {useMemo,useState} from "react";
import {calculateQuote,type TimeEaseService} from "../../lib/upload-first-pricing";
export default function UploadFirstForm(){
 const [service,setService]=useState<TimeEaseService>("consolidation");
 const [files,setFiles]=useState<File[]>([]);
 const [tier,setTier]=useState<"basic"|"complex"|"batch"|"resume"|"full">("basic");
 const [rows,setRows]=useState(100);
 const [error,setError]=useState("");
 const [saved,setSaved]=useState<{id:string;amount:number}|null>(null);
 const [busy,setBusy]=useState(false);
 const [checkoutBusy,setCheckoutBusy]=useState(false);
 const [checkoutReady,setCheckoutReady]=useState(false);
 const quote=useMemo(()=>{try{return calculateQuote({service,fileCount:files.length,catalogueRows:rows,tier})}catch{return null}},[service,files,rows,tier]);
 function onFiles(list:FileList|null){setSaved(null);setCheckoutReady(false);setError("");const next=Array.from(list??[]);if(next.length>100){setError("Maximum 100 files.");return;}const allowed=service==="invoice"||service==="consolidation"?[".pdf"]:service==="catalogue"?[".csv",".xlsx"]:[".pdf",".docx",".txt"];if(next.some(f=>!allowed.some(ext=>f.name.toLowerCase().endsWith(ext)))){setError("Unsupported file type for this service.");return;}if(next.reduce((sum,f)=>sum+f.size,0)>3*1024*1024){setError("Total upload size must be under 3MB. Larger files are not supported yet.");setFiles([]);return;}setFiles(next)}
 async function save(){if(!quote||busy)return;setBusy(true);setError("");setSaved(null);try{const body=new FormData();body.append("service",service);body.append("tier",tier);body.append("catalogueRows",String(rows));files.forEach(f=>body.append("files",f));const response=await fetch("/api/intake",{method:"POST",body});const result=await response.json();if(!response.ok)throw new Error(result.error||"Upload failed");setSaved({id:result.id,amount:result.quote.amountUsd});setCheckoutReady(Boolean(result.checkoutReady))}catch(e){setError(e instanceof Error?e.message:"Upload failed")}finally{setBusy(false)}}
 async function checkout(){if(!saved||checkoutBusy)return;setCheckoutBusy(true);setError("");try{const response=await fetch("/api/checkout",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({id:saved.id})});const result=await response.json();if(!response.ok)throw new Error(result.error==="CHECKOUT_NOT_YET_ENABLED"?"Secure checkout is not available yet. Your uploaded files are saved.":result.error||"Checkout unavailable");if(typeof result.checkoutUrl!=="string"||!result.checkoutUrl.startsWith("https://"))throw new Error("Invalid checkout URL");window.location.assign(result.checkoutUrl)}catch(e){setError(e instanceof Error?e.message:"Checkout unavailable")}finally{setCheckoutBusy(false)}}
 return <section className="plan-checker" aria-label="Upload-first order">
  <div className="eyebrow">Step 1 · Select service</div>
  <label htmlFor="service">What do you need?</label>
  <select id="service" value={service} onChange={e=>{setService(e.target.value as TimeEaseService);setTier(e.target.value==="resume"?"resume":"basic");setFiles([]);setSaved(null);setError("")}}>
   <option value="invoice">Invoice / PDF to Excel</option><option value="consolidation">Multiple Invoices to One Excel</option><option value="catalogue">Shopify Catalogue Fixer</option><option value="resume">Resume & Job Application Pack</option>
  </select>
  {(service==="invoice"||service==="resume")&&<div className="plan-question"><label htmlFor="tier">Package</label><select id="tier" value={tier} onChange={e=>{setTier(e.target.value as typeof tier);setSaved(null);setCheckoutReady(false)}}>{service==="invoice"?<><option value="basic">Basic · US$9</option><option value="complex">Complex · US$39</option><option value="batch">Batch · US$99</option></>:<><option value="resume">Resume · US$19</option><option value="full">Resume + Cover Letter + Email · US$39</option></>}</select></div>}
  {service==="catalogue"&&<div className="plan-question"><label htmlFor="rows">Catalogue rows (estimate)</label><input id="rows" type="number" min="1" max="2000" value={rows} onChange={e=>{setRows(Number(e.target.value));setSaved(null);setCheckoutReady(false)}}/></div>}
  <div className="plan-question"><label htmlFor="files">Step 2 · Choose files</label><input id="files" type="file" multiple={service==="consolidation"} accept={service==="invoice"||service==="consolidation"?".pdf":service==="catalogue"?".csv,.xlsx":".pdf,.docx,.txt"} onChange={e=>onFiles(e.target.files)}/><p>{files.length} file(s) selected · Maximum 3MB total for this preview</p></div>
  {error&&<p role="alert">{error}</p>}
  <div className="plan-result"><div><span className="card-kicker">Step 3 · Price</span><h2>{quote?"US$"+quote.amountUsd:"Select valid files"}</h2><p>{quote?.variantLabel||"Select files to calculate price"}</p></div><button className="button primary" type="button" disabled={!quote||busy||!!saved} onClick={save}>{busy?"Saving securely…":saved?"Upload saved":"Save files securely"}</button></div>
  {saved&&<div role="status"><p>Upload saved. Reference: <strong>{saved.id}</strong>. Price: US${saved.amount}. No second upload required.</p>{!checkoutReady&&<p>Secure checkout is not yet enabled. Your files are saved; no payment has been taken.</p>}<button className="button primary" type="button" onClick={checkout} disabled={checkoutBusy||!checkoutReady}>{checkoutBusy?"Checking secure checkout…":"Continue to secure checkout"}</button></div>}
  <p className="note">Files are stored privately. Payment remains disabled until Shopify checkout and verified payment callbacks are connected. Uploading does not charge you.</p>
 </section>
}
