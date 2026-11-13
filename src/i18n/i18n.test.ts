import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { en, type TranslationKey } from './en';
import { fa } from './fa';
import { ps } from './ps';
import { uz } from './uz';
import { tk } from './tk';
import { LANGUAGES, SUPPORTED_LANGS, translateKey } from './index';

const ALL_DICTS = { en, fa, ps, uz, tk } as const;

function walkSourceFiles(dir: string): string[] {
  const results: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...walkSourceFiles(full));
    } else if ((entry.name.endsWith('.ts') || entry.name.endsWith('.tsx')) && !entry.name.endsWith('.test.ts')) {
      results.push(full);
    }
  }
  return results;
}

test('all 5 language dictionaries have exact key parity and non-empty strings', () => {
  const enKeys = Object.keys(en).sort();
  assert.ok(enKeys.length > 200, 'Expected comprehensive dictionary');

  for (const lang of SUPPORTED_LANGS) {
    const dict = ALL_DICTS[lang];
    const langKeys = Object.keys(dict).sort();
    assert.deepEqual(langKeys, enKeys, `Key mismatch in language dictionary: ${lang}`);

    for (const k of enKeys) {
      const val = dict[k as TranslationKey];
      assert.equal(typeof val, 'string', `${lang}.${k} must be a string`);
      assert.ok(val.trim().length > 0, `${lang}.${k} must not be empty`);
      assert.ok(!val.includes('[MISSING:'), `${lang}.${k} must not contain placeholder markers`);
      assert.ok(!val.includes('($)') && !val.includes('دالر') && !val.includes('ډالر'), `${lang}.${k} must use AFN instead of USD/$/دالر`);
    }
    assert.equal('sealTextLabel' in dict, false, `${lang} must not define sealTextLabel`);
    assert.equal('defaultCertSeal' in dict, false, `${lang} must not define defaultCertSeal`);
  }
});

test('RTL and LTR directions match language specifications', () => {
  const dirMap = Object.fromEntries(LANGUAGES.map((l) => [l.code, l.dir]));
  assert.equal(dirMap.fa, 'rtl');
  assert.equal(dirMap.ps, 'rtl');
  assert.equal(dirMap.uz, 'rtl');
  assert.equal(dirMap.tk, 'rtl');
  assert.equal(dirMap.en, 'ltr');
});

test('translateKey never silently falls back to English when a key is missing', () => {
  const missingResult = translateKey('fa', 'nonExistentKeyForTest' as TranslationKey);
  assert.equal(missingResult, '[MISSING:fa:nonExistentKeyForTest]');
});

test('every static t("...") key referenced across src/ exists in all 5 dictionaries', () => {
  const srcRoot = path.resolve(process.cwd(), 'src');
  const files = walkSourceFiles(srcRoot);
  const keySet = new Set(Object.keys(en));
  const missingCalls: string[] = [];

  const literalCallRegex = /\bt\(\s*'([a-zA-Z0-9_]+)'/g;
  for (const file of files) {
    const content = fs.readFileSync(file, 'utf8');
    let match: RegExpExecArray | null;
    while ((match = literalCallRegex.exec(content)) !== null) {
      const key = match[1];
      if (!keySet.has(key)) {
        missingCalls.push(`${path.relative(srcRoot, file)} -> ${key}`);
      }
    }
  }

  assert.deepEqual(missingCalls, [], `Missing translation keys in source files: ${missingCalls.join(', ')}`);
});
