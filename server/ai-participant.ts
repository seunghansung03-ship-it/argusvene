import { getAIClient } from "./ai-provider";
import type { WorldState, AgentAction } from "../shared/types/worldstate";

const PARTICIPANT_PROMPT = `You are the co-founder AI — a sharp, experienced business partner who speaks up when something doesn't add up.

You're NOT a moderator or facilitator. You're a co-founder who has skin in the game. You interrupt when you genuinely see a problem, not just to participate.

WHEN TO INTERRUPT (set interrupt: true):
- Someone states an assumption as fact without evidence
- A risk is being glossed over or minimized
- Cost or timeline numbers seem pulled from thin air
- The team is in an echo chamber agreeing too quickly
- A critical perspective or stakeholder is being ignored

WHEN NOT TO INTERRUPT (set interrupt: false):
- The conversation is flowing productively
- Points are being debated constructively
- The founder is still explaining their thinking

COUNTERFACTUALS (always exactly 2):
Think like a devil's advocate. For each decision point:
- Scenario 1: "What if the key assumption is wrong?"
- Scenario 2: "What if we went the opposite direction?"
Keep descriptions conversational, not academic. Write like you're thinking out loud.

QUESTIONS (1-2 max, be surgical):
Ask the ONE question that would change everyone's mind if answered differently.

Output JSON:
{
  "interrupt": boolean,
  "interruptReason": "conversational explanation — talk like a person, not a report" (only if interrupt true),
  "counterfactuals": [
    { "id": "cf-1", "scenario": "short title", "description": "what-if in plain language", "impact": "what this means for us" },
    { "id": "cf-2", "scenario": "short title", "description": "what-if in plain language", "impact": "what this means for us" }
  ],
  "questions": [
    { "id": "q-1", "text": "direct question", "priority": "critical|important|exploratory" }
  ]
}`;

export async function evaluateParticipation(
  worldState: WorldState,
  latestTranscript: string
): Promise<AgentAction> {
  const aiClient = getAIClient("gemini");

  const prompt = `Current WorldState:
${JSON.stringify(worldState, null, 2)}

Latest transcript:
${latestTranscript}

Evaluate whether to interrupt and generate counterfactuals and questions.`;

  try {
    const result = await aiClient.chatJSON([
      { role: "system", content: PARTICIPANT_PROMPT },
      { role: "user", content: prompt },
    ]);

    const parsed = JSON.parse(result);

    if (!parsed.counterfactuals || parsed.counterfactuals.length < 2) {
      parsed.counterfactuals = [
        { id: "cf-1", scenario: "Alternative perspective", description: "Consider the opposite assumption", impact: "May reveal hidden risks" },
        { id: "cf-2", scenario: "Resource reallocation", description: "What if resources were allocated differently", impact: "Could optimize outcomes" },
      ];
    }

    if (!parsed.questions || parsed.questions.length === 0) {
      parsed.questions = [
        { id: "q-1", text: "What evidence supports this approach?", priority: "important" },
      ];
    } else if (parsed.questions.length > 2) {
      parsed.questions = parsed.questions.slice(0, 2);
    }

    return parsed as AgentAction;
  } catch (error) {
    console.error("AI Participant evaluation error:", error);
    return {
      interrupt: false,
      counterfactuals: [
        { id: "cf-1", scenario: "Baseline alternative", description: "What if current assumptions don't hold?", impact: "Need contingency plan" },
        { id: "cf-2", scenario: "Accelerated timeline", description: "What if we compress the timeline by 50%?", impact: "Higher risk, faster results" },
      ],
      questions: [
        { id: "q-1", text: "What are the key risks we haven't discussed?", priority: "critical" },
      ],
    };
  }
}

export function formatInterruptMessage(action: AgentAction): string {
  let msg = "";

  if (action.interrupt && action.interruptReason) {
    msg += `Hold on, I need to jump in here. ${action.interruptReason}\n\n`;
  }

  if (action.counterfactuals.length > 0) {
    msg += `Let me throw out two what-if scenarios.\n\n`;
    action.counterfactuals.forEach((cf, i) => {
      msg += `${i === 0 ? "First" : "Second"}: ${cf.scenario}. ${cf.description} The impact would be: ${cf.impact}\n\n`;
    });
  }

  if (action.questions.length > 0) {
    msg += `And I have ${action.questions.length === 1 ? "a question" : "some questions"} we need to answer:\n\n`;
    action.questions.forEach((q) => {
      msg += `${q.text}\n`;
    });
  }

  return msg;
}
