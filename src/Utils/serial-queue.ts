/**
 * Small dependency-free promise queue with concurrency one.
 * Rejected tasks do not poison the queue; later tasks still execute.
 */
export class SerialQueue {
	private tail: Promise<void> = Promise.resolve()

	add<T>(task: () => PromiseLike<T> | T): Promise<T> {
		const result = this.tail.then(task)
		this.tail = result.then(
			() => undefined,
			() => undefined
		)
		return result
	}
}
