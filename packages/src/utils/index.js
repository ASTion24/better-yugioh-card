import { isPlainObject } from 'lodash-unified';

const browserFontPromiseMap = new Map();
const fontManifestPromiseMap = new Map();
const nodeFontKeySet = new Set();
let nodeFs = null;
// 是否是浏览器
export const isBrowser = typeof window !== 'undefined' && typeof window.document !== 'undefined';
// 是否是node环境
export const isNode = typeof process !== 'undefined' && process.versions != null && process.versions.node != null;

const getNodeFs = () => {
  if (!isNode) {
    throw new Error('fs is not available in browser builds');
  }
  if (!nodeFs) {
    nodeFs = process.getBuiltinModule?.('node:fs') ?? process.getBuiltinModule?.('fs');
  }
  if (!nodeFs) {
    throw new Error('fs is not available in the current Node.js runtime');
  }
  return nodeFs;
};

const loadFontManifest = fontPath => {
  if (fontManifestPromiseMap.has(fontPath)) {
    return fontManifestPromiseMap.get(fontPath);
  }

  const promise = fetch(`${fontPath}/font-list.json`).then(res => {
    if (!res.ok) {
      throw new Error(`读取字体清单失败: ${res.status}`);
    }
    return res.json();
  }).catch(error => {
    fontManifestPromiseMap.delete(fontPath);
    throw error;
  });
  fontManifestPromiseMap.set(fontPath, promise);
  return promise;
};

const selectFontFamilies = (manifest, familyList) => {
  if (!familyList?.length) {
    return manifest;
  }
  const requestedSet = new Set(familyList);
  return manifest.filter(family => requestedSet.has(family));
};

// 加载字体 - 浏览器环境，异步；失败的请求不会污染缓存，可再次尝试。
export const loadFontBrowser = async (fontPath, familyList = []) => {
  const manifest = await loadFontManifest(fontPath);
  const selectedFamilies = selectFontFamilies(manifest, familyList);
  await Promise.all(selectedFamilies.map(family => {
    const fontUrl = `${fontPath}/${family}.woff2`;
    if (browserFontPromiseMap.has(fontUrl)) {
      return browserFontPromiseMap.get(fontUrl);
    }

    const font = new FontFace(family, `url(${fontUrl}) format('woff2')`, {
      display: 'swap',
    });
    document.fonts.add(font);
    const promise = font.load().catch(error => {
      browserFontPromiseMap.delete(fontUrl);
      document.fonts.delete(font);
      throw error;
    });
    browserFontPromiseMap.set(fontUrl, promise);
    return promise;
  }));
};

// 加载字体 - Nodejs 环境，同步
export const loadFontNode = (fontPath, skia, familyList = []) => {
  const manifest = JSON.parse(getNodeFs().readFileSync(`${fontPath}/font-list.json`, 'utf-8'));
  const selectedFamilies = selectFontFamilies(manifest, familyList);
  if (skia) {
    selectedFamilies.forEach(family => {
      const fontKey = `${fontPath}/${family}`;
      if (nodeFontKeySet.has(fontKey)) {
        return;
      }
      skia.FontLibrary.use(family, [
        `${fontPath}/${family}.woff2`,
      ]);
      nodeFontKeySet.add(fontKey);
    });
  }
};

// 数字转全角
export const numberToFull = value => {
  return value.replace(/\d/g, d => String.fromCharCode(d.charCodeAt(0) + 0xFEE0));
};

// 继承css样式
export const inheritProp = (obj, parentObj = {}) => {
  const inheritPropList = ['fontFamily', 'fontSize', 'fontStyle', 'fontWeight', 'lineHeight', 'letterSpacing', 'wordSpacing'];
  inheritPropList.forEach(inherit => {
    if (!Object.hasOwn(obj, inherit) && Object.hasOwn(parentObj, inherit)) {
      obj[inherit] = parentObj[inherit];
    }
  });
  Object.keys(obj).forEach(key => {
    if (isPlainObject(obj[key])) {
      inheritProp(obj[key], obj);
    }
  });
  return obj;
};
