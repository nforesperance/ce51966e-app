// Today's date (YYYY-MM-DD) as observed in the given IANA timezone.
export function todayInTz(tz: string, now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit",
  }).format(now);
}

// Convert a (date + time) expressed in `tz` to a UTC Date.
// date: YYYY-MM-DD, time: HH:MM[:SS]. Works across DST.
export function zonedToUtc(date: string, time: string, tz: string): Date {
  const iso = `${date}T${time.length === 5 ? time + ":00" : time}`;
  // Interpret the ISO string as if it were UTC to get a reference instant,
  // then correct by the zone offset at that instant.
  const asIfUtc = new Date(iso + "Z");
  // Format the reference back into the target tz to learn what the local wall-clock would be for that UTC instant.
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz, hour12: false,
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  }).formatToParts(asIfUtc);
  const g = (type: string) => parts.find((p) => p.type === type)!.value;
  // The difference between "intended local wall time" and "asIfUtc seen in tz" equals the tz offset.
  const seenLocal = Date.UTC(
    parseInt(g("year"), 10),
    parseInt(g("month"), 10) - 1,
    parseInt(g("day"), 10),
    parseInt(g("hour"), 10) === 24 ? 0 : parseInt(g("hour"), 10),
    parseInt(g("minute"), 10),
    parseInt(g("second"), 10),
  );
  const offset = seenLocal - asIfUtc.getTime();
  return new Date(asIfUtc.getTime() - offset);
}

export function minutesBetween(a: Date, b: Date) {
  return (b.getTime() - a.getTime()) / 60000;
}
