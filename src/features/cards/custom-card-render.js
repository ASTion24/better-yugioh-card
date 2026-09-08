const renderPromiseMap = new Map();

const renderKey = (card, options) => [
  card.id,
  card.updatedAt,
  options.format || 'jpg',
  options.pixelRatio || 'full',
].join(':');

export const renderCustomCard = async (card, options = {}) => {
  if (!card?.data) {
    throw new Error('原创卡缺少渲染数据');
  }
  if ((card.cardKind || 'yugioh') !== 'yugioh') {
    throw new Error('卡组暂仅支持游戏王标准卡模板');
  }
  const key = renderKey(card, options);
  if (renderPromiseMap.has(key)) {
    return renderPromiseMap.get(key);
  }
  const promise = import('../print/render-card.js')
    .then(({ renderYugiohCardData }) =>
      renderYugiohCardData(card.data, options))
    .catch(error => {
      renderPromiseMap.delete(key);
      throw error;
    });
  renderPromiseMap.set(key, promise);
  return promise;
};

export const renderCustomCardThumbnail = card => renderCustomCard(card, {
  format: 'jpg',
  pixelRatio: 0.25,
  quality: 0.82,
});
