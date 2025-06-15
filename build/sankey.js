import { IN, OUT } from './constants.js';

// Set up some handy constants (acting as enums)
// These numbers are relatively prime so each cross-product is unique
// (when we need that)
const SOURCES = 2;
const TARGETS = 3;
const TOP = 5;
const BOTTOM = 7;
const NEAREST = 11;

export class Sankey {
  constructor(nodes, flows, rightJustifyEndpoints, leftJustifyOrigins) {
    this.#nodes = nodes;
    this.#flows = flows;
    this.#rightJustifyEndpoints = rightJustifyEndpoints;
    this.#leftJustifyOrigins = leftJustifyOrigins;
    this.setup();
  }

  // Set by inputs:
  #nodeWidth = 9;
  #nodeHeightFactor = 0.5;
  #nodeSpacingFactor = 0.85;
  #size = { w: 1, h: 1 };
  #nodes = [];
  #flows = [];
  #rightJustifyEndpoints = false;
  #leftJustifyOrigins = false;
  #autoLayout = true;
  #attachIncompletesTo = NEAREST;
  // Calculated:
  #stagesArr = [];
  #maximumNodeSpacing = 0;
  #actualNodeSpacing = 0;
  #maxStage = -1;

  // ACCESSORS //

  nodeWidth(x) {
    if (arguments.length) {
      this.#nodeWidth = +x; return this;
    }
    return this.#nodeWidth;
  };

  nodeHeightFactor(x) {
    if (arguments.length) {
      this.#nodeHeightFactor = +x; return this;
    }
    return this.#nodeHeightFactor;
  };

  nodeSpacingFactor(x) {
    if (arguments.length) {
      this.#nodeSpacingFactor = +x; return this;
    }
    return this.#nodeSpacingFactor;
  };

  size(x) {
    if (arguments.length) {
      this.#size = x; return this;
    }
    return this.#size;
  };

  autoLayout(x) {
    if (arguments.length) {
      this.#autoLayout = x; return this;
    }
    return this.#autoLayout;
  };

  attachIncompletesTo(x) {
    if (arguments.length) {
      switch (x.toLowerCase()) {
      case 'leading': this.#attachIncompletesTo = TOP; break;
      case 'trailing': this.#attachIncompletesTo = BOTTOM; break;
      case 'nearest': this.#attachIncompletesTo = NEAREST; break;
        // no default
      }
      return this;
    }
    return this.#attachIncompletesTo;
  };

  // Getters:
  stages() {
    return this.#stagesArr;
  }

  // FUNCTIONS //

  // valueSum: Add up all the 'value' keys from a list of objects:
  valueSum(list) {
    return this.arraySum(list.map(b => b?.value || 0));
  }

  // divide: Substitute MIN_VALUE if a denominator would be 0:
  divide(a, b) {
    return a / (b || Number.MIN_VALUE);
  }

  // yCenter & yBottom: Y-position of the middle and end of a node.
  yCenter(n) {
    return n.y + n.dy / 2;
  }
  yBottom(n) {
    return n.y + n.dy;
  }

  // source___/target___: return the ___ of one end of a flow:
  sourceTop(f) {
    return f.source.y + f.sy;
  }
  targetTop(f) {
    return f.target.y + f.ty;
  }
  sourceCenter(f) {
    return f.source.y + f.sy + (f.dy / 2);
  }
  targetCenter(f) {
    return f.target.y + f.ty + (f.dy / 2);
  }
  sourceBottom(f) {
    return f.source.y + f.sy + f.dy;
  }
  targetBottom(f) {
    return f.target.y + f.ty + f.dy;
  }

  // Get the extreme bounds across a list of Nodes:
  leastY(nodeList) {
    return this.arrayMin(nodeList.map(n => n?.y));
  }
  greatestY(nodeList) {
    return this.arrayMax(nodeList.map(n => this.yBottom(n)));
  }

  arrayMin(list, defaultValue = Number.MAX_VALUE) {
    return list.filter(Number).reduce((a, b) => Math.min(a, b), defaultValue);
  }

  arrayMax(list, defaultValue = Number.MIN_VALUE) {
    return list.filter(Number).reduce((a, b) => Math.max(a, b), defaultValue);
  }

  arraySum(list) {
    return list.reduce((a, b) => a + (+b || 0), 0);
  }

  // Sorting functions:
  bySourceOrder(a, b) {
    return a.sourceRow - b.sourceRow;
  }
  byTopEdges(a, b) {
    return a.y - b.y;
  }

