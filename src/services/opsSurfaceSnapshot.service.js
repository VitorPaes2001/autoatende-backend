const fs = require("fs");
const path = require("path");

const DEFAULT_SNAPSHOT_PATH =
  process.env.OPS_SURFACE_SITE_CLICKS_SUMMARY_PATH ||
  path.join(process.cwd(), "nginx", "conf.d", "ops-surface", "site-clicks-summary.json");

const DEFAULT_HISTORY_DIR =
  process.env.OPS_SURFACE_HISTORY_DIR ||
  path.join(process.cwd(), "nginx", "conf.d", "ops-surface", "history");

const DEFAULT_HISTORY_MANIFEST_PATH =
  process.env.OPS_SURFACE_HISTORY_MANIFEST_PATH ||
  path.join(DEFAULT_HISTORY_DIR, "manifest.json");

// __AUTOATENDE_C13D_R8C_CURRENT_PREVIOUS_SNAPSHOT_SERVICE__

function sanitizeArray(value) {
  return Array.isArray(value) ? value : [];
}

function sanitizeObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function readJsonFile(filePath) {
  const raw = fs.readFileSync(filePath, "utf8");
  return raw ? JSON.parse(raw) : {};
}

function safeReadJsonFile(filePath) {
  try {
    return readJsonFile(filePath);
  } catch (_err) {
    return null;
  }
}

function pickFirstNumber(obj, keys) {
  const safe = sanitizeObject(obj);
  for (const key of keys) {
    const value = safe[key];
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string" && value.trim() !== "" && !Number.isNaN(Number(value))) {
      return Number(value);
    }
  }
  return null;
}

