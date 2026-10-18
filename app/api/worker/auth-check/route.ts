import {createHash,timingSafeEqual} from "node:crypto";
import {NextRequest,NextResponse} from "next/server";
export const runtime="nodejs";
export async function GET(req:NextRequest){
 const headers={"Cache-Control":"no-store"};
 const secret=process.env.TIMEEASE_V2_WORKER_SECRET;
 if(!secret||secret.length<32)return NextResponse.json({error:"WORKER_NOT_CONFIGURED"},{status:503,headers});
 const auth=req.headers.get("authorization")||"";
 if(!auth.startsWith("Bearer ")||auth.length<=7||auth.length>519)return NextResponse.json({error:"UNAUTHORIZED"},{status:401,headers});
 const actual=createHash("sha256").update(auth.slice(7)).digest();
 const expected=createHash("sha256").update(secret).digest();
 if(!timingSafeEqual(actual,expected))return NextResponse.json({error:"UNAUTHORIZED"},{status:401,headers});
 return NextResponse.json({authenticated:true,ordersAccessed:false,ledgerModified:false},{status:200,headers});
}
