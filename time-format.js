const TimeFormat = {
  age(timestamp) {
    if (!timestamp) return "Activity unknown";
    const elapsed = Math.max(0, Date.now() - timestamp);
    if (elapsed < 60_000) return "Just now";
    if (elapsed < 3_600_000) return `${Math.floor(elapsed / 60_000)}m ago`;
    if (elapsed < 86_400_000) return `${Math.floor(elapsed / 3_600_000)}h ago`;
    return `${Math.floor(elapsed / 86_400_000)}d ago`;
  },
  group(timestamp) {
    if (!timestamp) return "Activity unknown";
    const hours = (Date.now() - timestamp) / 3_600_000;
    if (hours < 1) return "Recently used";
    if (hours < 3) return "1 hour old";
    if (hours < 24) return "3 hours old";
    if (hours < 72) return "1 day old";
    if (hours < 168) return "3 days old";
    return "7+ days old";
  },
  domain(url) {
    try { return new URL(url).hostname.replace(/^www\./, ""); }
    catch { return url || "Unavailable page"; }
  }
};
