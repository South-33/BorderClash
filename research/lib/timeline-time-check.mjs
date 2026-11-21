export function summarizeTimelineTimes(events, { commonThreshold = 10 } = {}) {
  const distribution = new Map();
  const invalid = [];
  const dateOnly = [];
  for (const event of events) {
    const time = event?.timeOfDay;
    if (time == null || time === "") {
      dateOnly.push(event?.id || "");
      continue;
    }
    if (!/^(?:[01]\d|2[0-3]):[0-5]\d$/u.test(String(time))) {
      invalid.push({ id: event?.id || "", timeOfDay: time });
      continue;
    }
    const entry = distribution.get(time) || { timeOfDay: time, count: 0, sampleIds: [] };
    entry.count += 1;
    if (entry.sampleIds.length < 8 && event?.id) entry.sampleIds.push(event.id);
    distribution.set(time, entry);
  }
  const times = [...distribution.values()].sort((a, b) => b.count - a.count || a.timeOfDay.localeCompare(b.timeOfDay));
  return {
    timezone: "UTC+07:00",
    totalEvents: events.length,
    exactTimeEvents: times.reduce((sum, entry) => sum + entry.count, 0),
    dateOnlyEvents: dateOnly.length,
    invalidTimeEvents: invalid.length,
    commonTimes: times.filter(({ count }) => count >= commonThreshold),
    distribution: times,
    dateOnlyIds: dateOnly.slice(0, 100),
    invalid,
  };
}
