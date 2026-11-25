#!/usr/bin/env node
'use strict'

const required = [
  '@cacheable/node-cache', '@hapi/boom', 'async-mutex', 'libsignal',
  'long', 'lru-cache', 'music-metadata', 'pino', 'protobufjs',
  'whatsapp-rust-bridge', 'ws'
]
const optional = ['sharp', 'jimp', 'link-preview-js', 'audio-decode']

async function check(name) {
  try {
    await import(name)
    return true
  } catch {
    return false
  }
}

;(async () => {
  let missingRequired = false
  console.log(`\nVAMXREPAN BAILEYS — DEPENDENCY CHECK (Node.js ${process.versions.node})\n`)
  if (Number(process.versions.node.split('.')[0]) < 20) {
    console.error('Node.js 20 or newer is required.')
    process.exitCode = 1
    return
  }
  for (const name of required) {
    const ok = await check(name)
    console.log(`${ok ? '✓' : '✗'} ${name}${ok ? '' : ' — required'}`)
    if (!ok) missingRequired = true
  }
  for (const name of optional) {
    const ok = await check(name)
    console.log(`${ok ? '✓' : '·'} ${name}${ok ? '' : ' — optional feature'}`)
  }
  if (missingRequired) {
    console.error('\nRequired dependencies are missing. Run: npm install')
    process.exitCode = 1
  } else {
    console.log('\nCore dependencies are available. Optional modules enhance media/link features.')
  }
})().catch(error => {
  console.error('Dependency check failed:', error?.message || error)
  process.exitCode = 1
})
