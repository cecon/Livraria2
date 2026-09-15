import assert from 'node:assert/strict';
import test from 'node:test';
import { uiFiles, validate, validateReview } from './check-theme-usage.mjs';

const complete = `# Theme Review
- Theme reference: \`docs/references/theme/app/dashboard/page.tsx\`
- Documentation: \`docs/references/theme/documentation/index.html#table\`
- [x] AgentMemory recall
- [x] Desktop
- [x] Smartphone
- [x] Light mode
- [x] Dark mode
- [x] Accessibility
`;

test('detects UI files and ignores tests', () => {
  assert.deepEqual(uiFiles([
    'apps/pdv/src/Pdv.tsx',
    'apps/nuvem/web/app/page.tsx', 'packages/ui/theme.css',
    'apps/pdv/src/Pdv.test.tsx', 'apps/nuvem/api/src/main.ts', 'docs/readme.md',
  ]), ['apps/pdv/src/Pdv.tsx',
    'apps/nuvem/web/app/page.tsx', 'packages/ui/theme.css']);
});

test('accepts a complete report with existing references', () => {
  assert.deepEqual(validateReview(complete, () => true), []);
});

test('rejects missing evidence and invalid references', () => {
  const errors = validateReview('- Theme reference: `docs/references/theme/documentation/index.html`', () => false);
  assert.ok(errors.some(error => error.includes('exemplo especifico')));
  assert.ok(errors.some(error => error.includes('documentation')));
  assert.ok(errors.some(error => error.includes('Smartphone')));
});

test('staged UI changes only require local theme availability', () => {
  const existing = new Set([
    'D:/repo/docs/references/theme', 'D:/repo/docs/references/theme/documentation',
  ]);
  const result = validate({ files: ['apps/pdv/src/Pdv.tsx'], staged: true, root: 'D:/repo',
    exists: path => existing.has(path.replaceAll('\\', '/')) });
  assert.deepEqual(result.errors, []);
});

test('push rejects UI changes without a changed report', () => {
  const result = validate({ files: ['apps/nuvem/web/app/page.tsx'], staged: false,
    root: '/repo', exists: () => true });
  assert.ok(result.errors.some(error => error.includes('relatorio novo')));
});

test('push accepts UI changes with complete changed report', () => {
  const result = validate({
    files: ['apps/nuvem/web/app/page.tsx', 'docs/theme-reviews/mobile-home.md'],
    staged: false, root: '/repo', exists: () => true, read: () => complete,
  });
  assert.deepEqual(result.errors, []);
});
