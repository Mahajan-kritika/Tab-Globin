const TabFilter = {
  eligible(tab, protectedTabIds, protectedUrls, lastActive, thresholdMs = 0) {
    if (!tab.id || tab.active || tab.pinned || tab.discarded || tab.discardable === false) return false;
    if (protectedTabIds.has(tab.id) || protectedUrls.has(tab.url)) return false;
    if (!/^https?:/i.test(tab.url || "")) return false;
    const activeAt = lastActive[String(tab.id)];
    return Boolean(activeAt && Date.now() - activeAt >= thresholdMs);
  }
};
