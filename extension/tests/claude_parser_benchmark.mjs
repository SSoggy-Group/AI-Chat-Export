import { performance } from 'node:perf_hooks';

// Simple mock DOM Element for benchmarking containment check logic
class MockElement {
  constructor(className = '', parent = null) {
    this.className = className;
    this.parentElement = parent;
    this.children = [];
    if (parent) {
      parent.children.push(this);
    }
  }

  matches(selector) {
    if (selector.startsWith('.')) {
      const cls = selector.slice(1);
      return this.className.split(' ').includes(cls);
    }
    return false;
  }

  contains(other) {
    if (other === this) return true;
    let curr = other ? other.parentElement : null;
    while (curr) {
      if (curr === this) return true;
      curr = curr.parentElement;
    }
    return false;
  }
}

// Create mock tree with N candidates, some nested inside others
function createMockCandidates(numOuter, nestedDepth) {
  const candidates = [];
  for (let i = 0; i < numOuter; i++) {
    const parent = new MockElement(i % 10 === 0 ? 'artifact-block-cell' : 'font-claude-message');
    candidates.push(parent);

    let currentParent = parent;
    for (let d = 0; d < nestedDepth; d++) {
      const child = new MockElement('font-claude-response', currentParent);
      candidates.push(child);
      currentParent = child;
    }
  }
  return candidates;
}

const rawStrict = createMockCandidates(300, 3); // 1200 nodes total

// Baseline logic (O(N^2))
function runBaseline(items) {
  const start = performance.now();
  const result = items.filter(
    (el) => el.matches('.artifact-block-cell') ||
      !items.some((other) => other !== el && other.contains(el)),
  );
  const end = performance.now();
  return { timeMs: end - start, count: result.length };
}

// Optimized logic (O(N * depth))
function isContainedInSet(el, set) {
  let curr = el.parentElement;
  while (curr) {
    if (set.has(curr)) return true;
    curr = curr.parentElement;
  }
  return false;
}

function runOptimized(items) {
  const start = performance.now();
  const set = new Set(items);
  const result = items.filter(
    (el) => el.matches('.artifact-block-cell') || !isContainedInSet(el, set),
  );
  const end = performance.now();
  return { timeMs: end - start, count: result.length };
}

// Warm up
runBaseline(rawStrict);
runOptimized(rawStrict);

const iterations = 10;
let totalBaseline = 0;
let totalOptimized = 0;

for (let i = 0; i < iterations; i++) {
  totalBaseline += runBaseline(rawStrict).timeMs;
  totalOptimized += runOptimized(rawStrict).timeMs;
}

const avgBaseline = totalBaseline / iterations;
const avgOptimized = totalOptimized / iterations;

console.log(`Baseline (O(N^2) .some()): ${avgBaseline.toFixed(3)} ms`);
console.log(`Optimized (O(N*d) Set + parent check): ${avgOptimized.toFixed(3)} ms`);
console.log(`Speedup: ${(avgBaseline / avgOptimized).toFixed(2)}x faster`);
