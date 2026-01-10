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
    Generate ${villagerCount} unique, complex characters for a high-stakes Wuxia drama game.
    The setting is "Rice Fragrance Village" (稻香村), but it is a powder keg waiting to explode.
    
    Current Task: Create initial NPC data.
    
    **CRITICAL DESIGN INSTRUCTIONS:**
    1. **Conflict-Ready Roles**: Include characters naturally opposed to each other (e.g., a hidden assassin vs. a retired constable, a rich merchant vs. a bandit spy).
    2. **Sects**: Use JX3 sects (Tian Ce, Chun Yang, Wan Hua, Tang Sect, Ming Jiao, Five Venoms, etc.).
    3. **Volatile Secrets**: The "Deep Secret" must be something that, if revealed, causes immediate fighting or tragedy (e.g., "I murdered the Village Chief's son," "I am poisoning the well").
    
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
      Social Circle:
      ${relationshipsCtx || "None."}

      The Player (a mysterious inner voice or stranger) asks: "${question}"
      
      **Directives:**
      1. **Relationship-Driven Tone (CRITICAL)**:
         - If discussing a **Lover** (情缘): Voice is soft, protective, yearning. You would die for them.
         - If discussing an **Enemy** (死敌/仇敌): Voice is cold, angry, mocking. You want them dead or ruined.
         - If discussing a **Master/Disciple** (师徒): Voice is formal, respectful (if disciple) or stern/proud (if master).
         - If discussing **Family** (亲眷): Voice is familiar, loyal, or deeply annoyed (family feud).
      2. **Be Dramatic**: Do not be polite. If you are angry, scream. If you are sad, weep.
      3. **React to Keywords**: 
         - If the player mentions your *Secret*, panic or get defensive.
      4. **Brevity**: Under 40 words.
      5. **Language**: Simplified Chinese, Wuxia style.
      
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
    `ID:${n.id} Name:${n.name} (${n.role}) Status:${n.status} Mood:${n.currentMood} Secret:${n.deepSecret} Loc:(${n.position.x},${n.position.y})`
  ).join('\n');

  const relationshipSummaries = currentState.npcs.map(n => {
    const rels = n.relationships.map(r => `${r.targetName}[${r.type}:${r.affinity}]`).join(', ');
    return `${n.name} Relationships: {${rels}}`;
  }).join('\n');

  // Interpret Player Actions strictly
  let playerIntervention = "No Player Intervention.";
  if (playerActions.length > 0) {
    playerIntervention = "PLAYER 'GOD' ACTIONS (MUST BE OBEYED & HAVE IMMEDIATE IMPACT):\n" + 
      playerActions.map(a => 
        `- ACTION TYPE: ${a.type}\n  TARGET: ${a.targetId || 'Global'}\n  CONTENT: "${a.content}"\n  RULE: This is absolute truth to the NPCs.`
      ).join('\n');
  }

  // Objective formatting
  let objectiveContext = "";
  if (currentState.objective) {
    objectiveContext = `CURRENT GAME OBJECTIVE: ${currentState.objective.description}. (Day ${currentState.day}/${currentState.objective.deadlineDay})`;
  }

  const prompt = `
    You are the Director of a **High-Stakes, Fast-Paced Wuxia Drama**.
    
    **CONTEXT:**
    Day: ${currentState.day}
    NPCs:
    ${npcSummaries}
    Relationships:
    ${relationshipSummaries}
    
    ${playerIntervention}
    
    ${objectiveContext}

    **CORE INSTRUCTION: RELATIONSHIP-DRIVEN PLOT**
    The simulation must be driven by the specific relationships between characters. A "Day" in this game is a narrative turn.
    
    **BEHAVIOR RULES (Apply these STRICTLY based on Relationship Type):**
    1. **Enemies (仇敌)**:
       - MUST generate CONFLICT. Examples: Ambush, Poisoning, Public Challenge, Spreading malicious rumors.
       - Affinity decreases further.
       - If Affinity < -80, Attempt Murder (Status -> Dead).
    2. **Lovers (情缘)**:
       - MUST generate ROMANCE/SUPPORT. Examples: Secret rendezvous, Gifting heirlooms, Healing injuries, Defending honor.
       - Affinity increases.
    3. **Master/Disciple (师徒)**:
       - MUST generate GROWTH/DISCIPLINE. Examples: Teaching secret arts (Action: "Transmits Qi"), Punishing mistakes, Saving from danger.
       - Trust increases.
    4. **Family (家人)**:
       - MUST generate LOYALTY/DRAMA. Examples: Covering up crimes, Arranged marriage disputes, Financial help.
    5. **No Relationship**:
       - Create chance encounters that lead to NEW relationships.
    
    **ADDITIONAL DIRECTIVES:**
    - **Accelerate the Plot**: Boredom is death. Every NPC must take a decisive action.
    - **Enforce Player Will**: If Player used INCEPTION/FABRICATE, NPCs react instantly and dramatically.
    - **Forced Relationship Evolution**: 
       - If Affinity > 60 and not 'Lover'/'Family', CHANGE TYPE TO 'Lover' or 'Sworn Brother'.
       - If Affinity < -40 and not 'Enemy', CHANGE TYPE TO 'Enemy'.
       - Teaching Action -> Change to 'Master'/'Disciple'.
    - **Global Event**: Invent a random daily event to stir chaos (e.g., "A poisonous fog descends", "The Emperor's guard arrives").
    
    **OUTPUT REQUIREMENTS (JSON):**
    - **logs**: Dramatic narrative of actions. Use "Thought" for inner monologue, "Action" for visible deeds.
    - **relationshipUpdates**: Drastic changes. Send 'newType' if thresholds are met.
    - **npcStatusUpdates**: Kill off characters, jail them, or marry them off. Do not keep everyone 'Normal'.
    - **newspaper**: A sensationalist headline summarizing the chaos.
    - **gameOutcome**: Check strictly if the Objective is met (Victory) or if time is up (Defeat).

    **Language**: Simplified Chinese, dramatic Jianghu flavor.
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
