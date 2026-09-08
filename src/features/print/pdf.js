export const CARD_WIDTH_MM = 59;
export const CARD_HEIGHT_MM = 86;
export const PAGE_WIDTH_MM = 210;
export const PAGE_HEIGHT_MM = 297;
export const CARDS_PER_ROW = 3;
export const CARDS_PER_COLUMN = 3;
export const CARDS_PER_PAGE = CARDS_PER_ROW * CARDS_PER_COLUMN;
export const CUT_EFFICIENT_CARDS_PER_PAGE = 10;
export const DENSE_CARDS_PER_PAGE = 11;
export const DEFAULT_GAP_MM = 0.1;
export const COMPACT_MAX_GAP_MM = 0.5;
export const MAX_GAP_MM = 10;

export const getCardsPerPage = layout => {
  if (layout === 'cut-efficient') return CUT_EFFICIENT_CARDS_PER_PAGE;
  return layout === 'dense' ? DENSE_CARDS_PER_PAGE : CARDS_PER_PAGE;
};

const normalizeGap = (value, layout) => {
  const fallback = value === undefined ? DEFAULT_GAP_MM : Number(value);
  const maximum = ['cut-efficient', 'dense'].includes(layout)
    ? COMPACT_MAX_GAP_MM
    : MAX_GAP_MM;
  return Math.min(maximum, Math.max(0, Number.isFinite(fallback) ? fallback : 0));
};

const getStandardGridOrigin = (layout, gridWidth, gridHeight) => {
  const right = PAGE_WIDTH_MM - gridWidth;
  const bottom = PAGE_HEIGHT_MM - gridHeight;
  const origins = {
    'top-left': [0, 0],
    'top-right': [right, 0],
    'bottom-left': [0, bottom],
    'bottom-right': [right, bottom],
  };
  return origins[layout] || [right / 2, bottom / 2];
};

const createStandardSlots = (layout, gap, offsetX, offsetY) => {
  const gridWidth = CARD_WIDTH_MM * CARDS_PER_ROW +
    gap * (CARDS_PER_ROW - 1);
  const gridHeight = CARD_HEIGHT_MM * CARDS_PER_COLUMN +
    gap * (CARDS_PER_COLUMN - 1);
  const [originX, originY] = getStandardGridOrigin(
    layout,
    gridWidth,
    gridHeight,
  );
  return Array.from({ length: CARDS_PER_PAGE }, (_, slot) => {
    const row = Math.floor(slot / CARDS_PER_ROW);
    const column = slot % CARDS_PER_ROW;
    return {
      row,
      column,
      x: originX + offsetX + column * (CARD_WIDTH_MM + gap),
      y: originY + offsetY + row * (CARD_HEIGHT_MM + gap),
      width: CARD_WIDTH_MM,
      height: CARD_HEIGHT_MM,
      rotation: 0,
    };
  });
};

const createDenseSlots = (gap, offsetX, offsetY) => {
  const originX = offsetX;
  const originY = offsetY;
  const landscapeX = originX + CARD_WIDTH_MM * 2 + gap * 2;
  // Group equal orientations so adjacent cards share long, straight cut lines.
  return [
    ...Array.from({ length: 6 }, (_, slot) => ({
      row: Math.floor(slot / 2),
      column: slot % 2,
      x: originX + (slot % 2) * (CARD_WIDTH_MM + gap),
      y: originY + Math.floor(slot / 2) * (CARD_HEIGHT_MM + gap),
      width: CARD_WIDTH_MM,
      height: CARD_HEIGHT_MM,
      rotation: 0,
    })),
    ...Array.from({ length: 5 }, (_, row) => ({
      row,
      column: 2,
      x: landscapeX,
      y: originY + row * (CARD_WIDTH_MM + gap),
      width: CARD_HEIGHT_MM,
      height: CARD_WIDTH_MM,
      rotation: 90,
    })),
  ];
};

const createCutEfficientSlots = (gap, offsetX, offsetY) => {
  return Array.from({ length: CUT_EFFICIENT_CARDS_PER_PAGE }, (_, slot) => {
    const row = Math.floor(slot / 2);
    const column = slot % 2;
    return {
      row,
      column,
      x: offsetX + column * (CARD_HEIGHT_MM + gap),
      y: offsetY + row * (CARD_WIDTH_MM + gap),
      width: CARD_HEIGHT_MM,
      height: CARD_WIDTH_MM,
      rotation: 90,
    };
  });
};

