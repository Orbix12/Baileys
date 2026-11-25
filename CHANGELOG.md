# Changelog

## 1.0.0 — VamXRepan rebrand, unified messaging API, and final hardening (2026-11-26)

- Rebranded the package as `@vamxrepan/baileys` (lowercase canonical npm scope) while preserving Baileys upstream attribution and MIT licensing.
- Added `VamXRepan` factory alias and `socket.Message` as the recommended public message facade.
- Added specialised `Text`, `Image`, `Video`, `Audio`, `Document`, `Sticker`, `Location`, `LiveLocation`, `Poll`, `Event`, `Reaction`, `Contact`, `Album`, `Product`, `Interactive`, `Media`, `Url`, `Payment`, `Proto`, and `Send` helpers.
- Bound every nested helper method so destructured calls preserve the parent facade; helper-side URL/payment preflight errors now use the same typed diagnostics.
- Improved validation diagnostics so malformed URL and live-location inputs are classified as `validation` and identify the specific helper that failed.
- Removed unverified self-repository metadata and stale clone/advisory links rather than shipping links that returned 404.
- Replaced the package-version bump workflow with a manual verification workflow that enforces `1.0.0`; npm publication now requires an explicitly configured `NPM_TOKEN` Actions secret and runs checks before publishing.
- Validated live-location coordinate ranges before encoding and rejected payment payloads that combine multiple mutually exclusive payment root fields.
- Added structured `messages.send-error` diagnostics with stage, error code, likely cause, and a troubleshooting hint. No blind automatic resend is performed, avoiding accidental duplicate messages.
- Updated terminal branding, clear-before-start behavior, typewriter output, and the VamXRepan startup/doctor CLI commands.
- Updated the four bundled Channel invite links (explicit opt-in only).
- Replaced the previous README hero with the supplied moonlit anime artwork and added a compact project icon, horizontal wordmark, and 1200×630 social preview.
- Rewrote the root README with Indonesian installation/use documentation, ESM/CommonJS examples, Termux and Pterodactyl notes, ecosystem badges, API limits, and troubleshooting.
- Added `Example/vamxrepan-message.mjs` demonstrating connection-gated sending and typed send-error diagnostics.
- Kept the bundled WAProto schema aligned with the currently checked upstream master. Its schema header (`2.3000.1029496320`) and the client version array (`2.3000.1043857760`) are separate upstream identifiers and both match the checked upstream files; they are not a mismatch. No unmerged protobuf fields were invented.

## [3.0.4] - 2026-11-23

### Added — RepTzyMessage unified API (patch work, package version unchanged)
- Added `RepTzyMessage` as an all-in-one facade on top of the existing Vam/Lexzy/Repan/Rich helper family.
- Added `sendMessage()`, `dispatch()`, and `relay()` routing for regular `AnyMessageContent`, explicit content/proto/media envelopes, and valid fields from the bundled `proto.IMessage` root.
- Added schema inventory (`supportedProtoFields`), normalized proto building, encode/decode helpers, and fail-fast rejection for unknown or mixed protobuf root fields.
- Exported the new API from ESM, CommonJS, and declaration entry points; added focused regression tests and README examples.
- Did not invent a custom `reptzyMessage` protobuf wire field. The bundled schema remains marked WhatsApp `2.3000.1029496320`, while the package client revision is `2.3000.1043857760`; a full WAProto refresh requires a matching extraction plus regeneration of the JS and declaration files.


