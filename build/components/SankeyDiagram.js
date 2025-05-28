import * as d3 from 'd3';
import { logger as msg } from '../ux/logger.js';
import { settingsService } from '../services/settingsService';

/**
 * SankeyDiagram Component
 * Handles the rendering and interaction of the Sankey diagram
 */
class SankeyDiagram {
  constructor(containerId, options = {}) {
    this.container = d3.select(`#${containerId}`);
    this.options = {
      width: 1200,
      height: 800,
      nodeWidth: 15,
      nodePadding: 10,
      ...options
    };

    this.init();
  }

  /**
   * Initialize the SVG container and basic structure
   */
  init() {
    // Clear any existing content
    this.container.html('');

    // Create SVG element
    this.svg = this.container.append('svg')
      .attr('width', '100%')
      .attr('height', '100%')
      .attr('viewBox', `0 0 ${this.options.width} ${this.options.height}`)
      .attr('preserveAspectRatio', 'xMidYMid meet');

    // Create main group for the diagram
    this.chart = this.svg.append('g');

    // Create defs for gradients and patterns
    this.defs = this.svg.append('defs');

    // Initialize zoom behavior
    this.initZoom();

    // Initialize drag behavior
    this.initDrag();
  }

  /**
   * Initialize zoom behavior
   */
  initZoom() {
    const zoom = d3.zoom()
      .scaleExtent([0.1, 4])
      .on('zoom', event => {
        this.chart.attr('transform', event.transform);
      });

    this.svg.call(zoom);
  }

  /**
   * Initialize drag behavior for nodes
   */
  initDrag() {
    this.drag = d3.drag()
      .on('start', this.dragStart.bind(this))
      .on('drag', this.dragging.bind(this))
      .on('end', this.dragEnd.bind(this));
  }

  /**
   * Handle drag start event
   */
  dragStart(event, d) {
    // Store initial position
    d.x0 = d.x0 || d.x;
    d.y0 = d.y0 || d.y;
  }

  /**
   * Handle dragging event
   */
  dragging(event, d) {
    // Update node position
    d.x = d.x0 + event.dx;
    d.y = d.y0 + event.dy;

    // Update links connected to this node
    this.updateNodePosition(d);
  }

  /**
   * Handle drag end event
   */
  dragEnd(event, d) {
    // Save the new position
    d.x0 = d.x;
    d.y0 = d.y;

    // Update the diagram
    this.updateDiagram();
  }

  /**
   * Update the position of a node and its connected links
   * @param {Object} node - The node to update
   */
  updateNodePosition(node) {
    // Update node position
    this.nodeElements
      .filter(d => d.id === node.id)
      .attr('transform', d => `translate(${d.x},${d.y})`);

    // Update links
    this.updateLinks();
  }

  /**
   * Update the diagram with new data
   * @param {Object} data - The data to render
   */
  update(data) {
    if (!data || !data.nodes || !data.links) {
      msg.add('Invalid data for Sankey diagram', 'issue');
      return;
    }

    this.data = data;
    this.processData();
    this.render();
  }

  /**
   * Process the data for rendering
   */
  processData() {
    const { nodes, links } = this.data;

    // Calculate node depths and positions
    this.calculateNodeDepths(nodes, links);

    // Calculate link paths
    this.calculateLinkPaths(links);
  }

  /**
   * Calculate node depths and positions
   * @param {Array} nodes - Array of nodes
   * @param {Array} links - Array of links
   */
  calculateNodeDepths(nodes, links) {
    // Simple implementation - can be enhanced with D3's sankey layout
    const nodeMap = new Map(nodes.map(node => [node.id, node]));

    // Reset depths
    nodes.forEach(node => {
      node.depth = 0;
      node.height = 0;
    });

    // Calculate depths (BFS)
    const queue = nodes.filter(node => !links.some(link => link.target === node.id));
    const visited = new Set();

    while (queue.length > 0) {
      const node = queue.shift();

      if (visited.has(node.id)) continue;
      visited.add(node.id);

      // Update depth based on incoming links
      links
        .filter(link => link.target === node.id)
        .forEach(link => {
          const sourceNode = nodeMap.get(link.source);
          if (sourceNode) {
            node.depth = Math.max(node.depth, sourceNode.depth + 1);
          }
        });

      // Add source nodes to queue
      links
        .filter(link => link.source === node.id)
        .map(link => nodeMap.get(link.target))
        .filter(targetNode => targetNode && !visited.has(targetNode.id))
        .forEach(targetNode => queue.push(targetNode));
    }

    // Position nodes based on depth
    const depthGroups = {};
    nodes.forEach(node => {
      if (!depthGroups[node.depth]) {
        depthGroups[node.depth] = [];
      }
      depthGroups[node.depth].push(node);
    });

    const maxDepth = Math.max(...Object.keys(depthGroups).map(Number));
    const widthStep = this.options.width / (maxDepth + 1);

    // Position nodes
    Object.entries(depthGroups).forEach(([depth, groupNodes]) => {
      const x = depth * widthStep;
      const heightStep = this.options.height / (groupNodes.length + 1);

      groupNodes.forEach((node, i) => {
        node.x = x;
        node.y = (i + 1) * heightStep;
      });
    });
  }

