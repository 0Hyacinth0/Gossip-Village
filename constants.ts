
import { NPC } from "./types";

export const GRID_SIZE = 4; // 4x4 Grid
export const MAX_AP_PER_DAY = 3;

export const INITIAL_LOG_ENTRY = {
  day: 0,
  timePhase: 'Morning' as const,
  content: "欢迎来到稻香村。江湖风云暗涌，你是掌握天机的观察者。",
  type: 'System' as const
};

export const STATUS_MAP: Record<string, string> = {
  'Normal': '正常',
  'Agitated': '杀气',
  'Depressed': '抑郁',
  'Left Village': '闯荡江湖',
  'Married': '神仙眷侣',
  'Dead': '死亡',
  'Jailed': '囚禁',
  'Heartbroken': '断肠',
  'Escaped': '亡命',
  'QiDeviated': '走火入魔',
  'Injured': '重伤'
};

export const TIME_PHASE_MAP: Record<string, string> = {
  'Morning': '辰时 (清晨)',
  'Afternoon': '未时 (午后)',
  'Evening': '酉时 (黄昏)',
  'Night': '子时 (深夜)'
};

// 4x4 Grid Location Names [y][x] - Village Scale with Jianghu flavor
export const LOCATION_MAP = [
  ['稻香村口', '镜湖畔', '大侠墓', '芦苇荡'],       // y=0
  ['破旧道观', '演武场', '村长家', '百草园'], // y=1
  ['打铁铺', '稻香酒肆', '水榭戏台', '幽暗竹林'], // y=2
  ['猎户小屋', '荒废祭坛', '西域营帐', '后山密洞'] // y=3
];

// Placeholder data for initial render
export const PLACEHOLDER_NPCS: NPC[] = [
  {
    id: '1',
    name: '李复',
    age: 28,
    gender: 'Male' as any,
    role: '鬼谋',
    publicPersona: '游历江湖的书生，运筹帷幄。',
    deepSecret: '正在策划一场颠覆武林的惊天阴谋。',
    lifeGoal: '寻找《九天兵鉴》。',
    relationships: [],
    currentMood: '深沉',
    status: 'Normal',
    hp: 90,
    mp: 95,
    san: 10,
    position: { x: 0, y: 0 }
  },
  {
    id: '2',
    name: '秋叶青',
    age: 24,
    gender: 'Female' as any,
    role: '侠女',
    publicPersona: '温柔体贴，紧随李复左右。',
    deepSecret: '其实对李复的计划有所察觉，内心挣扎。',
    lifeGoal: '与李复归隐山林。',
    relationships: [],
    currentMood: '忧虑',
    status: 'Normal',
    hp: 80,
    mp: 60,
    san: 20,
    position: { x: 0, y: 0 }
  }
];
