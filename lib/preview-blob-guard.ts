/** Customer/business Preview routes remain closed. An independent Store passing
 * a probe does not authorize customer processing. The separate synthetic-order
 * adapter enforces its own authentication, fixture, database and Store scope.
 * Do not remove this gate or use a flag to open all Preview business routes.
 */
export function previewBlobAccessBlocked(env: Record<string,string|undefined>): boolean {
 return env.VERCEL_ENV === 'preview';
}
