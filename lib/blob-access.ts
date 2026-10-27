import {PREVIEW_BLOB_STORE,previewBlobOptions} from './preview-runtime-evidence';
import {isIsolatedPreview} from './test-worker-guards';
/** Preview must never inherit the legacy static production Blob credential. */
export function blobAccessConfigured(env:Record<string,string|undefined>):boolean {
 return env.VERCEL_ENV==='preview'
  ? isIsolatedPreview(env)&&env.TIMEEASE_PREVIEW_BLOB_STORE_ID===PREVIEW_BLOB_STORE
  : Boolean(env.BLOB_READ_WRITE_TOKEN);
}
export async function blobAccessOptions(env:Record<string,string|undefined>):Promise<{storeId:string;token?:never}|{token:string|undefined;storeId?:never}>{
 if(env.VERCEL_ENV==='preview')return previewBlobOptions(env);
 return {token:env.BLOB_READ_WRITE_TOKEN};
}
