/**
 * Verify: does fixTerminalBendDirections + reclip create the collinear U-turn?
 * Tests the hypothesis that re-snap produces clean points, but the subsequent
 * fixTerminalBendDirections step creates the collinear U-turn.
 */
import { snapToOrthogonal } from './src/dagre-adapter.ts'

// Simulated post-shift points (before re-snap at line 806)
// Based on dagre output + shifts
const shiftedPoints = [
  { x: 233.85, y: 444.8 },    // SG_L source, shifted
  { x: 233.85, y: 464.8 },    // intermediate
  { x: 197.0, y: 464.8 },     // label route, shifted differently
  { x: 197.0, y: 889.7 },     // target area, shifted
  { x: 665.9, y: 922.6 },     // target, shifted to SubA
]

console.log('=== Input (simulated post-shift) ===')
console.log(shiftedPoints.map(p => `(${p.x.toFixed(1)}, ${p.y.toFixed(1)})`).join(' → '))

const resnapped = snapToOrthogonal(shiftedPoints, true)
console.log('\n=== After re-snap (line 806) ===')
console.log(resnapped.map(p => `(${p.x.toFixed(1)}, ${p.y.toFixed(1)})`).join(' → '))
console.log('Point count:', resnapped.length)

// fixTerminalBendDirections (verticalFirst=true)
const n = resnapped.length
if (n >= 3) {
  const last = resnapped[n - 1]!
  const prev = resnapped[n - 2]!
  const prevPrev = resnapped[n - 3]!

  const isLastHorizontal = Math.abs(last.y - prev.y) < 2 && Math.abs(last.x - prev.x) >= 2
  const isPrevVertical = Math.abs(prev.x - prevPrev.x) < 2 && Math.abs(prev.y - prevPrev.y) >= 2

  console.log('\n=== fixTerminalBendDirections check ===')
  console.log(`Last segment: (${prev.x.toFixed(1)},${prev.y.toFixed(1)}) → (${last.x.toFixed(1)},${last.y.toFixed(1)})`)
  console.log(`isLastHorizontal: ${isLastHorizontal}, isPrevVertical: ${isPrevVertical}`)

  if (isLastHorizontal && isPrevVertical) {
    resnapped[n - 2] = { x: last.x, y: prevPrev.y }
    console.log(`FIXED: point[${n-2}] changed to (${last.x.toFixed(1)}, ${prevPrev.y.toFixed(1)})`)
  }
}

console.log('\n=== After fixTerminalBendDirections ===')
console.log(resnapped.map(p => `(${p.x.toFixed(1)}, ${p.y.toFixed(1)})`).join(' → '))

// Check for collinear U-turns
for (let i = 1; i < resnapped.length - 1; i++) {
  const a = resnapped[i - 1]!
  const b = resnapped[i]!
  const c = resnapped[i + 1]!
  const sameY = Math.abs(a.y - b.y) < 1 && Math.abs(b.y - c.y) < 1
  if (sameY) {
    console.log(`\n*** COLLINEAR at y=${b.y.toFixed(1)}: ${a.x.toFixed(1)} → ${b.x.toFixed(1)} → ${c.x.toFixed(1)}`)
    const direction1 = b.x - a.x
    const direction2 = c.x - b.x
    if (direction1 * direction2 < 0) {
      console.log('  → U-TURN detected! This is the bug.')
    }
  }
}

// After reclip, point[3] would get x shifted to ENI_A center (721.2) but pattern same
console.log('\n=== After reclipEndpointsToNodes (simulated) ===')
// Target re-clip: vertical approach → center x on target
resnapped[n - 1] = { x: 721.2, y: 922.6 }    // ENI_A top
resnapped[n - 2] = { ...resnapped[n - 2]!, x: 721.2 }
// Source re-clip: vertical exit → center x on source
resnapped[0] = { x: 233.85, y: 444.8 }
resnapped[1] = { ...resnapped[1]!, x: 233.85 }
console.log(resnapped.map(p => `(${p.x.toFixed(1)}, ${p.y.toFixed(1)})`).join(' → '))
console.log('\nThis matches the SVG output!')