  // connectFlowsToNodes: Populate flows in & out for each node.
  connectFlowsToNodes() {
    // Initialize the flow buckets:
    for (const n of this.#nodes) {
      // Lists of flows which use this node as their target or source:
      n.flows = { [IN]: [], [OUT]: [] };
      // Mark these as real nodes we want to see:
      n.isAShadow = false;
    }

    // Connect each flow to its two nodes:
    for (const f of this.#flows) {
      // When the source or target is a number, that's an index;
      // convert it to the referenced object:
      if (typeof f.source === 'number') {
        f.source = this.#nodes[f.source];
      }
      if (typeof f.target === 'number') {
        f.target = this.#nodes[f.target];
      }

      // Add this flow to the affected source & target:
      f.source.flows[OUT].push(f);
      f.target.flows[IN].push(f);
      // By default, real flows are used when sorting/placing within a node.
      f.useForVisiblePlacing = true;
      // Mark these as real flows we want to see:
      f.isAShadow = false;
      f.hasAShadow = false;
    }
  }

  // computeNodeValues: Compute the value of each node by summing the
  // associated flows:
  computeNodeValues() {
    for (const n of this.#nodes) {
      // Remember the totals in & out:
      n.total = { [IN]: this.valueSum(n.flows[IN]), [OUT]: this.valueSum(n.flows[OUT]) };
      // Each node's value will be the greater of the two (or else the
      // smallest positive value):
      n.value = Math.max(n.total[IN], n.total[OUT], Number.MIN_VALUE);
    }
  }

  // flowSetStats: get the total weight+value from a group of flows
  #flowSetStats(nodeList, whichFlows) {
    // Get every flow touching one side & treat them as one list:
    const flowList = nodeList
      .map(n => n.flows[whichFlows])
      .flat()
      // Use the weighted value of a flow (this handles shadows):
      .filter(f => f.weightedValue > 0);
    // If 0 flows, return enough structure to satisfy the caller:
    if (flowList.length === 0) {
      return { value: 0, sources: { weight: 0 }, targets: { weight: 0 } };
    }

