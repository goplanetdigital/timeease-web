/** Preview currently inherits a Blob store also scoped to Production.
 * Keep all Preview Blob access closed until a separate store and runtime
 * isolation have been independently verified. Flags cannot bypass this gate.
 */
export function previewBlobAccessBlocked(env: Record<string,string|undefined>): boolean {
 return env.VERCEL_ENV === 'preview';
}
