import { emptyDataset, isValidDataset, pruneCoverage } from './model.js';

const DATA_KEY = 'coverage-cube:input-data:v1';
const PREFS_KEY = 'coverage-cube:prefs:v1';
// Keys used before the app was renamed from Coverage Queue; read as a fallback.
const LEGACY_DATA_KEY = 'coverage-queue:input-data:v1';
const LEGACY_PREFS_KEY = 'coverage-queue:prefs:v1';

function safeGet(key) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeSet(key, value) {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

export function loadInputData() {
  const raw = safeGet(DATA_KEY) ?? safeGet(LEGACY_DATA_KEY);
  if (!raw) return emptyDataset();
  try {
    const parsed = JSON.parse(raw);
    return isValidDataset(parsed) ? pruneCoverage(parsed) : emptyDataset();
  } catch {
    return emptyDataset();
  }
}

export function saveInputData(data) {
  return safeSet(DATA_KEY, JSON.stringify(data));
}

export function loadPrefs() {
  try {
    return JSON.parse(safeGet(PREFS_KEY) ?? safeGet(LEGACY_PREFS_KEY) ?? '{}') || {};
  } catch {
    return {};
  }
}

export function savePrefs(prefs) {
  safeSet(PREFS_KEY, JSON.stringify(prefs));
}