    return {
      value: this.arraySum(flowList.map(f => f.weightedValue)),
      sources: {
        weight: this.arraySum(flowList.map(f => this.sourceCenter(f) * f.weightedValue)),
        maxSourceStage: this.arrayMax(flowList.map(f => f.source.stage)),
      },
      targets: {
        weight: this.arraySum(flowList.map(f => this.targetCenter(f) * f.weightedValue)),
        minTargetStage: this.arrayMin(flowList.map(f => f.target.stage)),
      },
    };
  }
  // allFlowStats(nodeList): provides all components necessary to make
  // weighted-center calculations. These are used to decide where a
  // group of nodes would ideally 'want' to be.
  allFlowStats(nodeList) {
    // Return the stats for the set of all flows touching these nodes:
    return { [IN]: this.#flowSetStats(nodeList, IN), [OUT]: this.#flowSetStats(nodeList, OUT) };
  }

  // placeFlowAt(edge, fIndex):
  //   Update the bound, set this flow's offset, update the queue.
  #placeFlowAt(placing, bounds, edge, fIndex, flowsRemaining, parentNode) {
    const f = this.#flows[fIndex];
    let newY = 0;
    if (edge === TOP) {
      newY = bounds.upper;
      // If this is real, move the upper bound DOWN.
      if (f.useForVisiblePlacing || parentNode.isAShadow) {
        bounds.upper += f.dy;
      }
    } else { // edge === BOTTOM
      // Make room at the bottom of the range for this flow:
      newY = bounds.lower - f.dy;
      // If this is real, move the lower bound UP to match:
      if (f.useForVisiblePlacing || parentNode.isAShadow) {
        bounds.lower = newY;
      }
    }

    // Put the flow where we just decided & drop it from the queue:
    this.#placeFlow(placing, f, newY, flowsRemaining);

    if (f.useForVisiblePlacing && f.isAShadow) {
      // If this flow should be used for placing a real one AND is a
      // shadow flow, then copy its new position to the true flow & drop
      // that other flow from the queue too:
      this.#placeFlow(placing, this.#flows[f.shadowOf], newY, flowsRemaining);
    }
  }

  // placeUnhappiestFlowAt(edge):
  //   Figure out which flow is worst off (slope-wise) and place it.
  //   edge = TOP or BOTTOM
  #placeUnhappiestFlowAt(slopeData, placing, bounds, edge, flowsRemaining, parentNode) {
    // The queue may have been drained early. Guard against that:
    if (!flowsRemaining.size) {
      return;
    }
    const sKey = edge * placing,
      slopeOf = slopeData[sKey].f,
      // flowIndex = the ID of the unhappiest flow
      flowIndex = Array.from(flowsRemaining)
      // Exclude flows with shadows; they'll get their position
      // assigned when their shadow gets placed:
        .filter(i => !this.#flows[i].hasAShadow)
        .sort((a, b) => (
        // For autolayout, use the right slopes in the correct order (asc/dsc):
          this.#autoLayout
            ? (slopeData[sKey].dir * (slopeOf(this.#flows[a]) - slopeOf(this.#flows[b]))
              // If there is a tie, sort by x-distance (ascending):
              || this.#flows[a].dx - this.#flows[b].dx)
            : 0)
          // If we are using exact order (OR if there is still a tie),
          // sort by sourceRow (which is also set for shadow flows)
          || this.#flows[a].sourceRow - this.#flows[b].sourceRow)[0];
    // If we found a flow, place it at the correct edge:
    if (flowIndex !== undefined) {
      this.#placeFlowAt(placing, bounds, edge, flowIndex, flowsRemaining, parentNode);
    }
  }

  // placeFlow(f, y): Update a flow's position
  #placeFlow(placing, f, newTopY, flowsRemaining) {
    // Is the flow actually in the queue? Exit if not. (This can happen
    // when we're placing a shadow flow and offer to update the original
    // flow's Y, but it's in some other stage.)
    if (!flowsRemaining.has(f.index)) {
      return;
    }
    // sy & ty (source/target y) are the vertical *offsets* at each end
    // of a flow, determining where below the node's top edge the flow's
    // top will meet.
    if (placing === TARGETS) {
      f.ty = newTopY - f.target.y;
    } else {
      f.sy = newTopY - f.source.y;
    }
    // Drop the flow we just placed from the queue:
    flowsRemaining.delete(f.index);
  }

  // sortFlows(node, placing):
  //   Given a node & a side, reorder that group of flows as best we can.
  //   'placing' indicates which end of the flows we're working on here:
  //      - TARGETS = we're placing the targets of n.flows[IN]
  //      - SOURCES = we're placing the sources of n.flows[OUT]
  #sortFlows(n, placing) {
    const dir = placing === TARGETS ? IN : OUT
    const fStats = this.allFlowStats([n]);
    const flowsToSort = n.flows[dir];
    const totalFlowValue = n.total[dir];
    const totalFlowWeight = (dir === IN ? fStats[IN].sources : fStats[OUT].targets).weight;
    // Make a Set of flow IDs we can delete from as we go:
    const flowsRemaining = new Set(flowsToSort.map(f => f.index));
    // Calculate how tall the flow group is which will attach to this
    // node (may be less than n.dy):
    const totalFlowSpan = this.arraySum(
      // Only count the space which is needed for visible flows (when
      // the node is real) OR for flows meeting a shadow node:
      flowsToSort.filter(f => !f.isAShadow || n.isAShadow).map(f => f.dy)
    );
    // Attach flows to the *top* of the range, *except* when:
    // the entire node's value is not all flowing somewhere, AND
    // - The caller says to attach them to the bottom, OR
    // - The caller says to use the 'nearest' end AND
    //   - the center-of-all-attached-flows is below the node's
    //     own center.
    const flowPosition
        = totalFlowValue < n.value
          && (this.#attachIncompletesTo === BOTTOM
              || (this.#attachIncompletesTo === NEAREST
                  && this.divide(totalFlowWeight, totalFlowValue) > this.yCenter(n)))
          ? BOTTOM
          : TOP;
    // upper/lower bounds = the range where flows may attach
    const bounds
        = flowPosition === TOP
          ? { upper: n.y, lower: n.y + totalFlowSpan }
          : { upper: this.yBottom(n) - totalFlowSpan, lower: this.yBottom(n) };
    // Reminder: In SVG-land, y-axis coordinates are inverted...
    //   "upper" & "lower" are meant visually here, not numerically.

    // slopeData keys are the product of an 'edge' & a 'placing' value:
    const slopeData = {
      [TOP * TARGETS]: { f: f => (bounds.upper - this.sourceTop(f)) / f.dx, dir: -1 },
      [TOP * SOURCES]: { f: f => (this.targetTop(f) - bounds.upper) / f.dx, dir: 1 },
      [BOTTOM * TARGETS]: { f: f => (bounds.lower - this.sourceBottom(f)) / f.dx, dir: 1 },
      [BOTTOM * SOURCES]: { f: f => (this.targetBottom(f) - bounds.lower) / f.dx, dir: -1 },
    };

    // Loop through the flow set, placing them from the outside in.
    // If there are at least 2 flows to be placed, we figure out which is
    // best suited to occupy the top & bottom edge spots.
    // After placing those, the remaining range is reduced & we repeat.
    while (flowsRemaining.size > 1) {
      // Place the least fortunate flows, then subtract their size from
      // the available range:
      this.#placeUnhappiestFlowAt(slopeData, placing, bounds, TOP, flowsRemaining, n);
      if (this.#autoLayout) {
        this.#placeUnhappiestFlowAt(slopeData, placing, bounds, BOTTOM, flowsRemaining, n);
      }
      // (If using exact order, we want to place top->bottom, NOT alternate.)
    }

    // After that loop, we have 0-1 flows. If there is one, place it:
    for (const i of flowsRemaining) {
      this.#placeFlowAt(placing, bounds, TOP, i, flowsRemaining, n);
    }
  }

  // placeFlowsInsideNodes(nodeList):
  //   Compute the y-offset of every flow's source and target endpoints,
  //   relative to the each node's y-position.
  #placeFlowsInsideNodes(nodeList) {
    // We have the utility functions defined now; time to actually use them.

    // First, update the x-distance (dx) values for all flows -- they may
    // have moved since their initial placement, due to drags. Two notes:
    // 1) We use the *absolute* value of the x-distance, so even when a node
    //    is dragged to the opposite side of a connected node, the ordering
    //    will remain stable.
    // 2) Denominator dx must not be 0, so MIN_VALUE is substituted if needed.
    for (const f of this.#flows) {
      f.dx = Math.abs(f.target.x - f.source.x) || Number.MIN_VALUE;
    }

    // Gather all the distinct batches of flows we'll need to process (each
    // node may have 0-2 batches):
    const flowBatches = [
      ...nodeList.filter(n => n.flows[IN].length)
        .map(n => (
          { i: n.index, len: n.flows[IN].length, placing: TARGETS }
        )),
      ...nodeList.filter(n => n.flows[OUT].length)
        .map(n => (
          { i: n.index, len: n.flows[OUT].length, placing: SOURCES }
        )),
    ];

    // Sort the flow batches so that we start with those having the FEWEST
    // flows and work upward.
    // Reason: a 1-flow placement is certain; a 2-flow set is simple; etc.
    // By settling easier cases first, the harder cases end up with fewer
    // wild possibilities for how they may be arranged.
    flowBatches.sort((a, b) => a.len - b.len);
    for (const fBatch of flowBatches) {
      // Finally: Go through every batch & sort its flows anew:
      this.#sortFlows(this.#nodes[fBatch.i], fBatch.placing);
    }
  }

  // Handle layout checkboxes:
  #setStageWhenNoFlows(direction, newStage) {
    // For nodes with no flows going {direction}...
    for (const n of this.#nodes.filter(n => !n.flows[direction].length)) {
      // ...set their stages to newStage:
      n.stage = newStage;
    }
  }

  // assignNodesToStages: Iteratively assign the stage (x-group) for each node.
  // Nodes are assigned the maximum stage of their incoming neighbors + 1,
  // then any nodes which can be nudged forward are.
  assignNodesToStages() {
    const nodesToCheckAgain = new Set();

    // Work from left to right.
    // Assign every node to stage 0, then keep updating the stage of every node
    // that was a target of a known node. Repeat and fade.
    let nodesToPlace = this.#nodes;
    // The maxStage check is to avoid an infinite loop when there is a cycle:
    while (nodesToPlace.length && this.#maxStage < this.#nodes.length - 1) {
      this.#maxStage += 1;
      for (const n of nodesToPlace) {
        n.stage = this.#maxStage;
        for (const f of n.flows[OUT]) {
          nodesToCheckAgain.add(f.target);
        }
      }

      nodesToPlace = Array.from(nodesToCheckAgain);
      nodesToCheckAgain.clear();
    }

    // Pull any source nodes to the right which have room to move.
    // First, get a COPY of the list of all nodes with targets:
    const nodesWithTargets = this.#nodes.filter(n => n.flows[OUT].length).slice();
    nodesWithTargets.sort((a, b) => b.stage - a.stage); // Sort that by stage, descending
    for (const n of nodesWithTargets) {
      // Find n's minimum target stage and use the one right before that:
      const maxNewStage = this.arrayMin(n.flows[OUT].map(f => f.target.stage)) - 1;
      if (n.stage < maxNewStage) {
        n.stage = maxNewStage;
      }
    }

    // Force origins to appear all the way to the left?
    if (this.#leftJustifyOrigins) {
      this.#setStageWhenNoFlows(IN, 0);
    }

    // Force endpoints all the way to the right?
    if (this.#rightJustifyEndpoints) {
      this.#setStageWhenNoFlows(OUT, this.#maxStage);
    }

    // Now that the main nodes and flows are in place, we also fill in
    // SHADOW nodes & flows to occupy space whenever stages are skipped.
    // To get started, fill in the 'ds' (stage distance) for all flows:
    for (const f of this.#flows) {
      f.ds = f.target.stage - f.source.stage;
    }

    // Next, operate on flows which cross more than one stage:
    const shadowNodeNames = new Map();
    for (const f of this.#flows.filter(f => Math.abs(f.ds) > 1)) {
      const nodesForThisFlow = [f.source];
      // Duplicate the source node as many times as needed (though only
      // as large as this individual flow)
      for (let i = 1; i < f.ds; i += 1) {
        const shadowStage = f.source.stage + i;
        // Create a custom name for the shadow which will still group
        // multiple flows between the same 2 places.
        const newNodeName = `sh_${f.source.index}_${f.target.index}_s${shadowStage}`;
        const fVal = Number(f.value);

        let shadowNode;
        // Have we already made a shadow node for this source/target?
        if (shadowNodeNames.has(newNodeName)) {
          // If so, let's add value to the node we've already made:
          shadowNode = this.#nodes[shadowNodeNames.get(newNodeName)];
          shadowNode.value += fVal;
          shadowNode.total[IN] += fVal;
          shadowNode.total[OUT] += fVal;
        } else {
          // A shadow node doesn't exist, so we make a fresh one with the
          // same sourceRow as the original flow:
          shadowNode = {
            index: this.#nodes.length,
            stage: shadowStage,
            name: newNodeName,
            sourceRow: f.sourceRow,
            isAShadow: true,
            flows: { [IN]: [], [OUT]: [] },
            total: { [IN]: fVal, [OUT]: fVal },
            value: fVal,
          };
          // Add this to the big list and to our shadow-tracking list:
          this.#nodes.push(shadowNode);
          shadowNodeNames.set(newNodeName, shadowNode.index);
        }
        nodesForThisFlow.push(shadowNode);
      }
      nodesForThisFlow.push(f.target);

      // Now that we have a list of all nodes along the way, add shadow
      // flows between each pair (starting from the 2nd item in the list).
      for (let i = 1; i < nodesForThisFlow.length; i += 1) {
        const sourceNode = nodesForThisFlow[i - 1];
        const targetNode = nodesForThisFlow[i];
        const origSourceRow = Number(f.sourceRow);
        // Take values from the original flow, then override some:
        const newFlow = {
          ...f,
          source: sourceNode,
          target: targetNode,
          index: this.#flows.length,
          shadowOf: f.index,
          isAShadow: true,
          hasAShadow: false,
          // Make artificial sourceRow numbers so these get prioritized
          // *with* the original flow:
          sourceRow: origSourceRow + i / (f.ds + 1),
          // Should we propagate this shadow's y position to the original
          // flow? Only at the ends of the shadow path.
          useForVisiblePlacing:
                sourceNode.stage === f.source.stage
                  || targetNode.stage === f.target.stage,
        };

        this.#flows.push(newFlow);
        newFlow.source.flows[OUT].push(newFlow);
        newFlow.target.flows[IN].push(newFlow);
      }

      // Now that we're done adopting various values from original flow f,
      // tell f itself that Things have Changed:
      f.useForVisiblePlacing = false;
      f.hasAShadow = true;
    }
  }

  // Set up stagesArr: one array element for each stage, containing that
  // stage's nodes, in stage order.
  // This can also be called when nodes' info may have been updated elsewhere
  // & we need a fresh map generated.
  updateStagesArray() {
    this.#stagesArr = Object.entries(Object.groupBy(this.#nodes, ({stage}) => stage)) // [stage, [nodes]]
      .sort((a, b) => a[0] - b[0])
      // Extract each stage and sort its nodes by sourceRow.
      // (This raises shadow nodes to the same rank the original flow is at)
      .map(([_stage, nodes]) => nodes.sort(this.bySourceOrder));
  }

  // nodeSetStats(nodeList):
  //   Get the total weight+value from an assortment of Nodes.
  //   The Nodes are expected to all be in the same Stage.
  #nodeSetStats(nodeList) {
    const weight = this.arraySum(nodeList.map(n => this.yCenter(n) * n.value));
    const value = this.valueSum(nodeList);
    return {
      stage: nodeList[0].stage,
      weight: weight,
      value: value,
      center: this.divide(weight, value),
    };
  }

  // Set up the scaling factor and the initial x & y of all the Nodes:
  #initializeNodePositions() {
    // First, calculate the spacing values.
    // How many nodes are in the 'busiest' stage?
    const greatestNodeCount = this.arrayMax(this.#stagesArr.map(s => s.length));

    let ky = 0;
    // Special case: What if there's only one node in every stage?
    // That calculation is very different:
    if (greatestNodeCount === 1) {
      [this.#maximumNodeSpacing, this.#actualNodeSpacing] = [0, 0];
      ky = this.#nodeHeightFactor * this.arrayMin(this.#stagesArr.map(s => this.divide(this.#size.h, this.valueSum(s))));
    } else {
      // What if each node in the busiest stage got 1 pixel?
      // Figure out how many pixels would be left over.
      // (If pixels < 2, use 2; otherwise the slider has nothing to do.)
      const allAvailablePadding = Math.max(2, this.#size.h - greatestNodeCount);

      // A nodeHeightFactor of 0 means: 'pad as much as possible
      // without making any node less than 1 pixel tall'.
      // Formula for the initial spacing value when nHF = 0:
      //   allAvailablePadding / (# of spaces in the busiest stage)
      this.#maximumNodeSpacing = ((1 - this.#nodeHeightFactor) * allAvailablePadding) / (greatestNodeCount - 1);
      this.#actualNodeSpacing = this.#maximumNodeSpacing * this.#nodeSpacingFactor;
      // Finally, calculate the vertical scaling factor for all
      // nodes, given maximumNodeSpacing & the diagram's height:
      ky = this.arrayMin(this.#stagesArr.map(s => this.divide(this.#size.h - (s.length - 1) * this.#maximumNodeSpacing, this.valueSum(s))));
    }
    if (ky === Infinity) {
      ky = 1;
    } // This happens if all Node values are 0

    // Compute all the dy & weighted values using the now-known scale
    // of the graph:
    for (const f of this.#flows) {
      f.dy = f.value * ky;
      f.weightedValue = f.hasAShadow ? 0 : f.value;
    }
    // Also: Ensure each node has a nonzero height:
    for (const n of this.#nodes) {
      n.dy = Math.max(n.value * ky, Number.MIN_VALUE);
    }

    // Set the initial positions of all nodes within each stage.
    // The initial stage will start with all nodes centered vertically,
    // separated by the actualNodeSpacing.
    // Each stage afterwards will center on its combined source nodes.
    let targetY;
    for (const [stageIndex, s] of this.#stagesArr.entries()) {
      const stageSize = (this.valueSum(s) * ky) + (this.#actualNodeSpacing * (s.length - 1));
      targetY = this.#size.h / 2; // default case = center this batch of nodes
      // If we have any flows into the current set of nodes, we have a
      // chicken/egg problem: We want to use weighted centers based on
      // flows (i.e. flowSetStats), but at this point 0 flows are placed.
      // Simpler approach: use the weighted center of nodes flowing in.
      const allFlowsIn = s.map(n => n.flows[IN]).flat();
      if (allFlowsIn.length > 0) {
        const uniqueSourceNodes = new Set(
          allFlowsIn.map(f => f.source)
          // Since shadows are in every stage, don't look back more than
          // 1 stage. (And self-loops may mean there are flows from the
          // *same* stage, currently.)
            .filter(n => n.stage >= stageIndex - 1)
        );
        targetY = this.#nodeSetStats(Array.from(uniqueSourceNodes)).center;
      }

      // Calculate the first-node-in-this-stage's y position (while not
      // letting it be placed where the stage will exceed either boundary):
      let nextNodePos = Math.max( 0, Math.min(targetY - (stageSize / 2), this.#size.h - stageSize) );
      for (const n of s) {
        n.y = nextNodePos;
        // Find the y position of the next node:
        nextNodePos = this.yBottom(n) + this.#actualNodeSpacing;
      }
    };

    // Set up x-values too.
    // Apply a scaling factor based on width per stage:
    const widthPerStage = this.#maxStage > 0 ? (this.#size.w - this.#nodeWidth) / this.#maxStage : 0;
    for (const n of this.#nodes) {
      n.x = widthPerStage * n.stage;
      n.dx = this.#nodeWidth;
    }

    // With nodes placed, we *also* have to provide an initial
    // placement for all flows, so that their weights can be measured
    // realistically in the placeNodes() routine.
    for (const n of this.#nodes) {
      // Each flow is initially placed naively, just using the input order.
      // Any misfires will be corrected soon by placeFlowsInsideNodes()
      let [sy, ty] = [0, 0];
      // Shadows touching a real node adopt the same position as their
      // 'true' flow. (NOTE: This works because all shadows initially
      // *follow* all real flows.):
      for (const f of n.flows[OUT]) {
        if (f.isAShadow && !n.isAShadow) {
          f.sy = this.#flows[f.shadowOf].sy;
        } else {
          f.sy = sy; sy += f.dy;
        }
      }
      for (const f of n.flows[IN]) {
        if (f.isAShadow && !n.isAShadow) {
          f.ty = this.#flows[f.shadowOf].ty;
        } else {
          f.ty = ty; ty += f.dy;
        }
      }
    }
  }

  // findNodeGroupOffset(nodeList):
  //   Figure out where these Nodes want to be, and return the
  //   appropriate y-offset value.
  #findNodeGroupOffset(nodeList) {
    // The population of flows to test = the combination of every
    // last flow touching this group of Nodes:
    const fStats = this.allFlowStats(nodeList);
    const totalIn = fStats[IN].value;
    const totalOut = fStats[OUT].value;
    // If there are no flows touching *either* side here, there's nothing
    // to offset ourselves relative to, so we can exit early:
    if (totalIn === 0 && totalOut === 0) {
      return 0;
    }

    const nStats = this.#nodeSetStats(nodeList);
    // projectedSourceCenter =
    //   the current Node group's weighted center
    //     MINUS the weighted center of incoming Flows' targets
    //     PLUS the weighted center of incoming Flows' sources.
    // Thought exercise:
    // If 100% of the value of the Node group is flowing in, then this is
    // exactly equivalent to: *the weighted center of all sources*.
    const projectedSourceCenter = this.divide(
      nStats.weight - fStats[IN].targets.weight + fStats[IN].sources.weight,
      nStats.value
    );

    // projectedTargetCenter = the same idea in the other direction:
    //   current Node group's weighted center
    //     - outgoing weights' center
    //     + final center of those weights
    const projectedTargetCenter = this.divide(
      nStats.weight - fStats[OUT].sources.weight + fStats[OUT].targets.weight,
      nStats.value
    );

    // Time to do the positioning calculations.
    let goalY = 0;
    if (totalOut === 0) {
      // If we have only in-flows, it's simple:
      // Center the current group relative only to its sources.
      goalY = projectedSourceCenter;
    } else if (totalIn === 0) {
      // Only out-flows? Center this group on its targets:
      goalY = projectedTargetCenter;
    } else {
      // There are flows both in & out. Find the slope between the centers:
      const startStage = fStats[IN].sources.maxSourceStage;
      const endStage = fStats[OUT].targets.minTargetStage;
      const stageDistance = endStage - startStage;
      const slopeBetweenCenters = stageDistance !== 0 // Avoid divide-by-0 error
        ? (projectedTargetCenter - projectedSourceCenter) / stageDistance
        : 0;
      // Where along that line should this current group be centered?
      goalY = projectedSourceCenter + (nStats.stage - startStage) * slopeBetweenCenters;
    }

    // We have a goal Y value! Return the offset from the current center:
    return goalY - nStats.center;
  }

  // nodesAreAdjacent: Given two nodes *in height order*, is the top of n2
  // bumping up against n1's bottom edge?
  #nodesAreAdjacent(n1, n2) {
    // Is the bottom of the 1st node + the node spacing essentially
    // the same as the 2nd node's top? (i.e. within a tenth of a 'pixel')
    return (n2.y - this.#actualNodeSpacing - this.yBottom(n1)) < 0.1;
  }

  // enforceValidNodePositions():
  //   Make sure this stage doesn't extend past either the top or
  //   bottom, and preserve the required spacing between nodes.
  #enforceValidNodePositions(s) {
    // Nudge down any nodes which are past the top:
    let yPos = 0; // = the current available y closest to the top
    for (const n of s) {
      // If this node's top is above yPos, nudge the node down:
      if (n.y < yPos) {
        n.y = yPos;
      }
      // Set yPos to the next available y toward the bottom:
      yPos = this.yBottom(n) + this.#actualNodeSpacing;
    }

    // ... if we've gone *past* the bottom, bump nodes back up.
    yPos = this.#size.h; // = the current available y closest to the bottom
    for (const n of s.slice().reverse()) {
      // if this node's bottom is below yPos, nudge it up:
      if (this.yBottom(n) > yPos) {
        n.y = yPos - n.dy;
      }
      // Set yPos to the next available y toward the top:
      yPos = n.y - this.#actualNodeSpacing;
    }
  }

  #centerNeighborGroups(s) {
    // First, Gather groups of neighbors. This loop produces arrays
    // of 1 or more nodes which need to be nudged together.
    const neighborGroups = [];
    for (const [i, n] of s.entries()) {
      // Can we include this node as a neighbor of its predecessor?
      if (i > 0 && this.#nodesAreAdjacent(s[i - 1], n)) {
        // Yes? Then append it to the 'current' group:
        const lastGroup = neighborGroups.length - 1;
        neighborGroups[lastGroup].push(n);
      } else {
        // No? Start a new group:
        neighborGroups.push([n]);
      }
    }

    // At this point we *may* have node groups which need nudges.
    // For each multi-node group, find the weighted center of its
    // sources/targets, and place that group's center along that
    // line:
    for (const nodeGroup of neighborGroups.filter(g => g.length > 1)) {
      // Apply the offset to the entire node group:
      const yOffset = this.#findNodeGroupOffset(nodeGroup);
      for (const n of nodeGroup) {
        n.y += yOffset;
      }
    }
  }

  // updateStageCentering(stage):
  //   Make sure nodes are spaced far enough apart from each other,
  //   AND, after some have been nudged apart, put those
  //   now-locked-together groups of nodes in the best available
  //   position given their group's *overall* connections in & out.
  updateStageCentering(s) {
    // First, sort this stage's nodes based on either their current
    // positions or on the order they appeared in the data:
    s.sort(this.#autoLayout ? this.byTopEdges : this.bySourceOrder);

    // Make sure any overlapping nodes preserve the required spacing.
    // Run the first nudge of all to see what bumps against each other:
    this.#enforceValidNodePositions(s);

    // Look for sets of neighbors and center them as best we can:
    this.#centerNeighborGroups(s);
    // Make sure we're still on the canvas:
    this.#enforceValidNodePositions(s);

    // Since we may have just created more neighbors, iterate 1 more time:
    this.#centerNeighborGroups(s);
    this.#enforceValidNodePositions(s);
    // We could keep doing more rounds! But have to stop somewhere.
    // Someday I hope to update this to notice when we've either:
    // 1) stopped bumping into more nodes, or else
    // 2) reached the maximum group (all nodes in 1 neighbor group)
    // For now, this will do.
  }

  // processStages(stageList, factor):
  //   Iterate over a list of stages in the given order, moving Nodes
  //   and Flows around according to the given factor (which proceeds
  //   from 0.99 downwards as the iterations continue).
  #processStages(stageList, factor) {
    for (const s of stageList) {
      // Move each node to its ideal vertical position:
      for (const n of s) {
        n.y += this.#findNodeGroupOffset([n]) * factor;
      }
      // Update this stage's node positions to incorporate their proximity
      // & required spacing *now*, since they'll be used as the basis for
      // weights in the very next stage:
      this.updateStageCentering(s);
      // Update the flow sorting too; same reason:
      this.#placeFlowsInsideNodes(s);
    }
    // At the end of each round, do a proper final flow placement
    // across the whole diagram. (Some locally-optimized flow choices
    // don't work across the whole and need this resolution step
    // before doing more balancing).
    this.#placeFlowsInsideNodes(this.#nodes);
  }

  // reCenterDiagram:
  // If (the vertical size of the space occupied by the nodes)
  //  < (the total diagram's Height),
  // then offset ALL Nodes' y positions to center the diagram:
  #reCenterDiagram() {
    const minY = this.leastY(this.#nodes)
    const yH =  this.greatestY(this.#nodes) - minY;
    if (yH < this.#size.h) {
      const yOffset = (this.#size.h / 2) - (minY + (yH / 2));
      for (const n of this.#nodes) {
        n.y += yOffset;
      }
    }
  }

  // placeNodes(iterations):
  //   Set (and then adjust) the y-position for each node and flow, based
  //   on their connections to other points in the diagram.
  placeNodes(iterations) {
    // Enough preamble. Lay out the nodes:
    this.#initializeNodePositions();
    // Resolve all collisions/spacing & place all flows to start:
    for (const s of this.#stagesArr) {
      this.updateStageCentering(s);
    }
    this.#placeFlowsInsideNodes(this.#nodes);

    let [alpha, counter] = [1, 0];
    while (counter < iterations) {
      counter += 1;
      // Make each round of moves progressively weaker:
      alpha *= 0.99;
      // Run through stages left-to-right, then right-to-left:
      this.#processStages(this.#stagesArr, alpha);
      this.#processStages(this.#stagesArr.slice().reverse(), alpha);
      this.#reCenterDiagram();
    }

    // After the last layout adjustment, remember these node coordinates
    // (for reference when the user is dragging nodes):
    for (const n of this.#nodes) {
      n.origPos = { x: n.x, y: n.y };
      n.lastPos = { x: n.x, y: n.y };
      n.move = [0, 0];
    }
  }

  // setup() = define the *skeleton* of the diagram -- which nodes link to
  // which, and in which stages -- but no specific positions yet:
  setup() {
    this.connectFlowsToNodes();
    this.computeNodeValues();
    this.assignNodesToStages();
    this.updateStagesArray();
    return this;
  };

  // layout() = Given a complete skeleton, use the given total width/height and
  // set the exact positions of all nodes and flows:
  layout(iterations) {
    // In case anything's changed since setup, re-generate our map:
    this.updateStagesArray();
    // Iterate over the structure several times to make the layout nice:
    this.placeNodes(iterations);
    return this;
  };

  // relayout() = Given a complete diagram with some new node positions,
  // calculate where the flows must now start/end:
  relayout() {
    this.#placeFlowsInsideNodes(this.#nodes);
    return this;
  };
};
