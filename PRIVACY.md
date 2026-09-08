# Privacy

Better YGO is designed as a local-first browser application.

## Data stored on the device

Projects, deck edits, playtest history, role labels, inventory counts, and
workspace settings are stored in the browser's IndexedDB. Better YGO does not
include an account system, analytics SDK, advertising SDK, or cloud sync.

Users can export individual `.ygoproject` files or a complete `.ygoworkspace`
backup. Clearing browser site data removes locally stored projects unless they
were exported first.

## Images and camera

Uploaded images and camera frames are processed in the browser. Source images
and recognition crops are not written into project files. Camera access begins
only after the user selects the camera command, and active media tracks are
stopped when the camera view closes or a frame is captured.

Camera access requires a secure context such as HTTPS or localhost.

## Network requests

Some workflows request card metadata, artwork, banlist data, prerelease
packages, OCR resources, or public deck pages from external services. Requests
contain the query or card identifiers required by that operation and normal
HTTP metadata such as the user's IP address and browser headers.

The YGOPRODeck deck-page proxy only accepts HTTPS YGOPRODeck URLs and limits
response size. Self-hosted deployments control the proxy endpoint through
`VITE_DECK_SOURCE_PROXY`.

See [THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md) for the external services
used by the project.
