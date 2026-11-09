/** Structure check only. Never connect, log, or return any URL component. */
const LIMITED_ROLE="timeease_worker_limited";
export type WorkerDatabaseUrlDiagnostic={
 dedicatedUrlPresent:boolean;
 urlParsed:boolean;
 postgresProtocol:boolean;
 usernameMatchesLimitedRole:boolean;
 passwordPresent:boolean;
 code:string;
};
function report(code:string,flags:Partial<WorkerDatabaseUrlDiagnostic>={}):WorkerDatabaseUrlDiagnostic{
 return {dedicatedUrlPresent:false,urlParsed:false,postgresProtocol:false,
  usernameMatchesLimitedRole:false,passwordPresent:false,...flags,code};
}
/** Inspect only the dedicated Worker URL. The ledger URL is intentionally ignored. */
export function diagnoseDedicatedWorkerDatabaseUrl(raw:string|undefined):WorkerDatabaseUrlDiagnostic{
 if(typeof raw!=="string"||raw.trim()==="")return report("WORKER_DATABASE_URL_MISSING");
 let url:URL;
 try{url=new URL(raw.trim());}
 catch{return report("WORKER_DATABASE_URL_MALFORMED",{dedicatedUrlPresent:true});}
 const protocol=url.protocol==="postgres:"||url.protocol==="postgresql:";
 let username="";
 try{username=decodeURIComponent(url.username);}catch{username="";}
 let password="";
 try{password=url.searchParams.get("password")||decodeURIComponent(url.password);}catch{password="";}
 const parsed:WorkerDatabaseUrlDiagnostic={
  dedicatedUrlPresent:true,
  urlParsed:true,
  postgresProtocol:protocol,
  usernameMatchesLimitedRole:username===LIMITED_ROLE,
  passwordPresent:password.length>0,
  code:"WORKER_DATABASE_URL_ACCEPTED"
 };
 if(!parsed.postgresProtocol)return {...parsed,code:"WORKER_DATABASE_PROTOCOL_INVALID"};
 if(!parsed.usernameMatchesLimitedRole)return {...parsed,code:"WORKER_DATABASE_ROLE_MISMATCH"};
 if(!parsed.passwordPresent)return {...parsed,code:"WORKER_DATABASE_PASSWORD_MISSING"};
 return parsed;
}
