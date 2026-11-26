function buildTimeline(observations) {
  const bucketMap = new Map();
  for (const o of observations) {
    const minute = Math.floor(o.elapsedSec / 60);
    if (!bucketMap.has(minute)) bucketMap.set(minute, { minute, count: 0, types: {} });
    const b = bucketMap.get(minute);
    b.count += 1;
    b.types[o.type] = (b.types[o.type] || 0) + 1;
  }
  return [...bucketMap.values()].sort((a, b) => a.minute - b.minute);
}

module.exports = { buildTimeline };
