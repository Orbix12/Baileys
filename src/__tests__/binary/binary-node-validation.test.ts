import { getBinaryNodeChildBuffer, getBinaryNodeChildString } from '../../WABinary/generic-utils.js'
import { encodeBinaryNode } from '../../WABinary/encode.js'
import type { BinaryNode } from '../../WABinary/types.js'

describe('binary node value guards', () => {
	it('returns Buffer and Uint8Array child content without widening the result type', () => {
		const buffer = Buffer.from('payload')
		const bytes = new Uint8Array([1, 2, 3])
		const node: BinaryNode = {
			tag: 'root',
			attrs: {},
			content: [
				{ tag: 'buffer', attrs: {}, content: buffer },
				{ tag: 'bytes', attrs: {}, content: bytes }
			]
		}

		expect(getBinaryNodeChildBuffer(node, 'buffer')).toBe(buffer)
		expect(getBinaryNodeChildBuffer(node, 'bytes')).toBe(bytes)
		expect(getBinaryNodeChildBuffer(node, 'missing')).toBeUndefined()
	})

	it('decodes byte child values and preserves text child values', () => {
		const node: BinaryNode = {
			tag: 'root',
			attrs: {},
			content: [
				{ tag: 'bytes', attrs: {}, content: Buffer.from('hello') },
				{ tag: 'text', attrs: {}, content: 'world' },
				{ tag: 'children', attrs: {}, content: [{ tag: 'nested', attrs: {} }] }
			]
		}

		expect(getBinaryNodeChildString(node, 'bytes')).toBe('hello')
		expect(getBinaryNodeChildString(node, 'text')).toBe('world')
		expect(getBinaryNodeChildString(node, 'children')).toBeUndefined()
	})
})

describe('binary node encoder validation', () => {
	it('rejects non-node values inside a child list with a useful error', () => {
		const malformed = {
			tag: 'root',
			attrs: {},
			content: [Buffer.from('not-a-node')]
		} as unknown as BinaryNode

		expect(() => encodeBinaryNode(malformed)).toThrow(/Invalid child at index 0/)
	})

	it('rejects non-string binary node attributes instead of silently omitting them', () => {
		const malformed = {
			tag: 'root',
			attrs: { invalid: 123 }
		} as unknown as BinaryNode

		expect(() => encodeBinaryNode(malformed)).toThrow(/expected a string/)
	})

	it('rejects list sizes that cannot be represented by the WhatsApp binary format', () => {
		const children = Array.from({ length: 65_536 }, (_, index) => ({
			tag: `n${index}`,
			attrs: {}
		}))
		const node: BinaryNode = { tag: 'root', attrs: {}, content: children }

		expect(() => encodeBinaryNode(node)).toThrow(/list size is outside the supported range/)
	})

	it('rejects excessive nesting before the JavaScript call stack overflows', () => {
		const root: BinaryNode = { tag: 'root', attrs: {} }
		let current = root
		for (let index = 0; index < 66; index += 1) {
			const child: BinaryNode = { tag: 'child', attrs: {} }
			current.content = [child]
			current = child
		}

		expect(() => encodeBinaryNode(root)).toThrow(/maximum supported depth/)
	})
})