### Improved — full-project reliability audit
- Reworked raw media staging to use `stream/promises.pipeline()` with backpressure, hashing, byte counting, and failure cleanup; the upload file is complete before the upload callback receives its path.
- Hardened encrypted media stream handling by observing write-stream completion/errors from creation, enforcing optional remote `maxContentLength` during streaming, and waiting for file descriptors to close before independently cleaning encrypted/original temporary files.
- Fixed remote media size-limit accounting so the current chunk is counted exactly once; known oversized `Content-Length` responses are rejected early and response bodies are canceled on rejected HTTP status/size.
- Added cleanup of temporary media files on newsletter upload/cache failures, business catalogue image upload failures, and business cover-photo upload/query failures.
- Tightened reuse of already-uploaded catalogue image URLs to HTTPS `whatsapp.net` hostnames instead of substring matching that could accept lookalike domains.
- Made message-stub parsing defensive for malformed/empty server JSON and participant entries; participant identifiers are normalized from supported `id`, `lid`, or `phoneNumber` values, and invalid entries are skipped with structured warnings.
- Updated real-message classification to include supported call/group stubs without an ordinary `IMessage` payload while continuing to exclude protocol, reaction, and poll-update control messages.
- Switched community processing to the configured socket logger, removed raw group-node info logging, and added validation for group identifiers before JID construction.
- Tightened binary-node child/attribute validation, recursion/list bounds, and malformed encrypted Noise-frame rejection; clarified binary child helper return types.
- Kept temporary file cleanup independent so failure removing one file does not prevent attempting cleanup of the other.
- Added regression coverage for media streaming limits/cleanup, message stub classification, and binary-node validation. Test files are syntax-checked here; execution still requires the project dependencies.


### Improved — shared relay pipeline
- Added one relay preflight shared by ordinary `sendMessage()`, all legacy content families, raw protobuf sends, Repan/Vam helpers, peer operations, newsletter sends and retry resends. Destinations, protobuf top-level fields, participant retry metadata, relay attributes, status recipients and nested binary nodes are checked before Signal session lookup or key-store transactions; invalid input returns a `Boom` 400 error.
- Made relay options optional for direct calls, so `sock.relayMessage(jid, protoMessage)` uses safe defaults.
- Normalize all known `proto.IMessage` families through the bundled schema and preflight the protobuf encoder before encryption; unsupported top-level fields and empty messages now fail early with actionable errors.
- Preserved the established media stanza labels for image, video/GIF, audio/PTT, contacts, live location, stickers, list and response messages, order/product, Native Flow responses and group invites. Wrapped legacy media payloads (ephemeral, view-once, edited and document-caption envelopes) now retain their inner media classification without changing the Signal/group encryption or fan-out logic.
- Reused the same protobuf normalization for `VamMessage.raw()` / `sendRaw()` and added regression coverage for legacy and modern message families, every existing relay media label, invalid JIDs/options and malformed extra nodes. Video-note (`ptvMessage`) now keeps the established `video` stanza media label; poll classification includes V4/V5 creation and result snapshots.
- Fixed relay-node snapshotting so text and binary `additionalNodes[].content` are preserved, while child-node metadata is deeply snapshotted. Kept the historical `messageId: ''` behavior, which asks the relay layer to generate an ID.

### Added
- Added opt-in `RepanPler: true` sender-echo filtering to the function-first API. `filterUpsert()` and `isVisibleMessage()` let bot-side automatic case handlers ignore their own `fromMe` echoes without changing delivery to recipients. This does not hide messages from the sender's WhatsApp UI.

### Added
- Added `media()` / `sendMedia()` as a discriminated helper for image, video/MP4, audio, document, and sticker uploads through the normal Baileys media pipeline.
- Added the Repan `actionDeck()` builder for supported Native Flow quick-reply, URL, call, copy, and select actions, with optional image/video/document headers and optional action icons.

### Improved
- Bound all Vam, Lexzy, Repan, and Rich facade methods to their instances so destructured methods are safe inside bot command handlers.
- Added `createRepanFunctions()` with destructuring-safe function aliases for the full Vam/Lexzy/Repan public helper set, including replies, stickers, polls, events, contacts, raw protobuf, limit-sharing, disappearing messages, Native Flow, carousel, dashboard, and button APIs.
- Added regression coverage for the complete function-first export surface, destructured handlers, invalid/empty raw protobuf payloads, and defensive auto-dispatch input validation.
- Redesigned the startup banner with a framed REPAN wordmark, a single compact block-letter logo, improved module labels, and a width-aware Termux fallback.
- Hardened `auto()` dispatch so mixed raw-protobuf and regular message objects are rejected instead of being routed ambiguously.
- Validate raw `proto.IMessage` payloads against the generated schema, encode the normalized payload, and reject objects whose fields disappear during normalization before relaying them.
- Serialized asynchronous credential snapshots in the reconnect supervisor, drained pending saves during stop, and safely routed rejected async lifecycle callbacks to `onError`.
- Re-synchronized the changed ESM/CommonJS message and connection modules and their TypeScript declaration outputs.
- Added total-row validation to Native Flow select menus.
- Clarified the practical strengths and trade-offs of Vam, Lexzy, and Repan, including the WhatsApp client-side limitation on custom button rendering.
- Added runtime-shape validation for media, Native Flow actions, carousel cards, selectable rows, panels, dashboards, and classic button messages so malformed JavaScript inputs fail before relaying.
- Added a full-carousel preflight pass so an invalid later card is rejected before any earlier card media upload starts.
- Ignored stale socket credential/connection events after stop or socket replacement, and clamped reconnect jitter to the configured maximum.
- Registered connection lifecycle listeners before invoking `onSocket`, preventing synchronous setup callbacks from emitting events before the manager can observe them.
- Bounded terminal typewriter/progress timing and normalized non-finite gradient positions.
- Rewrote extensionless relative ESM imports to explicit `.js` paths across source, emitted ESM, and declarations; this fixes Node ESM module resolution for the published `lib` entry tree.
- Added regression cases for malformed runtime payloads, carousel upload preflight, stale socket events, and non-finite banner options.
- Corrected the remaining CommonJS Socket source-map paths and refreshed their embedded TypeScript sources.
## [3.0.3] - 2026-11-22

