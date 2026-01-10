
import { GoogleGenAI, Type } from "@google/genai";
import { NPC, GameState, DailyNews, LogEntry, IntelCard } from "../types";

// Initialize Gemini Client
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
const SIMULATION_MODEL = 'gemini-3-flash-preview';

// --- Helper Functions ---

async function runWithRetry<T>(fn: () => Promise<T>, retries = 3, delay = 1000): Promise<T> {
  let lastError;
  for (let i = 0; i < retries; i++) {
    try {
      return await fn();
    } catch (error) {
      console.warn(`Attempt ${i + 1} failed:`, error);
      lastError = error;
      if (i < retries - 1) {
        await new Promise(resolve => setTimeout(resolve, delay * Math.pow(2, i)));
      }
    }
  }
  throw lastError;
}

// --- Helper Types for AI Responses ---

interface SimulationResponse {
  logs: { npcName: string; thought: string; action: string }[];
  relationshipUpdates: { sourceName: string; targetName: string; affinityChange: number; trustChange: number; newType?: string }[];
  statUpdates: { npcName: string; hpChange: number; mpChange: number; sanChange: number }[];
  newIntel: { content: string; type: string; sourceName: string }[];
  newspaper: { headline: string; articles: string[] };
  npcStatusUpdates: { npcName: string; status: string; mood: string; newPosition?: {x: number, y: number} }[];
  gameOutcome?: { result: 'Victory' | 'Defeat'; reason: string };
}

interface InitializationResponse {
  npcs: any[];
}

interface InteractionResponse {
  reply: string;
  revealedInfo: string | null; // If they reveal a secret, put it here
  moodChange: string;
}

// --- API Functions ---

export const generateVillage = async (villagerCount: number): Promise<NPC[]> => {
  const prompt = `
    Generate ${villagerCount} unique, complex characters for a high-stakes Wuxia drama game.
    The setting is "Rice Fragrance Village" (稻香村).
    
    Current Task: Create initial NPC data, including their social web, location, and RPG Stats.
    
    **CRITICAL DESIGN INSTRUCTIONS:**
    1. **Conflict & Connection**: Ensure some NPCs are *already* connected. 
    2. **RPG Stats**:
       - **HP (Health)**: 80-100 for warriors, 50-70 for civilians.
       - **MP (Martial Power)**: 70-100 for Guards/Assassins/Sect Members. 0-20 for ordinary villagers.
       - **SAN (Corruption/入魔值)**: 0-20 initially. Higher for villains or tragic characters.
    3. **Spawn Zone**: Assign a 'spawnZone' based on their role.
    4. **Roles**: Use JX3 sects or classic Wuxia roles.
    
    Language Requirement: 
    - 'gender': 'Male' or 'Female'.
    - 'spawnZone': One of ['Market', 'Official', 'Temple', 'Secluded'].
    - 'initialConnectionType': One of ['Lover', 'Enemy', 'Master', 'Disciple', 'Family'] or null.
    - All other text fields MUST BE IN SIMPLIFIED CHINESE.
    
    Output strictly valid JSON matching the schema.
  `;

  return runWithRetry(async () => {
    const response = await ai.models.generateContent({
      model: SIMULATION_MODEL,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            npcs: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  name: { type: Type.STRING },
                  age: { type: Type.INTEGER },
                  gender: { type: Type.STRING, enum: ['Male', 'Female'] },
                  role: { type: Type.STRING },
                  publicPersona: { type: Type.STRING },
                  deepSecret: { type: Type.STRING },
                  lifeGoal: { type: Type.STRING },
                  currentMood: { type: Type.STRING },
                  hp: { type: Type.INTEGER },
                  mp: { type: Type.INTEGER },
                  san: { type: Type.INTEGER },
                  spawnZone: { type: Type.STRING, enum: ['Market', 'Official', 'Temple', 'Secluded'] },
                  initialConnectionName: { type: Type.STRING, nullable: true },
                  initialConnectionType: { type: Type.STRING, enum: ['Lover', 'Enemy', 'Master', 'Disciple', 'Family'], nullable: true }
                },
                required: ['name', 'age', 'gender', 'role', 'publicPersona', 'deepSecret', 'lifeGoal', 'currentMood', 'spawnZone', 'hp', 'mp', 'san']
              }
            }
          }
        }
      }
    });

    const data = JSON.parse(response.text || "{}") as InitializationResponse;
    
    // Post-process
    return data.npcs.map((npc, index) => ({
      ...npc,
      id: `npc-${Date.now()}-${index}`,
      status: 'Normal',
      position: { x: 0, y: 0 }, 
      relationships: [] 
    }));
  });
};