export const computeCardPositions = (count, options = {}) => {
  const layout = options.layout || 'center';
  const gap = normalizeGap(options.gap, layout);
  const offsetX = Number(options.offsetX) || 0;
  const offsetY = Number(options.offsetY) || 0;
  const slots = layout === 'dense'
    ? createDenseSlots(gap, offsetX, offsetY)
    : layout === 'cut-efficient'
      ? createCutEfficientSlots(gap, offsetX, offsetY)
      : createStandardSlots(layout, gap, offsetX, offsetY);
  const cardsPerPage = slots.length;

  return Array.from({ length: count }, (_, index) => {
    const page = Math.floor(index / cardsPerPage);
    const slot = index % cardsPerPage;
    return {
      page,
      slot,
      ...slots[slot],
    };
  });
};

export const computeBackPositions = (count, options = {}) => {
  const flip = options.duplexFlip === 'short-edge'
    ? 'short-edge'
    : 'long-edge';
  return computeCardPositions(count, options).map(position => ({
    ...position,
    x: flip === 'long-edge'
      ? PAGE_WIDTH_MM - position.x - position.width
      : position.x,
    y: flip === 'short-edge'
      ? PAGE_HEIGHT_MM - position.y - position.height
      : position.y,
  }));
};

const drawCropMarks = (pdf, x, y, width, height, gap) => {
  const markLength = Math.min(2.5, Math.max(0.8, gap / 2));
  const inset = gap > 0 ? Math.min(0.35, gap / 4) : 0.25;
  const left = x;
  const right = x + width;
  const top = y;
  const bottom = y + height;

  pdf.setDrawColor(70, 70, 70);
  pdf.setLineWidth(0.12);
  [
    [left - inset - markLength, top, left - inset, top],
    [left, top - inset - markLength, left, top - inset],
    [right + inset, top, right + inset + markLength, top],
    [right, top - inset - markLength, right, top - inset],
    [left - inset - markLength, bottom, left - inset, bottom],
    [left, bottom + inset, left, bottom + inset + markLength],
    [right + inset, bottom, right + inset + markLength, bottom],
    [right, bottom + inset, right, bottom + inset + markLength],
  ].forEach(([x1, y1, x2, y2]) => pdf.line(x1, y1, x2, y2));
};

const drawMissingCard = (pdf, card, position) => {
  pdf.setFillColor(248, 247, 244);
  pdf.setDrawColor(180, 178, 172);
  pdf.rect(position.x, position.y, position.width, position.height, 'FD');
  pdf.setTextColor(95, 92, 86);
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(9);
  pdf.text(card.id, position.x + position.width / 2, position.y + position.height / 2, {
    align: 'center',
  });
};

export const generatePrintablePdf = async cards => {
  return generatePrintablePdfWithOptions(cards, {});
};

export const generateCalibrationPdf = async (options = {}) => {
  const { jsPDF } = await import('jspdf');
  const pdf = new jsPDF({
    unit: 'mm',
    format: 'a4',
    orientation: 'portrait',
    compress: true,
  });
  const offsetX = Number(options.offsetX) || 0;
  const offsetY = Number(options.offsetY) || 0;
  const frameX = (PAGE_WIDTH_MM - CARD_WIDTH_MM) / 2 + offsetX;
  const frameY = (PAGE_HEIGHT_MM - CARD_HEIGHT_MM) / 2 + offsetY;

  pdf.setDrawColor(30, 30, 30);
  pdf.setLineWidth(0.15);
  pdf.rect(5, 5, PAGE_WIDTH_MM - 10, PAGE_HEIGHT_MM - 10);
  pdf.setLineWidth(0.25);
  pdf.rect(frameX, frameY, CARD_WIDTH_MM, CARD_HEIGHT_MM);
  pdf.line(frameX - 8, frameY, frameX + CARD_WIDTH_MM + 8, frameY);
  pdf.line(
    frameX - 8,
    frameY + CARD_HEIGHT_MM,
    frameX + CARD_WIDTH_MM + 8,
    frameY + CARD_HEIGHT_MM,
  );
  pdf.line(frameX, frameY - 8, frameX, frameY + CARD_HEIGHT_MM + 8);
  pdf.line(
    frameX + CARD_WIDTH_MM,
    frameY - 8,
    frameX + CARD_WIDTH_MM,
    frameY + CARD_HEIGHT_MM + 8,
  );

  const centerX = PAGE_WIDTH_MM / 2 + offsetX;
  const centerY = PAGE_HEIGHT_MM / 2 + offsetY;
  pdf.setLineWidth(0.1);
  pdf.line(centerX - 12, centerY, centerX + 12, centerY);
  pdf.line(centerX, centerY - 12, centerX, centerY + 12);

  for (let x = 10; x <= PAGE_WIDTH_MM - 10; x += 1) {
    const major = x % 10 === 0;
    pdf.line(x, 10, x, major ? 16 : 13);
    pdf.line(x, PAGE_HEIGHT_MM - 10, x, major ? PAGE_HEIGHT_MM - 16 : PAGE_HEIGHT_MM - 13);
    if (major) {
      pdf.setFontSize(6);
      pdf.text(String(x), x, 19, { align: 'center' });
    }
  }
  for (let y = 10; y <= PAGE_HEIGHT_MM - 10; y += 1) {
    const major = y % 10 === 0;
    pdf.line(10, y, major ? 16 : 13, y);
    pdf.line(PAGE_WIDTH_MM - 10, y, major ? PAGE_WIDTH_MM - 16 : PAGE_WIDTH_MM - 13, y);
    if (major) {
      pdf.setFontSize(6);
      pdf.text(String(y), 19, y + 1.8);
    }
  }

  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(8);
  pdf.text('A4 CALIBRATION / 59 x 86 mm', PAGE_WIDTH_MM / 2, 27, {
    align: 'center',
  });
  pdf.text(
    `OFFSET X ${offsetX.toFixed(1)} mm / Y ${offsetY.toFixed(1)} mm`,
    PAGE_WIDTH_MM / 2,
    PAGE_HEIGHT_MM - 24,
    { align: 'center' },
  );
  return pdf.output('blob');
};

