import {createHmac,timingSafeEqual} from "node:crypto";

export type CheckoutTokenPayload={
 intakeId:string;
 variantId:string;
 amountUsd:number;
 expiresAt:number;
};
const ID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function valid(p:CheckoutTokenPayload):boolean{
 return ID.test(p.intakeId)&&/^[0-9]+$/.test(p.variantId)&&Number.isSafeInteger(p.amountUsd)&&p.amountUsd>0&&
 Number.isSafeInteger(p.expiresAt)&&p.expiresAt>0;
}
export function signCheckoutToken(payload:CheckoutTokenPayload,secret:string):string{
 if(!secret||secret.length<32||!valid(payload))throw new Error("INVALID_CHECKOUT_BINDING");
 const body=Buffer.from(JSON.stringify(payload)).toString("base64url");
 const mac=createHmac("sha256",secret).update(body).digest("base64url");
 return body+"."+mac;
}
export function verifyCheckoutToken(token:string,secret:string,now=Math.floor(Date.now()/1000)):CheckoutTokenPayload|null{
 if(!secret||secret.length<32||typeof token!=="string"||token.length>2048)return null;
 const parts=token.split(".");
 if(parts.length!==2||!parts.every(x=>/^[A-Za-z0-9_-]+$/.test(x)))return null;
 const expected=createHmac("sha256",secret).update(parts[0]).digest();
 const supplied=Buffer.from(parts[1],"base64url");
 if(supplied.length!==expected.length||!timingSafeEqual(supplied,expected))return null;
 try{
  const p=JSON.parse(Buffer.from(parts[0],"base64url").toString("utf8")) as CheckoutTokenPayload;
  if(!valid(p)||p.expiresAt<=now||p.expiresAt>now+3600)return null;
  return p;
 }catch{return null}
}
