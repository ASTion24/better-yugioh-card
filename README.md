<h1 align="center">Better YGO</h1>

<p align="center">
  轻量级游戏王卡组工作台
</p>

<p align="center">
  <a href="./README.en.md">English</a>
  ·
  <a href="https://github.com/ASTion24/better-yugioh-card/actions/workflows/ci.yml">
    <img src="https://github.com/ASTion24/better-yugioh-card/actions/workflows/ci.yml/badge.svg" alt="CI">
  </a>
  <a href="./LICENSE">
    <img src="https://img.shields.io/badge/License-MIT-1c1d1b.svg" alt="MIT License">
  </a>
</p>

<p align="center">
  <img src=".github/assets/launcher.jpg" alt="Better YGO 统一启动台">
</p>

Better YGO 以卡组为一级资产，将导入、编辑、图像识别、构筑分析、试手换备与打印交付串成一个浏览器工作台。它面向实际构筑流程，不要求账户、云同步或本地全量卡库；卡组和图片默认留在本机。

> 当前版本：`0.1.0-beta.1`。核心流程已经可用，外部卡片数据与先行卡内容仍受第三方服务可用性影响。

## 核心工作流

| 工作区 | 解决的问题 |
| --- | --- |
| 统一启动台 | 打开图片或文件导入卡组，粘贴 YDK、YDKe 或卡组链接，直接编辑最近卡组 |
| 单卡DIY工坊 | 数据库补全、高清重绘、异画/先行卡处理、裁图与 PNG 导出 |
| 卡片资料库 | 按需查询卡片，将结果加入卡组或转为可编辑原创卡 |
| 卡组打印工作台 | YDK 到可编辑卡组与 A4 PDF；快速卡图仅用于排版预览，PDF 与交付包始终高清重绘 |
| 卡牌卡组图像识别 | 上传或摄像头拍摄单卡/多卡，复核后导出或继续编辑标准卡组 |
| 试手与概率实验室 | 角色标记、精确概率、组合条件、失败诊断、换备方案与历史统计 |
| 批量制卡 | CSV/JSON 导入、质量审计、批量样式、生产包与打印交付 |

每套卡组均可独立保存、复制、导入和导出，首页只展示最近卡组并可直接进入编辑。为兼容既有数据，单份备份继续使用 `.ygoproject` v3，卡组集合使用 `.ygoworkspace`；IndexedDB 自动保存、revision 检查与 `BroadcastChannel` 用于避免多标签页静默覆盖。

<table>
  <tr>
    <td><img src=".github/assets/recognition.jpg" alt="卡牌卡组图像识别"></td>
    <td><img src=".github/assets/batch.jpg" alt="批量制卡生产工作台"></td>
  </tr>
</table>

## 设计边界

- 不维护全量本地卡片数据库，只按当前任务请求必要记录。
- 图像识别使用约 800 KB 的视觉指纹索引，数字 OCR 仅在需要时加载。
- 原始识别图片和切片不会写入卡组备份。
- 首期识别面向规则截图、单卡照片和无遮挡平铺卡组；严重反光、遮挡或散乱堆叠需要人工复核。
- 标准 YDK/YDKe 只能保存官方数字卡号，原创卡数据保存在 Better YGO 卡组备份中。

更多隐私与第三方服务说明见 [PRIVACY.md](./PRIVACY.md) 和 [THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md)。
计划中的对局环境实验室、全局实卡库存与连续摄像头盘点见
[ROADMAP.md](./ROADMAP.md)。参与开发前请阅读
[CONTRIBUTING.md](./CONTRIBUTING.md)。

## 快速开始

需要 Node.js 22+ 与 pnpm 10+。

### 本地开发

```bash
pnpm install
pnpm dev
```

开发服务器默认从 `http://localhost:5173` 启动。

### 验证

```bash
pnpm lint
pnpm test
pnpm build
pnpm test:e2e:setup
pnpm test:e2e
```

E2E 安装命令会把 Python 依赖和 Chromium 放入本地 `.runtime`，不会提交到仓库。