export const generatePrintablePdfWithOptions = async (cards, options = {}) => {
  const { jsPDF } = await import('jspdf');
  const layout = options.layout || 'center';
  const gap = normalizeGap(options.gap, layout);
  const positions = computeCardPositions(cards.length, {
    gap,
    layout,
    offsetX: options.offsetX,
    offsetY: options.offsetY,
  });
  const pdf = new jsPDF({
    unit: 'mm',
    format: 'a4',
    orientation: 'portrait',
    compress: true,
  });
  const cardsPerPage = getCardsPerPage(layout);
  const backImage = options.backImage || '';
  const backImageFormat = backImage.startsWith('data:image/png')
    ? 'PNG'
    : 'JPEG';
  const flip = options.duplexFlip === 'short-edge' ? 'short-edge' : 'long-edge';

  let currentPage = 0;
  cards.forEach((card, index) => {
    const position = positions[index];
    if (position.page > currentPage) {
      pdf.addPage('a4', 'portrait');
      currentPage = position.page;
    }

    if (card.dataUrl) {
      if (position.rotation === 90) {
        pdf.addImage(
          card.dataUrl,
          'JPEG',
          position.x + position.width,
          position.y + position.height - CARD_HEIGHT_MM,
          CARD_WIDTH_MM,
          CARD_HEIGHT_MM,
          `card-${card.id}`,
          'MEDIUM',
          90,
        );
      } else {
        pdf.addImage(
          card.dataUrl,
          'JPEG',
          position.x,
          position.y,
          CARD_WIDTH_MM,
          CARD_HEIGHT_MM,
          `card-${card.id}`,
          'MEDIUM',
        );
      }
    } else {
      drawMissingCard(pdf, card, position);
    }

    if (options.cropMarks) {
      drawCropMarks(
        pdf,
        position.x,
        position.y,
        position.width,
        position.height,
        gap,
      );
    }
  });

  if (backImage) {
    const frontPageCount = Math.ceil(cards.length / cardsPerPage);
    for (let page = frontPageCount - 1; page >= 0; page -= 1) {
      const count = Math.min(
        cardsPerPage,
        cards.length - page * cardsPerPage,
      );
      const mirrored = computeBackPositions(count, {
        gap,
        layout,
        offsetX: options.offsetX,
        offsetY: options.offsetY,
        duplexFlip: flip,
      }).map(position => ({ ...position, page: 0 }));
      const insertAfter = page + 2;
      pdf.insertPage(insertAfter);
      pdf.setPage(insertAfter);
      mirrored.forEach(position => {
        if (position.rotation === 90) {
          pdf.addImage(
            backImage,
            backImageFormat,
            position.x + position.width,
            position.y + position.height - CARD_HEIGHT_MM,
            CARD_WIDTH_MM,
            CARD_HEIGHT_MM,
            'card-back',
            'MEDIUM',
            90,
          );
        } else {
          pdf.addImage(
            backImage,
            backImageFormat,
            position.x,
            position.y,
            CARD_WIDTH_MM,
            CARD_HEIGHT_MM,
            'card-back',
            'MEDIUM',
          );
        }
        if (options.cropMarks) {
          drawCropMarks(
            pdf,
            position.x,
            position.y,
            position.width,
            position.height,
            gap,
          );
        }
      });
    }
  }

  return pdf.output('blob');
};

export const downloadBlob = (blob, filename) => {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};
