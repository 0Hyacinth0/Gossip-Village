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
  relationshipUpdates: { sourceName: string; targetName: string; affinityChange: number; trustChange: number }[];
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
    Generate ${villagerCount} unique, quirky characters for a Chinese pixel-art style village simulation game called "Gossip Village" (八卦村).
    
    Current Task: Create initial NPC data.
    
    Language Requirement: 
    - The 'gender' field must be 'Male' or 'Female' (English Enum).
    - All other text fields (name, role, publicPersona, deepSecret, currentMood, lifeGoal) MUST BE IN SIMPLIFIED CHINESE.
    
    Each character needs:
    - Name (Chinese style names like 王村长, 李大妈)
    - Age, Gender, Role
    - Public Persona (What everyone sees)
    - Deep Secret (Something scandalous or hidden)
    - Life Goal (Specific, actionable goal. e.g., "Marry the baker", "Kill the chief", "Become rich")
    - Initial Mood
    
    Ensure conflicts of interest exist between characters (e.g. A wants to steal B's position).

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
      Roleplay Simulation.
      
      You are playing the role of: ${npc.name} (${npc.role}, Age: ${npc.age}).
      Your Personality: ${npc.publicPersona}.
      Your Current Mood: ${npc.currentMood}.
      Your Deepest Secret (Hidden): ${npc.deepSecret}.
      Your Life Goal: ${npc.lifeGoal}.
      
      A mysterious voice (The Player/Observer) asks you: "${question}"
      
      Instructions:
      1. Respond in character (Simpilified Chinese). Keep it short (under 50 words).
      2. Decide if you want to reveal any information based on the question.
         - If the player guesses your secret or pressures you correctly, you might slip up or confess.
         - If the question is irrelevant, be dismissive.
      3. Determine how this interaction affects your mood.
      
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
              revealedInfo: { type: Type.STRING, nullable: true, description: "If a secret or valid rumor is revealed, summarize it here. Otherwise null." },
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
    `${n.name} (ID: ${n.id}, ${n.role}): Status=${n.status}, Goal=${n.lifeGoal}, Location=(${n.position.x},${n.position.y}). Secret: ${n.deepSecret}.`
  ).join('\n');

  const relationshipSummaries = currentState.npcs.map(n => {
    const rels = n.relationships.map(r => `${r.targetName}(Aff:${r.affinity}, Trust:${r.trust})`).join(', ');
    return `${n.name} feels about others: [${rels}]`;
  }).join('\n');

  // Prepare Location Map Context so AI knows where places are
  const mapContext = currentState.gridMap.flatMap((row, y) => 
    row.map((name, x) => `(x:${x}, y:${y}) is "${name}"`)
  ).join('\n');

  let actionDescription = "The observer (player) did nothing today.";
  if (playerActions.length > 0) {
    actionDescription = "The observer performed the following actions:\n" + 
      playerActions.map(a => `- ACTION: ${a.type}. Content: "${a.content}". Target: ${a.targetId || 'ALL'}.`).join('\n');
  }

  // Objective formatting
  let objectiveContext = "Game Mode: Sandbox (No specific win/loss condition).";
  if (currentState.objective) {
    const { mode, description, deadlineDay } = currentState.objective;
    objectiveContext = `
      CURRENT GAME MODE: ${mode}
      OBJECTIVE: ${description}
      DEADLINE: Day ${deadlineDay || 'None'} (Current Day: ${currentState.day})
      
      VICTORY/DEFEAT RULES:
      - Matchmaker Mode: 
        * Victory if target couple gets Married (Status 'Married').
        * DEFEAT if target couple Affinity < -50 (Must set Status to 'Heartbroken').
        * DEFEAT if deadline passed without marriage.
      - Detective Mode: 
        * Victory if player BROADCASTS the correct accusation regarding the culprit.
        * DEFEAT if player BROADCASTS a WRONG accusation (Culprit escapes, must set Status to 'Escaped').
        * DEFEAT if deadline passed (Culprit escapes, set Status to 'Escaped').
      - Chaos Mode:
        * Victory if > 50% of village is Dead, Jailed, or Left Village.
        * DEFEAT if deadline passed.
    `;
  }

  const prompt = `
    You are the simulation engine for Gossip Village (八卦村).
    
    Current State:
    Day: ${currentState.day}
    Grid Size: 4x4 (Coordinates 0-3)
    
    Map Locations (Use these coordinates for movement):
    ${mapContext}

    Villagers:
    ${npcSummaries}

    Relationships:
    ${relationshipSummaries}

    Player Actions Today:
    ${actionDescription}

    ${objectiveContext}

    Task:
    Simulate ONE day of interactions, prioritizing DRAMA and CONSEQUENCES.
    
    Directives:
    1. **Execute Player Intent**: If the player used INCEPTION, the NPC MUST attempt to do it.
    2. **Escalate Conflict**: If Affinity < -50, characters should sabotage or fight.
    3. **Resolve Goals**: NPCs should actively take steps to fulfill their 'Life Goal'.
    4. **Evaluate Game Outcome**: Check the "VICTORY/DEFEAT RULES" above. If a condition is met, fill the 'gameOutcome' field.
    5. **End Game States**: Use 'Dead', 'Jailed', 'Left Village', 'Married', 'Heartbroken', 'Escaped' statuses freely if warranted.
    
    6. **Movement Rules (CRITICAL)**: 
       - **Contextual Movement**: Update the NPC's \`newPosition\` to match their ACTION.
         * Example: If Blacksmith is visiting the Chief, put Blacksmith at 'Village Chief House' coordinates.
         * Example: If working, put them at their shop.
         * Example: If meeting someone secretly, put them in 'Woods' or 'Back Mountain'.
       - NPCs can move to ANY valid coordinate (0-3, 0-3) if the story requires it. No adjacency limit.
       - **Exceptions**: If Status is 'Dead', 'Jailed', 'Left Village', 'Escaped', or 'Heartbroken', do NOT move them.

    Language Requirement:
    - **ALL output text (thoughts, actions, newspaper articles, headlines, rumors, gameOutcome.reason) MUST BE IN SIMPLIFIED CHINESE.**
    - Only JSON keys should remain in English.

    Return strictly JSON. Keep logs concise.
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
                  trustChange: { type: Type.INTEGER }
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
