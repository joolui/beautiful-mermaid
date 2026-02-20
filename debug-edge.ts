/**
 * Diagnostic script to trace edge routing for SG_L -> ENI_A
 * Usage: bun run debug-edge.ts
 */
import { parseMermaid } from './src/parser.ts'
import { layoutGraph } from './src/layout.ts'
import { readFileSync } from 'fs'

const mmd = readFileSync('sample/src/NetworkingLayer.mmd', 'utf-8')
const graph = parseMermaid(mmd)
const positioned = await layoutGraph(graph)

// Find the SG_L -> ENI_A edge (dotted, labeled "protects", where target is ENI_A)
for (const edge of positioned.edges) {
  if (edge.source === 'SG_L' && edge.target === 'ENI_A') {
    console.log('=== SG_L -> ENI_A edge ===')
    console.log('Points:')
    for (const p of edge.points) {
      console.log(`  (${p.x.toFixed(2)}, ${p.y.toFixed(2)})`)
    }
    console.log('Label position:', edge.labelPosition
      ? `(${edge.labelPosition.x.toFixed(2)}, ${edge.labelPosition.y.toFixed(2)})`
      : 'none (will use midpoint)')
    console.log('Point count:', edge.points.length)

    // Check for U-turns (3 collinear points where middle reverses direction)
    for (let i = 1; i < edge.points.length - 1; i++) {
      const a = edge.points[i - 1]!
      const b = edge.points[i]!
      const c = edge.points[i + 1]!
      const sameY = Math.abs(a.y - b.y) < 1 && Math.abs(b.y - c.y) < 1
      const sameX = Math.abs(a.x - b.x) < 1 && Math.abs(b.x - c.x) < 1
      if (sameY) {
        const ab = b.x - a.x
        const bc = c.x - b.x
        if (ab * bc < 0) console.log(`  *** U-turn at point ${i}: horizontal reversal at y=${b.y.toFixed(2)}`)
      }
      if (sameX) {
        const ab = b.y - a.y
        const bc = c.y - b.y
        if (ab * bc < 0) console.log(`  *** U-turn at point ${i}: vertical reversal at x=${b.x.toFixed(2)}`)
      }
    }
  }
}

// Dump groups to find Security Groups box bounds
function dumpGroups(groups: any[], indent = '') {
  for (const g of groups) {
    const bottom = g.y + g.height
    console.log(`${indent}${g.id} "${g.label}": y=${g.y.toFixed(1)} h=${g.height.toFixed(1)} bottom=${bottom.toFixed(1)} x=${g.x.toFixed(1)} w=${g.width.toFixed(1)} right=${(g.x + g.width).toFixed(1)}`)
    if (g.children?.length) dumpGroups(g.children, indent + '  ')
  }
}
console.log('\n=== All groups ===')
dumpGroups(positioned.groups)

// Dump SG_L node position
for (const node of positioned.nodes) {
  if (node.id === 'SG_L' || node.id === 'ENI_A') {
    console.log(`\nNode ${node.id}: x=${node.x.toFixed(1)} y=${node.y.toFixed(1)} w=${node.width.toFixed(1)} h=${node.height.toFixed(1)} bottom=${(node.y + node.height).toFixed(1)}`)
  }
}
