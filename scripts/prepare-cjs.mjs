import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

const root = process.cwd()
const cjsRoot = join(root, 'cjs')

function walk(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const file = join(dir, entry.name)
    return entry.isDirectory() ? walk(file) : [file]
  })
}

// TypeScript lowers import() to Promise.then(require()) in CommonJS mode. Restore
// native import() for these optional/native-ESM integrations so Node 20+ can load them.
const dynamicOnly = new Set(['audio-decode', 'jimp', 'link-preview-js', 'music-metadata', 'sharp'])
for (const file of walk(cjsRoot).filter(file => file.endsWith('.js'))) {
  let source = readFileSync(file, 'utf8')
  source = source.replace(/Promise\.resolve\(\)\.then\(\(\) => __importStar\(require\((['"])([^'"]+)\1\)\)\)/g, (full, quote, name) => {
    return dynamicOnly.has(name) ? `import(${quote}${name}${quote})` : full
  })
  source = source.replace(/Promise\.resolve\(\)\.then\(\(\) => require\((['"])([^'"]+)\1\)\)/g, (full, quote, name) => {
    return dynamicOnly.has(name) ? `import(${quote}${name}${quote})` : full
  })
  source = source.replace(/\n?\/\/# sourceMappingURL=.*$/gm, '')
  writeFileSync(file, source)
}

// Keep the ESM declarations in ./lib; the CJS facade points to them from a .d.cts file.
writeFileSync(join(cjsRoot, 'package.json'), '{\n  "type": "commonjs"\n}\n')
writeFileSync(join(cjsRoot, 'index.js'), `// CommonJS facade: callable default plus named API properties.\n'use strict'\nconst api = require('./lib/index.js')\nconst makeWASocket = api.default || api.makeWASocket\nif (typeof makeWASocket !== 'function') {\n  throw new TypeError('VamXRepan Baileys CJS entry did not expose makeWASocket')\n}\nObject.assign(makeWASocket, api, { default: makeWASocket, makeWASocket })\nmodule.exports = makeWASocket\n`)
writeFileSync(join(cjsRoot, 'index.d.cts'), `import makeWASocket from '../lib/index.js'\ndeclare const vamxrepanBaileys: typeof makeWASocket & typeof import('../lib/index.js')\nexport = vamxrepanBaileys\n`)

console.log('Built CommonJS output in ./cjs (native dynamic import preserved).')