export const interactWithNPC = async (npc: NPC, question: string): Promise<InteractionResponse> => {
    // Construct relationship context string
    const relationshipsCtx = npc.relationships.map(r => 
        `- ${r.targetName}: [${r.type}] (Affinity: ${r.affinity})`
    ).join('\n');

    const prompt = `
      Roleplay Simulation (High Drama Wuxia).
      
      You are: ${npc.name} (${npc.role}).
      Secret: ${npc.deepSecret}.
      Current State: ${npc.status}.
      Stats: HP ${npc.hp}, Martial ${npc.mp}, Corruption ${npc.san}.
      Social Circle:
      ${relationshipsCtx || "None."}

      The Player (a mysterious inner voice or stranger) asks: "${question}"
      
      **Directives:**
      1. **Tone**: Driven by relationships and current corruption (SAN). 
         - If SAN > 60: Unstable, murmuring, violent thoughts.
         - If SAN > 90 (QiDeviated): Completely insane.
      2. **Brevity**: Under 40 words.
      3. **Language**: Simplified Chinese, Wuxia style.
      
      Output JSON.
    `;
  
    return runWithRetry(async () => {
      const response = await ai.models.generateContent({
        model: SIMULATION_MODEL,
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              reply: { type: Type.STRING },
              revealedInfo: { type: Type.STRING, nullable: true },
              moodChange: { type: Type.STRING }
            },
            required: ['reply', 'moodChange']
          }
        }
      });
  
      return JSON.parse(response.text || "{}") as InteractionResponse;
    });
  };

