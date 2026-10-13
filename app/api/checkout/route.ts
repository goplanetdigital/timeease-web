import {NextRequest,NextResponse} from "next/server";
import {head} from "@vercel/blob";
import {resolveShopifyVariant} from "../../../../lib/shopify-variants";
export const runtime="nodejs";
export async function POST(req:NextRequest){
 try{
  const {id}=await req.json();
  if(typeof id!=="string"||!/^[0-9a-f-]{36}$/i.test(id))return NextResponse.json({error:"INVALID_INTAKE_ID"},{status:400});
  if(!process.env.BLOB_READ_WRITE_TOKEN)return NextResponse.json({error:"STORAGE_NOT_CONFIGURED"},{status:503});
  const manifestPath="intake-v2/"+id+"/manifest.json";
  const record=await head(manifestPath,{token:process.env.BLOB_READ_WRITE_TOKEN});
  if(!record)return NextResponse.json({error:"INTAKE_NOT_FOUND"},{status:404});
  // A private manifest cannot be retrieved anonymously via a public URL.
  // Server-side manifest read and checkout session signing must be implemented
  // before this endpoint may issue a Shopify checkout URL.
  return NextResponse.json({error:"CHECKOUT_NOT_YET_ENABLED",detail:"Private manifest verification and paid-order callback pending."},{status:503});
 }catch{return NextResponse.json({error:"CHECKOUT_UNAVAILABLE"},{status:503})}
}