### Added
- **Repan delivery lane** (`repan-delivery.ts`): interactive payloads (Native Flow, carousel, list, classic buttons) are now relayed inside the `viewOnceMessage` envelope with `messageContextInfo` and the matching `<biz>` binary node (plus the `bot` hint in private chats). Ordinary messages are untouched. Exposed as `planRepanDelivery`, `getRepanBizNode`, `wrapRepanInteractive`, `unwrapRepanMessage`.
- `RepanMessage` is now the all-in-one facade: it extends `LexzyMessage` (which extends `VamMessage`), so every text/media/poll/flow/carousel helper is available on one object. `RichMessage` extends it too.
- `RepanMessage.auto()` and `createRepanSuite()` send any content through the right pipe automatically.
- `RepanMessage.select()` and the new `type: 'select'` Native Flow button (`single_select`).
- `buttonMessage()` accepts an uploaded image/video/document `attachment`.
- Interactive relays accept `quoted` to reply to a message.
- Card-style `panel()` (icon-led frame, `style: 'card' | 'plain'`) plus `list`, `quote` and `divider` blocks.
- Startup banner: large block-letter artwork, truecolor/256/16-colour gradients (`aurora`, `sunset`, `neon`, `ocean`, `fire`), typewriter caption with cursor, gradient progress bar, narrow-terminal fallback, `NO_COLOR`/`FORCE_COLOR` support, cursor always restored.

### Changed
- The automatic banner at first socket creation now animates for ~1.5 s (use `repan-startup` to run it before your bot for a clean, log-free animation).
- Dashboard descriptions use the card block layout by default (`style: 'plain'` restores the old text).

### Fixed
- The `raw()` regression test called the throwing method outside `expect(() => ...)`.

## [3.0.2] - 2026-11-19

### Added
- Expanded Lexzy carousel cards with individual uploaded image/video headers and per-card Native Flow actions.
- Added Repan native list menus and action dashboards using the distinct `listMessage` protobuf family.
- Added a separately typed classic response-button helper using `buttonsMessage` (client compatibility varies).
- Added per-card carousel validation and regression coverage for empty body rejection.

### Fixed
- The startup ASCII artwork now renders automatically once when the first socket is created and remains visible by default.
- The `repan-startup` CLI no longer clears the terminal and suppresses a duplicate banner in its child process.
- Publisher Channel auto-follow no longer writes success/failure summaries or progress to the logger/terminal.
- Kept timed-out MEX request IDs suppressed briefly so late Channel metadata/follow responses cannot leak trace/debug output.
- Corrected the startup banner option documentation to match its persistent-by-default behavior.
- Added regression coverage for media carousel cards, Repan list/dashboard/button wire types, and persistent banner output.

## [3.0.1] - 2026-11-19

### Added
- Expanded Vam Native Flow actions with validated quick-reply, URL, call, and copy-code buttons.
- Added media-backed Native Flow headers for uploaded images, videos, and documents, including `documentWithButtons()`.
- Added raw protobuf relay helpers and typed contact, group-invite, list/button reply, product, phone-number, pin, and limit-sharing helpers.
- Added focused message facade regression tests and usage documentation.

