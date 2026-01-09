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
    Generate ${villagerCount} unique, complex characters for a Wuxia/Xianxia style game (specifically inspired by JX3/剑网3 style).
    The setting is "Rice Fragrance Village" (稻香村), a legendary starting place in the Jianghu.
    
    Current Task: Create initial NPC data.
    
    **CRITICAL DESIGN INSTRUCTIONS:**
    1. **Diversity (Sects & Roles)**: Include characters from famous sects:
       - "Tian Ce" (天策 - Soldiers/Generals)
       - "Chun Yang" (纯阳 - Taoists)
       - "Wan Hua" (万花 - Doctors/Scholars)
       - "Qi Xiu" (七秀 - Dancers/Swordswomen)
       - "Shao Lin" (少林 - Monks)
       - "Tang Sect" (唐门 - Assassins)
       - "Cang Yun" (苍云 - Shield Guards)
       - "Ming Jiao" (明教 - Cultists)
       - "Beggar Sect" (丐帮 - Beggars/Drunks)
       - "Hidden Sword" (藏剑 - Smiths/Rich Nobles)
       - "Five Venoms" (五毒 - Shamans)
    2. **Naming**: Use poetic Chinese Wuxia names (e.g., 叶英, 李承恩, 东方宇轩 style names).
    3. **Complex Relationships**: Ensure the "Deep Secret" creates Jianghu conflict. Examples:
       - Secretly a spy for the "Valley of Villains" (恶人谷).
       - Suffering from "Qi Deviation" (走火入魔).
       - Holds a piece of a legendary treasure map.
       - Seeking revenge for a sect massacre.
    
    Language Requirement: 
    - The 'gender' field must be 'Male' or 'Female' (English Enum).
    - All other text fields (name, role, publicPersona, deepSecret, currentMood, lifeGoal) MUST BE IN SIMPLIFIED CHINESE.
    
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
                },
                required: ['name', 'age', 'gender', 'role', 'publicPersona', 'deepSecret', 'lifeGoal', 'currentMood']
              }
            }
          }
        }
      }
    });

    const data = JSON.parse(response.text || "{}") as InitializationResponse;
    
    // Post-process to add IDs and initial empty relationships
    return data.npcs.map((npc, index) => ({
      ...npc,
      id: `npc-${Date.now()}-${index}`,
      status: 'Normal',
      position: { x: index % 3, y: Math.floor(index / 3) }, // Simple grid layout
      relationships: [] // Will be populated in the first simulation tick or separately
    }));
  });
};

export const interactWithNPC = async (npc: NPC, question: string): Promise<InteractionResponse> => {
    const prompt = `
      Roleplay Simulation (Wuxia / JX3 Style).
      
      You are: ${npc.name} (${npc.role}, Age: ${npc.age}).
      Sect/Background: Inferred from role (e.g., Taoist -> Chun Yang).
      Personality: ${npc.publicPersona}.
      Current Mood: ${npc.currentMood}.
      Deepest Secret: ${npc.deepSecret}.
      Goal: ${npc.lifeGoal}.
      
      A mysterious voice (The Observer) transmits a thought to you: "${question}"
      
      Instructions:
      1. Respond in "Jianghu" style Chinese (Semi-classical, martial arts terms, '侠义风').
      2. Keep it short (under 50 words).
      3. Logic:
         - If the question touches your secret or sect weakness, be defensive or lie.
         - If pressed correctly, you might confess your inner demons.
      
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
              reply: { type: Type.STRING, description: "NPC's spoken response" },
              revealedInfo: { type: Type.STRING, nullable: true, description: "If a secret is revealed, summarize it. Otherwise null." },
              moodChange: { type: Type.STRING, description: "New mood after interaction" }
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
  
  // Prepare context for the AI
  const npcSummaries = currentState.npcs.map(n => 
    `${n.name} (ID: ${n.id}, ${n.role}): Status=${n.status}, Goal=${n.lifeGoal}, Loc=(${n.position.x},${n.position.y}). Secret: ${n.deepSecret}.`
  ).join('\n');

  const relationshipSummaries = currentState.npcs.map(n => {
    const rels = n.relationships.map(r => `${r.targetName}[${r.type}]: ${r.affinity}`).join(', ');
    return `${n.name} relationships: {${rels}}`;
  }).join('\n');

  const mapContext = currentState.gridMap.flatMap((row, y) => 
    row.map((name, x) => `(x:${x}, y:${y}) is "${name}"`)
  ).join('\n');

  let actionDescription = "The observer did nothing.";
  if (playerActions.length > 0) {
    actionDescription = "The observer actions:\n" + 
      playerActions.map(a => `- ${a.type} to ${a.targetId || 'ALL'}: "${a.content}"`).join('\n');
  }

  // Objective formatting
  let objectiveContext = "Mode: Sandbox.";
  if (currentState.objective) {
    const { mode, description, deadlineDay } = currentState.objective;
    objectiveContext = `
      MODE: ${mode}
      GOAL: ${description}
      DEADLINE: Day ${deadlineDay} (Current: ${currentState.day})
      
      RULES:
      - Matchmaker: Win if Married/Lover. Lose if Heartbroken/Affinity<-50.
      - Detective: Win if correct Broadcast accusation. Lose if wrong accusation or Culprit Escapes.
      - Chaos: Win if >50% Dead/Jailed/Left.
    `;
  }

  const prompt = `
    You are the simulation engine for "Gossip Village: JX3 Edition" (武侠版八卦村).
    
    Setting: A wuxia village where various sects (Tian Ce, Chun Yang, Tang Sect, etc.) coexist uneasily.
    
    Map:
    ${mapContext}

    Characters (Jianghu Heroes/Villains):
    ${npcSummaries}

    Relationships (Types: Friend, Enemy, Lover, Family, Master, Disciple):
    ${relationshipSummaries}

    Player Actions:
    ${actionDescription}

    ${objectiveContext}

    Task:
    Simulate ONE day. Prioritize WUXIA DRAMA (Duels, Qi Deviation, Sect Politics, Secret Manuals).
    
    Directives:
    1. **Events**: Generate events like "Practicing swords", "Drinking at tavern", "Spying on other sects", "Healing injuries".
    2. **Conflict**: Update affinity and **Relationship Type**.
       - If affinity > 60 and romance, set type='Lover'.
       - If affinity < -50 and fighting, set type='Enemy'.
       - If teaching kung fu, set type='Master'/'Disciple'.
       - If purely social, set type='Friend'.
    3. **Movement**:
       - Chun Yang -> Meditate in Mountains/Temples.
       - Beggars -> Markets/Ditches.
       - Tang Sect -> Shadows/Forests.
       - Tian Ce -> Camps/Open grounds.
       - Wan Hua -> Gardens/Clinics.
    4. **Language**: Use SIMPLIFIED CHINESE with Wuxia flavor (e.g., instead of "Sad", use "黯然神伤"; instead of "Angry", use "怒发冲冠").
    
    Return strictly JSON.
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
              required: ['headline', 'articles']
            },
            npcStatusUpdates: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  npcName: { type: Type.STRING },
                  status: { type: Type.STRING, enum: ['Normal', 'Agitated', 'Depressed', 'Left Village', 'Married', 'Dead', 'Jailed', 'Heartbroken', 'Escaped'] },
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
