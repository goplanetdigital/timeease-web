import {createHmac,timingSafeEqual} from "node:crypto";
import {NextRequest,NextResponse} from "next/server";

export const runtime="nodejs";

function authenticated(raw:string,signature:string|null,secret:string):boolean {
 if(!signature || !/^[A-Za-z0-9+/]{43}=$/.test(signature))return false;
 const expected=createHmac("sha256",secret).update(raw,"utf8").digest();
 const supplied=Buffer.from(signature,"base64");
 return supplied.length===expected.length && timingSafeEqual(supplied,expected);
}

// Isolated, fail-closed verification endpoint. It deliberately does NOT mark
// an intake paid, start a worker, or accept a client-provided order status.
export async function POST(req:NextRequest){
 const secret=process.env.SHOPIFY_WEBHOOK_SECRET;
 if(!secret)return NextResponse.json({error:"WEBHOOK_NOT_CONFIGURED"},{status:503});
 const raw=await req.text();
 if(!authenticated(raw,req.headers.get("x-shopify-hmac-sha256"),secret))
  return NextResponse.json({error:"INVALID_WEBHOOK_SIGNATURE"},{status:401});
 const topic=req.headers.get("x-shopify-topic");
 if(topic!=="orders/paid")
  return NextResponse.json({error:"UNSUPPORTED_WEBHOOK_TOPIC"},{status:422});
 let order:unknown;
 try{order=JSON.parse(raw)}catch{return NextResponse.json({error:"INVALID_JSON"},{status:400})}
 if(!order||typeof order!=="object"||!("id" in order)||!("financial_status" in order))
  return NextResponse.json({error:"INVALID_ORDER"},{status:400});
 const payload=order as {id:unknown;financial_status:unknown};
 if((typeof payload.id!=="number"&&typeof payload.id!=="string")||payload.financial_status!=="paid")
  return NextResponse.json({error:"ORDER_NOT_PAID"},{status:422});
 // No state changes until the Shopify order ID is bound to a private intake
 // and the paid order's line items and price have been independently checked.
 return NextResponse.json({error:"PAID_ORDER_LINKING_NOT_ENABLED"},{status:503,headers:{"Cache-Control":"no-store"}});
}
