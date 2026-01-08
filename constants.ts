import { NPC } from "./types";

export const GRID_SIZE = 4; // 4x4 Grid
export const MAX_AP_PER_DAY = 3;

export const INITIAL_LOG_ENTRY = {
  day: 0,
  content: "欢迎来到八卦村。村民们正在过着他们的日常生活。你是观察者。",
  type: 'System' as const
};

export const STATUS_MAP: Record<string, string> = {
  'Normal': '正常',
  'Agitated': '焦躁',
  'Depressed': '消沉',
  'Left Village': '已搬离',
  'Married': '新婚',
  'Dead': '死亡',
  'Jailed': '入狱',
  'Heartbroken': '心碎',
  'Escaped': '潜逃'
};

// 4x4 Grid Location Names [y][x]
export const LOCATION_MAP = [
  ['后山荒地', '密林深处', '自家农田', '臭水沟'],   // y=0
  ['破庙', '村长家', '中央广场', '老中医馆'],     // y=1
  ['铁匠铺', '杂货铺', '王大妈家', '李二狗家'],   // y=2
  ['乱葬岗', '小黑屋', '村口大门', '村外驿站']    // y=3
];

// Placeholder data for initial render before AI takes over or if AI fails
export const PLACEHOLDER_NPCS: NPC[] = [
  {
    id: '1',
    name: '王村长',
    age: 60,
    gender: 'Male' as any,
    role: '村长',
    publicPersona: '德高望重的长辈，公正公平。',
    deepSecret: '挪用了修桥款去还赌债。',
    lifeGoal: '保住村长的位置，并在死前还清债务。',
    relationships: [],
    currentMood: '平静',
    status: 'Normal',
    position: { x: 1, y: 1 }
  },
  {
    id: '2',
    name: '刘大妈',
    age: 55,
    gender: 'Female' as any,
    role: '杂货铺老板',
    publicPersona: '热心肠，喜欢八卦，认识所有人。',
    deepSecret: '其实是铁匠的亲生母亲，但从未告诉他。',
    lifeGoal: '让铁匠认祖归宗，或者给他找个好媳妇。',
    relationships: [],
    currentMood: '好奇',
    status: 'Normal',
    position: { x: 2, y: 2 }
  }
];