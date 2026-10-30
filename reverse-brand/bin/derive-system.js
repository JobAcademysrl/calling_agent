#!/usr/bin/env node
'use strict';
// derive-system <analysis.json> <identity.json> <out-dir>
// Builds a design system that keeps a brand's identity and adopts the structure measured by
// reverse-brand on a reference site: tokens.css, tokens.json, <name>-bridge.css, design-system.html.
const fs = require('fs');
const path = require('path');
const { deriveSystem, systemCss, systemJson } = require('../src/derive');
const { systemPage } = require('../src/system-page');

const [analysisFile, identityFile, outDir] = process.argv.slice(2);
if (!analysisFile || !identityFile || !outDir) { console.log('Usage: derive-system <analysis.json> <identity.json> <out-dir>'); process.exit(1); }
const a = JSON.parse(fs.readFileSync(analysisFile, 'utf8'));
const id = JSON.parse(fs.readFileSync(identityFile, 'utf8'));
const sys = deriveSystem(a, id);
const tokensCss = systemCss(sys, id);
const tokensJson = systemJson(sys, id);
const slug = id.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
const bridgeCss = `/* Maps ${id.name}'s existing variable names onto the v1 tokens. Load after tokens.css, before the app stylesheet,\n   and remove the old :root values from the app stylesheet. */\n:root, :root[data-theme] {\n${Object.entries(id.bridge || {}).map(([k, v]) => `  ${k}: ${v};`).join('\n')}\n}\n`;
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, 'tokens.css'), tokensCss);
fs.writeFileSync(path.join(outDir, 'tokens.json'), tokensJson);
fs.writeFileSync(path.join(outDir, `${slug}-bridge.css`), bridgeCss);
fs.writeFileSync(path.join(outDir, 'design-system.html'), systemPage({ a, sys, id, tokensCss, tokensJson, bridgeCss, copy: id.copy }));
console.log(`${sys.tokens.length} tokens -> ${outDir}`);
