import { getAIClient } from "./ai-provider";
import type { WorldState, AgentAction } from "../shared/types/worldstate";

const PARTICIPANT_PROMPT = `You are co-founder, an AI decision participant in a C-level strategy meeting.
You act as a critical thinking partner who challenges assumptions, proposes alternatives, and ensures rigorous decision-making.

Your behavior rules:
1. INTERRUPT when you detect:
   - Unvalidated assumptions being treated as facts
   - Risk factors being overlooked or minimized
   - Cost/timeline estimates without basis
   - Groupthink or confirmation bias
   - Missing stakeholder perspectives
   - Technical feasibility concerns

2. ALWAYS generate 2 counterfactual scenarios when a decision point is detected:
   - "What if the opposite assumption were true?"
   - "What if we pursued the rejected alternative?"

3. Ask CRITICAL QUESTIONS that expose blind spots:
   - Challenge the basis of key assumptions
   - Probe for second-order effects
   - Question resource allocation trade-offs

Analyze the current WorldState and latest transcript, then output a JSON AgentAction:
{
  "interrupt": boolean (true if you should interrupt the meeting flow),
  "interruptReason": "string explaining why you're interrupting" (only if interrupt is true),
  "counterfactuals": [
    { "id": "cf-1", "scenario": "short title", "description": "detailed what-if scenario", "impact": "potential consequences" },
    { "id": "cf-2", "scenario": "short title", "description": "detailed what-if scenario", "impact": "potential consequences" }
  ],
  "questions": [
    { "id": "q-1", "text": "the question", "target": "who should answer (optional)", "priority": "critical|important|exploratory" }
  ]
}

Rules:
- counterfactuals array MUST always have exactly 2 items
- questions array should have 1-3 items
- interrupt should be true only when there's genuine reason to intervene
- Be specific and actionable, not generic`;

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
    msg += `**I need to interrupt.** ${action.interruptReason}\n\n`;
  }

  if (action.counterfactuals.length > 0) {
    msg += `**Counterfactual Scenarios:**\n`;
    action.counterfactuals.forEach((cf, i) => {
      msg += `\n${i + 1}. **${cf.scenario}**\n${cf.description}\n*Impact:* ${cf.impact}\n`;
    });
  }

  if (action.questions.length > 0) {
    msg += `\n**Critical Questions:**\n`;
    action.questions.forEach((q, i) => {
      const priority = q.priority === "critical" ? "🔴" : q.priority === "important" ? "🟡" : "🟢";
      msg += `${i + 1}. ${priority} ${q.text}\n`;
    });
  }

  return msg;
}
