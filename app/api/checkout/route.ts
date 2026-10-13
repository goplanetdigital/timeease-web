import {NextRequest,NextResponse} from "next/server";
export const runtime="nodejs";
export async function POST(req:NextRequest){
 try{
  const {id}=await req.json();
  if(typeof id!=="string"||!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id))
   return NextResponse.json({error:"INVALID_INTAKE_ID"},{status:400});
  // No Shopify redirect until a server-authenticated private manifest, a
  // single-use signed checkout session, and paid-order webhook are installed.
  return NextResponse.json({error:"CHECKOUT_NOT_YET_ENABLED"},{status:503,headers:{"Cache-Control":"no-store"}});
 }catch{return NextResponse.json({error:"INVALID_REQUEST"},{status:400})}
}