function pickFirstString(obj, keys) {
  const safe = sanitizeObject(obj);
  for (const key of keys) {
    const value = safe[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}

function normalizeRankedItem(item, labelKeys = [], valueKeys = []) {
  const safe = sanitizeObject(item);
  return {
    label: pickFirstString(safe, labelKeys),
    value: pickFirstNumber(safe, valueKeys),
    raw: safe
  };
}

function buildNormalizedSnapshot(data) {
  const safeData = sanitizeObject(data);
  const totals = sanitizeObject(safeData.totals);
  const topSources = sanitizeArray(safeData.top_sources);
  const topLandingPages = sanitizeArray(safeData.top_landing_pages);
  const topCampaigns = sanitizeArray(safeData.top_campaigns);
  const topRefhosts = sanitizeArray(safeData.top_refhosts);
  const recentEvents = sanitizeArray(safeData.recent_events);

  const totalClicks =
    pickFirstNumber(totals, ["all_clicks", "total_clicks", "clicks", "events", "total_events"]) ??
    recentEvents.length;

  const totalConversions =
    pickFirstNumber(totals, ["conversions", "total_conversions", "leads"]) ??
    topCampaigns.reduce(
      (acc, item) => acc + (pickFirstNumber(item, ["conversions", "total_conversions", "leads"]) || 0),
      0
    );

  const totalSources =
    pickFirstNumber(totals, ["origins_count", "sources_count", "channels_count"]) ??
    topSources.length;

  return {
    generated_at: pickFirstString(safeData, ["generated_at", "updated_at", "snapshot_at"]),
    window_days: pickFirstNumber(safeData, ["window_days"]),
    metrics: {
      total_clicks: totalClicks,
      total_conversions: totalConversions,
      total_sources: totalSources,
      total_landing_pages: topLandingPages.length,
      total_campaigns: topCampaigns.length,
      total_refhosts: topRefhosts.length,
      total_recent_events: recentEvents.length
    },
    top_sources: topSources.map((item) =>
      normalizeRankedItem(item, ["source", "name", "label", "utm_source"], ["clicks", "count", "events", "total"])
    ),
    top_landing_pages: topLandingPages.map((item) =>
      normalizeRankedItem(item, ["path", "landing_page", "url", "name"], ["clicks", "count", "events", "total"])
    ),
    top_campaigns: topCampaigns.map((item) =>
      normalizeRankedItem(item, ["campaign", "name", "utm_campaign", "label"], ["clicks", "count", "events", "total"])
    ),
    top_refhosts: topRefhosts.map((item) =>
      normalizeRankedItem(item, ["refhost", "host", "domain", "name"], ["clicks", "count", "events", "total"])
    ),
    recent_events: recentEvents.map((item) => ({
      label: pickFirstString(item, ["event", "name", "label", "type", "source"]),
      occurred_at: pickFirstString(item, ["created_at", "timestamp", "occurred_at", "at"]),
      raw: sanitizeObject(item)
    }))
  };
}

function buildSnapshotEnvelope(data, snapshotPath, historyMeta = null) {
  const safeData = sanitizeObject(data);
  const normalized = buildNormalizedSnapshot(safeData);

  return {
    source: "ops_surface_snapshot_file",
    snapshot_path: snapshotPath,
    generated_at: normalized.generated_at,
    window_days: normalized.window_days,
    totals: sanitizeObject(safeData.totals),
    top_sources: sanitizeArray(safeData.top_sources),
    top_landing_pages: sanitizeArray(safeData.top_landing_pages),
    top_campaigns: sanitizeArray(safeData.top_campaigns),
    top_refhosts: sanitizeArray(safeData.top_refhosts),
    recent_events: sanitizeArray(safeData.recent_events),
    normalized,
    history_meta: historyMeta
  };
}

function readHistoryManifest() {
  if (!fs.existsSync(DEFAULT_HISTORY_MANIFEST_PATH)) return [];
  const raw = safeReadJsonFile(DEFAULT_HISTORY_MANIFEST_PATH);
  return sanitizeArray(raw)
    .filter((entry) => entry && typeof entry === "object")
    .sort((a, b) => String(a.timestamp_utc || "").localeCompare(String(b.timestamp_utc || "")));
}

function computeMetricDelta(currentValue, previousValue) {
  const current = Number.isFinite(Number(currentValue)) ? Number(currentValue) : null;
  const previous = Number.isFinite(Number(previousValue)) ? Number(previousValue) : null;

  if (current === null || previous === null) {
    return {
      current,
      previous,
      absolute_delta: null,
      relative_delta: null
    };
  }

  const absoluteDelta = current - previous;
  const relativeDelta = previous === 0 ? null : Number((absoluteDelta / previous).toFixed(6));

  return {
    current,
    previous,
    absolute_delta: absoluteDelta,
    relative_delta: relativeDelta
  };
}

function getSiteClicksSummary() {
  const snapshotPath = DEFAULT_SNAPSHOT_PATH;

  if (!fs.existsSync(snapshotPath)) {
    const error = new Error("Ops surface snapshot file not found");
    error.code = "OPS_SURFACE_SNAPSHOT_NOT_FOUND";
    error.statusCode = 404;
    error.meta = { snapshotPath };
    throw error;
  }

  let parsed;
  try {
    parsed = readJsonFile(snapshotPath);
  } catch (err) {
    const error = new Error("Ops surface snapshot file is invalid JSON");
    error.code = "OPS_SURFACE_SNAPSHOT_INVALID_JSON";
    error.statusCode = 500;
    error.meta = { snapshotPath, originalMessage: err.message };
    throw error;
  }

  const historyManifest = readHistoryManifest();
  const currentEntry = historyManifest.length ? historyManifest[historyManifest.length - 1] : null;
  const previousEntry = historyManifest.length >= 2 ? historyManifest[historyManifest.length - 2] : null;

  const currentSnapshot = buildSnapshotEnvelope(
    parsed,
    snapshotPath,
    currentEntry ? sanitizeObject(currentEntry) : null
  );

  let previousSnapshot = null;

  if (previousEntry && previousEntry.file) {
    const previousPath = path.join(DEFAULT_HISTORY_DIR, previousEntry.file);
    const previousData = safeReadJsonFile(previousPath);
    if (previousData && typeof previousData === "object") {
      previousSnapshot = buildSnapshotEnvelope(
        previousData,
        previousPath,
        sanitizeObject(previousEntry)
      );
    }
  }

  const comparison = {
    available: Boolean(previousSnapshot),
    metrics: {
      total_clicks: computeMetricDelta(
        pickFirstNumber(currentSnapshot.normalized.metrics, ["total_clicks"]),
        previousSnapshot ? pickFirstNumber(previousSnapshot.normalized.metrics, ["total_clicks"]) : null
      ),
      total_conversions: computeMetricDelta(
        pickFirstNumber(currentSnapshot.normalized.metrics, ["total_conversions"]),
        previousSnapshot ? pickFirstNumber(previousSnapshot.normalized.metrics, ["total_conversions"]) : null
      ),
      total_sources: computeMetricDelta(
        pickFirstNumber(currentSnapshot.normalized.metrics, ["total_sources"]),
        previousSnapshot ? pickFirstNumber(previousSnapshot.normalized.metrics, ["total_sources"]) : null
      )
    }
  };

  return {
    ...currentSnapshot,
    history: {
      history_dir: DEFAULT_HISTORY_DIR,
      manifest_path: DEFAULT_HISTORY_MANIFEST_PATH,
      entries_count: historyManifest.length,
      latest_entry: currentEntry ? sanitizeObject(currentEntry) : null,
      previous_entry: previousEntry ? sanitizeObject(previousEntry) : null
    },
    current_snapshot: currentSnapshot,
    previous_snapshot: previousSnapshot,
    comparison
  };
}

module.exports = {
  getSiteClicksSummary,
  DEFAULT_SNAPSHOT_PATH,
  DEFAULT_HISTORY_DIR,
  DEFAULT_HISTORY_MANIFEST_PATH
};
