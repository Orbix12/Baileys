import { SerialQueue } from '../../Utils/serial-queue.js'

describe('SerialQueue', () => {
	it('runs queued tasks in order', async () => {
		const queue = new SerialQueue()
		const order: number[] = []
		await Promise.all([
			queue.add(async () => { order.push(1) }),
			queue.add(async () => { order.push(2) }),
			queue.add(async () => { order.push(3) })
		])
		expect(order).toEqual([1, 2, 3])
	})

	it('continues after a rejected task', async () => {
		const queue = new SerialQueue()
		const first = queue.add(async () => { throw new Error('expected') })
		const second = queue.add(async () => 'continued')
		await expect(first).rejects.toThrow('expected')
		await expect(second).resolves.toBe('continued')
	})
})
