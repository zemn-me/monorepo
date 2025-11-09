import { expect, it } from "@jest/globals";

import { formatTimeZone } from "#root/ts/react/lang/format_time_zone.js";



it('formats a time zone string correctly', () => {
  expect(formatTimeZone('America/New_York')).toBe('New York, America');
  expect(formatTimeZone('Europe/London')).toBe('London, Europe');
  expect(formatTimeZone('Asia/Tokyo')).toBe('Tokyo, Asia');
});
