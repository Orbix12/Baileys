<div align="center">
  <img src="Media/vamxrepan-anime-thumbnail.png" alt="VamXRepan Baileys — anime moonlight artwork supplied for the project" width="100%" />
  <br />
  <img src="Media/vamxrepan-wordmark.jpg" alt="VamXRepan Baileys wordmark" width="88%" />

  # @Orbix12/Baileys

  **WhatsApp Web socket toolkit · Unified message API · TypeScript + JavaScript**

  <p>
    <img alt="GitHub source archive" src="https://img.shields.io/badge/GitHub-Source%20Archive-181717?style=for-the-badge&logo=github&logoColor=white" />
    <img alt="npm package target" src="https://img.shields.io/badge/npm-%40vamxrepan%2Fbaileys-CB3837?style=for-the-badge&logo=npm&logoColor=white" />
    <img alt="Version 1.0.0" src="https://img.shields.io/badge/version-1.0.0-6D5DFB?style=for-the-badge" />
    <img alt="MIT license" src="https://img.shields.io/badge/license-MIT-16A34A?style=for-the-badge&logo=opensourceinitiative&logoColor=white" />
  </p>
  <p>
    <img alt="Node.js 20+" src="https://img.shields.io/badge/Node.js-20%2B-339933?style=flat-square&logo=nodedotjs&logoColor=white" />
    <img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-ready-3178C6?style=flat-square&logo=typescript&logoColor=white" />
    <img alt="JavaScript ESM and CJS" src="https://img.shields.io/badge/ESM%20%2B%20CommonJS-supported-F7DF1E?style=flat-square&logo=javascript&logoColor=black" />
    <img alt="WhatsApp Web" src="https://img.shields.io/badge/WhatsApp-Web-25D366?style=flat-square&logo=whatsapp&logoColor=white" />
    <img alt="Termux" src="https://img.shields.io/badge/Termux-Android-000000?style=flat-square&logo=termux&logoColor=white" />
    <img alt="Pterodactyl" src="https://img.shields.io/badge/Pterodactyl-Panel-10539F?style=flat-square&logo=pterodactyl&logoColor=white" />
    <img alt="Linux" src="https://img.shields.io/badge/Linux-supported-FCC624?style=flat-square&logo=linux&logoColor=black" />
    <img alt="GitHub Actions" src="https://img.shields.io/badge/GitHub-Actions-2088FF?style=flat-square&logo=githubactions&logoColor=white" />
    <img alt="Protocol Buffers" src="https://img.shields.io/badge/Protocol%20Buffers-WAProto-6B7280?style=flat-square&logo=protobuf&logoColor=white" />
  </p>

  **Created by VamTzy And RepanOffcl** · Fork of [WhiskeySockets/Baileys](https://github.com/WhiskeySockets/Baileys)
</div>

---

## Tentang proyek

**Orbix12 Baileys** adalah fork TypeScript/JavaScript untuk berkomunikasi dengan WhatsApp Web melalui protokol multi-device. Paket ini mempertahankan jalur inti Baileys—termasuk koneksi WebSocket, enkripsi Signal, pengiriman media terautentikasi, fan-out perangkat, retry protocol, dan protobuf—serta menyediakan satu facade pengiriman tingkat tinggi:

```js
VamXRepan.Message
```

Gunakan facade ini untuk pesan teks, media, dokumen, stiker, URL, interaksi, dan payload protobuf yang memang tersedia pada schema paket. Transport internal `relayMessage()` tetap dipakai oleh library di belakang layar agar proses enkripsi, session, device fan-out, dan mekanisme relay Baileys tidak terputus.

> **Penting:** proyek ini tidak resmi, tidak berafiliasi dengan WhatsApp atau Meta, dan tidak dapat memaksa server maupun aplikasi WhatsApp menerima atau menampilkan semua format pesan. Field yang tersedia di protobuf bukan jaminan bahwa server, akun, wilayah, atau versi client mendukung payload tersebut.

## Distribusi dan versi

| Distribusi | Nama | Tujuan |
| --- | --- | --- |
| GitHub source | `Orbix12-Baileys` | Source TypeScript, generated output, tests, docs, workflows, dan aset |
| npm | `@orbix12/baileys` | Paket runtime ESM + CommonJS beserta deklarasi TypeScript |

**Versi proyek tetap `1.0.0`.** Nama tampilan boleh ditulis `@orbix12/Baileys`, tetapi nama package npm yang canonical adalah lowercase `@orbix12/baileys`.

- GitHub source: tersedia sebagai arsip source ZIP; repository publik belum ditautkan karena URL pemilik sebelumnya tidak bisa diverifikasi.
- npm: <https://www.npmjs.com/package/@vamxrepan/baileys> (aktif setelah package diterbitkan dan registry menampilkan versi `1.0.0`).
- Upstream: <https://github.com/Orbix12/Baileys>
- Termux: <https://termux.dev/>
- Pterodactyl: <https://pterodactyl.io/>
- Node.js: <https://nodejs.org/>
- TypeScript: <https://www.typescriptlang.org/>

URL GitHub publik belum dapat diverifikasi, sehingga metadata paket tidak menyertakan `repository`, `homepage`, atau `bugs` yang mengarah ke alamat yang belum pasti. Arsip source ZIP dan tarball npm lokal sudah disiapkan. Sebelum rilis publik, maintainer perlu membuat repository miliknya, mengatur remote, memastikan hak akses scope npm, dan menambahkan secret `NPM_TOKEN` pada GitHub Actions.

## Fitur utama

- **Unified API:** `VamXRepan.Message.send()`, `.sendMessage()`, `.dispatch()`, dan `.relay()`.
- **Specialised helpers:** text, image, video, audio, document, sticker, media, URL, payment-protobuf, dan raw-protobuf.
- **Message builders:** reply, reaction, delete, edit, forward, location, live-location payload, contact, poll, event, group invite, menu, Native Flow, carousel, panel, rich text, album, dan product—sesuai implementasi serta dukungan WhatsApp.
- **Proto inspection:** daftar field `proto.IMessage`, validasi schema, encode, decode, dan raw send.
- **Send diagnostics:** error bertipe, event `messages.send-error`, tahap penyebab, kode error jika tersedia, dan saran pemeriksaan.
- **Dual module:** ESM dan CommonJS, dengan deklarasi TypeScript.
- **Terminal intro:** ASCII art, gradient, typewriter, progress indicator, dan clear screen pada TTY.
- **Runtime check:** command `vamxrepan-doctor` untuk memeriksa Node.js dan dependency wajib/opsional.
- **Channel follow:** hanya dijalankan setelah pemilik akun mengaktifkan opsi secara eksplisit.

## Persyaratan

- Node.js **20 atau lebih baru**.
- npm yang kompatibel dengan versi Node.js tersebut.
- Koneksi internet untuk instalasi dependency dan koneksi ke WhatsApp Web.
- Akun WhatsApp yang sah dan perangkat yang boleh ditautkan.

## Instalasi

### Dari npm

Setelah package dipublikasikan dan tersedia pada registry, instal dengan:

```bash
npm install @orbix12/baileys
```

### Dari arsip source ZIP

Ekstrak `note wajib install di project lu`, masuk ke folder project, lalu jalankan:

```bash
npm install
npm run build:dual
npm test
```

### Dari tarball npm lokal

Setelah mengunduh `baileys`, jalankan:

```bash
npm start
```

**Status distribusi:** arsip ZIP dan tarball dapat dibuat serta dipasang secara lokal. Repository GitHub pemilik dan publikasi ke registry npm belum dilakukan dari paket ini; jangan menganggap tautan GitHub/npm publik sudah aktif sebelum pemilik menghubungkannya.

## Quick start

Buat `index.js`:

```js
import makeWASocket, {
  useMultiFileAuthState,
  DisconnectReason
} from '@orbix12/baileys'

const { state, saveCreds } = await useMultiFileAuthState('./auth_info')

// Nama variabel socket yang direkomendasikan: VamXRepan.
const VamXRepan = makeWASocket({ auth: state })

VamXRepan.ev.on('creds.update', saveCreds)

let startupMessageSent = false

VamXRepan.ev.on('connection.update', ({ connection, lastDisconnect }) => {
  if (connection === 'open') {
    console.log('[VamXRepan] WhatsApp connected')

    // Wait for connection: open before sending anything.
    if (!startupMessageSent) {
      startupMessageSent = true
      void VamXRepan.Message.send('6281234567890@s.whatsapp.net', {
        text: 'Halo dari VamXRepan Baileys!'
      }).catch(error => console.error('[Send failed]', error.report ?? error))
    }
  }

  if (connection === 'close') {
    const statusCode = lastDisconnect?.error?.output?.statusCode
    if (statusCode === DisconnectReason.loggedOut) {
      console.error('[VamXRepan] Session logged out. Link the device again.')
    } else {
      console.error('[VamXRepan] Connection closed. Reconnect using your app lifecycle.')
    }
  }
})

VamXRepan.ev.on('messages.upsert', ({ messages, type }) => {
  if (type !== 'notify') return

  for (const message of messages) {
    console.log('[Incoming]', message.key.remoteJid, message.key.id)
  }
})

```

Ganti JID contoh dengan tujuan yang benar. Contoh ini baru mencoba kirim setelah event `connection: open`, bukan saat socket masih menghubungkan. Jangan menaruh folder auth, QR login, pairing code, atau credential di repository publik.

### CommonJS

Package juga menyediakan entry CommonJS:

```js
const makeWASocket = require('@orbix12/baileys')
const { useMultiFileAuthState, DisconnectReason } = makeWASocket

async function main() {
  const { state, saveCreds } = await useMultiFileAuthState('./auth_info')
  const VamXRepan = makeWASocket({ auth: state })

  VamXRepan.ev.on('creds.update', saveCreds)
  VamXRepan.ev.on('connection.update', ({ connection }) => {
    if (connection === 'open') console.log('[VamXRepan] Connected')
  })
}

main().catch(error => {
  console.error('[VamXRepan] Startup failed:', error)
  process.exitCode = 1
})
```

## `VamXRepan.Message`

Facade dibuat otomatis untuk setiap socket:

```js
const VamXRepan = makeWASocket({ auth: state })
const Message = VamXRepan.Message
```

### Universal send

```js
await Message.send(jid, { text: 'Text message' })
await Message.sendMessage(jid, { text: 'sendMessage alias' })
await Message.dispatch(jid, { text: 'dispatch alias' })
await Message.relay(jid, { text: 'high-level relay alias' })
```

Input biasa mengikuti `AnyMessageContent` milik Baileys. Payload raw yang berisi field top-level dari `proto.IMessage` diarahkan ke jalur protobuf tervalidasi. Untuk memilih format secara tegas, gunakan envelope:

```js
await Message.send(jid, {
  format: 'content',
  content: { text: 'Regular Baileys content' }
})

await Message.send(jid, {
  format: 'proto',
  message: { conversation: 'Schema-defined proto content' }
})

await Message.send(jid, {
  format: 'media',
  media: {
    type: 'image',
    media: imageBuffer,
    options: { caption: 'Image caption' }
  }
})
```

### Specialised message helpers

| Helper | Contoh |
| --- | --- |
| Text | `await Message.Text.send(jid, 'Halo')` |
| Image | `await Message.Image.send(jid, imageBuffer, { caption: 'Foto' })` |
| Video | `await Message.Video.send(jid, videoBuffer, { caption: 'Video' })` |
| Audio | `await Message.Audio.send(jid, audioBuffer, { mimetype: 'audio/mpeg' })` |
| Document | `await Message.Document.send(jid, pdfBuffer, 'application/pdf', { fileName: 'dokumen.pdf' })` |
| Sticker | `await Message.Sticker.send(jid, stickerBuffer)` |
| Static location | `await Message.Location.send(jid, { degreesLatitude: -6.2, degreesLongitude: 106.8 })` |
| Live-location payload | `await Message.LiveLocation.send(jid, { degreesLatitude: -6.2, degreesLongitude: 106.8, sequenceNumber: 1 })` |
| Poll | `await Message.Poll.send(jid, { name: 'Pilihan?', values: ['A', 'B'] })` |
| Event | `await Message.Event.send(jid, eventOptions)` |
| Reaction | `await Message.Reaction.send(jid, messageKey, '👍')` |
| Contact | `await Message.Contact.send(jid, contactProto)` |
| Album | `await Message.Album.send(jid, { expectedImageCount: 2 })` |
| Product | `await Message.Product.send(jid, productOptions)` |
| Interactive | `await Message.Interactive.actionDeck(jid, actionDeck)` |
| URL | `await Message.Url.send(jid, 'https://example.com')` |
| Media router | `await Message.Media.send(jid, { type: 'image', media: imageBuffer })` |
| Payment schema | `await Message.Payment.send(jid, paymentProto)` |
| Raw protobuf | `await Message.Proto.send(jid, protoMessage)` |
| General send helper | `await Message.Send.send(jid, content)` |

Semua helper memakai socket dan pipeline Baileys yang sama. Pengiriman gambar, video, audio, dokumen, dan stiker menggunakan proses media terautentikasi library untuk membuat metadata upload dan enkripsi media. Jangan membuat sendiri nilai media key, hash, atau direct path.

URL helper membatasi skema ke `http:` dan `https:`. Preview link bergantung pada opsi link-preview serta respons URL; URL yang valid tidak menjamin WhatsApp akan menampilkan preview.

### Jenis pesan dan protobuf

Daftar field `proto.IMessage` yang dikenali oleh generated schema pada versi ini dapat dilihat melalui:

```js
const protoFields = Message.supportedProtoFields
console.log('Supported schema fields:', protoFields.length)
console.log(protoFields)

const built = Message.buildProto({ conversation: 'Validated payload' })
const encoded = Message.encodeProto(built)
const decoded = Message.decodeProto(encoded)

await Message.sendProto(jid, decoded)
```

API helper juga tersedia sebagai kategori khusus (`Location`, `LiveLocation`, `Poll`, `Event`, `Reaction`, `Contact`, `Album`, `Product`, dan `Interactive`). Facade dasar tetap menyediakan `reply`, `delete`, `forward`, `editText`, `disappearing`, `contacts`, `groupInvite`, `listReply`, `buttonReply`, `sharePhoneNumber`, `requestPhoneNumber`, `pin`, `limitSharing`, `nativeFlow`, `nativeFlowWithMedia`, `documentWithButtons`, `imageWithButtons`, `videoWithButtons`, `carousel`, `menu`, `dashboard`, `actionDeck`, `select`, `panel`, dan `richText`.

Metode pada sub-helper seperti `const sendText = Message.Text.send` aman dipisahkan (destructuring) dan tetap terikat ke facade pemiliknya. `LiveLocation` memeriksa rentang koordinat standar sebelum membuat payload protobuf. Pengiriman live-location satu payload bukan pelacak GPS berkelanjutan; aplikasi tetap perlu mengelola pembaruan lokasi sesuai alur WhatsApp yang didukung.

Untuk melihat seluruh field yang benar-benar tersedia pada generated schema, gunakan `supportedProtoFields` atau `Message.Proto.supportedFields()`. Field yang dikenal tidak otomatis berarti server WhatsApp menerima nilainya. Beberapa format memerlukan metadata server, hasil upload media, entitlement akun, atau dukungan versi client. Field yang tidak ada dalam schema ditolak; library tidak mengarang nomor field protobuf.

**Payment:** `Message.Payment.supportedFields()` menampilkan keluarga field pembayaran yang tersedia pada schema. `Message.Payment` hanya mengirim payload protobuf payment-related yang dikenal oleh schema saat ini. Fitur ini bukan payment gateway, dompet digital, atau pemroses transaksi. Keberhasilan encode/send tidak membuktikan transaksi dibayar atau diselesaikan.

## Diagnostik pengiriman

Ketika proses send menolak Promise atau gagal pada tahap yang ditangani facade, error dibungkus menjadi `VamXRepanSendError`, dilaporkan lewat event `messages.send-error`, dan dicetak ke stderr secara default.

```js
VamXRepan.ev.on('messages.send-error', report => {
  console.error('[SEND FAILED]', report)
  // report.stage: validation | connection | media | encryption | relay | unknown
  // report.reason: error dari proses pengiriman
  // report.suggestion: langkah pemeriksaan yang disarankan
})

try {
  await VamXRepan.Message.send(jid, { text: 'Send test' })
} catch (error) {
  console.error(error.name, error.message)
  console.error(error.report)
}
```

Atau gunakan hasil terstruktur tanpa melempar error:

```js
const result = await VamXRepan.Message.sendDetailed(jid, {
  text: 'Diagnostic test'
})

if (!result.ok) {
  console.error(result.stage, result.reason, result.suggestion)
}
```

Arti `ok: true` adalah operasi lokal sudah disubmit/selesai pada jalur send yang dipanggil. Itu **bukan** bukti penerima sudah menerima atau membaca pesan. Status delivery/read harus diperiksa melalui event receipt dan message update. Library tidak melakukan retry buta karena error koneksi dapat terjadi setelah server menerima pesan; retry otomatis tanpa idempotency berisiko mengirim duplikat.

Untuk menonaktifkan cetakan diagnostic pada instance facade mandiri (event dan exception tetap tersedia):

```js
import { VamXRepanMessage } from '@orbix12/baileys'
const Message = new VamXRepanMessage(VamXRepan, { diagnostics: false })
```

Facade bawaan `VamXRepan.Message` mengaktifkan diagnostic secara default.

## Persiapan rilis publik

Arsip source ZIP dan tarball npm lokal sudah tersedia, tetapi repository GitHub pemilik dan rilis registry belum dipublikasikan dari lingkungan ini. Untuk mengaktifkan workflow rilis setelah repository dibuat:

1. Push source ZIP yang sudah diekstrak ke repository GitHub milik maintainer pada branch `main`.
2. Pastikan maintainer memang memiliki akses publish ke scope npm `@orbix12`.
3. Tambahkan secret repository `NPM_TOKEN` pada **Settings → Secrets and variables → Actions**.
4. Jalankan pemeriksaan manual terlebih dahulu. Workflow manual akan menolak versi selain `1.0.0`.
5. Setelah semua pemeriksaan lolos, buat dan push tag `v1.0.0` untuk memicu publish.

Workflow publikasi tidak mengubah versi package. Jangan menaruh token npm, WhatsApp auth state, atau pairing credentials di repository atau file ZIP.

## Terminal startup dan doctor

Jalankan bot dengan intro terminal sebelum script utama:

```bash
npx vamxrepan-startup -- node index.js
```

Atau gunakan script `package.json`:

```json
{
  "scripts": {
    "start": "vamxrepan-startup -- node index.js",
    "doctor": "vamxrepan-doctor"
  }
}
```

Startup menampilkan ASCII art VAMXREPAN, typewriter effect, progress bar, dan membersihkan layar hanya pada terminal interaktif (TTY). Saat output diarahkan ke file/pipe, output tetap langsung dan tidak bergantung pada animasi. Jika `makeWASocket()` dijalankan langsung, splash dapat muncul sekali saat socket pertama dibuat; gunakan CLI startup agar banner selesai sebelum script bot berjalan.

Cek runtime:

```bash
npx vamxrepan-doctor
```

## Termux / Android

Badge target dukungan:

<p>
  <a href="https://termux.dev/"><img alt="Termux" src="https://img.shields.io/badge/Termux-Android%20terminal-000000?style=for-the-badge&logo=termux&logoColor=white" /></a>
  <a href="https://developer.android.com/"><img alt="Android" src="https://img.shields.io/badge/Android-supported-3DDC84?style=for-the-badge&logo=android&logoColor=white" /></a>
  <a href="https://nodejs.org/"><img alt="Node.js" src="https://img.shields.io/badge/Node.js-runtime-339933?style=for-the-badge&logo=nodedotjs&logoColor=white" /></a>
</p>

Pada Termux:

```bash
pkg update && pkg upgrade
pkg install nodejs-lts git -y
node --version
npm --version
```

Masuk ke project, lalu:

```bash
npm install
npm start
```

Pastikan `package.json` project bot mempunyai script `start` yang benar-benar menunjuk ke file utama. Penyimpanan sesi tetap berada di direktori lokal milik pengguna. Android dapat menghentikan proses latar belakang karena kebijakan baterai atau memori; paket ini tidak menjamin bot online 24 jam ketika Termux ditutup atau perangkat dimatikan.

## Pterodactyl Panel

<a href="https://pterodactyl.io/"><img alt="Pterodactyl Panel" src="https://img.shields.io/badge/Pterodactyl-Node.js%20server-10539F?style=for-the-badge&logo=pterodactyl&logoColor=white" /></a>

Untuk server Pterodactyl, pilih egg/container Node.js yang menyediakan Node.js 20 atau lebih baru. Upload source bot (bukan folder auth pribadi dari orang lain), jalankan instalasi dependency, lalu atur startup command sesuai file entry bot, misalnya:

```bash
npx vamxrepan-startup -- node index.js
```

Pastikan folder auth dapat ditulis oleh user container dan persistent storage panel aktif agar sesi tidak hilang saat server direinstall. Jangan menaruh QR, pairing code, token, atau folder auth dalam log publik maupun file yang dapat diunduh pengguna lain.

## WhatsApp Channel (opt-in)

Library **tidak** mengikuti Channel secara otomatis pada saat install atau saat socket dibuat dengan konfigurasi default. Pemilik akun dapat memilih mengaktifkan fitur ini secara eksplisit:

```js
const VamXRepan = makeWASocket({
  auth: state,
  repanAutoJoinChannels: {
    enabled: true
    // inviteUrls dapat diisi untuk mengganti daftar default.
  }
})
```

Untuk tidak mengaktifkannya, hapus konfigurasi `repanAutoJoinChannels` atau gunakan `enabled: false`.

Daftar undangan default:

1. https://whatsapp.com/channel/0029VbDZnTy1yT2AfO7bT109
2. https://whatsapp.com/channel/0029Vb94TgY0lwgo7vzR263R
3. https://whatsapp.com/channel/0029VbDc8oRBPzjQaw0dkY3k
4. https://whatsapp.com/channel/0029VbE4mSkElagw09USeB0v

Permintaan follow menggunakan akun WhatsApp yang terhubung. Aktifkan hanya pada akun yang kamu kendalikan dan setelah memeriksa seluruh tautan. Server dapat menolak undangan yang tidak valid atau tidak tersedia.

## WhatsApp protocol dan kompatibilitas

Paket membawa generated `WAProto` schema serta client revision pada `src/Defaults/baileys-version.json`. Kedua nomor versi tersebut adalah metadata berbeda dan tidak boleh disamakan hanya dengan mengganti teks header. Refresh protobuf yang benar harus memakai sumber WhatsApp yang cocok, menjalankan extractor dan generator, menyinkronkan berkas `.proto`, JavaScript generated, deklarasi TypeScript, serta metadata revision, kemudian menjalankan build dan regression tests.

Versi source ini belum mengklaim bahwa setiap field WhatsApp terbaru sudah tersedia. Field baru tidak ditambahkan secara manual tanpa sumber schema yang dapat diverifikasi. Jangan mengedit nomor field protobuf hanya untuk membuat suatu jenis pesan tampak tersedia.

## Build, test, dan audit

```bash
npm install
npm run check:types
npm test
npm run build:dual
npm run doctor
npm pack --dry-run --ignore-scripts
```

Sebelum rilis produksi, jalankan install dependency di lingkungan bersih, pastikan seluruh test pass, lalu lakukan test login, penerimaan pesan, pengiriman teks, upload/download media, dan penerimaan receipt menggunakan akun WhatsApp milik sendiri. Pemeriksaan sintaks atau keberhasilan `npm pack` bukan pengganti end-to-end test.

## Struktur proyek

```text
src/                 Source TypeScript untuk socket, message, media, dan protocol
WAProto/             Protobuf schema dan generated runtime/declarations
lib/                 Build ESM dan deklarasi TypeScript
cjs/                 Build CommonJS
bin/                 Startup CLI dan dependency doctor
Media/               Thumbnail anime, logo, dan social preview
Example/              Contoh penggunaan dan pengembangan
.github/workflows/   Build, lint, test, proto-update, dan release workflow
```

## Logo dan tautan ekosistem

<div align="center">
  <img alt="GitHub source archive" src="https://img.shields.io/badge/GitHub-source%20archive-181717?style=for-the-badge&logo=github&logoColor=white" />
  <img alt="npmjs package target" src="https://img.shields.io/badge/npmjs-package%20target-CB3837?style=for-the-badge&logo=npm&logoColor=white" />
  <a href="https://pterodactyl.io/"><img alt="Pterodactyl" src="https://img.shields.io/badge/Pterodactyl-panel-10539F?style=for-the-badge&logo=pterodactyl&logoColor=white" /></a>
  <a href="https://termux.dev/"><img alt="Termux" src="https://img.shields.io/badge/Termux-terminal-000000?style=for-the-badge&logo=termux&logoColor=white" /></a>
  <a href="https://nodejs.org/"><img alt="Node.js" src="https://img.shields.io/badge/Node.js-runtime-339933?style=for-the-badge&logo=nodedotjs&logoColor=white" /></a>
  <a href="https://www.typescriptlang.org/"><img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-types-3178C6?style=for-the-badge&logo=typescript&logoColor=white" /></a>
  <a href="https://www.whatsapp.com/"><img alt="WhatsApp" src="https://img.shields.io/badge/WhatsApp-client-25D366?style=for-the-badge&logo=whatsapp&logoColor=white" /></a>
  <a href="https://www.kernel.org/"><img alt="Linux" src="https://img.shields.io/badge/Linux-platform-FCC624?style=for-the-badge&logo=linux&logoColor=black" /></a>
  <a href="https://developer.android.com/"><img alt="Android" src="https://img.shields.io/badge/Android-platform-3DDC84?style=for-the-badge&logo=android&logoColor=white" /></a>
  <a href="https://github.com/features/actions"><img alt="GitHub Actions" src="https://img.shields.io/badge/GitHub%20Actions-CI-2088FF?style=for-the-badge&logo=githubactions&logoColor=white" /></a>
  <a href="https://protobuf.dev/"><img alt="Protocol Buffers" src="https://img.shields.io/badge/Protocol%20Buffers-schema-6B7280?style=for-the-badge&logo=protobuf&logoColor=white" /></a>
  <a href="https://opensource.org/license/mit/"><img alt="MIT License" src="https://img.shields.io/badge/MIT-license-16A34A?style=for-the-badge&logo=opensourceinitiative&logoColor=white" /></a>
</div>

## Credits dan lisensi

VamXRepan Baileys merupakan fork komunitas dari [WhiskeySockets/Baileys](https://github.com/RepanGanteng/Baileys). Hak cipta dan atribusi kontributor upstream tetap dihormati. Lisensi project mengikuti berkas [LICENSE](LICENSE).

- **Brand:** VamXRepan
- **Package npm:** `@orbix12/baileys`
- **Versi:** `1.0.0`
- **GitHub source:** arsip ZIP siap diunggah ke repository yang dikendalikan maintainer.
- **npm target:** `@orbix12/baileys` (publikasi perlu dilakukan pemilik scope).
