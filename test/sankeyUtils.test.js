import { test } from 'node:test';
import assert from 'node:assert';
import { calculateMissingFlowValues } from '../build/components/sankeyUtils.js';
import { Flow, Node } from '../build/sankey.js';

test('resolveFlowValues', async t => {
  await t.test('should resolve simple flow values', () => {
    const A = new Node('A');
    const B = new Node('B');
    const C = new Node('C');

    // A -> B (10) -> C (10)
    const flowAB = new Flow(A, B, 10);
    const flowBC = new Flow(B, C, 10);

    const allNodes = [A, B, C];
    const allFlows = new Set([flowAB, flowBC]);

    calculateMissingFlowValues(allNodes, allFlows);

    assert.strictEqual(flowAB.value, 10);
    assert.strictEqual(flowBC.value, 10);
  });

  await t.test('should resolve wildcard flow values', () => {
    const A = new Node('A');
    const B = new Node('B');
    const C = new Node('C');
    const D = new Node('D');

    // A -> B (*) -> C (20)
    const flowAB = new Flow(A, B, '?');
    const flowBC = new Flow(B, C, '?');
    const flowCD = new Flow(C, D, 20);

    const allNodes = [A, B, C, D];
    const allFlows = new Set([flowAB, flowBC, flowCD]);
    calculateMissingFlowValues(allNodes, allFlows);

    assert.strictEqual(flowAB.value, 20);
    assert.strictEqual(flowBC.value, 20);
    assert.strictEqual(flowCD.value, 20);
  });

  await t.test('should split values between multiple unknown flows', () => {
    const A = new Node('A');
    const B = new Node('B');
    const C = new Node('C');
    const D = new Node('D');
    const E = new Node('E');

    // A -> B (*), A -> C (*)
    const flowAB = new Flow(A, B, '?');
    const flowCB = new Flow(C, B, '?');
    const flowBD = new Flow(B, D, 30);
    const flowAE = new Flow(A, E, 30);

    const allNodes = [A, B, C, D, E];
    const allFlows = new Set([flowAB, flowCB, flowBD, flowAE]);
    calculateMissingFlowValues(allNodes, allFlows);

    assert.strictEqual(flowAB.value, 15);
    assert.strictEqual(flowCB.value, 15);
    assert.strictEqual(flowBD.value, 30);
  });

  await t.test('should handle nodes with no incoming or outgoing flows', () => {
    const A = new Node('A');
    const B = new Node('B');

    // A -> B (*)
    const flowAB = new Flow(A, B, '?');

    const allNodes = [A, B];
    const allFlows = new Set([flowAB]);
    calculateMissingFlowValues(allNodes, allFlows);

    // Should not be able to resolve without more information
    assert.strictEqual(A.outgoingFlows[0].value, '?');
    assert.strictEqual(B.incomingFlows[0].value, '?');
  });

  await t.test('should handle circular dependencies', () => {
    const A = new Node('A');
    const B = new Node('B');

    // A -> B (*), B -> A (*)
    const flowAB = new Flow(A, B, '?');
    const flowBA = new Flow(B, A, '?');

    const allNodes = [A, B];
    const allFlows = new Set([flowAB, flowBA]);
    calculateMissingFlowValues(allNodes, allFlows);

    // Should not be able to resolve circular dependencies
    assert.strictEqual(flowAB.value, '?');
    assert.strictEqual(flowBA.value, '?');
  });

  await t.test('should handle complex flow chains', () => {
    const A = new Node('A');
    const B = new Node('B');
    const C = new Node('C');
    const D = new Node('D');
    const E = new Node('E');

    // A -> B (*) -> C (*) -> D (20)
    const flowAB = new Flow(A, B, '?');
    const flowBC = new Flow(B, C, '?');
    const flowCD = new Flow(C, D, '?');
    const flowDE = new Flow(D, E, 20);

    const allNodes = [A, B, C, D, E];
    const allFlows = new Set([flowAB, flowBC, flowCD, flowDE]);
    calculateMissingFlowValues(allNodes, allFlows);

    assert.strictEqual(flowAB.value, 20);
    assert.strictEqual(flowBC.value, 20);
    assert.strictEqual(flowCD.value, 20);
    assert.strictEqual(flowDE.value, 20);
  });
});