### 部署

`pnpm build` 会生成静态站点。GitHub Actions 可直接发布 GitHub Pages。YGOPRODeck 页面导入需要仓库中的 `/api/deck-source` Serverless 入口；纯静态部署可通过 `VITE_DECK_SOURCE_PROXY` 指向自己的代理。代理仅允许 HTTPS `ygoprodeck.com`，响应上限为 2 MB。

## 渲染内核

本项目基于 [kooriookami/yugioh-card](https://github.com/kooriookami/yugioh-card) 的 Canvas 渲染内核继续开发，并保留其 MIT 许可与原作者署名。仓库内 `packages/` 是兼容层，不会以原包名发布。

如只需要原始渲染库：

```bash
pnpm add yugioh-card
```

### 浏览器

```js
// 可选 YugiohCard, RushDuelCard, YugiohBackCard, FieldCenterCard, YugiohSeries2Card
import { YugiohCard } from 'yugioh-card';

const card = new YugiohCard({
  view: 'xxx', // div 容器
  data: {
    ..., // 参数见下方 Data 属性
  },
  resourcePath: 'xxx', // 静态资源路径，把 src/assets/yugioh-card 文件夹复制到你的项目中或者服务器上
});

// ready() 会等待字体和图像资源；export() 会在资源就绪后导出。
await card.export('xxx.png', {
  screenshot: true,
  pixelRatio: devicePixelRatio,
});

card.destroy();
```

### Node.js

运行 Node.js 示例前，请先确保本地 Node.js 版本为 22 或更高。

`pnpm add skia-canvas@2`

```js
import http from 'http';
import skia from 'skia-canvas';
import { YugiohCard } from 'yugioh-card';

http.createServer((req, res) => {
  const card = new YugiohCard({
    data: {
      ..., // 参数见下方 Data 属性
    },
    resourcePath: 'xxx', // 静态资源路径，把 src/assets/yugioh-card 文件夹复制到你的项目中或者服务器上
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

## 🔎 示例代码

[示例代码](src/components/YugiohCard.vue)

## 📖 Data 属性

### 游戏王

|         属性名         |    说明     |   类型    |                                                         可选值                                                         |                   备注                    |        默认值        |
|:-------------------:|:---------:|:-------:|:-------------------------------------------------------------------------------------------------------------------:|:---------------------------------------:|:-----------------:|
|      language       |    语言     |  enum   |                                     'sc' / 'tc' / 'jp' / 'kr' / 'en' / 'astral'                                     |    简体中文 / 繁体中文 / 日文 / 韩文 / 英文 / 星光界文    |       'sc'        |
|        font         |    字体     |  enum   |                                             '' / 'custom1' / 'custom2'                                              |            默认 / 自定义一 / 自定义二             |        ''         |
|        name         |    卡名     | string  |                                                          —                                                          |                    —                    |        ''         |
|        color        |   卡名颜色    | string  |                                                          —                                                          |                    —                    |        ''         |
|        align        |   卡名对齐    |  enum   |                                             'left' / 'center' / 'right'                                             |             左对齐 / 居中 / 右对齐              |      'left'       |
|      gradient       |  卡名是否渐变色  | boolean |                                                          —                                                          |                    —                    |       false       |
|   gradientColor1    |   渐变色 1   | string  |                                                          —                                                          |                    —                    |     '#999999'     |
|   gradientColor2    |   渐变色 2   | string  |                                                          —                                                          |                    —                    |     '#ffffff'     |
|        type         |    类型     |  enum   |                                      'monster' / 'spell' / 'trap' / 'pendulum'                                      |            怪兽 / 魔法 / 陷阱 / 灵摆            |     'monster'     |
|      attribute      |    属性     |  enum   |                       'dark' / 'light' / 'earth' / 'water' / 'fire' / 'wind' / 'divine' / ''                        |      暗 / 光 / 地 / 水 / 炎 / 风 / 神 / 无      |      'dark'       |
|        icon         |   魔陷图标    |  enum   |                       'equip' / 'field' / 'quick-play' / 'ritual' / 'continuous' / 'counter'                        |       装备 / 场地 / 速攻 / 仪式 / 永续 / 反击       |        ''         |
|        image        |   中间卡图    | string  |                                                          —                                                          |                    —                    |        ''         |
|      cardType       |   卡片类型    |  enum   |                  'normal' / 'effect' / 'ritual' / 'fusion' / 'synchro' / 'xyz' / 'link' / 'token'                   | 通常 / 效果 / 仪式 / 融合 / 同调 / 超量 / 连接 / 衍生物  |     'normal'      |
|    pendulumType     |   灵摆类型    |  enum   | 'normal-pendulum' / 'effect-pendulum' / 'ritual-pendulum' / 'fusion-pendulum' / 'synchro-pendulum' / 'xyz-pendulum' | 通常灵摆 / 效果灵摆 / 仪式灵摆 / 融合灵摆 / 同调灵摆 / 超量灵摆 | 'normal-pendulum' |
|        level        |    星级     | number  |                                                          —                                                          |                    —                    |         0         |
|        rank         |    阶级     | number  |                                                          —                                                          |                    —                    |         0         |
|    pendulumScale    |   灵摆刻度    | number  |                                                          —                                                          |                    —                    |         0         |
| pendulumDescription |   灵摆效果    | string  |                                                          —                                                          |                    —                    |        ''         |
|     monsterType     |   怪兽类型    | string  |                                                          —                                                          |                    —                    |        ''         |
|       atkBar        |    攻守条    | boolean |                                                          —                                                          |                    —                    |       true        |
|         atk         |    攻击力    | number  |                                                          —                                                          |                ?：-1，∞：-2                |         0         |
|         def         |    防御力    | number  |                                                          —                                                          |                ?：-1，∞：-2                |         0         |
|      arrowList      |   连接箭头    |  array  |                                              [1, 2, 3, 4, 5, 6, 7, 8]                                               |      [上, 右上, 右, 右下, 下, 左下, 左, 左上]       |        []         |
|     description     |   效果描述    | string  |                                                          —                                                          |                    —                    |        ''         |
|  firstLineCompress  |  是否首行压缩   | boolean |                                                          —                                                          |                    —                    |       false       |
|  descriptionAlign   | 是否效果描述居中  | boolean |                                                          —                                                          |                    —                    |       false       |
|   descriptionZoom   |  效果描述缩放   | number  |                                                          —                                                          |                    —                    |         1         |
|  descriptionWeight  |  效果描述字重   | number  |                                                          —                                                          |                    —                    |         0         |
|       package       |    卡包     | string  |                                                          —                                                          |                    —                    |        ''         |
|      password       |   卡片密码    | string  |                                                          —                                                          |                    —                    |        ''         |
|      copyright      |    版权     |  enum   |                                                 'sc' / 'jp' / 'en'                                                  |             简体中文 / 日文 / 英文              |        ''         |
|        laser        |    角标     |  enum   |                                      'laser1' / 'laser2' / 'laser3' / 'laser4'                                      |          样式一 / 样式二 / 样式三 / 样式四          |        ''         |
|        rare         |    罕贵     |  enum   |                                 'dt' / 'ur' / 'gr' / 'hr' / 'ser' / 'gser' / 'pser'                                 |  DT / UR / GR / HR / SER / GSER / PSER  |        ''         |
|      twentieth      | 是否是 20 周年 | boolean |                                                          —                                                          |                    —                    |       false       |
|       radius        |   是否是圆角   | boolean |                                                          —                                                          |                    —                    |       true        |
|        scale        |   卡片缩放    | number  |                                                          —                                                          |                    —                    |         1         |

### 超速决斗

|        属性名        |    说明    |   类型    |                                  可选值                                   |              备注               |    默认值    |
|:-----------------:|:--------:|:-------:|:----------------------------------------------------------------------:|:-----------------------------:|:---------:|
|     language      |    语言    |  enum   |                              'sc' / 'jp'                               |           简体中文 / 日文           |   'sc'    |
|       name        |    卡名    | string  |                                   —                                    |               —               |    ''     |
|       color       |   卡名颜色   | string  |                                   —                                    |               —               |    ''     |
|       type        |    类型    |  enum   |                      'monster' / 'spell' / 'trap'                      |         怪兽 / 魔法 / 陷阱          | 'monster' |
|     attribute     |    属性    |  enum   | 'dark' / 'light' / 'earth' / 'water' / 'fire' / 'wind' / 'divine' / '' | 暗 / 光 / 地 / 水 / 炎 / 风 / 神 / 无 |  'dark'   |
|       icon        |   魔陷图标   |  enum   | 'equip' / 'field' / 'quick-play' / 'ritual' / 'continuous' / 'counter' |  装备 / 场地 / 速攻 / 仪式 / 永续 / 反击  |    ''     |
|       image       |   中间卡图   | string  |                                   —                                    |               —               |    ''     |
|     cardType      |   卡片类型   |  enum   |               'normal' / 'effect' / 'ritual' / 'fusion'                |       通常 / 效果 / 仪式 / 融合       | 'normal'  |
|       level       |    星级    | number  |                                   —                                    |               —               |     0     |
|    monsterType    |   怪兽类型   | string  |                                   —                                    |               —               |    ''     |
|    maximumAtk     |  极限攻击力   | number  |                                   —                                    |               —               |     0     |
|        atk        |   攻击力    | number  |                                   —                                    |             ?：-1              |     0     |
|        def        |   防御力    | number  |                                   —                                    |             ?：-1              |     0     |
|    description    |   效果描述   | string  |                                   —                                    |               —               |    ''     |
| firstLineCompress |  是否首行压缩  | boolean |                                   —                                    |               —               |   false   |
| descriptionAlign  | 是否效果描述居中 | boolean |                                   —                                    |               —               |   false   |
|  descriptionZoom  |  效果描述缩放  | number  |                                   —                                    |               —               |     1     |
| descriptionWeight |  效果描述字重  | number  |                                   —                                    |               —               |     0     |
|      package      |    卡包    | string  |                                   —                                    |               —               |    ''     |
|     password      |   卡片密码   | string  |                                   —                                    |               —               |    ''     |
|      legend       |  是否是传说   | boolean |                                   —                                    |               —               |   false   |
|       laser       |    角标    |  enum   |               'laser1' / 'laser2' / 'laser3' / 'laser4'                |     样式一 / 样式二 / 样式三 / 样式四     |    ''     |
|       rare        |    罕贵    |  enum   |                          'sr' / 'rr' / 'pser'                          |        SR / RR / PSER         |    ''     |
|      radius       |  是否是圆角   | boolean |                                   —                                    |               —               |   true    |
|       scale       |   卡片缩放   | number  |                                   —                                    |               —               |     1     |

### 游戏王卡背

|   属性名    |   说明    |   类型    |                           可选值                           |          备注          |   默认值    |
|:--------:|:-------:|:-------:|:-------------------------------------------------------:|:--------------------:|:--------:|
|   type   |  卡背类型   |  enum   | 'normal' / 'tormentor' / 'sky-dragon' / 'winged-dragon' | 通常 / 巨神兵 / 天空龙 / 翼神龙 | 'normal' |
|   logo   |   标志    |  enum   |                  'ocg' / 'tcg' / 'rd'                   |    OCG / TCG / RD    |  'ocg'   |
|  konami  | 是否有 K 标 | boolean |                            —                            |          —           |   true   |
| register | 是否有 R 标 | boolean |                            —                            |          —           |   true   |
|  radius  |  是否是圆角  | boolean |                            —                            |          —           |   true   |
|  scale   |  卡片缩放   | number  |                            —                            |          —           |    1     |

### 场地中心卡

|   属性名    |  说明   |   类型    | 可选值 | 备注 |  默认值  |
|:--------:|:-----:|:-------:|:---:|:--:|:-----:|
|  image   | 场地图片  | string  |  —  | —  |  ''   |
| cardBack | 是否是卡背 | boolean |  —  | —  | false |
|  radius  | 是否是圆角 | boolean |  —  | —  | true  |
|  scale   | 卡片缩放  | number  |  —  | —  |   1   |

### 游戏王 2 期

|        属性名        |    说明    |   类型    |                                           可选值                                            |                 备注                  |    默认值    |
|:-----------------:|:--------:|:-------:|:----------------------------------------------------------------------------------------:|:-----------------------------------:|:---------:|
|     language      |    语言    |  enum   |                                           'jp'                                           |                 日文                  |   'jp'    |
|       font        |    字体    |  enum   |                                '' / 'custom1' / 'custom2'                                |          默认 / 自定义一 / 自定义二           |    ''     |
|       name        |    卡名    | string  |                                            —                                             |                  —                  |    ''     |
|       color       |   卡名颜色   | string  |                                            —                                             |                  —                  |    ''     |
|       align       |   卡名对齐   |  enum   |                               'left' / 'center' / 'right'                                |           左对齐 / 居中 / 右对齐            |  'left'   |
|     gradient      | 卡名是否渐变色  | boolean |                                            —                                             |                  —                  |   false   |
|  gradientColor1   |  渐变色 1   | string  |                                            —                                             |                  —                  | '#999999' |
|  gradientColor2   |  渐变色 2   | string  |                                            —                                             |                  —                  | '#ffffff' |
|       type        |    类型    |  enum   |                               'monster' / 'spell' / 'trap'                               |            怪兽 / 魔法 / 陷阱             | 'monster' |
|     attribute     |    属性    |  enum   |          'dark' / 'light' / 'earth' / 'water' / 'fire' / 'wind' / 'divine' / ''          |    暗 / 光 / 地 / 水 / 炎 / 风 / 神 / 无    |  'dark'   |
|       icon        |   魔陷图标   |  enum   |          'equip' / 'field' / 'quick-play' / 'ritual' / 'continuous' / 'counter'          |     装备 / 场地 / 速攻 / 仪式 / 永续 / 反击     |    ''     |
|       image       |   中间卡图   | string  |                                            —                                             |                  —                  |    ''     |
|     cardType      |   卡片类型   |  enum   | 'normal' / 'effect' / 'ritual' / 'fusion' / 'tormentor' / 'sky-dragon' / 'winged-dragon' | 通常 / 效果 / 仪式 / 融合 / 巨神兵 / 天空龙 / 翼神龙 | 'normal'  |
|       level       |    星级    | number  |                                            —                                             |                  —                  |     0     |
|    monsterType    |   怪兽类型   | string  |                                            —                                             |                  —                  |    ''     |
|        atk        |   攻击力    | number  |                                            —                                             |           ????：-1，X000：-2           |     0     |
|        def        |   防御力    | number  |                                            —                                             |           ????：-1，X000：-2           |     0     |
|    description    |   效果描述   | string  |                                            —                                             |                  —                  |    ''     |
| firstLineCompress |  是否首行压缩  | boolean |                                            —                                             |                  —                  |   false   |
| descriptionAlign  | 是否效果描述居中 | boolean |                                            —                                             |                  —                  |   false   |
|  descriptionZoom  |  效果描述缩放  | number  |                                            —                                             |                  —                  |     1     |
| descriptionWeight |  效果描述字重  | number  |                                            —                                             |                  —                  |     0     |
|      package      |    卡包    | string  |                                            —                                             |                  —                  |    ''     |
|     password      |   卡片密码   | string  |                                            —                                             |                  —                  |    ''     |
|     copyright     |    版权    |  enum   |                                           'jp'                                           |                 日文                  |    ''     |
|       laser       |    角标    |  enum   |                        'laser1' / 'laser2' / 'laser3' / 'laser4'                         |        样式一 / 样式二 / 样式三 / 样式四        |    ''     |
|      radius       |  是否是圆角   | boolean |                                            —                                             |                  —                  |   true    |
|       scale       |   卡片缩放   | number  |                                            —                                             |                  —                  |     1     |
