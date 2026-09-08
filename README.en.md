<h1 align="center">Better YGO</h1>

<p align="center">
  A lightweight Yu-Gi-Oh! card and competitive deck workbench
</p>

<p align="center">
  <a href="./README.md">简体中文</a>
  ·
  <a href="https://github.com/ASTion24/better-yugioh-card/actions/workflows/ci.yml">
    <img src="https://github.com/ASTion24/better-yugioh-card/actions/workflows/ci.yml/badge.svg" alt="CI">
  </a>
  <a href="./LICENSE">
    <img src="https://img.shields.io/badge/License-MIT-1c1d1b.svg" alt="MIT License">
  </a>
</p>

<p align="center">
  <img src=".github/assets/launcher.jpg" alt="Better YGO unified launcher">
</p>

Better YGO treats each deck as a first-class asset and connects import, editing,
image recognition, build analysis, playtesting, Side Deck planning, printing,
and delivery in one browser workspace. It requires no account, cloud sync, or
bundled full card database; decks and uploaded images stay on the device by
default.

> Current release: `0.1.0-beta.1`. Core workflows are usable. Availability of
> remote card data and prerelease records still depends on third-party services.

## Core Workflows

| Workspace | What it solves |
| --- | --- |
| Unified launcher | Open an image or file to import a deck; paste YDK, YDKe, or a deck link; reopen any recent deck |
| Single-card DIY studio | Database completion, high-resolution rendering, artwork cropping, and PNG export |
| Card library | On-demand card search with deck insertion and editable custom-card drafts |
| Deck print workspace | Turn YDK into an editable deck and A4 PDF; quick images are preview-only, while print outputs always use high-resolution rendering |
| Card and deck image recognition | Upload or capture single/multiple cards, review results, and export or continue editing a standard deck |
| Playtest lab | Roles, exact odds, custom goals, failure diagnosis, Side plans, and trial history |
| Batch production | CSV/JSON import, quality audit, bulk styles, production packages, and print handoff |

Each deck can be saved, duplicated, imported, and exported independently. The
launcher lists recent decks only and opens any of them directly for editing.
For backward compatibility, individual backups still use `.ygoproject` v3 and
deck collections use `.ygoworkspace`. IndexedDB autosave, revision checks, and
`BroadcastChannel` notifications prevent silent overwrites between tabs.

<table>
  <tr>
    <td><img src=".github/assets/recognition.jpg" alt="Card image recognition"></td>
    <td><img src=".github/assets/batch.jpg" alt="Batch production workspace"></td>
  </tr>
</table>

## Design Boundaries

- No bundled full card database; only records required by the current task are requested.
- Recognition uses an approximately 800 KB visual fingerprint index and loads numeric OCR only when needed.
- Source images and recognition crops are never persisted in deck backups.
- Initial recognition targets regular screenshots, single-card photos, and unobstructed flat lays. Heavy glare, overlap, and scattered cards require manual review.
- Standard YDK/YDKe exports contain official numeric IDs only. Custom-card data stays in Better YGO deck backups.

See [PRIVACY.md](./PRIVACY.md) and
[THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md) for data handling and
third-party service details.
See [ROADMAP.md](./ROADMAP.md) for planned matchup, inventory, and continuous
camera workflows, and [CONTRIBUTING.md](./CONTRIBUTING.md) before contributing.

## Quick Start

Requires Node.js 22+ and pnpm 10+.

### Local Development

```bash
pnpm install
pnpm dev
```

The development server starts at `http://localhost:5173` by default.

### Verification

```bash
pnpm lint
pnpm test
pnpm build
pnpm test:e2e:setup
pnpm test:e2e
```

The E2E setup command installs Python packages and Chromium under the local
`.runtime` directory, which is excluded from version control.

### Deployment

`pnpm build` creates the static site. The included GitHub Actions workflow can
publish it to GitHub Pages. YGOPRODeck page imports require the Serverless
`/api/deck-source` endpoint; static hosts can set `VITE_DECK_SOURCE_PROXY` to
their own proxy. The proxy only accepts HTTPS `ygoprodeck.com` URLs and limits
responses to 2 MB.

