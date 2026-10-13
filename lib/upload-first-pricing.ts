export type TimeEaseService = "invoice" | "consolidation" | "catalogue" | "resume";
export type QuoteInput = {service: TimeEaseService; fileCount: number; catalogueRows?: number; tier?: "basic" | "complex" | "batch" | "resume" | "full"};
export type Quote = {service: TimeEaseService; amountUsd: number; currency: "USD"; variantLabel: string; requiresReview: boolean};
export function calculateQuote(input: QuoteInput): Quote {
  const {service, fileCount, catalogueRows, tier} = input;
  if (!Number.isSafeInteger(fileCount) || fileCount < 1 || fileCount > 100) throw new Error("INVALID_FILE_COUNT");
  if (service === "consolidation") {
    if (fileCount > 100) throw new Error("TOO_MANY_FILES");
    return {service, amountUsd: fileCount <= 10 ? 9 : fileCount - 1, currency:"USD", variantLabel: String(fileCount) + " PDFs", requiresReview:false};
  }
  if (service === "invoice") {
    if (fileCount !== 1) throw new Error("USE_CONSOLIDATION_FOR_MULTIPLE_PDFS");
    const prices = {basic:9, complex:39, batch:99};
    if (!tier || !(tier in prices)) throw new Error("SELECT_INVOICE_TIER");
    return {service, amountUsd: prices[tier as keyof typeof prices], currency:"USD", variantLabel:tier, requiresReview:tier !== "basic"};
  }
  if (service === "catalogue") {
    if (fileCount !== 1 || !Number.isSafeInteger(catalogueRows) || !catalogueRows || catalogueRows < 1 || catalogueRows > 2000) throw new Error("INVALID_CATALOGUE_ROWS");
    const bracket = catalogueRows <= 100 ? 100 : catalogueRows <= 500 ? 500 : 2000;
    return {service, amountUsd: bracket === 100 ? 19 : bracket === 500 ? 39 : 79, currency:"USD", variantLabel:bracket+" rows", requiresReview:true};
  }
  if (service === "resume") {
    if (fileCount !== 1 || (tier !== "resume" && tier !== "full")) throw new Error("INVALID_RESUME_TIER");
    return {service, amountUsd:tier === "resume" ? 19 : 39, currency:"USD", variantLabel:tier, requiresReview:true};
  }
  throw new Error("UNSUPPORTED_SERVICE");
}
