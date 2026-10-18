export const TIMEZONES = [
  "UTC", "Africa/Douala", "Africa/Lagos", "Africa/Nairobi", "Africa/Johannesburg",
  "Europe/London", "Europe/Paris", "America/New_York", "America/Los_Angeles", "Asia/Dubai",
];

/** TIMEZONES plus `current` if it isn't already listed. */
export function timezoneOptions(current: string) {
  return TIMEZONES.includes(current) ? TIMEZONES : [current, ...TIMEZONES];
}
