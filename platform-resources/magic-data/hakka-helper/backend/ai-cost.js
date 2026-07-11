"use strict";

const EFFECTIVE_REVENUE_CNY_PER_HOUR = 120;

function safeNumber(value) {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : 0;
}

function roundAmount(value, digits) {
  return Number(safeNumber(value).toFixed(digits));
}

function estimateIncome(effectiveTimeSeconds) {
  const seconds = Math.max(0, safeNumber(effectiveTimeSeconds));
  return roundAmount((seconds / 3600) * EFFECTIVE_REVENUE_CNY_PER_HOUR, 4);
}

module.exports = {
  EFFECTIVE_REVENUE_CNY_PER_HOUR,
  estimateIncome,
};
