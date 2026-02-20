/**
 * Diagnostic: trace SG_L -> ENI_A edge through post-processing pipeline.
 * Patches layout.ts to log intermediate states.
 */
import { parseMermaid } from './src/parser.ts'
import { readFileSync } from 'fs'
import dagre from '@dagrejs/dagre/dist/dagre.js'
import { snapToOrthogonal, clipEndpointsToNodes, centerToTopLeft } from './src/dagre-adapter.ts'
import { estimateTextWidth, FONT_SIZES, FONT_WEIGHTS, NODE_PADDING, GROUP_HEADER_CONTENT_PAD, LINE_HEIGHT_RATIO, wrapText } from './src/styles.ts'

const mmd = readFileSync('sample/src/NetworkingLayer.mmd', 'utf-8')
const graph = parseMermaid(mmd)

function fmt(p: { x: number; y: number }) { return `(${p.x.toFixed(1)}, ${p.y.toFixed(1)})` }
function fmtPts(pts: { x: number; y: number }[]) { return pts.map(fmt).join(' → ') }

// Run a minimal dagre layout and trace edge points

const NON_RECT_SHAPES = new Set(['diamond', 'circle', 'doublecircle', 'state-start', 'state-end'])

const g = new dagre.graphlib.Graph({ directed: true, compound: true })
g.setGraph({ rankdir: 'TB', acyclicer: 'greedy', nodesep: 24, ranksep: 40, marginx: 40, marginy: 40 })
g.setDefaultEdgeLabel(() => ({}))

// Helper to estimate node size (simplified)
function estimateNodeSize(id: string, label: string, shape: string) {
  const lines = wrapText(label, FONT_SIZES.nodeLabel, FONT_WEIGHTS.nodeLabel)
  const widestLine = lines.reduce((max: number, line: string) =>
    Math.max(max, estimateTextWidth(line, FONT_SIZES.nodeLabel, FONT_WEIGHTS.nodeLabel)), 0)
  const textHeight = lines.length * FONT_SIZES.nodeLabel * LINE_HEIGHT_RATIO
  const verticalPad = lines.length > 2 ? NODE_PADDING.vertical * 1.5 : NODE_PADDING.vertical
  let width = widestLine + NODE_PADDING.horizontal * 2
  let height = textHeight + verticalPad * 2
  width = Math.max(width, 60)
  height = Math.max(height, 36)
  return { width, height }
}

// Collect subgraph node IDs
const subgraphNodeIds = new Set<string>()
function collectSubgraphNodeIds(sg: any, out: Set<string>) {
  for (const id of sg.nodeIds) out.add(id)
  for (const child of sg.children) collectSubgraphNodeIds(child, out)
}
for (const sg of graph.subgraphs) {
  subgraphNodeIds.add(sg.id)
  collectSubgraphNodeIds(sg, subgraphNodeIds)
}

// Add top-level nodes
for (const [id, node] of graph.nodes) {
  if (!subgraphNodeIds.has(id)) {
    const size = estimateNodeSize(id, node.label, node.shape)
    g.setNode(id, { label: node.label, width: size.width, height: size.height })
  }
}

// Add subgraphs
function addSubgraph(g: any, sg: any, graph: any, parentId?: string) {
  g.setNode(sg.id, { label: sg.label })
  if (parentId) g.setParent(sg.id, parentId)
  for (const nodeId of sg.nodeIds) {
    const node = graph.nodes.get(nodeId)
    if (node) {
      const size = estimateNodeSize(nodeId, node.label, node.shape)
      g.setNode(nodeId, { label: node.label, width: size.width, height: size.height })
      g.setParent(nodeId, sg.id)
    }
  }
  for (const child of sg.children) addSubgraph(g, child, graph, sg.id)
}

function buildRedirects(sg: any, entry: Map<string, string>, exit: Map<string, string>) {
  for (const child of sg.children) buildRedirects(child, entry, exit)
  const childIds = [...sg.nodeIds, ...sg.children.map((c: any) => c.id)]
  if (childIds.length === 0) { entry.set(sg.id, sg.id); exit.set(sg.id, sg.id); return }
  const first = childIds[0]!
  const last = childIds[childIds.length - 1]!
  entry.set(sg.id, entry.get(first) ?? first)
  exit.set(sg.id, exit.get(last) ?? last)
}

for (const sg of graph.subgraphs) addSubgraph(g, sg, graph)

const subgraphEntryNode = new Map<string, string>()
const subgraphExitNode = new Map<string, string>()
for (const sg of graph.subgraphs) buildRedirects(sg, subgraphEntryNode, subgraphExitNode)

// Add edges
const introducedTargets = new Set<string>()
for (let i = 0; i < graph.edges.length; i++) {
  const edge = graph.edges[i]!
  const source = subgraphExitNode.get(edge.source) ?? edge.source
  const target = subgraphEntryNode.get(edge.target) ?? edge.target
  const edgeLabel: Record<string, unknown> = { _index: i }
  if (edge.label) {
    edgeLabel.label = edge.label
    const edgeLines = wrapText(edge.label, FONT_SIZES.edgeLabel, FONT_WEIGHTS.edgeLabel)
    const widestEdgeLine = edgeLines.reduce((max: number, l: string) =>
      Math.max(max, estimateTextWidth(l, FONT_SIZES.edgeLabel, FONT_WEIGHTS.edgeLabel)), 0)
    edgeLabel.width = widestEdgeLine + 8
    edgeLabel.height = edgeLines.length * FONT_SIZES.edgeLabel * LINE_HEIGHT_RATIO + 6
    edgeLabel.labelpos = 'c'
  }
  if (!introducedTargets.has(target)) { edgeLabel.weight = 2; introducedTargets.add(target) }
  g.setEdge(source, target, edgeLabel)
}

dagre.layout(g)

// Find the SG_L → ENI_A edge from dagre output
for (const edgeObj of g.edges()) {
  const dagreEdge = g.edge(edgeObj)
  const originalEdge = graph.edges[dagreEdge._index as number]!
  if (originalEdge.source === 'SG_L' && originalEdge.target === 'ENI_A') {
    const rawPoints = dagreEdge.points ?? []
    console.log('=== Step 1: Raw dagre points ===')
    console.log(fmtPts(rawPoints))
    console.log('Dagre label position:', dagreEdge.x?.toFixed(1), dagreEdge.y?.toFixed(1))

    const orthoPoints = snapToOrthogonal(rawPoints, true)
    console.log('\n=== Step 2: After snapToOrthogonal ===')
    console.log(fmtPts(orthoPoints))

    // Get node rects for clipping
    const sn = g.node(edgeObj.v)
    const tn = g.node(edgeObj.w)
    const srcRect = sn ? { cx: sn.x, cy: sn.y, hw: sn.width / 2, hh: sn.height / 2 } : null
    const tgtRect = tn ? { cx: tn.x, cy: tn.y, hw: tn.width / 2, hh: tn.height / 2 } : null
    const clippedPoints = clipEndpointsToNodes(orthoPoints, srcRect, tgtRect)
    console.log('\n=== Step 3: After clipEndpointsToNodes ===')
    console.log(fmtPts(clippedPoints))
    console.log('Source node rect:', edgeObj.v, srcRect)
    console.log('Target node rect:', edgeObj.w, tgtRect)
  }
}
