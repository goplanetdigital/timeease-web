import {type Quote} from "./upload-first-pricing";
const VARIANTS={
 invoice:{basic:"51269543428343",complex:"51291397423351",batch:"51291397456119"},
 catalogue:{"100":"51293145759991","500":"51293145792759","2000":"51293145825527"},
 resume:{resume:"51293146087671",full:"51293146120439"}
} as const;
export function resolveShopifyVariant(quote:Quote,fileCount:number){
 if(quote.service==="invoice")return VARIANTS.invoice[quote.variantLabel as keyof typeof VARIANTS.invoice];
 if(quote.service==="catalogue")return VARIANTS.catalogue[quote.variantLabel.split(" ")[0] as keyof typeof VARIANTS.catalogue];
 if(quote.service==="resume")return VARIANTS.resume[quote.variantLabel as keyof typeof VARIANTS.resume];
 if(quote.service==="consolidation"){
  if(!Number.isSafeInteger(fileCount)||fileCount<1||fileCount>100)throw new Error("INVALID_FILE_COUNT");
  if(fileCount<=10)return "51293065117943";
  // Shopify variants 11–100 must be resolved against the live catalog, not inferred.
  throw new Error("CONSOLIDATION_VARIANT_LOOKUP_REQUIRED");
 }
 throw new Error("UNKNOWN_VARIANT");
}
