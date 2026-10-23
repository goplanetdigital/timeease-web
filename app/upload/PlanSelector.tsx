"use client";
import {useState,type ChangeEvent} from "react";

export default function PlanSelector(){
 const [files,setFiles]=useState<File[]>([]);
 const [tier,setTier]=useState<"basic"|"complex"|"batch">("basic");
 const [busy,setBusy]=useState(false);
 const [message,setMessage]=useState("");
 const [quote,setQuote]=useState("");
 const onFiles=(e:ChangeEvent<HTMLInputElement>)=>{setFiles(Array.from(e.target.files||[]));setMessage("");setQuote("");};
 async function submit(){
  if(!files.length){setMessage("Choose at least one PDF invoice first.");return;}
  setBusy(true);setMessage("");setQuote("");
  try{
   const form=new FormData();form.set("service","invoice");form.set("tier",tier);
   for(const f of files)form.append("files",f);
   const res=await fetch("/api/intake",{method:"POST",body:form,cache:"no-store"});
   const data=await res.json();
   if(!res.ok)throw new Error(data.error||"Upload failed");
   setQuote("US$"+String(data.quote?.amountUsd??""));
   setMessage("Your files were uploaded securely. Payment is temporarily unavailable while we verify automatic delivery. No payment has been taken.");
  }catch(err){setMessage(err instanceof Error?err.message:"Upload failed");}
  finally{setBusy(false);}
 }
 return <section className="plan-checker">
  <div className="eyebrow">Upload first · Secure processing</div>
  <h2>Upload your invoice PDF</h2>
  <p>Select your files first. TimeEase checks the upload and calculates the price before payment.</p>
  <div className="plan-question"><strong>PDF invoice files (maximum 100 files, 3 MB total)</strong>
   <input type="file" accept=".pdf,application/pdf" multiple onChange={onFiles} aria-label="Select invoice PDF files"/>
   <p>{files.length?files.length+" file(s) selected":"No files selected"}</p>
  </div>
  <div className="plan-question"><strong>Processing level</strong>
   <div className="choice-row">
    {(["basic","complex","batch"] as const).map(x=><button key={x} type="button" className={tier===x?"choice active":"choice"} onClick={()=>setTier(x)}>{x[0].toUpperCase()+x.slice(1)}</button>)}
   </div>
  </div>
  <div className="plan-result"><div><span className="card-kicker">Upload and quote</span><h2>{quote||"Price calculated after upload"}</h2><p>Payment remains disabled until end-to-end delivery is verified.</p></div>
   <button type="button" className="button primary" disabled={busy||!files.length} onClick={submit}>{busy?"Uploading...":"Upload & calculate price →"}</button>
  </div>
  {message&&<p className="note" role="status">{message}</p>}
 </section>;
}
