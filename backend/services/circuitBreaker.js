const state = {
  failures: 0,
  openedAt: 0,
};

const failureThreshold = Number(process.env.LLM_CIRCUIT_FAILURE_THRESHOLD || 5);
const coolDownMs = Number(process.env.LLM_CIRCUIT_COOLDOWN_MS || 30000);

export const isCircuitOpen = () => {
  if (state.failures < failureThreshold) return false;
  if (Date.now() - state.openedAt > coolDownMs) {
    state.failures = 0;
    state.openedAt = 0;
    return false;
  }
  return true;
};

export const recordFailure = () => {
  state.failures += 1;
  if (state.failures >= failureThreshold && state.openedAt === 0) {
    state.openedAt = Date.now();
  }
};

export const recordSuccess = () => {
  state.failures = 0;
  state.openedAt = 0;
};
