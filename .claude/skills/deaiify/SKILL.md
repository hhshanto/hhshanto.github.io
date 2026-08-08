---
name: deaiify
description: Audit and rewrite posts that read as AI-written. Removes templated section scaffolding, bolded numbered lists, every em-dash, and tidy symmetric conclusions. Use when drafting a new post, when asked to make writing "sound human" / "less like AI" / "less like ChatGPT", when reviewing an existing post's prose, or before publishing anything to the site.
---

# De-AI-ify

Make posts on this site read like Hasan wrote them, not like a model generated them.

The goal is **not** to evade AI detectors. It is to remove the structural and rhetorical habits that make prose feel machine-assembled, while keeping the argument intact. A post that has been laundered of em-dashes but still marches through Introduction → three symmetric sections → tidy Conclusion has not been fixed.

## Two modes

**Audit (default).** Report tells with file:line and a proposed fix. Change nothing. Use this whenever the post already exists, because the templated parts and the genuinely-Hasan parts are interleaved and blind rewriting destroys both.

**Rewrite.** Only when explicitly asked ("rewrite it", "fix them", "apply"), or when drafting new text that hasn't been published. After rewriting, list what changed and why, in one line each.

When auditing, rank findings: structural tells first (they matter most and are hardest to see), sentence-level tells last.

## The tell catalogue

Examples below are real, drawn from posts in this repo.

### 1. Template scaffolding (worst offender)

Section headers that label the machinery of an essay rather than its content.

❌ `## Introduction` / `## Conclusion` / `## Key Points` / `## Analysis` / `## Implications` / `## Meta`
✅ Either no header (just start), or a header that says something: `## When I Feel Hopeless`

Nobody writing for themselves labels their first paragraph "Introduction." `_reflections/about/2025-03-08-noema-digital-garden.md` runs Context → Key Points → Analysis → Implications → References → Meta → Updates; that is a report template, not an essay.

The `_reflections/_templates/` scaffold is a starting point, not a shape to preserve. Delete headers the post outgrew.

### 2. Symmetric architecture

Two concepts, one section each, equal length, parallel sub-structure, then a section reconciling them. Real thinking is lopsided. One idea gets four paragraphs because it's the interesting one, another gets a sentence.

Check: do the sections have suspiciously similar word counts? Does each one end with a list of the same length? That's a template asserting itself over the argument.

### 3. The bolded numbered list

❌
```
1. **Stay Realistic About Systemic Issues** – Acknowledging that corruption won't disappear overnight...
2. **Avoid Apathy** – Even if progress is slow, recognizing that small victories matter...
3. **Maintain Resilience** – If I expect challenges, I'm less likely to be discouraged.
```

Three items, each a bold noun phrase, each followed by a dash and one explanatory clause. This is the single most recognizable AI shape in the corpus, and it appears four times in `2025-03-19-hopeful-pessimism.md` alone.

✅ Turn it into prose. The connective tissue between the three points is where the actual thinking lives, and the list format is what deleted it. If it must stay a list, let the items be uneven: one clause, then three sentences, then a fragment.

Bullets are fine for things that are genuinely enumerable (categories, steps, references). They are not fine as a way to avoid writing paragraphs.

### 4. Tidy resolution

The closer that resolves all tension into balance.

❌ "In the end, I don't have to choose between hope and despair. I just have to learn how to live with both."
❌ "Patriotic ambivalence isn't a sign of weakness—it's proof that we're engaged in our nation's journey."
❌ "And maybe, just maybe, the fact that we care so much means there's hope after all."

Note `2025-03-15-patriotic-ambivalence.md` lands this move twice, in consecutive paragraphs. Once is a choice; twice is a tic.

✅ Stop earlier. End on the concrete thing rather than the lesson drawn from it. A post is allowed to end unresolved. That's what `confidence: low` in the front matter is for.

### 5. "Not X, but Y" and its relatives

❌ "It's not about being unpatriotic—it's about recognizing the full picture."
❌ "The goal isn't perfection—it's progress."
❌ "Love for one's country doesn't mean blind loyalty, just as criticism doesn't mean disloyalty."

The construction feels incisive and costs nothing to generate, which is why models overproduce it. One per post, maximum. Usually the Y half stands alone.

### 6. Tricolon closers

❌ "I see failure and progress, corruption and resilience, stagnation and innovation—all at the same time."

