
export enum Gender {
  Male = 'Male',
  Female = 'Female'
}

export type RelationshipType = 'None' | 'Friend' | 'Enemy' | 'Lover' | 'Family' | 'Master' | 'Disciple';

export interface Relationship {
  targetId: string;
  targetName: string;
  affinity: number; // -100 to 100 (Hate <-> Love)
  trust: number;    // 0 to 100
  type: RelationshipType; // The nature of the bond
  knownSecrets: string[]; // List of secrets this NPC knows about the target
}

export interface NPC {
  id: string;
  name: string;
  age: number;
  gender: Gender;
  role: string; // e.g., "Village Chief", "Baker"
  publicPersona: string;
  deepSecret: string; // Known only to God (Player) and self initially
  lifeGoal: string; // What they ultimately want to achieve
  relationships: Relationship[];
  currentMood: string;
  status: 'Normal' | 'Agitated' | 'Depressed' | 'Left Village' | 'Married' | 'Dead' | 'Jailed' | 'Heartbroken' | 'Escaped';
  position: { x: number; y: number }; // For the grid map
}

export interface IntelCard {
  id: string;
  type: 'Observation' | 'Secret' | 'Rumor' | 'Fabrication' | 'Confession';
  content: string;
  sourceId?: string; // Who originated this info?
  timestamp: number; // Day number
}

export interface LogEntry {
  day: number;
  npcId?: string;
  npcName?: string;
  content: string;
  type: 'Thought' | 'Action' | 'System';
}

export interface DailyNews {
  headline: string;
  articles: string[];
}

export type GameMode = 'Sandbox' | 'Chaos' | 'Matchmaker' | 'Detective';

export interface GameObjective {
  mode: GameMode;
  targetIds: string[]; // IDs of NPCs relevant to the goal
  description: string;
  deadlineDay?: number;
}

export interface GameState {
  day: number;
  npcs: NPC[];
  intelInventory: IntelCard[];
  logs: LogEntry[];
  isSimulating: boolean;
  gameMode: GameMode;
  objective: GameObjective | null;
  gameOutcome: { result: 'Victory' | 'Defeat'; reason: string } | null;
  lastNewspaper: DailyNews | null;
  actionPoints: number;
  gridMap: string[][]; // 4x4 Dynamic Location Names
}

export type ActionType = 'WHISPER' | 'BROADCAST' | 'FABRICATE' | 'INCEPTION' | 'INTERROGATE';
