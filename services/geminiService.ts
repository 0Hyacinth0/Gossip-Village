
import { GoogleGenAI, Type } from "@google/genai";
import { NPC, GameState, DailyNews, LogEntry, IntelCard } from "../types";
import { LOCATION_MAP } from "../constants";

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

export interface SimulationResponse {
  logs: { npcName: string; thought: string; action: string }[];
  relationshipUpdates: { sourceName: string; targetName: string; affinityChange: number; trustChange: number; newType?: string }[];
  statUpdates: { npcName: string; hpChange: number; mpChange: number; sanChange: number }[];
  newIntel: { content: string; type: string; sourceName: string }[];
  newspaper: { headline: string; articles: string[] };
  npcStatusUpdates: { npcName: string; status: string; mood: string; newPosition?: {x: number, y: number} }[];
  gameOutcome?: { result: 'Victory' | 'Defeat'; reason: string };
}

export interface InitializationResponse {
  npcs: any[];
}

export interface InteractionResponse {
  reply: string;
  revealedInfo: string | null; // If they reveal a secret, put it here
  moodChange: string;
}

// --- API Functions ---

export const generateVillage = async (villagerCount: number): Promise<NPC[]> => {
  const prompt = `
    Generate ${villagerCount} unique, complex characters for a high-stakes Wuxia drama game.
    The setting is "Rice Fragrance Village" (稻香村).
    
    Current Task: Create initial NPC data, including their social web, location, RPG Stats, and a DETAILED BACKSTORY.
    
    **CRITICAL DESIGN INSTRUCTIONS:**
    1. **Conflict & Connection**: Ensure some NPCs are *already* connected via 'initialConnectionName'.
    2. **RPG Stats (MUST MATCH BACKGROUND)**:
       - **HP (Health)**: Derive from age/role. 
         * High (85-100): Young warriors, blacksmiths, laborers.
         * Medium (60-80): Normal adults, agile rogues.
         * Low (30-55): Elderly, children, scholars, or the sick/poisoned.
       - **MP (Martial Power)**: Derive from role/secret.
         * Elite (80-100): Sect leaders, hidden masters, top assassins.
         * Trained (50-79): Guards, disciples, bandits.
         * Civilian (0-20): Merchants, farmers, pure scholars.
       - **SAN (Corruption/入魔值)**: Derive from secret/mental state.
         * High (40-60): Cultists (Ming Jiao/Five Venoms), spies, or those with tragic/guilty secrets.
         * Medium (10-30): Ambitious characters, those with grudges.
         * Low (0-9): Pure-hearted, monks, naive youths.
    3. **Backstory**: Create a rich history (100-150 words) explaining their past, trauma, sect origins, or why they are in this village.
    4. **Spawn Zone**: Assign a 'spawnZone' strictly based on their role.
    5. **Roles**: Use JX3 sects or classic Wuxia roles.
    
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
                  backstory: { type: Type.STRING },
                  lifeGoal: { type: Type.STRING },
                  currentMood: { type: Type.STRING },
                  hp: { type: Type.INTEGER },
                  mp: { type: Type.INTEGER },
                  san: { type: Type.INTEGER },
                  spawnZone: { type: Type.STRING, enum: ['Market', 'Official', 'Temple', 'Secluded'] },
                  initialConnectionName: { type: Type.STRING, nullable: true },
                  initialConnectionType: { type: Type.STRING, enum: ['Lover', 'Enemy', 'Master', 'Disciple', 'Family'], nullable: true }
                },
                required: ['name', 'age', 'gender', 'role', 'publicPersona', 'deepSecret', 'backstory', 'lifeGoal', 'currentMood', 'spawnZone', 'hp', 'mp', 'san']
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
      Backstory: ${npc.backstory}.
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
         - If HP < 20 (Injured): Weak, coughing, pleading for help or medicine.
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

  // Create Map Legend for AI Spatial Awareness
  const mapLegend = LOCATION_MAP.flatMap((row, y) => 
    row.map((name, x) => `"${name}": {x:${x}, y:${y}}`)
  ).join(', ');

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
    Game Mode: "${currentState.gameMode}"
    Objective: "${currentState.objective?.description || 'Survive and observe.'}"
    
    **MAP GEOGRAPHY (COORDINATES {x,y}):**
    ${mapLegend}

    NPCs:
    ${npcSummaries}
    Relationships:
    ${relationshipSummaries}
    
    ${playerIntervention}

    **CORE RULES:**
    
    1. **DAILY ROUTINES (AUTONOMOUS MOVEMENT)**:
       You MUST update 'newPosition' by strictly referring to **MAP GEOGRAPHY** above.
       - **Morning/Afternoon (Work)**: 
         * Village Chief/Officials -> '村长家'
         * Blacksmith -> '打铁铺'
         * Doctor -> '百草园'
         * Guards/Warriors -> '演武场'
       - **Evening (Social)**: 
         * High chance to move to '稻香酒肆' (Tavern) or '水榭戏台'.
         * Lovers tend to move to the same location.
       - **Night (Rest)**: 
         * Return to homes (Secluded), '破旧道观' (Temple), or '幽暗竹林'.
         * Suspicious characters might go to '后山密洞' or '大侠墓'.
    
    2. **COMBAT & CONFLICT**:
       - IF 'Enemy' or 'QiDeviated' NPCs are in the **same location**, a fight MUST break out.
       - **Winner**: (Attacker MP + random 1-20) vs (Defender MP + random 1-20).
       - **Loser**: HP -25 (Major Injury). Status -> 'Injured' if HP < 20. Gains MP +1. SAN +5 (Humiliation).
       - **Winner**: MP +3. HP -5. SAN -2.
       - **Spectators**: SAN +2.
    
    3. **GROWTH & TRAINING**:
       - NPCs at '演武场' (Martial Field), '后山密洞' (Secret Cave), or '芦苇荡' (Reeds) during Day gain MP +3 to +5.
    
    4. **HEALTH & SANITY**:
       - **Healing**: 'Injured' NPC in '破旧道观' (Temple)/'百草园' (Herb) -> HP +15.
       - **Recovery**: Peaceful activities (drinking, resting) -> SAN -5.
       - **Qi Deviation**: SAN > 90 -> Status 'QiDeviated'. Attacks everyone.

    **GAME ENDING RULES:**
    1. **Sandbox Mode**: The game should NOT end. Do not return a 'gameOutcome' unless every single NPC is Dead. There is no time limit.
    2. **Matchmaker / Detective / Chaos Modes**: Evaluate strictly based on the "Objective". 
       - If the deadline (Day 7) is passed and goal NOT met -> 'Defeat'. 
       - If goal met -> 'Victory'.
    
    **OUTPUT REQUIREMENTS:**
    - **npcStatusUpdates**: MUST include 'newPosition' for at least 50% of NPCs (make them move!).
    - **logs**: Describe the movement and interactions strictly matching the MAP coordinates. e.g., if X goes to {x:1,y:2}, log "X went to 稻香酒肆".
    - **statUpdates**: Calculate strictly based on events.
    - **newspaper**: Generate only for Deaths or Massacres.
    - **gameOutcome**: Only provide this if the specific Game Mode ending conditions are met.

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
