import * as fs from 'fs'
import { uploadingNecessaryImages } from '../../Utils/business.js'
import type { WAMediaUploadFunction } from '../../Types/index.js'

describe('uploadingNecessaryImages', () => {
	it('reuses only HTTPS URLs on the WhatsApp media domain', async () => {
		const upload = jest.fn<WAMediaUploadFunction>()
		const url = 'https://mmg.whatsapp.net/v/t62/catalog-image'

		await expect(uploadingNecessaryImages([{ url }], upload)).resolves.toEqual([{ url }])
		expect(upload).not.toHaveBeenCalled()
	})

	it('re-uploads lookalike external hosts and removes the temporary file after upload failure', async () => {
		const originalFetch = global.fetch
		global.fetch = jest.fn(async () => new Response('catalog image bytes', { status: 200 })) as unknown as typeof fetch

		let temporaryFile: string | undefined
		const upload: WAMediaUploadFunction = jest.fn(async filePath => {
			temporaryFile = filePath
			expect(await fs.promises.readFile(filePath)).toEqual(Buffer.from('catalog image bytes'))
			throw new Error('simulated upload failure')
		})

		try {
			await expect(
				uploadingNecessaryImages([{ url: 'https://whatsapp.net.attacker.example/image' }], upload)
			).rejects.toThrow('simulated upload failure')
			expect(upload).toHaveBeenCalledTimes(1)
			expect(temporaryFile).toBeDefined()
			await expect(fs.promises.access(temporaryFile!)).rejects.toThrow()
		} finally {
			global.fetch = originalFetch
			if (temporaryFile) await fs.promises.unlink(temporaryFile).catch(() => undefined)
		}
	})
})