  /**
   * Calculate link paths between nodes
   * @param {Array} links - Array of links
   */
  calculateLinkPaths(links) {
    // Simple straight lines - can be enhanced with curves
    links.forEach(link => {
      const sourceNode = this.data.nodes.find(n => n.id === link.source);
      const targetNode = this.data.nodes.find(n => n.id === link.target);

      if (sourceNode && targetNode) {
        link.path = this.createLinkPath(
          sourceNode.x + this.options.nodeWidth,
          sourceNode.y,
          targetNode.x,
          targetNode.y
        );
      }
    });
  }

  /**
   * Create an SVG path for a link
   * @param {number} x1 - Source x-coordinate
   * @param {number} y1 - Source y-coordinate
   * @param {number} x2 - Target x-coordinate
   * @param {number} y2 - Target y-coordinate
   * @returns {string} SVG path string
   */
  createLinkPath(x1, y1, x2, y2) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const dr = Math.sqrt(dx * dx + dy * dy) * 2;

    return `M${x1},${y1}C${x1 + dr/3},${y1} ${x2 - dr/3},${y2} ${x2},${y2}`;
  }

  /**
   * Render the diagram
   */
  render() {
    this.renderLinks();
    this.renderNodes();
  }

  /**
   * Render the links between nodes
   */
  renderLinks() {
    // Remove existing links
    this.chart.selectAll('.link').remove();

    // Create new links
    this.linkElements = this.chart.selectAll('.link')
      .data(this.data.links)
      .enter()
      .append('path')
      .attr('class', 'link')
      .attr('d', d => d.path)
      .style('fill', 'none')
      .style('stroke', '#999')
      .style('stroke-opacity', 0.6)
      .style('stroke-width', d => Math.max(1, Math.sqrt(d.value)));
  }

  /**
   * Render the nodes
   */
  renderNodes() {
    // Remove existing nodes
    this.chart.selectAll('.node').remove();

    // Create node groups
    this.nodeElements = this.chart.selectAll('.node')
      .data(this.data.nodes)
      .enter()
      .append('g')
      .attr('class', 'node')
      .attr('transform', d => `translate(${d.x},${d.y})`)
      .call(this.drag);

    // Add rectangles for nodes
    this.nodeElements.append('rect')
      .attr('height', d => d.height || 10)
      .attr('width', this.options.nodeWidth)
      .style('fill', '#69b3a2')
      .style('stroke', '#999');

    // Add labels
    this.nodeElements.append('text')
      .attr('x', -6)
      .attr('y', d => (d.height || 10) / 2)
      .attr('dy', '.35em')
      .attr('text-anchor', 'end')
      .text(d => d.name)
      .filter(d => d.x < this.options.width / 2)
      .attr('x', this.options.nodeWidth + 6)
      .attr('text-anchor', 'start');
  }

  /**
   * Update the diagram after changes
   */
  updateDiagram() {
    this.renderLinks();
    this.nodeElements.attr('transform', d => `translate(${d.x},${d.y})`);
  }

  /**
   * Resize the diagram
   * @param {number} width - New width
   * @param {number} height - New height
   */
  resize(width, height) {
    this.options.width = width;
    this.options.height = height;

    this.svg
      .attr('width', width)
      .attr('height', height)
      .attr('viewBox', `0 0 ${width} ${height}`);

    this.processData();
    this.render();
  }

  /**
   * Clear the diagram
   */
  clear() {
    this.chart.selectAll('*').remove();
  }
}

export default SankeyDiagram;
