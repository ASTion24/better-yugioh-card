import {
  getCustomCard,
  isCustomCardId,
} from '../cards/custom-card.js';
import { renderCustomCardThumbnail } from '../cards/custom-card-render.js';
import {
  fetchCardImageDataUrl,
  fetchPrereleaseImageDataUrl,
  isPrereleaseCardId,
} from './card-source.js';
import { runWithConcurrency } from './concurrency.js';

const loadImage = source => new Promise((resolve, reject) => {
  const image = new Image();
  image.onload = () => resolve(image);
  image.onerror = () => reject(new Error('卡图加载失败'));
  image.crossOrigin = 'anonymous';
  image.src = source;
});

const resolveImage = async (id, customCards) => {
  const customCard = getCustomCard(customCards, id);
  if (customCard) return renderCustomCardThumbnail(customCard);
  if (isPrereleaseCardId(id)) return fetchPrereleaseImageDataUrl(id);
  return fetchCardImageDataUrl(id, 'zh');
};

const groupedCards = deck => {
  const sections = [
    ['main', '主卡组'],
    ['extra', '额外卡组'],
    ['side', '副卡组'],
  ];
  return sections.map(([key, label]) => {
    const grouped = new Map();
    (deck[key] || []).forEach(id => {
      const value = String(id);
      grouped.set(value, (grouped.get(value) || 0) + 1);
    });
    return { key, label, cards: [...grouped] };
  });
};

export const generateDeckOverview = async (deck, options = {}) => {
  const width = 1600;
  const cardWidth = 132;
  const cardHeight = 192;
  const gap = 18;
  const columns = 10;
  const titleHeight = 116;
  const sectionHeaderHeight = 54;
  const sections = groupedCards(deck);
  const imageMap = new Map();
  const imageIds = [...new Set(
    sections.flatMap(section => section.cards.map(([id]) => id)),
  )];
  await runWithConcurrency(
    imageIds.map(id => async () => {
      try {
        imageMap.set(id, await loadImage(await resolveImage(
          id,
          options.customCards || {},
        )));
      } catch {
        imageMap.set(id, null);
      }
    }),
    4,
  );
  const sectionHeights = sections.map(section =>
    sectionHeaderHeight +
    Math.max(1, Math.ceil(section.cards.length / columns)) *
      (cardHeight + 54 + gap));
  const height = titleHeight + sectionHeights.reduce(
    (total, value) => total + value,
    0,
  ) + 40;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  context.fillStyle = '#f3f1ec';
  context.fillRect(0, 0, width, height);
  context.fillStyle = '#1c1d1b';
  context.font = '700 34px "PingFang SC", sans-serif';
  context.fillText(options.name || '未命名卡组', 42, 52);
  const total = sections.reduce((sum, section) =>
    sum + section.cards.reduce((count, [, copies]) => count + copies, 0), 0);
  context.fillStyle = '#74736e';
  context.font = '18px "PingFang SC", sans-serif';
  context.fillText(`${total} 张 · ${new Date().toLocaleDateString('zh-CN')}`, 42, 86);

  let cursorY = titleHeight;
  for (const section of sections) {
    context.fillStyle = '#1c1d1b';
    context.fillRect(0, cursorY, width, 1);
    context.font = '700 22px "PingFang SC", sans-serif';
    context.fillText(
      `${section.label}  ${section.cards.reduce((sum, [, count]) => sum + count, 0)}`,
      42,
      cursorY + 34,
    );
    cursorY += sectionHeaderHeight;
    for (let index = 0; index < section.cards.length; index += 1) {
      const [id, count] = section.cards[index];
      const column = index % columns;
      const row = Math.floor(index / columns);
      const x = 42 + column * (cardWidth + gap);
      const y = cursorY + row * (cardHeight + 54 + gap);
      const image = imageMap.get(id);
      if (image) {
        context.drawImage(image, x, y, cardWidth, cardHeight);
      } else {
        context.fillStyle = '#dedbd3';
        context.fillRect(x, y, cardWidth, cardHeight);
      }
      context.fillStyle = 'rgba(28, 29, 27, 0.88)';
      context.fillRect(x + cardWidth - 32, y + 6, 26, 24);
      context.fillStyle = '#ffffff';
      context.font = '700 15px sans-serif';
      context.textAlign = 'center';
      context.fillText(`×${count}`, x + cardWidth - 19, y + 23);
      context.textAlign = 'left';
      const card = getCustomCard(options.customCards, id);
      context.fillStyle = '#1c1d1b';
      context.font = '700 14px "PingFang SC", sans-serif';
      context.fillText(
        String(card?.name || options.names?.[id] || id).slice(0, 10),
        x,
        y + cardHeight + 22,
      );
      context.fillStyle = '#74736e';
      context.font = '12px monospace';
      context.fillText(
        isCustomCardId(id) ? card?.data?.password || '原创卡' : id,
        x,
        y + cardHeight + 42,
      );
    }
    cursorY += Math.max(1, Math.ceil(section.cards.length / columns)) *
      (cardHeight + 54 + gap);
  }
  return new Promise(resolve =>
    canvas.toBlob(resolve, 'image/png'));
};
