# ArgusVene V3 Product Contract

This document replaces ad-hoc patching. From this point forward, ArgusVene should be rebuilt against this contract instead of being incrementally modified without a stable product shape.

## 1. What ArgusVene Is

ArgusVene is not a chat app.

ArgusVene is a live meeting operating system where:
- multiple human users join the same room at the same time
- AI agents join as real participants, not just answer bots
- the room produces work during the meeting, not after it
- the center canvas is a live work surface that agents can directly update
- outcomes become decisions, tasks, artifacts, and next actions

## 2. Product Center

The product center is the Live Meeting Room.

Everything else exists to support the room:
- organization management
- workspace/project preparation
- files and context
- post-meeting outcomes

The meeting room must always have 3 panes:
- Left: live transcript and voice lane
- Center: live canvas and execution surface
- Right: people, agents, permissions, and command deck

## 3. Non-Negotiable UX Rules

- The room must feel operable within seconds.
- Users must know what each pane is for without reading a manual.
- The top-level layout must reduce thinking, not increase it.
- The UI must look intentional and calm, not like stacked prototype cards.
- Important state must be visible at a glance:
  - who is in the room
  - which agents are active
  - current work order
  - live audio state
  - current build/review object
  - whether there is a runnable preview
- The room should minimize repeated controls and decorative noise.

## 4. Meeting Room Behavior

### Left Pane

Purpose:
- human conversation
- live voice interaction
- transcript review
- precise room instructions

Must support:
- text turns
- live voice turns
- Korean-first flow when available
- direct addressing of a specific agent
- clear distinction between human and agent turns

### Center Pane

Purpose:
- make, inspect, revise

Must support:
- generating software drafts
- generating hardware concepts
- generating workflows
- generating experiments
- showing the current object under discussion
- runnable preview for software outputs
- direct agent updates to the shared canvas state

The center pane is not for notes. It is the room's working surface.

### Right Pane

Purpose:
- room operations

Must support:
- invite/remove humans
- activate/stand down agents
- choose a lead agent
- command a lead agent to build, critique, research, or decide
- show room roster clearly

## 5. Agent Contract

Agents must not behave like passive answer generators.

Agents must:
- speak with role-specific perspective
- take initiative when appropriate
- update room work order
- create artifacts
- create tasks
- lock decisions
- read workspace files
- react to the current room state, not just the latest prompt

Each agent should have:
- role
- tone
- authority boundary
- action permissions
- explicit triggers for intervention

## 6. Multiuser Contract

Authentication exists to support shared room use, not for its own sake.

The system must treat the room as a shared state, including:
- user identity
- presence
- membership
- room roles
- invites
- removals
- authorship
- shared canvas visibility

## 7. Execution Layer

The product goal is not only discussion. It is discussion plus direct making.

The execution layer should support:
- immediate prototype generation
- live preview for software outputs
- revision loop based on feedback from humans and agents

Longer term, the product should behave like a live browser runtime inside the room:
- generate
- run
- inspect
- revise

This should not be limited to software. Hardware, workflow, and experiment outputs also need first-class treatment, even when they do not have a browser runtime.

## 8. Product Flow

The product flow should be:

1. Organization
2. Workspace / Project Prep
3. Live Meeting Room
4. Outcomes

The meeting room is the core. The other pages should remain lighter and support the room.

## 9. V3 Build Rule

V3 should reuse only:
- auth
- database
- workspace / membership / file models
- deployment infrastructure
- Gemini / Gemini Live connectivity
- runtime preview serving where useful

V3 should not inherit current UI or orchestration by default.

The following should be treated as replaceable:
- room UI
- room orchestration flow
- agent interaction loop
- layout hierarchy
- command surfaces

## 10. Immediate V3 Delivery Target

The first V3 vertical slice must prove this exact loop:

1. user enters a live room
2. multiple agents are visibly active
3. user speaks or types
4. one or more agents respond with clear role behavior
5. an agent updates the work order or produces an artifact
6. the center canvas changes in response
7. if the output is software, the user can launch and inspect a runnable preview
8. the room can critique and revise the result

If that loop is not clean, V3 is not done.
