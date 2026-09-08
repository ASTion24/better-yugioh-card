import {
  adaptYgocdbCard,
  isExtraDeckCardType,
} from '../print/card-adapter.js';
import {
  extractPrereleaseArtworkDataUrl,
  fetchCardData,
  fetchImageDataUrl,
  fetchPrereleaseCardData,
  getArtworkImageUrl,
  getCardArtworkId,
  getCardDisplayName,
  isAlternateArtworkCard,
  isPrereleaseCardId,
  searchCardDatabase,
} from '../print/card-source.js';

const normalizeId = value => String(value ?? '').replace(/^0+/, '') || '0';

const findExactResult = (results, requestedId) => {
  return results.find(result => {
    return getCardArtworkId(result) === requestedId ||
      normalizeId(result.id) === requestedId;
  });
};

const fetchMetadata = async requestedId => {
  if (isPrereleaseCardId(requestedId)) {
    return fetchPrereleaseCardData(requestedId);
  }
  try {
    return await fetchCardData(requestedId);
  } catch (error) {
    const results = await searchCardDatabase(requestedId);
    const result = findExactResult(results, requestedId);
    if (!result) {
      throw error;
    }
    return result;
  }
};

export const resolveCard = async (reference, options = {}) => {
  const requestedId = normalizeId(
    typeof reference === 'object'
      ? reference.artworkId || reference.id
      : reference,
  );
  const metadata = typeof reference === 'object' && reference.metadata
    ? reference.metadata
    : await fetchMetadata(requestedId);
  const prerelease = Boolean(metadata.prerelease) || isPrereleaseCardId(requestedId);
  const alternateArtwork = !prerelease &&
    isAlternateArtworkCard(metadata, requestedId);
  const baseId = normalizeId(metadata.id);
  const artworkId = requestedId;
  let artwork = '';

  if (options.includeArtwork) {
    artwork = prerelease
      ? await extractPrereleaseArtworkDataUrl(artworkId)
      : await fetchImageDataUrl(
        getArtworkImageUrl(alternateArtwork ? baseId : artworkId),
      );
  }

  const rendererData = adaptYgocdbCard(metadata, artwork);
  return {
    id: requestedId,
    baseId,
    artworkId,
    name: getCardDisplayName(metadata) || rendererData.name || requestedId,
    metadata,
    rendererData,
    prerelease,
    alternateArtwork,
    renderMode: alternateArtwork ? 'full-card' : 'redraw',
    source: prerelease ? 'prerelease' : 'ygocdb',
    defaultSection: isExtraDeckCardType(rendererData.cardType) ? 'extra' : 'main',
  };
};

export const resolveSearchResult = (result, options = {}) => {
  return resolveCard({
    id: getCardArtworkId(result),
    artworkId: getCardArtworkId(result),
    metadata: result,
  }, options);
};
