export const FLOW_VALUE_FROM_INCOMING = '*';
export const FLOW_VALUE_FROM_OUTGOING = '?';
export const FLOW_VALUE_CALCULATED = [FLOW_VALUE_FROM_INCOMING, FLOW_VALUE_FROM_OUTGOING];

/**
 * Calculates the sum of numeric values in an array of flows
 * @param {Array} flows - Array of flow objects
 * @returns {number} Sum of numeric values
 */
export function sumFlowValues(flows = []) {
  return flows.reduce((sum, flow) => {
    const value = +flow.value || 0;
    return sum + value;
  }, 0);
}

// Helper function to calculate flow value based on node balance
function calculateFlowValue(flow) {
  // For '*' flows, we need to look at the end node's outgoing flows
  // For '?' flows, we need to look at the start node's incoming flows
  const targetNode = flow.value === FLOW_VALUE_FROM_INCOMING ? flow.source : flow.target;
  if (!targetNode) return flow.value;

  const targetFlows = flow.value === FLOW_VALUE_FROM_INCOMING ? targetNode.incomingFlows : targetNode.outgoingFlows;
  if (targetFlows.length === 0) return flow.value;

  const targetKnownFlows = targetFlows.filter(f => f !== flow && typeof f.value === 'number');
  const targetKnownSum = sumFlowValues(targetKnownFlows);
  const targetUnknownFlows = targetFlows.filter(f => f !== flow && FLOW_VALUE_CALCULATED.includes(f.value));

  // If we have no known values and unknown flows, we can't calculate yet
  if (targetKnownSum === 0 && targetUnknownFlows.length > 0) return flow.value;

  // If no other unknown flows, calculate the difference
  const sourceFlows = flow.value === FLOW_VALUE_FROM_INCOMING ? targetNode.outgoingFlows : targetNode.incomingFlows;
  const sourceFlowsTotal = sumFlowValues(sourceFlows);
  const sourceUnknownFlows = sourceFlows.filter(f => f !== flow && FLOW_VALUE_CALCULATED.includes(f.value));

  const remainingValue = targetKnownSum - sourceFlowsTotal;
  return remainingValue / (sourceUnknownFlows.length + 1);
}

/**
 * Resolves flow values in a nodeList by calculating missing values
 * @param {Array} allNodes - Array of node objects with flows
 * @param {Array | null} allFlows - Array of flow objects, or null to calculate from allNodes
 */
export function calculateMissingFlowValues(allNodes, allFlows = null) {
  // optimization so we don't need to create a new set every time
  allNodes = Array.from(allNodes);
  if (!allFlows) {
    allFlows = allNodes.flatMap(node => node.incomingFlows).concat(allNodes.flatMap(node => node.outgoingFlows));
  }
  allFlows = Array.from(allFlows);
  const unresolvedFlows = new Set(allFlows.filter(f => FLOW_VALUE_CALCULATED.includes(f.value)));

  // Iterate until no more changes are made
  let iterations = 0;
  const MAX_ITERATIONS = allNodes.length * 2; // Prevent infinite loops

  while (unresolvedFlows.size > 0 && iterations < MAX_ITERATIONS) {
    iterations++;
    for (const flow of unresolvedFlows) {
      const newValue = calculateFlowValue(flow);
      if (newValue !== flow.value && typeof newValue === 'number') {
        flow.value = newValue;
        unresolvedFlows.delete(flow)
      }
    }
  }

  if (unresolvedFlows.size > 0) {
    console.warn('Some flow values could not be resolved. This may be due to missing information or circular dependencies.');
  }

  calculateNodeValue(allNodes);
}

export function calculateNodeValue(node) {
  if (Array.isArray(node)) {
    for (const n of node) {
      calculateNodeValue(n);
    }
  } else {
    // Each node's value will be the greater of the two (or else the
    // smallest positive value):

    node.incomingTotal = sumFlowValues(node.incomingFlows);
    node.outgoingTotal = sumFlowValues(node.outgoingFlows);
    node.value = Math.max(node.incomingTotal, node.outgoingTotal, Number.MIN_VALUE);
  }
}

export function canonicalName(name) {
  return name.replace(/^-(.*)-$/, '$1').replaceAll('\\n', ' ').toLowerCase().trim();
}

/**
 * Format a number according to user's preferred style. For legacy reasons, we convert the style to a specific geographically-specific format.
 *   * `123,456.78` => `us`
 *   * `123.456,78` => `de`
 *   * `123 456,78` => `fr`
 *   * `123 456.78` => `ses`
 * @param {number} numberIn - The number to format
 * @param {Object} cfg - Formatting options
 * @returns {string} Formatted number string
 */
export const formatValue = (numberIn, cfg) => {
  const maximumFractionDigits = cfg.maxDecimalPlaces;
  const minimumFractionDigits = cfg.labelvalue_fullprecision ? cfg.maxDecimalPlaces : 0;
  const useGrouping = !cfg.value_format.startsWith('X') ? 'auto' : false;

  let nString;
  switch (cfg.value_format.padStart(2, 'X')) {
  case 'X.':
  case ',.':
    nString = Intl.NumberFormat('us', { maximumFractionDigits, minimumFractionDigits, useGrouping}).format(numberIn);
    break;
  case 'X,':
  case '.,':
    nString = Intl.NumberFormat('de', { maximumFractionDigits, minimumFractionDigits, useGrouping}).format(numberIn);
    break;
  case ' ,':
    nString = Intl.NumberFormat('fr', { maximumFractionDigits, minimumFractionDigits, useGrouping}).format(numberIn);
    break;
  case ' .':
    nString = Intl.NumberFormat('ses', { maximumFractionDigits, minimumFractionDigits, useGrouping}).format(numberIn);
    break;
  default:
    // no formatting except for decimal separator
    nString = numberIn;
    break;
  }

  return `${cfg.value_prefix}${nString}${cfg.value_suffix}`;
}
