/** Existing protected branch alias on the isolated project, never a suffix match. */
export const FIXED_PREVIEW_ALIAS='timeease-v2-secure-git-feature-isolate-3c280a-go-planet-digital.vercel.app';
export function canonicalPreviewHost(env:NodeJS.ProcessEnv,host:string):string{
 return host===FIXED_PREVIEW_ALIAS?env.VERCEL_URL||'':host;
}
/** Alias can move on deploy; reject a stale/wrong reviewed SHA before any DB/Blob access. */
export function previewAliasCommitMatches(env:NodeJS.ProcessEnv,host:string,headers:Pick<Headers,'get'>):boolean{
 if(host!==FIXED_PREVIEW_ALIAS)return true;
 const sha=env.VERCEL_GIT_COMMIT_SHA;
 return typeof sha==='string'&&/^[a-f0-9]{40}$/.test(sha)&&headers.get('x-timeease-preview-commit')===sha;
}
