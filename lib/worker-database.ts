/** Worker traffic may use only the limited login. The payment ledger keeps its own URL. */
const LIMITED_ROLE="timeease_worker_limited";
export function workerDatabaseConnection(env:NodeJS.ProcessEnv=process.env):string{
 const raw=env.TIMEEASE_WORKER_DATABASE_URL||env.TIMEEASE_DB_DATABASE_URL;
 if(!raw)throw new Error("WORKER_DATABASE_NOT_CONFIGURED");
 let url:URL;
 try{url=new URL(raw);}catch{throw new Error("WORKER_DATABASE_ROLE_FORBIDDEN");}
 const user=decodeURIComponent(url.username);
 if((url.protocol!=="postgres:"&&url.protocol!=="postgresql:")||user!==LIMITED_ROLE)
  throw new Error("WORKER_DATABASE_ROLE_FORBIDDEN");
 return raw;
}
