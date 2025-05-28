// Test suite for TSV flow line parsing
import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import { LINE_FLOW_REGEX } from '../build/constants.js';

/**
 * Test a single flow line against the regex
 * @param {string} input - The flow line to test
 * @param {Object} expected - Expected match groups
 * @param {string} expected.source - Expected source node
 * @param {string} expected.value - Expected value
 * @param {string} expected.target - Expected target node
 * @param {string} [expected.color] - Expected color (without #)
 * @param {string} [expected.opacity] - Expected opacity
 */
function testFlowLine(input, expected) {
  const match = input.match(LINE_FLOW_REGEX);

  if (!match) {
    throw new Error(`Input did not match regex: ${JSON.stringify(input)}`);
  }

  const { groups } = match;

  // Check required groups
  assert.strictEqual(groups.source, expected.source, `Source node mismatch for: ${input} (groups: ${JSON.stringify(groups)})`);
  assert.strictEqual(groups.value, expected.value, `value mismatch for: ${input} (groups: ${JSON.stringify(groups)})`);
  assert.strictEqual(groups.target, expected.target, `Target node mismatch for: ${input} (groups: ${JSON.stringify(groups)})`);

  // Check optional groups
  if ('color' in expected) {
    assert.strictEqual(groups.color, expected.color, `Color mismatch for: ${input} (groups: ${JSON.stringify(groups)})`);
  } else if (groups.color !== "fff" ) { // `fff` special case for tests for convenience
    assert.strictEqual(groups.color, undefined, `Unexpected color in: ${input}`);
  }

  if ('opacity' in expected) {
    assert.strictEqual(groups.opacity, expected.opacity, `Opacity mismatch for: ${input} (groups: ${JSON.stringify(groups)})`);
  } else if (groups.opacity !== ".99") { // `99` special case for tests for convenience
    assert.strictEqual(groups.opacity, undefined, `Unexpected opacity in: ${input}`);
  }
}

describe('Flow Line Parser', () => {
  it('should parse basic flow line', () => {
    const expected = {
      source: 'Source',
      value: '100',
      target: 'Target'
    };
    testFlowLine('Source[100]Target', expected);
    testFlowLine(' Source [ 100 ] Target', expected);
    testFlowLine('  Source [\t  100 \t]  Target  ', expected);
  });

  it('should parse with color', () => {
    const expected = {
      source: 'Source',
      value: '100',
      target: 'Target',
      color: 'ff0000'
    };
    testFlowLine('Source[100]Target #ff0000', expected);
    testFlowLine('  Source[100]Target #ff0000', expected);
    testFlowLine('  Source  [  100  ]  Target  \t  #ff0000  ', expected);
  });

  it('should parse with color and opacity', () => {
    const expected = {
      source: 'Source',
      value: '100',
      target: 'Target',
      color: 'ff0000',
      opacity: '.75'
    };
    testFlowLine('Source[100]Target #ff0000.75', expected);
    testFlowLine('  Source[100]Target #ff0000.75', expected);
    testFlowLine('  Source  [  100  ]  Target  \t  #ff0000.75  ', expected);
  });

  it('should handle 3-digit hex colors', () => {
    const expected = {
      source: 'Source',
      value: '100',
      target: 'Target',
      color: 'f00'
    };
    testFlowLine('Source[100]Target #f00', expected);
    testFlowLine('  Source[100]Target #f00', expected);
    testFlowLine('  Source  [  100  ]  Target  \t  #f00  ', expected);
  });

  it('should parse with just opacity', () => {
    const expected = {
      source: 'Source',
      value: '100',
      target: 'Target',
      opacity: '.75'
    };
    testFlowLine('Source[100]Target #.75', expected);
    testFlowLine('  Source[100]Target #.75', expected);
    testFlowLine('  Source  [  100  ]  Target  \t  #.75  ', expected);
  });

  it('should handle empty value', () => {
    const expected = {
      source: 'Source',
      value: '',
      target: 'Target'
    };
    testFlowLine('Source[]Target', expected);
    testFlowLine('  Source[]Target', expected);
    testFlowLine('  Source  [\t  \t]Target  ', expected);
  });

  it('should handle empty target for when target and amaount are flipped', () => {
    const expected = {
      source: 'Source',
      value: 'Target',
      target: ''
    };
    testFlowLine('Source[Target]', expected);
    testFlowLine('Source[Target]#fff', expected);
    testFlowLine('Source[Target]#fff.99', expected);
    testFlowLine('  Source  [  Target  ]  #fff  ', expected);
    testFlowLine('  Source  [  Target  ]  #fff.99  ', expected);
  });

  it('should handle opacity with 1-4 digits', () => {
    const testCases = [
      { input: '.1', valid: true },
      { input: '.12', valid: true },
      { input: '.123', valid: true },
      { input: '.1234', valid: true },
      { input: '.12345', valid: false },
      { input: '1.2', valid: false }
    ];

    testCases.forEach(({ input, valid }) => {
      const line = `Source[100]Target #${input}`;
      const match = line.match(LINE_FLOW_REGEX);

      if (valid) {
        assert(match, `Should match: ${line}`);
        assert.strictEqual(match.groups.opacity, input, `Opacity should be ${input}`);
      } else {
        assert(!match || !match.groups.opacity, `Should not match invalid opacity: ${line}`);
      }
    });
  });

  it('should not match invalid color formats', () => {
    const invalidLines = [
      'Source[100]Target #',
      'Source[100]Target #zzz',
      'Source[100]Target #ff0000.',
      'Source[100]Target #ff0000.abc',
      'Source[100]Target #ff0000.12345'
    ];

    invalidLines.forEach(line => {
      const match = line.match(LINE_FLOW_REGEX);
      assert(!match || !match.groups.color, `Should not match invalid color format: ${line}`);
    });
  });
});
