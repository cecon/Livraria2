#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const UI_PATH = /^(?:apps\/(?:pdv|nuvem\/web)\/|packages\/ui\/).+\.(?:css|jsx|scss|tsx)$/i;
const REVIEW_PATH = /^docs\/theme-reviews\/.+\.md$/i;
const REQUIRED_CHECKS = [
  'AgentMemory recall', 'Desktop', 'Smartphone', 'Light mode', 'Dark mode', 'Accessibility',
];

export function uiFiles(files) {
  return files.filter(file => UI_PATH.test(file) && !/\.(?:spec|test)\.[jt]sx?$/i.test(file));
}

export function validateReview(content, fileExists = existsSync) {
  const errors = [];
  const reference = content.match(/^- Theme reference: `([^`]+)`\s*$/mi)?.[1];
  const documentation = content.match(/^- Documentation: `([^`]+)`\s*$/mi)?.[1];

  if (!reference?.startsWith('docs/references/theme/') ||
      reference.startsWith('docs/references/theme/documentation/')) {
    errors.push('informe um exemplo especifico em docs/references/theme');
  } else if (!fileExists(reference)) {
    errors.push(`a referencia do tema nao existe: ${reference}`);
  }

  if (!documentation?.startsWith('docs/references/theme/documentation/')) {
    errors.push('informe o arquivo consultado em docs/references/theme/documentation');
  } else if (!fileExists(documentation.split('#')[0])) {
    errors.push(`a documentacao nao existe: ${documentation}`);
  }

  for (const check of REQUIRED_CHECKS) {
    if (!new RegExp(`^- \\[x\\] ${check}$`, 'mi').test(content)) {
      errors.push(`marque a validacao: ${check}`);
    }
  }
  return errors;
}

function git(args) {
  return execFileSync('git', args, { encoding: 'utf8' }).trim();
}

function changedFiles(args) {
  if (args.includes('--staged')) {
    return git(['diff', '--cached', '--name-only', '--diff-filter=ACMRD']).split(/\r?\n/).filter(Boolean);
  }
  const baseAt = args.indexOf('--base');
  const base = baseAt >= 0 ? args[baseAt + 1] : 'origin/main';
  if (!base) throw new Error('Informe a referencia depois de --base.');
  return git(['diff', '--name-only', '--diff-filter=ACMRD', `${base}...HEAD`])
    .split(/\r?\n/).filter(Boolean);
}

export function validate({ files, staged, root = process.cwd(), read = readFileSync, exists = existsSync }) {
  const changedUi = uiFiles(files);
  if (changedUi.length === 0) return { changedUi, errors: [] };

  const errors = [];
  for (const required of ['docs/references/theme', 'docs/references/theme/documentation']) {
    if (!exists(resolve(root, required))) errors.push(`referencia obrigatoria ausente: ${required}`);
  }
  if (staged) return { changedUi, errors };

  const reviews = files.filter(file => REVIEW_PATH.test(file));
  if (reviews.length === 0) {
    errors.push('adicione um relatorio novo em docs/theme-reviews/ usando TEMPLATE.md');
    return { changedUi, errors };
  }
  const valid = reviews.some(file => {
    if (!exists(resolve(root, file))) return false;
    return validateReview(read(resolve(root, file), 'utf8'), candidate =>
      exists(resolve(root, candidate.split('#')[0]))).length === 0;
  });
  if (!valid) {
    const first = reviews.find(file => exists(resolve(root, file)));
    if (first) errors.push(...validateReview(read(resolve(root, first), 'utf8'), candidate =>
      exists(resolve(root, candidate.split('#')[0]))));
    else errors.push('o relatorio de tema foi removido ou nao pode ser lido');
  }
  return { changedUi, errors };
}

function main() {
  const args = process.argv.slice(2);
  const staged = args.includes('--staged');
  const result = validate({ files: changedFiles(args), staged });
  if (result.changedUi.length === 0) {
    console.log('Theme check: nenhuma alteracao de UI detectada.');
    return;
  }
  if (result.errors.length > 0) {
    console.error('Theme check falhou para:');
    result.changedUi.forEach(file => console.error(`  - ${file}`));
    result.errors.forEach(error => console.error(`  ERRO: ${error}`));
    console.error('Consulte docs/ui-theme-policy.md.');
    process.exitCode = 1;
    return;
  }
  console.log(`Theme check: aprovado para ${result.changedUi.length} arquivo(s) de UI.`);
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) {
  main();
}
