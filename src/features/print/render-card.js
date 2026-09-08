import { YugiohCard } from 'yugioh-card';
import {
  fetchCardImageDataUrl,
} from './card-source';
import { resolveCard } from '@/features/cards/card-service';
import { CARD_RESOURCE_PATH } from '@/config/card-resources';

const blobToDataUrl = blob => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(String(reader.result));
  reader.onerror = () => reject(reader.error || new Error('卡图导出失败'));
  reader.readAsDataURL(blob);
});

const normalizeExportData = async data => {
  if (typeof data === 'string' && data.startsWith('data:')) {
    return data;
  }
  if (data instanceof Blob) {
    return blobToDataUrl(data);
  }
  throw new Error('渲染器返回了无法识别的图片数据');
};

export const renderYugiohCardData = async (rendererData, options = {}) => {
  const format = options.format === 'png' ? 'png' : 'jpg';
  const host = document.createElement('div');
  host.setAttribute('aria-hidden', 'true');
  Object.assign(host.style, {
    position: 'fixed',
    left: '-10000px',
    top: '0',
    width: '1394px',
    height: '2031px',
    pointerEvents: 'none',
  });
  document.body.appendChild(host);

  const card = new YugiohCard({
    view: host,
    data: rendererData,
    resourcePath: CARD_RESOURCE_PATH,
  });

  try {
    const result = await card.export(format, {
      screenshot: true,
      pixelRatio: options.pixelRatio ?? window.devicePixelRatio ?? 1,
      quality: options.quality ?? 0.94,
      fill: '#ffffff',
    });
    return await normalizeExportData(result.data);
  } finally {
    card.destroy();
    host.remove();
  }
};

export const renderHighResolutionCard = async cardId => {
  const resolved = await resolveCard(cardId, { includeArtwork: true });
  if (resolved.renderMode === 'full-card') {
    return {
      id: cardId,
      name: resolved.name,
      dataUrl: await fetchCardImageDataUrl(cardId, 'sc'),
      fullCardFallback: true,
    };
  }
  return {
    id: cardId,
    name: resolved.name,
    dataUrl: await renderYugiohCardData(resolved.rendererData),
  };
};