## Rendering Core

Better YGO builds on the Canvas renderer from
[kooriookami/yugioh-card](https://github.com/kooriookami/yugioh-card), retaining
its MIT license and original attribution. The local `packages/` directory is a
compatibility layer and is not published under the upstream package name.

For the original standalone renderer:

```bash
pnpm add yugioh-card
```

### Browser

```js
// Optional: YugiohCard, RushDuelCard, YugiohBackCard, FieldCenterCard, YugiohSeries2Card
import { YugiohCard } from 'yugioh-card';

const card = new YugiohCard({
  view: 'xxx', // div container
  data: {
    ..., // see Data properties below
  },
  resourcePath: 'xxx', // path to static resources, copy src/assets/yugioh-card folder to your project or server
});

// ready() waits for fonts and images; export() waits before rendering.
await card.export('xxx.png', {
  screenshot: true,
  pixelRatio: devicePixelRatio,
});

card.destroy();
```

### Node.js

Before running the Node.js example, make sure your local Node.js version is 22 or higher.

`pnpm add skia-canvas@2`

```js
import http from 'http';
import skia from 'skia-canvas';
import { YugiohCard } from 'yugioh-card';

http.createServer((req, res) => {
  const card = new YugiohCard({
    data: {
      ..., // see Data properties below
    },
    resourcePath: 'xxx', // path to static resources, copy src/assets/yugioh-card folder to your project or server
    skia: skia,
  });
  card.leafer.export('png', {
    screenshot: true,
  }).then(result => {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.write(`<img src="${result.data}" />`);
    res.end();
  });
}).listen(3000, () => {
    console.log('server is running at http://localhost:3000');
});
```

## 🔎 Example Code

[Example Code](src/components/YugiohCard.vue)

## 📖 Data Properties

### Yu-Gi-Oh!

|    Property Name    |        Description        |  Type   |                                                       Options                                                       |                                                  Notes                                                  |      Default      |
|:-------------------:|:-------------------------:|:-------:|:-------------------------------------------------------------------------------------------------------------------:|:-------------------------------------------------------------------------------------------------------:|:-----------------:|
|      language       |         Language          |  enum   |                                     'sc' / 'tc' / 'jp' / 'kr' / 'en' / 'astral'                                     |             Simplified Chinese / Traditional Chinese / Japanese / Korean / English / Astral             |       'sc'        |
|        font         |           Font            |  enum   |                                             '' / 'custom1' / 'custom2'                                              |                                      Default / Custom 1 / Custom 2                                      |        ''         |
|        name         |         Card Name         | string  |                                                          —                                                          |                                                    —                                                    |        ''         |
|        color        |      Card Name Color      | string  |                                                          —                                                          |                                                    —                                                    |        ''         |
|        align        |    Card Name Alignment    |  enum   |                                             'left' / 'center' / 'right'                                             |                                          Left / Center / Right                                          |      'left'       |
|      gradient       | Whether Name Has Gradient | boolean |                                                          —                                                          |                                                    —                                                    |       false       |
|   gradientColor1    |     Gradient Color 1      | string  |                                                          —                                                          |                                                    —                                                    |     '#999999'     |
|   gradientColor2    |     Gradient Color 2      | string  |                                                          —                                                          |                                                    —                                                    |     '#ffffff'     |
|        type         |           Type            |  enum   |                                      'monster' / 'spell' / 'trap' / 'pendulum'                                      |                                    Monster / Spell / Trap / Pendulum                                    |     'monster'     |
|      attribute      |         Attribute         |  enum   |                       'dark' / 'light' / 'earth' / 'water' / 'fire' / 'wind' / 'divine' / ''                        |                       Dark / Light / Earth / Water / Fire / Wind / Divine / None                        |      'dark'       |
|        icon         |      Spell/Trap Icon      |  enum   |                       'equip' / 'field' / 'quick-play' / 'ritual' / 'continuous' / 'counter'                        |                       Equip / Field / Quick-Play / Ritual / Continuous / Counter                        |        ''         |
|        image        |       Center Image        | string  |                                                          —                                                          |                                                    —                                                    |        ''         |
|      cardType       |         Card Type         |  enum   |                  'normal' / 'effect' / 'ritual' / 'fusion' / 'synchro' / 'xyz' / 'link' / 'token'                   |                    Normal / Effect / Ritual / Fusion / Synchro / XYZ / Link / Token                     |     'normal'      |
|    pendulumType     |       Pendulum Type       |  enum   | 'normal-pendulum' / 'effect-pendulum' / 'ritual-pendulum' / 'fusion-pendulum' / 'synchro-pendulum' / 'xyz-pendulum' | Normal Pendulum / Effect Pendulum / Ritual Pendulum / Fusion Pendulum / Synchro Pendulum / XYZ Pendulum | 'normal-pendulum' |
|        level        |           Level           | number  |                                                          —                                                          |                                                    —                                                    |         0         |
|        rank         |           Rank            | number  |                                                          —                                                          |                                                    —                                                    |         0         |
|    pendulumScale    |      Pendulum Scale       | number  |                                                          —                                                          |                                                    —                                                    |         0         |
| pendulumDescription |      Pendulum Effect      | string  |                                                          —                                                          |                                                    —                                                    |        ''         |
|     monsterType     |       Monster Type        | string  |                                                          —                                                          |                                                    —                                                    |        ''         |
|       atkBar        |     Show ATK/DEF Bar      | boolean |                                                          —                                                          |                                                    —                                                    |       true        |
|         atk         |            ATK            | number  |                                                          —                                                          |                                               ?：-1, ∞：-2                                                |         0         |
|         def         |            DEF            | number  |                                                          —                                                          |                                               ?：-1, ∞：-2                                                |         0         |
|      arrowList      |        Link Arrows        |  array  |                                                  [1,2,3,4,5,6,7,8]                                                  |               [Top, Top-Right, Right, Bottom-Right, Bottom, Bottom-Left, Left, Top-Left]                |        []         |
|     description     |    Effect Description     | string  |                                                          —                                                          |                                                    —                                                    |        ''         |
|  firstLineCompress  |    Compress First Line    | boolean |                                                          —                                                          |                                                    —                                                    |       false       |
|  descriptionAlign   |    Center Effect Text     | boolean |                                                          —                                                          |                                                    —                                                    |       false       |
|   descriptionZoom   |     Effect Text Zoom      | number  |                                                          —                                                          |                                                    —                                                    |         1         |
|  descriptionWeight  |    Effect Text Weight     | number  |                                                          —                                                          |                                                    —                                                    |         0         |
|       package       |         Card Pack         | string  |                                                          —                                                          |                                                    —                                                    |        ''         |
|      password       |       Card Password       | string  |                                                          —                                                          |                                                    —                                                    |        ''         |
|      copyright      |         Copyright         |  enum   |                                                 'sc' / 'jp' / 'en'                                                  |                                 Simplified Chinese / Japanese / English                                 |        ''         |
|        laser        |        Laser Mark         |  enum   |                                      'laser1' / 'laser2' / 'laser3' / 'laser4'                                      |                                  Style 1 / Style 2 / Style 3 / Style 4                                  |        ''         |
|        rare         |          Rarity           |  enum   |                                 'dt' / 'ur' / 'gr' / 'hr' / 'ser' / 'gser' / 'pser'                                 |                                  DT / UR / GR / HR / SER / GSER / PSER                                  |        ''         |
|      twentieth      |     20th Anniversary      | boolean |                                                          —                                                          |                                                    —                                                    |       false       |
|       radius        |      Rounded Corners      | boolean |                                                          —                                                          |                                                    —                                                    |       true        |
|        scale        |        Card Scale         | number  |                                                          —                                                          |                                                    —                                                    |         1         |

### Rush Duel

|   Property Name   |     Description     |  Type   |                                Options                                 |                           Notes                            |  Default  |
|:-----------------:|:-------------------:|:-------:|:----------------------------------------------------------------------:|:----------------------------------------------------------:|:---------:|
|     language      |      Language       |  enum   |                              'sc' / 'jp'                               |               Simplified Chinese / Japanese                |   'sc'    |
|       name        |      Card Name      | string  |                                   —                                    |                             —                              |    ''     |
|       color       |   Card Name Color   | string  |                                   —                                    |                             —                              |    ''     |
|       type        |        Type         |  enum   |                      'monster' / 'spell' / 'trap'                      |                   Monster / Spell / Trap                   | 'monster' |
|     attribute     |      Attribute      |  enum   | 'dark' / 'light' / 'earth' / 'water' / 'fire' / 'wind' / 'divine' / '' | Dark / Light / Earth / Water / Fire / Wind / Divine / None |  'dark'   |
|       icon        |   Spell/Trap Icon   |  enum   | 'equip' / 'field' / 'quick-play' / 'ritual' / 'continuous' / 'counter' | Equip / Field / Quick-Play / Ritual / Continuous / Counter |    ''     |
|       image       |    Center Image     | string  |                                   —                                    |                             —                              |    ''     |
|     cardType      |      Card Type      |  enum   |               'normal' / 'effect' / 'ritual' / 'fusion'                |             Normal / Effect / Ritual / Fusion              | 'normal'  |
|       level       |        Level        | number  |                                   —                                    |                             —                              |     0     |
|    monsterType    |    Monster Type     | string  |                                   —                                    |                             —                              |    ''     |
|    maximumAtk     |     Maximum ATK     | number  |                                   —                                    |                             —                              |     0     |
|        atk        |         ATK         | number  |                                   —                                    |                            ?：-1                            |     0     |
|        def        |         DEF         | number  |                                   —                                    |                            ?：-1                            |     0     |
|    description    | Effect Description  | string  |                                   —                                    |                             —                              |    ''     |
| firstLineCompress | Compress First Line | boolean |                                   —                                    |                             —                              |   false   |
| descriptionAlign  | Center Effect Text  | boolean |                                   —                                    |                             —                              |   false   |
|  descriptionZoom  |  Effect Text Zoom   | number  |                                   —                                    |                             —                              |     1     |
| descriptionWeight | Effect Text Weight  | number  |                                   —                                    |                             —                              |     0     |
|      package      |      Card Pack      | string  |                                   —                                    |                             —                              |    ''     |
|     password      |    Card Password    | string  |                                   —                                    |                             —                              |    ''     |
|      legend       |      Legendary      | boolean |                                   —                                    |                             —                              |   false   |
|       laser       |     Laser Mark      |  enum   |               'laser1' / 'laser2' / 'laser3' / 'laser4'                |           Style 1 / Style 2 / Style 3 / Style 4            |    ''     |
|       rare        |       Rarity        |  enum   |                          'sr' / 'rr' / 'pser'                          |                       SR / RR / PSER                       |    ''     |
|      radius       |   Rounded Corners   | boolean |                                   —                                    |                             —                              |   true    |
|       scale       |     Card Scale      | number  |                                   —                                    |                             —                              |     1     |

### Yu-Gi-Oh! Card Back

| Property Name |   Description   |  Type   |                         Options                         |                      Notes                      | Default  |
|:-------------:|:---------------:|:-------:|:-------------------------------------------------------:|:-----------------------------------------------:|:--------:|
|     type      | Card Back Type  |  enum   | 'normal' / 'tormentor' / 'sky-dragon' / 'winged-dragon' | Normal / Tormentor / Sky Dragon / Winged Dragon | 'normal' |
|     logo      |      Logo       |  enum   |                  'ocg' / 'tcg' / 'rd'                   |                 OCG / TCG / RD                  |  'ocg'   |
|    konami     |   Show K mark   | boolean |                            —                            |                        —                        |   true   |
|   register    |   Show R mark   | boolean |                            —                            |                        —                        |   true   |
|    radius     | Rounded Corners | boolean |                            —                            |                        —                        |   true   |
|     scale     |   Card Scale    | number  |                            —                            |                        —                        |    1     |

### Field Center Card

| Property Name |   Description   |  Type   | Options | Notes | Default |
|:-------------:|:---------------:|:-------:|:-------:|:-----:|:-------:|
|     image     |   Field Image   | string  |    —    |   —   |   ''    |
|   cardBack    |  Is Card Back   | boolean |    —    |   —   |  false  |
|    radius     | Rounded Corners | boolean |    —    |   —   |  true   |
|     scale     |   Card Scale    | number  |    —    |   —   |    1    |

### Yu-Gi-Oh! Series 2

|   Property Name   |        Description        |  Type   |                                         Options                                          |                                   Notes                                    |  Default  |
|:-----------------:|:-------------------------:|:-------:|:----------------------------------------------------------------------------------------:|:--------------------------------------------------------------------------:|:---------:|
|     language      |         Language          |  enum   |                                           'jp'                                           |                                  Japanese                                  |   'jp'    |
|       font        |           Font            |  enum   |                                '' / 'custom1' / 'custom2'                                |                       Default / Custom 1 / Custom 2                        |    ''     |
|       name        |         Card Name         | string  |                                            —                                             |                                     —                                      |    ''     |
|       color       |      Card Name Color      | string  |                                            —                                             |                                     —                                      |    ''     |
|       align       |    Card Name Alignment    |  enum   |                               'left' / 'center' / 'right'                                |                           Left / Center / Right                            |  'left'   |
|     gradient      | Whether Name Has Gradient | boolean |                                            —                                             |                                     —                                      |   false   |
|  gradientColor1   |     Gradient Color 1      | string  |                                            —                                             |                                     —                                      | '#999999' |
|  gradientColor2   |     Gradient Color 2      | string  |                                            —                                             |                                     —                                      | '#ffffff' |
|       type        |           Type            |  enum   |                               'monster' / 'spell' / 'trap'                               |                           Monster / Spell / Trap                           | 'monster' |
|     attribute     |         Attribute         |  enum   |          'dark' / 'light' / 'earth' / 'water' / 'fire' / 'wind' / 'divine' / ''          |         Dark / Light / Earth / Water / Fire / Wind / Divine / None         |  'dark'   |
|       icon        |      Spell/Trap Icon      |  enum   |          'equip' / 'field' / 'quick-play' / 'ritual' / 'continuous' / 'counter'          |         Equip / Field / Quick-Play / Ritual / Continuous / Counter         |    ''     |
|       image       |       Center Image        | string  |                                            —                                             |                                     —                                      |    ''     |
|     cardType      |         Card Type         |  enum   | 'normal' / 'effect' / 'ritual' / 'fusion' / 'tormentor' / 'sky-dragon' / 'winged-dragon' | Normal / Effect / Ritual / Fusion / Tormentor / Sky Dragon / Winged Dragon | 'normal'  |
|       level       |           Level           | number  |                                            —                                             |                                     —                                      |     0     |
|    monsterType    |       Monster Type        | string  |                                            —                                             |                                     —                                      |    ''     |
|        atk        |            ATK            | number  |                                            —                                             |                              ????：-1, X000：-2                              |     0     |
|        def        |            DEF            | number  |                                            —                                             |                              ????：-1, X000：-2                              |     0     |
|    description    |    Effect Description     | string  |                                            —                                             |                                     —                                      |    ''     |
| firstLineCompress |    Compress First Line    | boolean |                                            —                                             |                                     —                                      |   false   |
| descriptionAlign  |    Center Effect Text     | boolean |                                            —                                             |                                     —                                      |   false   |
|  descriptionZoom  |     Effect Text Zoom      | number  |                                            —                                             |                                     —                                      |     1     |
| descriptionWeight |    Effect Text Weight     | number  |                                            —                                             |                                     —                                      |     0     |
|      package      |         Card Pack         | string  |                                            —                                             |                                     —                                      |    ''     |
|     password      |       Card Password       | string  |                                            —                                             |                                     —                                      |    ''     |
|     copyright     |         Copyright         |  enum   |                                           'jp'                                           |                                  Japanese                                  |    ''     |
|       laser       |        Laser Mark         |  enum   |                        'laser1' / 'laser2' / 'laser3' / 'laser4'                         |                   Style 1 / Style 2 / Style 3 / Style 4                    |    ''     |
|      radius       |      Rounded Corners      | boolean |                                            —                                             |                                     —                                      |   true    |
|       scale       |        Card Scale         | number  |                                            —                                             |                                     —                                      |     1     |
