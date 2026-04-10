const toDate = (value) => new Date(value instanceof Date ? value : String(value));

export const computeNullRates = (rows, fields) => {
  const total = rows.length || 1;
  const rates = {};
  for (const field of fields) {
    const nullCount = rows.filter(
      (row) => row[field] === null || row[field] === undefined || row[field] === ""
    ).length;
    rates[field] = {
      nullCount,
      nullRate: Number((nullCount / total).toFixed(6)),
    };
  }
  return rates;
};

export const detectDuplicateEvents = (events) => {
  const seen = new Map();
  const duplicates = [];

  for (const event of events) {
    const key = [
      String(event.student),
      String(event.course),
      String(event.topicId),
      String(event.questionId || ""),
      String(event.eventType),
      toDate(event.eventTimestamp).toISOString(),
    ].join("::");

    if (seen.has(key)) {
      duplicates.push({ duplicateOf: seen.get(key), event });
    } else {
      seen.set(key, event);
    }
  }

  return duplicates;
};

export const detectTimestampAnomalies = (events) => {
  const now = Date.now();
  const futureEvents = events.filter((e) => toDate(e.eventTimestamp).getTime() > now + 60 * 1000);

  const outOfOrder = [];
  const grouped = new Map();
  for (const event of events) {
    const key = `${event.student}::${event.course}::${event.topicId}`;
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key).push(event);
  }

  for (const [key, group] of grouped.entries()) {
    const sorted = [...group].sort(
      (a, b) => toDate(a.createdAt || a.eventTimestamp).getTime() - toDate(b.createdAt || b.eventTimestamp).getTime()
    );
    let prev = null;
    for (const e of sorted) {
      if (prev && toDate(e.eventTimestamp).getTime() < toDate(prev.eventTimestamp).getTime()) {
        outOfOrder.push({ key, previous: prev, current: e });
      }
      prev = e;
    }
  }

  return { futureEvents, outOfOrder };
};

const getWeekKey = (dateValue) => {
  const d = toDate(dateValue);
  const date = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((date - yearStart) / 86400000) + 1) / 7);
  return `${date.getUTCFullYear()}-W${String(weekNo).padStart(2, "0")}`;
};

export const computeWeeklyDistributionShift = (events) => {
  const counts = {};
  for (const event of events) {
    const key = getWeekKey(event.eventTimestamp);
    counts[key] = (counts[key] || 0) + 1;
  }

  const weeks = Object.keys(counts).sort();
  const shifts = [];
  for (let i = 1; i < weeks.length; i++) {
    const prev = counts[weeks[i - 1]];
    const curr = counts[weeks[i]];
    const delta = curr - prev;
    const pct = prev === 0 ? null : Number((delta / prev).toFixed(6));
    shifts.push({
      fromWeek: weeks[i - 1],
      toWeek: weeks[i],
      previousCount: prev,
      currentCount: curr,
      delta,
      percentChange: pct,
    });
  }

  return {
    weeklyCounts: counts,
    shifts,
  };
};

export const buildReadinessSummary = ({ events, featureRows, nullRates, duplicates, anomalies, distribution }) => ({
  totals: {
    events: events.length,
    featureRows: featureRows.length,
    duplicateEvents: duplicates.length,
    futureTimestampEvents: anomalies.futureEvents.length,
    outOfOrderEvents: anomalies.outOfOrder.length,
  },
  nullRates,
  topicCoverage: {
    uniqueTopics: new Set(events.map((e) => String(e.topicId))).size,
    uniqueStudents: new Set(events.map((e) => String(e.student))).size,
  },
  distribution,
  readyForTraining:
    duplicates.length === 0 &&
    anomalies.futureEvents.length === 0 &&
    anomalies.outOfOrder.length === 0,
});