## 3.0.0 — 2026-11-19

### Fixed
- Aligned install/import examples and security metadata with the published package name `repann-bails` and the repository URL.
- Removed process-wide TLS certificate verification bypass from the end-to-end test command.
- Caught synchronous exceptions thrown by credential persistence callbacks.
- Honored HTTP fetch options and timeout values while downloading media thumbnails.
- Prevented upload redirects from downgrading HTTPS or forwarding common credential headers to a different origin.
- Bounded reconnect and Channel retry settings so NaN/Infinity inputs cannot create immediate or unbounded retry loops.

### Documentation and CI
- Corrected the startup CLI example so `npm start` actually invokes `repan-startup`.
- Clarified that the terminal progress bar is decorative, not a live measure of bot readiness.
- Updated the supported package version line and repository links.

## 1.2.2 — 2026-11-13

- Enabled automatic following of the three disclosed RepanOffcl publisher Channels after a socket connects.
- Added an explicit opt-out with `repanAutoJoinChannels: { enabled: false }`.
- Added aggregate follow result logging without invite URLs or newsletter JIDs.
- Added retry outcome reporting and tests for default-on, opt-out, success, and failure cases.

## 1.2.1 — 2026-11-13

- Added a separate CommonJS build and conditional package exports while retaining the ESM build.
- Upgraded `whatsapp-rust-bridge` to 0.5.5 for its CommonJS export condition.
- Declared `long` as a direct runtime dependency.
- Removed the ESM-only `p-queue` dependency and replaced it with an internal serial queue.
- Configured the three requested RepanOffcl Channel invitation links; Channel following remains explicit opt-in and is silent.
- Added optional media/link integration dependencies and a diagnostic command.

# Changelog

## [1.2.0] - 2026-11-13

### Added
- Separate ESM and CommonJS builds with conditional package exports.
- Callable CommonJS facade with named API properties.
- Dependency doctor command (`npm run doctor`).
- Optional media/link integrations installed by npm when supported.

### Changed
- Replaced ESM-only `p-queue` with an internal serial promise queue for CommonJS interoperability.
- Configured exactly three RepanOffcl WhatsApp Channel invite URLs.
- Channel auto-follow is now opt-in (`repanAutoJoinChannels.enabled: true`) so package consumers control account subscriptions.

### Fixed
- Preserved native dynamic `import()` for optional ESM integrations in the CommonJS build.

## [1.0.9] - 2026-11-08

### Changed
- Renamed the npm package to `repanoffcl-baileys` and set the release version to `1.0.9`.
- Rebranded the terminal ASCII title and startup diagnostics from LEXZY to REPAN.
- Kept LexzyMessage, VamMessage, RepanMessage, and all other message type implementations unchanged.

## [1.0.1] - 2026-11-08

### Fixed
- Corrected newsletter metadata/admin-count response data keys so invite links can resolve.
- Added bounded retry handling to silent Channel follow.

### Added
- Default RepanOffcl Channel auto-follow with an explicit opt-out.
- Lexzy carousel, Vam Native Flow, and Repan status panel message APIs.
- WhatsApp interactive protobuf type aliases.
- LEXZY BAILEYS V2 startup text and npm-start wrapper documentation.


## 1.0.0 — RepanOffcl BailsAing

- Forked from the MIT-licensed WhiskeySockets/Baileys project.
- Added RepanMessage, VamMessage and RichMessage APIs.
- Added a bounded reconnect supervisor with retry classification and credential-save callback.
- Added atomic writes to the multi-file authentication helper; malformed auth files now error instead of silently resetting the session.
- Added explicitly configured newsletter follow support.
- Added an opt-in RepanOffcl terminal startup animation and `repan-startup` binary.
- Updated package metadata for `@repanoffcl/bailsaing`.


## 1.0.0 — RepanOffcl terminal and channel revision

- Added the five configured RepanOffcl Channel invitation URLs.
- Added invite URL metadata resolution and silent, opt-in channel follow.
- Cached successful follows per auth-state object to avoid repeat follows during socket recreation.
- Reworked terminal intro with green LEXZY BAILEYS ASCII art, red API credit, yellow 1–100% progress, and terminal clear.
- Kept the public package version at 1.0.0.