Three balanced pairs is a rhythm nobody reaches for naturally twice in the same piece. Cut to one pair, or to the single item that's actually true.

### 7. Em-dashes: banned outright

**No em-dashes. Zero. Not one per post, not one per 150 words. None.**

This is a hard rule, not a budget, and it is not negotiable on grounds of "this one is a legitimate appositive." Legitimate uses exist and they are still banned here, because the em-dash has become the single most recognizable signature of generated prose and Hasan does not want them on the site.

Applies to the em-dash character (—, U+2014) anywhere in a post: body text, headings, front matter, `abstract`, `description`. Also treat the en-dash (–, U+2013) as banned when it is doing an em-dash's job as a clause connector. En-dashes in numeric ranges (`5–7`, `1-29`) are fine and should be left alone.

Replace, in rough order of preference:

| Instead of | Use |
|---|---|
| `The result was clear — 65% complied.` | A period. `The result was clear. 65% complied.` |
| `Corruption, traffic — small things pile up.` | A colon. `Corruption, traffic: small things pile up.` |
| `-271.3°C — 1.9 kelvin, colder than space` | A comma, or parentheses. `-271.3°C (1.9 kelvin), colder than space` |
| `I love it — which is why I complain` | A comma, or a relative clause. `I love it, which is why I complain` |
| `Three things — A, B, and C` | A colon. `Three things: A, B, and C` |

Prefer the period whenever it works. Short sentences are the fastest way to stop sounding generated, and most em-dashes in a draft are a period that lost its nerve.

**Do not** substitute a spaced hyphen (` - `) as a workaround. That reads as a typo and is not what this rule is asking for. If no punctuation fits, rewrite the sentence.

**Verify before declaring done.** Do not eyeball this. Count. From the repo root:

```powershell
Get-ChildItem -Recurse -Include *.md -Path _reflections,_natural-sciences,_social-sciences |
  ForEach-Object {
    $n = ([regex]::Matches((Get-Content $_.FullName -Raw -Encoding UTF8), [char]0x2014)).Count
    if ($n -gt 0) { "$n  $($_.FullName)" }
  }
```

Silence means clean. Any output means the job is not finished.

### 8. Hedged intensifiers and filler

❌ "incredibly proud", "deeply invested", "immense pride", "genuinely believe", "truly", "vital", "crucial", "delve", "navigate the complexities", "in an age of information abundance", "it's worth noting"

Cut the adverb. "Proud" is stronger than "incredibly proud."

### 9. Abstract that restates the post

The `abstract` front matter key is what section index pages display. It should give a reason to read, not compress the argument into a paragraph the reader can substitute for the post.

❌ "This post explores the emotional push and pull of patriotic ambivalence, why it's natural, and what we can do with these feelings."
✅ Name the concrete situation the post starts from, and stop.

Also avoid: "This post explores…", "In this article, we…", "An exploration of…".

## The voice to aim for

Read `references/voice-samples.md` before rewriting anything. Those are Hasan's sentences from these same posts, the passages where the template dropped away. Match those, rather than matching a generic "human writing" ideal.

The short version of what's there: short declaratives, concrete Bangladeshi specifics (traffic, power cuts, 1971, garments), direct questions to himself, willingness to admit exhaustion, no summary of what he just said.

## What not to touch

- **Front matter.** Except `abstract`/`description` when they trip tell #9. Never change `date`, `layout`, `tags`, `confidence`, `importance`, `status`, `toc`.
- **The argument.** Rewriting is a prose operation. If a claim seems wrong, say so separately. Don't quietly fix it.
- **Quotations, citations, and references.** Leave verbatim.
- **First person.** These are personal essays; "I" is correct here, don't neutralize it.
- **Length.** Cuts are welcome, but don't pad to compensate elsewhere.
- **Anything already in the voice.** If a passage matches `references/voice-samples.md`, it's done. Leave it.

## Honest limits

Some of these patterns are just how Hasan writes essays, and stripping every one of them flat would also be a loss. Uniformly short sentences and zero structure is its own artificial register. Flag rather than enforce, and when a tell is load-bearing for the argument, say why you're leaving it.

The one exception is tell #7. The em-dash rule is absolute and is not subject to this judgment call. Hasan asked for zero, explicitly, after being shown the case for keeping a few. Do not relitigate it, do not leave one because it's grammatically defensible, and do not report the job done without running the count.
