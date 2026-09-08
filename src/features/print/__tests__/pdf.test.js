import assert from 'node:assert/strict';
import test from 'node:test';
import {
  CARD_HEIGHT_MM,
  CARD_WIDTH_MM,
  PAGE_HEIGHT_MM,
  PAGE_WIDTH_MM,
  computeBackPositions,
  computeCardPositions,
  generateCalibrationPdf,
  generatePrintablePdfWithOptions,
  getCardsPerPage,
} from '../pdf.js';

test('A4 layout centers a 3 by 3 grid at exact card dimensions', () => {
  const positions = computeCardPositions(9, { gap: 0 });
  assert.equal(positions.length, 9);
  assert.equal(positions[0].x, 16.5);
  assert.equal(positions[0].y, 19.5);
  assert.equal(positions[8].x, 16.5 + CARD_WIDTH_MM * 2);
  assert.equal(positions[8].y, 19.5 + CARD_HEIGHT_MM * 2);
  assert.equal(positions[8].page, 0);
});

test('layout starts a new page after nine cards and applies calibration', () => {
  const positions = computeCardPositions(10, {
    gap: 2,
    offsetX: 1,
    offsetY: -1,
  });
  assert.equal(positions[9].page, 1);
  assert.equal(positions[9].row, 0);
  assert.equal(positions[9].column, 0);
  assert.equal(positions[0].x, (210 - (CARD_WIDTH_MM * 3 + 4)) / 2 + 1);
  assert.equal(positions[0].y, (297 - (CARD_HEIGHT_MM * 3 + 4)) / 2 - 1);
});

test('corner layouts align the 3 by 3 grid to each requested paper edge', () => {
  const gap = 0.1;
  const gridWidth = CARD_WIDTH_MM * 3 + gap * 2;
  const gridHeight = CARD_HEIGHT_MM * 3 + gap * 2;
  const topLeft = computeCardPositions(1, { gap, layout: 'top-left' })[0];
  const topRight = computeCardPositions(1, { gap, layout: 'top-right' })[0];
  const bottomLeft = computeCardPositions(1, { gap, layout: 'bottom-left' })[0];
  const bottomRight = computeCardPositions(1, { gap, layout: 'bottom-right' })[0];
  assert.deepEqual([topLeft.x, topLeft.y], [0, 0]);
  assert.deepEqual([topRight.x, topRight.y], [PAGE_WIDTH_MM - gridWidth, 0]);
  assert.deepEqual([bottomLeft.x, bottomLeft.y], [0, PAGE_HEIGHT_MM - gridHeight]);
  assert.deepEqual(
    [bottomRight.x, bottomRight.y],
    [PAGE_WIDTH_MM - gridWidth, PAGE_HEIGHT_MM - gridHeight],
  );
});

test('dense layout groups shared cut lines against the top-left paper edges', () => {
  const positions = computeCardPositions(12, {
    gap: 0.1,
    layout: 'dense',
  });
  assert.equal(getCardsPerPage('dense'), 11);
  assert.equal(positions[10].page, 0);
  assert.equal(positions[11].page, 1);
  assert.equal(positions.slice(0, 11).filter(item => item.rotation === 90).length, 5);
  assert.deepEqual([positions[0].x, positions[0].y], [0, 0]);
  assert.deepEqual([positions[1].x, positions[1].y], [59.1, 0]);
  assert.deepEqual([positions[2].x, positions[2].y], [0, 86.1]);
  assert.deepEqual([positions[6].x, positions[6].y], [118.2, 0]);
  positions.slice(0, 11).forEach(position => {
    assert.ok(position.x >= 0);
    assert.ok(position.y >= 0);
    assert.ok(position.x + position.width <= PAGE_WIDTH_MM);
    assert.ok(position.y + position.height <= PAGE_HEIGHT_MM);
  });
});

test('cut-efficient layout creates a shared-line 2 by 5 landscape grid', () => {
  const positions = computeCardPositions(11, {
    gap: 0.1,
    layout: 'cut-efficient',
  });
  assert.equal(getCardsPerPage('cut-efficient'), 10);
  assert.equal(positions[9].page, 0);
  assert.equal(positions[10].page, 1);
  assert.equal(positions.slice(0, 10).every(item => item.rotation === 90), true);
  assert.deepEqual([positions[0].x, positions[0].y], [0, 0]);
  assert.deepEqual([positions[1].x, positions[1].y], [86.1, 0]);
  assert.deepEqual([positions[2].x, positions[2].y], [0, 59.1]);
  positions.slice(0, 10).forEach(position => {
    assert.ok(position.x >= 0);
    assert.ok(position.y >= 0);
    assert.ok(position.x + position.width <= PAGE_WIDTH_MM);
    assert.ok(position.y + position.height <= PAGE_HEIGHT_MM);
  });
});

test('duplex back positions mirror across the selected paper edge', () => {
  const front = computeCardPositions(1, {
    gap: 0.1,
    layout: 'top-left',
  })[0];
  const longEdge = computeBackPositions(1, {
    gap: 0.1,
    layout: 'top-left',
    duplexFlip: 'long-edge',
  })[0];
  const shortEdge = computeBackPositions(1, {
    gap: 0.1,
    layout: 'top-left',
    duplexFlip: 'short-edge',
  })[0];
  assert.equal(longEdge.x, PAGE_WIDTH_MM - front.x - front.width);
  assert.equal(longEdge.y, front.y);
  assert.equal(shortEdge.x, front.x);
  assert.equal(shortEdge.y, PAGE_HEIGHT_MM - front.y - front.height);
});

test('PDF generation keeps unresolved cards as printable placeholders', async () => {
  const cards = Array.from({ length: 10 }, (_, index) => ({
    id: String(index + 1),
    dataUrl: null,
  }));
  const blob = await generatePrintablePdfWithOptions(cards, {
    gap: 2,
    cropMarks: true,
  });
  assert.ok(blob instanceof Blob);
  assert.equal(blob.type, 'application/pdf');
  assert.ok(blob.size > 1000);
});

test('calibration PDF contains an A4 measurement page', async () => {
  const blob = await generateCalibrationPdf({
    offsetX: 1,
    offsetY: -0.5,
  });
  assert.ok(blob instanceof Blob);
  assert.equal(blob.type, 'application/pdf');
  assert.ok(blob.size > 1000);
});