export const simulateDay = async (
  currentState: GameState,
  playerActions: { type: string; targetId?: string; content: string }[]
): Promise<SimulationResponse> => {
  
  // Prepare context
  const npcSummaries = currentState.npcs.map(n => 
    `[${n.name}|${n.role}] Status:${n.status} HP:${n.hp} MP(Martial):${n.mp} SAN(Corruption):${n.san} Loc:(${n.position.x},${n.position.y})`
  ).join('\n');

  const relationshipSummaries = currentState.npcs.map(n => {
    const rels = n.relationships.map(r => `${r.targetName}[${r.type}:${r.affinity}]`).join(', ');
    return `${n.name} Rels: {${rels}}`;
  }).join('\n');

  let playerIntervention = "No Player Intervention.";
  if (playerActions.length > 0) {
    playerIntervention = "PLAYER ACTIONS:\n" + 
      playerActions.map(a => 
        `- TYPE: ${a.type} TARGET: ${a.targetId || 'Global'} CONTENT: "${a.content}"`
      ).join('\n');
  }

  const prompt = `
    Director Mode: Simulate the next time phase in "Rice Fragrance Village".
    
    **CONTEXT:**
    Day: ${currentState.day}, Time: ${currentState.timePhase}
    NPCs:
    ${npcSummaries}
    Relationships:
    ${relationshipSummaries}
    
    ${playerIntervention}

    **RULES OF THE JIANGHU (STAT SYSTEMS):**
    1. **Time Phase Impact**:
       - Morning/Afternoon: Public events, work, training.
       - Evening: Socializing, drinking.
       - Night: Assassinations, secret meetings, strange rituals.
    2. **Corruption (SAN)**:
       - SAN increases when witnessing death, secrets, or being acted on by 'INCEPTION'.
       - **SAN > 80**: NPC enters 'QiDeviated' (走火入魔). THEY MUST ATTACK OTHERS.
       - **SAN > 95**: NPC is uncontrollably violent. Villagers must team up to kill them.
    3. **Health (HP) & Martial (MP)**:
       - Combat Outcome = (Attacker MP + Random) vs (Defender MP + Random).
       - Loser takes HP damage (10-50).
       - **HP < 20**: Status -> 'Injured'.
       - **HP <= 0**: Status -> 'Dead'.
    4. **Behavior**:
       - 'QiDeviated' NPCs attack random people or their Obsession.
       - Enemies attack each other if in same location.
       - Lovers protect each other.
    
    **OUTPUT REQUIREMENTS:**
    - **statUpdates**: You MUST modify stats based on events. 
       - Fighting -> decrease HP. 
       - Training -> increase MP. 
       - Trauma -> increase SAN. 
       - Healing -> increase HP.
    - **npcStatusUpdates**: Enforce logic (Dead if HP=0, QiDeviated if SAN>80).
    - **newspaper**: Only generate if something major happened (Death, Frenzy) or if it's 'Morning'. Otherwise empty.

    Language: Simplified Chinese.
  `;

  return runWithRetry(async () => {
    const response = await ai.models.generateContent({
      model: SIMULATION_MODEL,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            logs: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  npcName: { type: Type.STRING },
                  thought: { type: Type.STRING },
                  action: { type: Type.STRING }
                },
                required: ['npcName', 'thought', 'action']
              }
            },
            relationshipUpdates: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  sourceName: { type: Type.STRING },
                  targetName: { type: Type.STRING },
                  affinityChange: { type: Type.INTEGER },
                  trustChange: { type: Type.INTEGER },
                  newType: { type: Type.STRING, enum: ['None', 'Friend', 'Enemy', 'Lover', 'Family', 'Master', 'Disciple'], nullable: true }
                },
                required: ['sourceName', 'targetName', 'affinityChange', 'trustChange']
              }
            },
            statUpdates: {
                type: Type.ARRAY,
                items: {
                    type: Type.OBJECT,
                    properties: {
                        npcName: { type: Type.STRING },
                        hpChange: { type: Type.INTEGER },
                        mpChange: { type: Type.INTEGER },
                        sanChange: { type: Type.INTEGER }
                    },
                    required: ['npcName', 'hpChange', 'mpChange', 'sanChange']
                }
            },
            newIntel: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  content: { type: Type.STRING },
                  type: { type: Type.STRING },
                  sourceName: { type: Type.STRING }
                },
                required: ['content', 'type', 'sourceName']
              }
            },
            newspaper: {
              type: Type.OBJECT,
              properties: {
                headline: { type: Type.STRING },
                articles: { type: Type.ARRAY, items: { type: Type.STRING } }
              },
              nullable: true
            },
            npcStatusUpdates: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  npcName: { type: Type.STRING },
                  status: { type: Type.STRING, enum: ['Normal', 'Agitated', 'Depressed', 'Left Village', 'Married', 'Dead', 'Jailed', 'Heartbroken', 'Escaped', 'QiDeviated', 'Injured'] },
                  mood: { type: Type.STRING },
                  newPosition: {
                    type: Type.OBJECT,
                    properties: { x: { type: Type.INTEGER }, y: { type: Type.INTEGER } }
                  }
                },
                required: ['npcName', 'status', 'mood']
              }
            },
            gameOutcome: {
              type: Type.OBJECT,
              properties: {
                result: { type: Type.STRING, enum: ['Victory', 'Defeat'] },
                reason: { type: Type.STRING }
              },
              nullable: true
            }
          }
        }
      }
    });

    return JSON.parse(response.text || "{}") as SimulationResponse;
  });
};
