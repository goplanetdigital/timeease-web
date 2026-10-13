"use client";
import {useMemo,useState} from "react";
import {calculateQuote,type TimeEaseService} from "../../lib/upload-first-pricing";
export default function UploadFirstForm(){
 const [service,setService]=useState<TimeEaseService>("consolidation");
 const [files,setFiles]=useState<File[]>([]);
 const [tier,setTier]=useState<"basic"|"complex"|"batch"|"resume"|"full">("basic");
 const [rows,setRows]=useState(100);
 const [error,setError]=useState("");
 const quote=useMemo(()=>{try{return calculateQuote({service,fileCount:files.length,catalogueRows:rows,tier})}catch{return null}},[service,files,rows,tier]);
 function onFiles(list:FileList|null){setError("");const next=Array.from(list??[]);if(next.length>100){setError("Maximum 100 files.");return;}const allowed=service==="invoice"||service==="consolidation"?[".pdf"]:service==="catalogue"?[".csv",".xlsx"]:[".pdf",".docx",".txt"];if(next.some(f=>!allowed.some(ext=>f.name.toLowerCase().endsWith(ext)))){setError("Unsupported file type for this service.");return;}setFiles(next)}
 return <section className="plan-checker" aria-label="Upload-first order">
  <div className="eyebrow">Step 1 · Select service</div>
  <label htmlFor="service">What do you need?</label>
  <select id="service" value={service} onChange={e=>{setService(e.target.value as TimeEaseService);setFiles([]);setError("")}}>
   <option value="invoice">Invoice / PDF to Excel</option>
   <option value="consolidation">Multiple Invoices to One Excel</option>
   <option value="catalogue">Shopify Catalogue Fixer</option>
   <option value="resume">Resume & Job Application Pack</option>
  </select>
  {(service==="invoice"||service==="resume")&&<div className="plan-question"><label htmlFor="tier">Package</label><select id="tier" value={service==="resume"?(tier==="full"?"full":"resume"):(["basic","complex","batch"].includes(tier)?tier:"basic")} onChange={e=>setTier(e.target.value as typeof tier)}>{service==="invoice"?<><option value="basic">Basic · US$9</option><option value="complex">Complex · US$39</option><option value="batch">Batch · US$99</option></>:<><option value="resume">Resume · US$19</option><option value="full">Resume + Cover Letter + Email · US$39</option></>}</select></div>}
  {service==="catalogue"&&<div className="plan-question"><label htmlFor="rows">Catalogue rows (estimate; verified before payment)</label><input id="rows" type="number" min="1" max="2000" value={rows} onChange={e=>setRows(Number(e.target.value))}/></div>}
  <div className="plan-question"><label htmlFor="files">Step 2 · Choose your files</label><input id="files" type="file" multiple={service==="consolidation"} accept={service==="invoice"||service==="consolidation"?".pdf":service==="catalogue"?".csv,.xlsx":".pdf,.docx,.txt"} onChange={e=>onFiles(e.target.files)}/><p>{files.length} file(s) selected</p></div>
  {error&&<p role="alert">{error}</p>}
  <div className="plan-result"><div><span className="card-kicker">Step 3 · Price preview</span><h2>{quote?"US$"+quote.amountUsd:"Select valid files to calculate price"}</h2><p>{quote?.variantLabel||"Files must be securely saved before checkout."}</p></div><button className="button primary" type="button" disabled title="Secure upload and verified Shopify checkout are being connected">Secure checkout coming soon</button></div>
  <p className="note">Preview only: selecting files does not upload them. Payment remains disabled until secure upload, order linking, and payment verification are tested. No second upload will be required in the finished flow.</p>
 </section>
}
