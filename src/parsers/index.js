/**
 * Aggregates all parsers into a single function that reads the entire .hank/ directory
 * and returns a unified dashboard state object.
 */

const { parseCostLog } = require("./cost-log");
const { parseCostSession } = require("./cost-session");
const {
  parseCircuitBreakerState,
  parseCircuitBreakerHistory,
} = require("./circuit-breaker");
const { parseResponseAnalysis } = require("./response-analysis");
const { parseExitSignals } = require("./exit-signals");
const { parseStatus } = require("./status");
const { parseProgress } = require("./progress");
const { parseImplementationPlan } = require("./implementation-plan");
const { parseLiveLog } = require("./live-log");
const { parseSessionHistory } = require("./session-history");
const { parseProcesses } = require("./processes");
const { parseErrorCatalog } = require("./error-catalog");
const { parseRetryLog } = require("./retry-log");
const { parseOrchestration } = require("./orchestration");

function filterToLatestSession(entries) {
  if (entries.length === 0) return entries;
  const lastSessionId = entries[entries.length - 1].sessionId;
  if (!lastSessionId) return entries;
  return entries.filter((e) => e.sessionId === lastSessionId);
}

function parseAll(hankDir) {
  return {
    costLog: filterToLatestSession(parseCostLog(hankDir)),
    costSession: parseCostSession(hankDir),
    circuitBreaker: parseCircuitBreakerState(hankDir),
    circuitBreakerHistory: parseCircuitBreakerHistory(hankDir),
    responseAnalysis: parseResponseAnalysis(hankDir),
    exitSignals: parseExitSignals(hankDir),
    status: parseStatus(hankDir),
    progress: parseProgress(hankDir),
    implementationPlan: parseImplementationPlan(hankDir),
    liveLog: parseLiveLog(hankDir),
    sessionHistory: parseSessionHistory(hankDir),
    processes: parseProcesses(),
    errorCatalog: parseErrorCatalog(hankDir),
    retryLog: parseRetryLog(hankDir),
    orchestration: parseOrchestration(hankDir),
  };
}

module.exports = {
  parseAll,
  parseCostLog,
  parseCostSession,
  parseCircuitBreakerState,
  parseCircuitBreakerHistory,
  parseResponseAnalysis,
  parseExitSignals,
  parseStatus,
  parseProgress,
  parseImplementationPlan,
  parseLiveLog,
  parseSessionHistory,
  parseProcesses,
  parseErrorCatalog,
  parseRetryLog,
  parseOrchestration,
};
