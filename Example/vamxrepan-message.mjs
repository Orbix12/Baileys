import makeWASocket, {
  DisconnectReason,
  useMultiFileAuthState
} from '@vamxrepan/baileys'

const { state, saveCreds } = await useMultiFileAuthState('./auth_info')
const VamXRepan = makeWASocket({ auth: state })
const targetJid = process.env.TARGET_JID
let welcomeSent = false

if (!targetJid) {
  console.error('Set TARGET_JID before using this example.')
  process.exitCode = 1
}

VamXRepan.ev.on('creds.update', saveCreds)

VamXRepan.ev.on('messages.send-error', report => {
  console.error('[VamXRepan send failure]', {
    jid: report.jid,
    type: report.messageType,
    stage: report.stage,
    code: report.code,
    reason: report.reason,
    suggestion: report.suggestion
  })
})

VamXRepan.ev.on('connection.update', ({ connection, lastDisconnect }) => {
  if (connection === 'open') {
    console.log('[VamXRepan] Connected.')

    // Never call send before the connection is open.
    if (targetJid && !welcomeSent) {
      welcomeSent = true
      void VamXRepan.Message.Text.send(targetJid, 'VamXRepan Message API is ready.')
        .catch(error => console.error('[Send rejected]', error.report ?? error))
    }
  }

  if (connection === 'close') {
    const status = lastDisconnect?.error?.output?.statusCode
    if (status === DisconnectReason.loggedOut) {
      console.error('[VamXRepan] Logged out. Remove no credentials automatically; relink the device manually.')
    } else {
      console.error('[VamXRepan] Connection closed. Reconnect using your application lifecycle.')
    }
  }
})

VamXRepan.ev.on('messages.upsert', ({ messages, type }) => {
  if (type !== 'notify') return
  for (const message of messages) {
    console.log('[Incoming]', message.key.remoteJid, message.key.id)
  }
})
