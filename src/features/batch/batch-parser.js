const clone = value => JSON.parse(JSON.stringify(value));

export const BATCH_CARD_DEFAULTS = {
  language: 'sc',
  font: '',
  name: '',
  color: '',
  align: 'left',
  gradient: false,
  gradientColor1: '#999999',
  gradientColor2: '#ffffff',
  type: 'monster',
  attribute: 'light',
  icon: '',
  image: '',
  cardType: 'effect',
  pendulumType: 'effect-pendulum',
  level: 4,
  rank: 0,
  pendulumScale: 0,
  pendulumDescription: '',
  monsterType: '怪兽族/效果',
  atkBar: true,
  atk: 0,
  def: 0,
  arrowList: [],
  description: '',
  firstLineCompress: false,
  descriptionAlign: false,
  descriptionZoom: 1,
  descriptionWeight: 0,
  package: '',
  password: '',
  copyright: '',
  laser: '',
  rare: '',
  twentieth: false,
  radius: true,
  scale: 1,
};

const parseCsvRows = input => {
  const rows = [];
  let row = [];
  let cell = '';
  let quoted = false;

  for (let index = 0; index < input.length; index += 1) {
    const char = input[index];
    if (char === '"') {
      if (quoted && input[index + 1] === '"') {
        cell += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (char === ',' && !quoted) {
      row.push(cell);
      cell = '';
    } else if ((char === '\n' || char === '\r') && !quoted) {
      if (char === '\r' && input[index + 1] === '\n') index += 1;
      row.push(cell);
      if (row.some(value => value.trim())) rows.push(row);
      row = [];
      cell = '';
    } else {
      cell += char;
    }
  }
  row.push(cell);
  if (row.some(value => value.trim())) rows.push(row);
  return rows;
};

const normalizeRecord = (record, index) => {
  if (!record || typeof record !== 'object' || Array.isArray(record)) {
    throw new Error(`第 ${index + 1} 条卡片数据格式无效`);
  }
  const numberFields = [
    'level',
    'rank',
    'pendulumScale',
    'atk',
    'def',
    'descriptionZoom',
    'descriptionWeight',
    'scale',
  ];
  const booleanFields = [
    'firstLineCompress',
    'atkBar',
    'descriptionAlign',
    'gradient',
    'radius',
    'twentieth',
  ];
  const data = {
    ...clone(BATCH_CARD_DEFAULTS),
    ...record,
    name: String(record.name || `未命名卡片 ${index + 1}`),
    password: String(record.password || '').trim(),
  };
  numberFields.forEach(key => {
    if (record[key] !== undefined && record[key] !== '') {
      const value = Number(record[key]);
      if (!Number.isFinite(value)) {
        throw new Error(`第 ${index + 1} 条卡片的 ${key} 不是有效数字`);
      }
      data[key] = value;
    }
  });
  booleanFields.forEach(key => {
    if (typeof record[key] === 'string') {
      data[key] = ['1', 'true', 'yes', '是'].includes(record[key].toLowerCase());
    }
  });
  if (typeof record.arrowList === 'string' && record.arrowList.trim()) {
    try {
      const arrowList = JSON.parse(record.arrowList);
      data.arrowList = Array.isArray(arrowList)
        ? arrowList.map(Number).filter(Number.isFinite)
        : [];
    } catch {
      throw new Error(`第 ${index + 1} 条卡片的 arrowList 不是有效数组`);
    }
  }
  data.pendulumType = `${data.cardType || 'effect'}-pendulum`;
  if (record.firstLineCompress === undefined ||
      record.firstLineCompress === '') {
    data.firstLineCompress = ['fusion', 'synchro', 'xyz', 'link']
      .includes(data.cardType);
  }
  return data;
};

export const parseBatchCards = input => {
  const value = input.trim();
  if (!value) throw new Error('请输入 CSV 或 JSON 卡片数据');

  let records;
  if (value.startsWith('[') || value.startsWith('{')) {
    const parsed = JSON.parse(value);
    records = Array.isArray(parsed) ? parsed : parsed.cards;
  } else {
    const [headers, ...rows] = parseCsvRows(value);
    if (!headers?.length) throw new Error('CSV 缺少表头');
    records = rows.map(row => Object.fromEntries(
      headers.map((header, index) => [header.trim(), row[index]?.trim() || '']),
    ));
  }

  if (!Array.isArray(records) || !records.length) {
    throw new Error('没有找到可导入的卡片记录');
  }
  if (records.length > 200) {
    throw new Error('单次最多生成 200 张原创卡');
  }
  return records.map(normalizeRecord);
};

export const BATCH_CSV_SAMPLE = `name,password,type,cardType,attribute,level,atk,def,monsterType,description
星海记录者,00000001,monster,effect,light,4,1600,1200,魔法师族/效果,这个卡名的效果1回合只能使用1次。①：这张卡召唤成功的场合才能发动。从卡组抽1张。
静默航路,00000002,spell,effect,,,,,,以场上1只怪兽为对象才能发动。那只怪兽回到持有者手卡。`;
