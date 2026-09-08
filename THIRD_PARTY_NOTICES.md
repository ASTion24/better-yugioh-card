# Third-Party Notices

Better YGO is an independent, fan-made project. It is not affiliated with,
endorsed by, sponsored by, or approved by Konami.

Yu-Gi-Oh!, card names, card artwork, card frames, symbols, and related
trademarks are the property of their respective owners. The repository's MIT
license applies to project source code and does not grant rights to third-party
trademarks, artwork, fonts, card data, or other assets.

## Upstream renderer

The rendering core is derived from
[kooriookami/yugioh-card](https://github.com/kooriookami/yugioh-card), released
under the MIT License. The original copyright notice is retained in
[LICENSE](./LICENSE).

The upstream project credits LeaferJS for its graphics framework and 白羽幸鳥
for high-resolution card templates. Better YGO preserves that attribution.

## External data services

Better YGO requests only data needed for the current operation. Depending on
the workflow, requests may be sent to:

- YGOCDB for card metadata and artwork references.
- YGOPRODeck for public card or deck information.
- MyCard/YGOPro prerelease resources for rolling prerelease records.
- User-provided GitHub Raw or other supported deck URLs.

These services are not controlled by Better YGO. Their availability, data
quality, licensing terms, and privacy policies remain their own.

## Open-source libraries

The project uses Vue, Vite, LeaferJS, sql.js, Tesseract.js, jsPDF, fflate,
Iconify, Lodash, and other packages distributed under their respective
licenses. Exact package versions and dependency metadata are recorded in
`pnpm-lock.yaml`.

## User responsibility

Generated cards and printable output are intended for personal testing,
research, and other uses permitted by applicable law. Users are responsible for
ensuring that imported images, fonts, card data, and generated output may be
used in their jurisdiction and intended context.
