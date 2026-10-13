export const CAMPAIGN_KEYS = ["utm_source", "utm_medium", "utm_campaign"] as const;

export type Campaign = Partial<Record<(typeof CAMPAIGN_KEYS)[number], string>>;

export function readCampaign(params: URLSearchParams): Campaign {
  const campaign: Campaign = {};
  for (const key of CAMPAIGN_KEYS) {
    const value = params.get(key)?.trim();
    if (value && /^[a-zA-Z0-9_-]{1,80}$/.test(value)) campaign[key] = value;
  }
  return campaign;
}

export function appendCampaign(url: string, campaign: Campaign): string {
  const parsed = new URL(url);
  for (const key of CAMPAIGN_KEYS) {
    const value = campaign[key];
    if (value && !parsed.searchParams.has(key)) parsed.searchParams.set(key, value);
  }
  return parsed.toString();
}
