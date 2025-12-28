/**
 * Merchant Logo Utilities
 *
 * Utilities for fetching and caching merchant logos using Logo.dev API
 */

/**
 * Extract domain from merchant name
 * Attempts to find a domain-like pattern or constructs one from the merchant name
 */
export function extractDomain(merchantName: string): string {
  const trimmed = merchantName.trim().toLowerCase();

  // Check if already a domain
  if (trimmed.includes('.com') || trimmed.includes('.net') || trimmed.includes('.org')) {
    return trimmed.split(/\s+/)[0];
  }

  // Remove common words and special characters
  const cleaned = trimmed
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\b(inc|llc|ltd|corp|corporation|company|co)\b/g, '')
    .trim()
    .replace(/\s+/g, '');

  // Construct domain
  return `${cleaned}.com`;
}

/**
 * Get logo URL from Logo.dev
 * Returns the Logo.dev URL for the given domain if token is available
 */
export function getLogoUrl(domain: string): string | null {
  const logoDevToken = import.meta.env.VITE_LOGODEV_TOKEN;

  if (logoDevToken) {
    // Use Logo.dev API with token
    return `https://img.logo.dev/${domain}?token=${logoDevToken}`;
  }

  // No token available, skip logo fetching
  return null;
}

/**
 * Check if a logo URL is valid by attempting to load it
 */
export async function validateLogoUrl(url: string): Promise<boolean> {
  try {
    const response = await fetch(url, { method: 'HEAD' });
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Fetch logo URL for a merchant
 * Returns null if no Logo.dev token is configured
 */
export async function fetchMerchantLogo(merchantName: string): Promise<string | null> {
  const domain = extractDomain(merchantName);
  const logoUrl = getLogoUrl(domain);

  // Skip fetching if no token is configured
  if (!logoUrl) {
    return null;
  }

  const isValid = await validateLogoUrl(logoUrl);
  return isValid ? logoUrl : null;
}
