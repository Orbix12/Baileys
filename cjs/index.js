// CommonJS facade: callable default plus named API properties.
'use strict'
const api = require('./lib/index.js')
const makeWASocket = api.default || api.makeWASocket
if (typeof makeWASocket !== 'function') {
  throw new TypeError('VamXRepan Baileys CJS entry did not expose makeWASocket')
}
Object.assign(makeWASocket, api, { default: makeWASocket, makeWASocket })
module.exports = makeWASocket
