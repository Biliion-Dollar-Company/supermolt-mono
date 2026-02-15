/**
 * Patches react-native-worklets compatibility.json to support RN 0.76.x
 * NativeWind's css-interop requires the worklets babel plugin,
 * but worklets only officially supports RN 0.78+.
 * The babel plugin works fine on 0.76 — only the podspec check blocks it.
 */
const fs = require('fs');
const path = require('path');

const compatPath = path.join(
  __dirname,
  '..',
  'node_modules',
  'react-native-worklets',
  'compatibility.json'
);

if (fs.existsSync(compatPath)) {
  const compat = JSON.parse(fs.readFileSync(compatPath, 'utf8'));

  // Add RN 0.76 and 0.77 support to all version ranges
  for (const key of Object.keys(compat)) {
    const versions = compat[key]['react-native'] || [];
    if (!versions.includes('0.76')) {
      versions.unshift('0.76', '0.77');
      compat[key]['react-native'] = versions;
    }
  }

  fs.writeFileSync(compatPath, JSON.stringify(compat, null, 2) + '\n');
  console.log('[patch] react-native-worklets compatibility patched for RN 0.76');
} else {
  console.log('[patch] react-native-worklets not found, skipping');
}
