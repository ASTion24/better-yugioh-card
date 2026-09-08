import assert from 'node:assert/strict';
import test from 'node:test';
import {
  auditBatchCards,
  getBatchCardQuality,
  validateBatchCard,
} from '../batch-validation.js';

const completeCard = {
  batchId: 'card-1',
  name: '测试卡',
  password: '00000001',
  type: 'monster',
  cardType: 'effect',
  monsterType: '龙族/效果',
  level: 4,
  atk: 1000,
  def: 1000,
  description: '测试效果。',
  image: 'data:image/png;base64,AA==',
};

test('batch validation accepts a production-ready card', () => {
  assert.deepEqual(validateBatchCard(completeCard, [completeCard]), []);
  assert.equal(
    getBatchCardQuality(completeCard, [completeCard]).status,
    'ready',
  );
});

test('batch validation separates blockers from warnings', () => {
  const card = {
    ...completeCard,
    name: '',
    password: '1',
    image: '',
    description: '',
  };
  const quality = getBatchCardQuality(card, [card]);
  assert.equal(quality.status, 'blocked');
  assert.equal(quality.errors, 2);
  assert.equal(quality.warnings, 2);
});

test('batch audit identifies duplicate passwords and link markers', () => {
  const cards = [
    completeCard,
    {
      ...completeCard,
      batchId: 'card-2',
      name: '连接测试卡',
      cardType: 'link',
      password: completeCard.password,
      arrowList: [],
    },
  ];
  const report = auditBatchCards(cards);
  assert.equal(report.ready, 0);
  assert.equal(report.attention, 2);
  assert.equal(report.blocked, 0);
  assert.ok(report.issues >= 3);
});
