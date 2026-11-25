#!/usr/bin/env node
'use strict'

const { spawn } = require('node:child_process')

const runTarget = (args) => {
	if (args[0] === '--') args = args.slice(1)
	if (args.length === 0) return

	let [command, ...commandArgs] = args
	const looksLikeNodeScript = /\.(?:c|m)?js$/.test(command) || command.startsWith('./') || command.startsWith('../')
	if (looksLikeNodeScript) {
		commandArgs = [command, ...commandArgs]
		command = process.execPath
	}

	const child = spawn(command, commandArgs, {
		cwd: process.cwd(),
		env: process.env,
		stdio: 'inherit'
	})

	child.once('error', error => {
		process.stderr.write(`[VAMXREPAN BAILEYS] Gagal menjalankan proses: ${error.message}\n`)
		process.exitCode = 1
	})
	child.once('exit', (code, signal) => {
		process.exitCode = signal ? 1 : (code ?? 1)
	})
}

import('../lib/Utils/repan-banner.js')
	.then(async ({ showVamXRepanStartup }) => {
		await showVamXRepanStartup({ clearBefore: true, clearAfter: false, durationMs: 950, typing: true, theme: 'neon' })
		process.env.VAMXREPAN_STARTUP_SHOWN = '1'
		runTarget(process.argv.slice(2))
	})
	.catch(error => {
		process.stderr.write(`[VAMXREPAN BAILEYS] Startup gagal: ${error?.message || error}\n`)
		process.exitCode = 1
	})
