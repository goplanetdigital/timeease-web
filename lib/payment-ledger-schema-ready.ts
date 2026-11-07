import {productionReleaseBound} from './production-release';
import {productionTransaction} from './production-database';
/** Read-only identity/schema readiness. Never creates schema or repairs grants. */
export async function paymentLedgerSchemaReady():Promise<boolean>{
 if(!productionReleaseBound())return false;
 try{return await productionTransaction('payment',async()=>true);}catch{return false;}
}
