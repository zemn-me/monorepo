'use client';

export interface TimeZoneNameProps {
  readonly timeZone: string;
  readonly className?: string;
}


/**
 * Formats a time zone city code for display.
 *
 * Converts e.g. America/New_York to "New York, America".
 */
export function formatTimeZone(tz: string): string {
  const [region, ...rest] = tz.split('/');
  if (!region) return tz;
  const city = rest.join(' / ').replace(/_/g, ' ');
  const regionName = region.replace(/_/g, ' ');
  return city ? `${city}, ${regionName}` : regionName;
}

