import {createHash,timingSafeEqual} from "node:crypto";
import {NextRequest,NextResponse} from "next/server";
import {previewAuthEnvironment} from "../../../lib/preview-order-fixture";
import {diagnoseDedicatedWorkerDatabaseUrl,WorkerDatabaseUrlDiagnostic} from "../../../lib/worker-database-url";

export const runtime="nodejs";
export const dynamic="force-dynamic";
const reply=(body:unknown,status:number)=>NextResponse.json(body,{status,headers:{"Cache-Control":"no-store"}});
const CODES=["WORKER_DATABASE_URL_MISSING","WORKER_DATABASE_URL_MALFORMED","WORKER_DATABASE_PROTOCOL_INVALID","WORKER_DATABASE_ROLE_MISMATCH","WORKER_DATABASE_PASSWORD_MISSING","WORKER_DATABASE_URL_ACCEPTED"];
const FLAGS=["dedicatedUrlPresent","urlParsed","postgresProtocol","usernameMatchesLimitedRole","passwordPresent"] as const;

function diagnostic(env:NodeJS.ProcessEnv):WorkerDatabaseUrlDiagnostic{
 return diagnoseDedicatedWorkerDatabaseUrl(env.TIMEEASE_WORKER_DATABASE_URL);
}
function accepted(data:unknown):data is WorkerDatabaseUrlDiagnostic{
 if(!data||typeof data!=="object")return false;
 const value=data as Record<string,unknown>;
 return FLAGS.every(key=>typeof value[key]==="boolean")&&typeof value.code==="string"&&CODES.includes(value.code)&&Object.keys(value).every(key=>FLAGS.includes(key as typeof FLAGS[number])||key==="code");
}
function authorize(req:NextRequest,secret:string|undefined):NextResponse|null{
 if(!secret||secret.length<32)return reply({error:"WORKER_NOT_CONFIGURED"},503);
 const auth=req.headers.get("authorization")||"";
 if(!auth.startsWith("Bearer ")||auth.length<=7||auth.length>519)return reply({error:"UNAUTHORIZED"},401);
 const actual=createHash("sha256").update(auth.slice(7)).digest();
 const expected=createHash("sha256").update(secret).digest();
 if(!timingSafeEqual(actual,expected))return reply({error:"UNAUTHORIZED"},401);
 return null;
}

/** Preview structure probe. Bearer is the existing Worker secret. No database connection. */
export async function GET(req:NextRequest){
 const env=process.env;
 if(!previewAuthEnvironment(env,new URL(req.url).hostname))return reply({error:"PREVIEW_TEST_ONLY"},404);
 const denied=authorize(req,env.TIMEEASE_V2_WORKER_SECRET);
 if(denied)return denied;
 return reply(diagnostic(env),200);
}

/** Same-origin operator channel. The Worker bearer stays inside this process. */
export async function POST(req:NextRequest){
 const env=process.env;
 if(!previewAuthEnvironment(env,new URL(req.url).hostname))return reply({error:"PREVIEW_TEST_ONLY"},404);
 if(req.headers.get("origin")!==`https://${env.VERCEL_URL}`||req.headers.get("sec-fetch-site")!=="same-origin")
  return reply({error:"SAME_ORIGIN_REQUIRED"},403);
 if(req.headers.get("content-type")!=="application/x-www-form-urlencoded")return reply({error:"FORM_REQUIRED"},415);
 const length=req.headers.get("content-length");
 if(length&&(!/^\d+$/.test(length)||Number(length)>256))return reply({error:"INVALID_CONFIRMATION"},400);
 if(!req.body)return reply({error:"INVALID_CONFIRMATION"},400);
 const reader=req.body.getReader();const chunks:Buffer[]=[];let size=0;
 try{
  while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;
   if(size>256)return reply({error:"INVALID_CONFIRMATION"},400);chunks.push(Buffer.from(value));}
 }finally{await reader.cancel().catch(()=>{});}
 const form=new URLSearchParams(Buffer.concat(chunks,size).toString("utf8"));
 const nonce=form.get("nonce");
 if([...form.keys()].some(key=>!["confirm","nonce"].includes(key))||form.getAll("confirm").length!==1||form.getAll("nonce").length!==1||
  form.get("confirm")!=="preview-worker-url-diagnostic-only"||!nonce||
  !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(nonce))
  return reply({error:"INVALID_CONFIRMATION"},400);
 const secret=env.TIMEEASE_V2_WORKER_SECRET;
 if(!secret||secret.length<32)return reply({error:"WORKER_NOT_CONFIGURED"},503);
 try{
  const result=await GET(new NextRequest(`https://${env.VERCEL_URL}/api/preview-worker-url-diagnostic`,{
   method:"GET",headers:{authorization:`Bearer ${secret}`}}));
  const data:unknown=await result.json();
  if(result.status!==200||!accepted(data))return reply({error:"URL_DIAGNOSTIC_REJECTED"},503);
  return reply({dedicatedUrlPresent:data.dedicatedUrlPresent,urlParsed:data.urlParsed,postgresProtocol:data.postgresProtocol,
   usernameMatchesLimitedRole:data.usernameMatchesLimitedRole,passwordPresent:data.passwordPresent,code:data.code},200);
 }catch{return reply({error:"URL_DIAGNOSTIC_UNAVAILABLE"},503);}
}
