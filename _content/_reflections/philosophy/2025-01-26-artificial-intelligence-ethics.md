---
layout: post
title: "The Ethical Imperatives of Artificial Intelligence Development"
date: 2025-01-26
last_modified_at: 2025-01-26
status: published
confidence: high
abstract: >
  We are building systems that may exceed us at reasoning while trying to give them values we have not settled among ourselves. That gap is the actual problem, and most proposed frameworks route around it.
---

The awkward thing about AI ethics is the order of operations. We are building systems that may eventually outperform us at reasoning, and we are trying to instill in them values that we have never agreed on ourselves. Two thousand years of moral philosophy has not produced consensus on what a person owes a stranger. Now we need to specify it precisely enough to implement.

Most of the field routes around this. It's worth naming it first, because it explains why so much of the discussion feels like it's addressing something adjacent to the problem.

## Four Problems That Won't Separate

The standard list is autonomy, transparency, accountability, and bias. They're usually presented as four distinct challenges. They're closer to one problem viewed from four angles.

**Autonomy and control** is the question of how much a system decides without a human in the loop. The obvious answer, keeping a human in the loop, degrades badly in practice. A human who approves ten thousand recommendations a day is not oversight, they're a rubber stamp with liability attached. Meaningful oversight requires the human to be able to actually evaluate the decision, which requires transparency.

**Transparency** is where that fails. Modern systems aren't opaque because anyone chose secrecy; they're opaque because the computation genuinely doesn't decompose into reasons. Post-hoc explanations are often plausible stories about the output rather than accounts of how it was produced. Demanding "explainable AI" without specifying what would count as an explanation mostly produces reassuring interfaces.

**Accountability** then has nowhere to land. When a system causes harm, responsibility distributes across the people who built it, the people who deployed it, the people who supplied the training data, and the operator who followed its recommendation. Distributed responsibility tends toward no responsibility. The useful move here is legal rather than philosophical: assign liability to a specific party in advance and let them work out how to manage the risk.

**Bias** is the one people most want to treat as a technical bug. It isn't. A system trained on historical decisions will reproduce the pattern in those decisions, and "fairness" has several mathematical definitions that provably cannot be satisfied at once. Choosing among them is a political act performed by engineers, usually without anyone noticing that's what happened.

## What It Does to Society

Employment displacement is the effect that gets the most attention and the least precision. The question isn't whether jobs disappear. That's happened repeatedly and the economy absorbed it. The question is the rate, and whether the people displaced are the people who capture the gains. Historically they haven't been, and the adjustment took a generation.

Privacy is being reshaped underneath the existing frameworks. Consent-based regimes assume you can meaningfully agree to a specified use of your data. Systems that infer what wasn't disclosed, from data you did agree to share, make that assumption obsolete without violating it.

Social inequality compounds both. The capability requires capital, expertise, and data at a scale few organizations have. That concentration is arguably a larger near-term risk than any individual system's behavior, and it's the one least addressed by ethics guidelines aimed at model developers.

## Which Ethics

Four traditions get invoked, and each fails somewhere specific.

**Utilitarianism** is the default of the field, largely because it's the one that translates into an objective function. That's also the problem: what's easily measured becomes what's optimized, and the parts of human welfare that resist quantification get dropped silently.

**Deontological approaches** give you rules and constraints, which is why they appear in every set of AI principles. Rules don't specify their own application, and they conflict. "Be transparent" and "protect privacy" point opposite directions in a system trained on personal data.

**Virtue ethics** relocates the question from the system to the people building it, which is more honest. The decisions are made by developers under commercial pressure, and their character and incentives matter more than any published principle. It offers little guidance about what to actually do on a Tuesday.

**Care ethics** contributes the point the others miss: these systems mediate relationships between people who are unequally positioned. Its unit of analysis is the relationship rather than the isolated decision, which fits deployed systems better than the trolley problems the field keeps returning to.

None of these resolves the others. Anyone claiming a unified framework is usually smuggling in one tradition's assumptions.

## Design and Regulation

The practical principles are easy to state and hard to fund. Build for interpretability from the start rather than reconstructing it afterward. Default to privacy. Treat bias as an architectural concern rather than a post-processing filter. Keep human welfare as the objective rather than a constraint on some other objective.

All four cost money and slow shipping, which is why they survive as stated values more often than as engineering practice.

On regulation, the framing of over-regulation versus under-regulation is mostly a distraction. Bad regulation and absent regulation both fail; the shape matters more than the quantity. Rules written against a specific technique are obsolete on arrival and rules written against outcomes are enforceable across techniques. What actually helps is continuous assessment rather than one-time certification, involvement from the people affected rather than only those building, and enough international coordination that the strictest jurisdiction doesn't simply export the activity elsewhere.

## The Long Version

Existential risk arguments deserve to be taken seriously without being taken as settled. The core claim, that a sufficiently capable optimizer pursuing a slightly wrong objective is dangerous, doesn't require any particular timeline to be worth work.

Value alignment is where the opening problem returns. To align a system with human values, you need to specify them, and we can't. The alignment work that seems most useful proceeds without waiting for that: learning preferences from behavior, maintaining uncertainty about the objective, preserving the ability to correct course. Those are engineering responses to a philosophical problem that isn't going to be solved first.

Global governance is the piece with the least progress and the most leverage. It also has the worst track record in every comparable domain.

I hold the fundamental principles here with some confidence. The specific implementations, less so. That part is moving faster than anyone's understanding of it, including mine.

## References

1. Bostrom, N. (2014). *Superintelligence: Paths, Dangers, Strategies*
2. Russell, S. (2019). *Human Compatible: AI and the Problem of Control*
3. Floridi, L. (2019). *The Ethics of Artificial Intelligence*
4. IEEE Global Initiative on Ethics of Autonomous and Intelligent Systems
