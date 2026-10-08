import test from 'node:test';
import assert from 'node:assert/strict';

function createMockElement(tag, className = '') {
  const children = [];
  return {
    tagName: tag.toUpperCase(),
    className,
    children,
    appendChild(child) {
      child.parentNode = this;
      children.push(child);
      return child;
    },
    cloneNode(deep) {
      const copy = createMockElement(tag, className);
      if (deep) {
        for (const child of children) {
          copy.appendChild(child.cloneNode(true));
        }
      }
      return copy;
    },
    querySelectorAll(selector) {
      const results = [];
      const selTypes = selector.split(',').map((s) => s.trim());
      function match(node) {
        for (const child of node.children) {
          const isButton = selTypes.includes('button') && child.tagName === 'BUTTON';
          const isArtifact =
            selTypes.includes('.artifact-block-cell') &&
            child.className.includes('artifact-block-cell');
          if (isButton || isArtifact) {
            results.push(child);
          }
          match(child);
        }
      }
      match(this);
      return results;
    },
    remove() {
      if (this.parentNode) {
        const idx = this.parentNode.children.indexOf(this);
        if (idx !== -1) {
          this.parentNode.children.splice(idx, 1);
        }
      }
    },
  };
}

test('Claude Parser node removal performance benchmark', () => {
  const root = createMockElement('div', 'font-claude-response');
  for (let i = 0; i < 50; i++) {
    const p = createMockElement('p');
    const b = createMockElement('button');
    const a = createMockElement('div', 'artifact-block-cell');
    const span = createMockElement('span');
    p.appendChild(b);
    p.appendChild(a);
    p.appendChild(span);
    root.appendChild(p);
  }

  const iterations = 50000;

  // Measure forEach baseline
  const startForEach = performance.now();
  for (let i = 0; i < iterations; i++) {
    const clone = root.cloneNode(true);
    clone.querySelectorAll('button, .artifact-block-cell').forEach((node) => node.remove());
  }
  const durationForEach = performance.now() - startForEach;

  // Measure for...of optimized
  const startForOf = performance.now();
  for (let i = 0; i < iterations; i++) {
    const clone = root.cloneNode(true);
    for (const node of clone.querySelectorAll('button, .artifact-block-cell')) {
      node.remove();
    }
  }
  const durationForOf = performance.now() - startForOf;

  assert.equal(typeof durationForEach, 'number');
  assert.equal(typeof durationForOf, 'number');
  console.log(`[Benchmark] forEach node removal ${iterations} iterations took ${durationForEach.toFixed(2)} ms`);
  console.log(`[Benchmark] for...of node removal ${iterations} iterations took ${durationForOf.toFixed(2)} ms`);
});
