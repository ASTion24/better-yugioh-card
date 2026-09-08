import { Text, Image, ImageEvent, Leafer, useCanvas } from 'leafer-unified';
import { isBrowser, isNode, loadFontBrowser, loadFontNode } from '../utils/index.js';
import loaderIconUrl from '../svg/loader.js';
import imageIconUrl from '../svg/image.js';

const fontPathMap = {
  YugiohCard: '/yugioh/font',
  YugiohSeries2Card: '/yugioh/font',
  RushDuelCard: '/rush-duel/font',
};

const resetAttr = () => {
  Text.changeAttr('lineHeight', {
    type: 'percent',
    value: 1.15,
  });
};

export class Card {
  leafer = null;
  imageStatusLeaf = null;
  cardWidth = 100;
  cardHeight = 100;
  data = {};
  view = null;
  resourcePath = null;
  skia = null;
  resourceReady = Promise.resolve();
  destroyed = false;
  /** @type {symbol | null} */
  renderVersion = null;

  constructor(data = {}) {
    this.view = data.view;
    this.resourcePath = data.resourcePath;
    this.skia = data.skia;
    resetAttr();

    if (isNode) {
      if (!this.skia) {
        throw new Error('skia-canvas is required in Node environment');
      }
      useCanvas('skia', this.skia);
    }
  }

  setData(data = {}) {
    if (this.destroyed) {
      throw new Error('card instance has been destroyed');
    }
    Object.assign(this.data, data);
    const version = Symbol('render');
    this.renderVersion = version;
    const fontReady = this.loadFonts();
    this.draw();
    this.resourceReady = fontReady.then(() => {
      if (!this.destroyed && this.renderVersion === version) {
        this.draw();
      }
    });
    // Mark the promise as handled while preserving rejection for ready()/export().
    this.resourceReady.catch(() => {});
    return this.resourceReady;
  }

  initLeafer() {
    this.leafer = new Leafer({
      view: this.view,
      width: this.cardWidth,
      height: this.cardHeight,
    });
  }

  draw() {
    // need to be overridden
  }

  get fontFamilyList() {
    return [];
  }

  loadFonts() {
    const fontPath = fontPathMap[this.tag];
    if (!fontPath || !this.resourcePath) {
      return Promise.resolve();
    }
    const fullPath = `${this.resourcePath}${fontPath}`;
    if (isNode) {
      loadFontNode(fullPath, this.skia, this.fontFamilyList);
      return Promise.resolve();
    }
    return loadFontBrowser(fullPath, this.fontFamilyList);
  }

  async ready() {
    let pending = this.resourceReady;
    await pending;
    if (pending !== this.resourceReady) {
      return this.ready();
    }
    if (!this.leafer || this.destroyed) {
      throw new Error('card instance is not available');
    }
    await new Promise(resolve => {
      this.leafer.waitViewCompleted(resolve);
      this.leafer.requestRender(true);
    });
    return this;
  }

  async export(filename, options = {}) {
    await this.ready();
    const result = await this.leafer.export(filename, options);
    if (result.error) {
      throw result.error;
    }
    return result;
  }

  destroy() {
    if (this.destroyed) {
      return;
    }
    this.destroyed = true;
    this.leafer?.destroy();
    this.leafer = null;
  }

  listenImageStatus(imageLeaf) {
    if (isNode) {
      return;
    }
    imageLeaf.on(ImageEvent.LOAD, () => {
      this.drawImageStatus(imageLeaf, ImageEvent.LOAD);
    });
    imageLeaf.on(ImageEvent.LOADED, () => {
      this.drawImageStatus(imageLeaf, ImageEvent.LOADED);
    });
    imageLeaf.on(ImageEvent.ERROR, () => {
      this.drawImageStatus(imageLeaf, ImageEvent.ERROR);
    });
  }

  drawImageStatus(imageLeaf, status) {
    const { url, width, height, x, y, zIndex } = imageLeaf;
    if (!this.imageStatusLeaf) {
      this.imageStatusLeaf = new Image();
      this.leafer.add(this.imageStatusLeaf);
    }

    let statusUrl = '';
    if (status === ImageEvent.LOAD) {
      statusUrl = loaderIconUrl;
    } else if (status === ImageEvent.ERROR) {
      statusUrl = imageIconUrl;
    }

    this.imageStatusLeaf.set({
      url: statusUrl,
      width: 120,
      height: 120,
      around: 'center',
      x: x + width / 2,
      y: y + height / 2,
      visible: [ImageEvent.LOAD, ImageEvent.ERROR].includes(status) && url,
      zIndex: zIndex + 1,
    });
  }

  updateScale() {
    const pixelRatio = isBrowser ? devicePixelRatio : 1;
    this.leafer.pixelRatio = pixelRatio;
    this.leafer.width = this.cardWidth * this.data.scale / pixelRatio;
    this.leafer.height = this.cardHeight * this.data.scale / pixelRatio;
    this.leafer.scaleX = this.data.scale / pixelRatio;
    this.leafer.scaleY = this.data.scale / pixelRatio;
  }
}
