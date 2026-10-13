import {put,del} from "@vercel/blob";
import {NextRequest,NextResponse} from "next/server";
import {calculateQuote,type TimeEaseService} from "../../../lib/upload-first-pricing";
export const runtime="nodejs";
const ACCEPT:Record<TimeEaseService,string[]>={invoice:[".pdf"],consolidation:[".pdf"],catalogue:[".csv",".xlsx"],resume:[".pdf",".docx",".txt"]};
export async function POST(req:NextRequest){
 try{
  if(!process.env.BLOB_READ_WRITE_TOKEN)return NextResponse.json({error:"STORAGE_NOT_CONFIGURED"},{status:503});
  const form=await req.formData();
  const service=String(form.get("service")||"") as TimeEaseService;
  if(!Object.hasOwn(ACCEPT,service))return NextResponse.json({error:"INVALID_SERVICE"},{status:400});
  const files=form.getAll("files");
  if(!files.length||files.length>100||files.some(f=>!(f instanceof File)))return NextResponse.json({error:"INVALID_FILE_COUNT"},{status:400});
  const docs=files as File[];
  if(docs.some(f=>!f.size||f.size>4*1024*1024||!ACCEPT[service].some(ext=>f.name.toLowerCase().endsWith(ext))))return NextResponse.json({error:"INVALID_FILE"},{status:400});
  // Keep under Vercel function request body limits; larger jobs require direct client uploads.
  if(docs.reduce((n,f)=>n+f.size,0)>3*1024*1024)return NextResponse.json({error:"UPLOAD_TOO_LARGE_MAX_3MB"},{status:413});
  // Check file signatures, not only user-controlled names or MIME types.
  for(const file of docs){
   const extension=file.name.toLowerCase().split(".").pop();
   const bytes=new Uint8Array(await file.slice(0,8).arrayBuffer());
   const ascii=String.fromCharCode(...bytes);
   if(extension==="pdf"&&!ascii.startsWith("%PDF-"))return NextResponse.json({error:"INVALID_PDF_SIGNATURE"},{status:400});
   if(extension==="xlsx"&&!(bytes[0]===0x50&&bytes[1]===0x4b))return NextResponse.json({error:"INVALID_XLSX_SIGNATURE"},{status:400});
   if(extension==="docx"&&!(bytes[0]===0x50&&bytes[1]===0x4b))return NextResponse.json({error:"INVALID_DOCX_SIGNATURE"},{status:400});
  }
  const tier=String(form.get("tier")||"") as "basic"|"complex"|"batch"|"resume"|"full";
  const catalogueRows=Number(form.get("catalogueRows"));
  const quote=calculateQuote({service,fileCount:docs.length,tier,catalogueRows});
  const id=crypto.randomUUID();
  const prefix="intake-v2/"+id+"/";
  const stored:{pathname:string;bytes:number;originalName:string}[]=[];
  try{
  for(let i=0;i<docs.length;i++){
   const file=docs[i];
   const suffix=file.name.toLowerCase().split(".").pop();
   const blob=await put(prefix+"file-"+String(i+1).padStart(3,"0")+"."+suffix,file,{access:"private",addRandomSuffix:false,contentType:"application/octet-stream",token:process.env.BLOB_READ_WRITE_TOKEN});
   stored.push({pathname:blob.pathname,bytes:file.size,originalName:file.name});
  }
  const manifest={id,service,quote,files:stored,status:"AWAITING_PAYMENT",createdAt:new Date().toISOString(),checkoutOrderId:null};
  await put(prefix+"manifest.json",JSON.stringify(manifest),{access:"private",addRandomSuffix:false,contentType:"application/json",token:process.env.BLOB_READ_WRITE_TOKEN});
  }catch(uploadError){
   // Do not retain a partial batch if the manifest or any document fails to save.
   if(stored.length){try{await del(stored.map(f=>f.pathname),{token:process.env.BLOB_READ_WRITE_TOKEN});}catch(cleanupError){console.error("timeease_intake_cleanup_failed",cleanupError instanceof Error?cleanupError.message:"unknown");}}
   throw uploadError;
  }
  return NextResponse.json({id,quote,status:"AWAITING_PAYMENT",checkoutReady:false},{status:201,headers:{"Cache-Control":"no-store"}});
 }catch(e){const message=e instanceof Error?e.message:"UPLOAD_FAILED";const expected=/^(INVALID_|SELECT_|USE_|TOO_MANY_|UNSUPPORTED_)/.test(message);console.error("timeease_intake_failure",message);return NextResponse.json({error:expected?message:"UPLOAD_FAILED"},{status:expected?400:500})}
}
