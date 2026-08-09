"""Train the tiny transformer that /model/ runs — dev-only.

    python .tools/train.py [steps]        default 4000

Writes assets/data/model.bin (int8 weights) and assets/data/model.json (shapes,
scales, config, and the projection basis the page uses for its 3D view).

WHAT THIS IS. A real decoder-only transformer — token and position embeddings,
pre-norm blocks, causal multi-head self-attention, GELU MLP, tied output head —
at a size that fits in a repository: 2 layers, 128 dimensions, 4 heads. About
half a million parameters, which is roughly 1/170,000th of GPT-3.

WHAT IT IS NOT. Good. It trains on 12 blog posts, which is about 14,000 tokens,
and no amount of tuning makes 14,000 tokens into a language model. It will
produce grammar-shaped noise and it will memorise chunks of the corpus verbatim.
That is the honest and useful outcome: the MECHANISM on the page is exactly the
mechanism in a frontier model, and the only thing missing is scale. A reader who
watches attention heads work correctly while the output stays nonsense has
learned something that no architecture diagram can teach.

WHY NOT SHIP GPT-2'S WEIGHTS INSTEAD. 124M parameters is 500MB in float32 and
124MB even at int8 — past GitHub's 100MB per-file limit, and a download nobody
should be asked to make to read a page. This is 510KB.

Requires torch and numpy. Nothing here ships; `.tools/` is excluded from the
Jekyll build.
"""

import json
import math
import re
import sys
from pathlib import Path

import numpy as np
import torch
import torch.nn as nn
import torch.nn.functional as F

ROOT = Path(__file__).resolve().parent.parent
OUT_BIN = ROOT / "assets/data/model.bin"
OUT_JSON = ROOT / "assets/data/model.json"
TOKENIZER = ROOT / "assets/data/tokenizer.json"

# ── Config ────────────────────────────────────────────────────────────────
# Sized to the two constraints that actually bind: the file has to be small
# enough to fetch without apology, and every intermediate has to be small enough
# to DRAW. A 12-layer model would not be much slower in the browser and would be
# unreadable on screen, which is the wrong trade for a page whose entire purpose
# is being looked at.
N_LAYER = 2
N_HEAD = 4
D_MODEL = 128
D_FF = 384
BLOCK = 64          # context length
DROPOUT = 0.1
BATCH = 32
LR = 1e-3
STEPS = int(sys.argv[1]) if len(sys.argv) > 1 else 4000
SEED = 1337

torch.manual_seed(SEED)
np.random.seed(SEED)

# ── Corpus, through the site's own tokenizer ──────────────────────────────
# Deliberately the same BPE table /tokenizer/ ships, not a fresh one. The point
# of putting these instruments on one site is that they form a pipeline: the
# tokens you can watch being built on that page are the tokens this model reads.

tok = json.loads(TOKENIZER.read_text(encoding="utf-8"))
MARK = tok["mark"]
vocab = tok["vocab"]
stoi = {t: i for i, t in enumerate(vocab)}
ranks = {(a, b): i for i, (a, b) in enumerate(tok["merges"])}

# Must match .tools/tokenizer.mjs and assets/js/tokenizer.js exactly.
PRE = re.compile(r" ?[A-Za-z]+| ?[0-9]+|[^\sA-Za-z0-9]|\s+")


def bpe(word):
    sym = list(word)
    while True:
        best, at = math.inf, -1
        for i in range(len(sym) - 1):
            r = ranks.get((sym[i], sym[i + 1]))
            if r is not None and r < best:
                best, at = r, i
        if at < 0:
            return sym
        sym = sym[:at] + [sym[at] + sym[at + 1]] + sym[at + 2:]


def encode(text):
    ids = []
    for raw in PRE.findall(text):
        if raw.isspace():
            if raw != " ":
                # Whitespace runs are their own tokens where the vocabulary has
                # them; a newline the corpus never contained is simply skipped
                # rather than crashing training on a KeyError.
                ids.extend(stoi[c] for c in raw if c in stoi)
            continue
        word = MARK + raw[1:] if raw.startswith(" ") else raw
        ids.extend(stoi[s] for s in bpe(word) if s in stoi)
    return ids


def read_corpus():
    """The same twelve pieces .tools/lib/corpus.mjs reads, same stripping."""
    docs = []
    for path in sorted((ROOT / "_content").rglob("*.md")):
        if "_templates" in path.parts:
            continue
        raw = path.read_text(encoding="utf-8")
        m = re.match(r"^---\r?\n(.*?)\r?\n---\r?\n(.*)$", raw, re.S)
        meta, body = (m.group(1), m.group(2)) if m else ("", raw)
        title = ""
        tm = re.search(r"^title:\s*(.*)$", meta, re.M)
        if tm:
            title = tm.group(1).strip().strip("\"'")
        body = re.sub(r"```.*?```", " ", body, flags=re.S)
        body = re.sub(r"!\[[^\]]*\]\([^)]*\)", " ", body)
        body = re.sub(r"\[([^\]]*)\]\([^)]*\)", r"\1", body)
        body = re.sub(r"[#>*_`~|-]+", " ", body)
        body = re.sub(r"\s+", " ", body).strip()
        docs.append(f"{title}\n{body}")
    return "\n".join(docs)


text = read_corpus()
data = torch.tensor(encode(text), dtype=torch.long)
n_train = int(0.9 * len(data))
train_data, val_data = data[:n_train], data[n_train:]
print(f"corpus: {len(text)} chars -> {len(data)} tokens "
      f"({len(train_data)} train / {len(val_data)} val), vocab {len(vocab)}")


def batch(split):
    src = train_data if split == "train" else val_data
    ix = torch.randint(len(src) - BLOCK - 1, (BATCH,))
    x = torch.stack([src[i:i + BLOCK] for i in ix])
    y = torch.stack([src[i + 1:i + BLOCK + 1] for i in ix])
    return x, y


# ── Model ─────────────────────────────────────────────────────────────────
# Pre-norm, which is what every modern decoder uses and what the JS forward pass
# in assets/js/model.js reimplements line for line. Post-norm would train
# slightly differently and, more to the point, would make the residual stream a
# different object — and the residual stream is the thing the page draws.

class Block(nn.Module):
    def __init__(self):
        super().__init__()
        self.ln1 = nn.LayerNorm(D_MODEL)
        self.attn = nn.Linear(D_MODEL, 3 * D_MODEL, bias=False)
        self.proj = nn.Linear(D_MODEL, D_MODEL, bias=False)
        self.ln2 = nn.LayerNorm(D_MODEL)
        self.fc = nn.Linear(D_MODEL, D_FF, bias=False)
        self.out = nn.Linear(D_FF, D_MODEL, bias=False)
        self.drop = nn.Dropout(DROPOUT)

    def forward(self, x):
        B, T, C = x.shape
        q, k, v = self.attn(self.ln1(x)).split(C, dim=2)
        q = q.view(B, T, N_HEAD, C // N_HEAD).transpose(1, 2)
        k = k.view(B, T, N_HEAD, C // N_HEAD).transpose(1, 2)
        v = v.view(B, T, N_HEAD, C // N_HEAD).transpose(1, 2)
        a = F.scaled_dot_product_attention(q, k, v, is_causal=True,
                                           dropout_p=DROPOUT if self.training else 0)
        a = a.transpose(1, 2).contiguous().view(B, T, C)
        x = x + self.drop(self.proj(a))
        x = x + self.drop(self.out(F.gelu(self.fc(self.ln2(x)))))
        return x


class Tiny(nn.Module):
    def __init__(self):
        super().__init__()
        self.tok = nn.Embedding(len(vocab), D_MODEL)
        self.pos = nn.Embedding(BLOCK, D_MODEL)
        self.blocks = nn.ModuleList([Block() for _ in range(N_LAYER)])
        self.lnf = nn.LayerNorm(D_MODEL)
        # Tied output head. Halves the parameter count at this vocabulary size
        # and is what GPT-2 does, so the logit lens on the page — decoding an
        # intermediate residual through the SAME matrix that embedded the input
        # — is the standard trick rather than an invention.
        self.head = lambda h: h @ self.tok.weight.T

    def forward(self, idx, targets=None):
        B, T = idx.shape
        x = self.tok(idx) + self.pos(torch.arange(T, device=idx.device))
        for b in self.blocks:
            x = b(x)
        logits = self.head(self.lnf(x))
        if targets is None:
            return logits, None
        loss = F.cross_entropy(logits.view(-1, logits.size(-1)), targets.reshape(-1))
        return logits, loss


model = Tiny()
n_params = sum(p.numel() for p in model.parameters())
print(f"model: {N_LAYER}L {N_HEAD}H {D_MODEL}d -> {n_params:,} parameters")

opt = torch.optim.AdamW(model.parameters(), lr=LR, weight_decay=0.1)
sched = torch.optim.lr_scheduler.CosineAnnealingLR(opt, T_max=STEPS)


@torch.no_grad()
def evaluate():
    model.eval()
    out = {}
    for split in ("train", "val"):
        losses = []
        for _ in range(20):
            x, y = batch(split)
            losses.append(model(x, y)[1])
        out[split] = torch.stack(losses).mean().item()
    model.train()
    return out


# The loss curve is exported, not just printed. The gap between the two lines is
# the most instructive thing this run produces: 14,000 tokens is nowhere near
# enough to generalise, so the model memorises, and a page that showed only the
# training loss would be quietly lying about what it is running.
history = []

for step in range(STEPS):
    x, y = batch("train")
    _, loss = model(x, y)
    opt.zero_grad(set_to_none=True)
    loss.backward()
    torch.nn.utils.clip_grad_norm_(model.parameters(), 1.0)
    opt.step()
    sched.step()
    if step % 200 == 0 or step == STEPS - 1:
        e = evaluate()
        history.append({"step": step,
                        "train": round(e["train"], 3),
                        "val": round(e["val"], 3)})
        if step % 1000 == 0 or step == STEPS - 1:
            print(f"  step {step:5d}  train {e['train']:.3f}  val {e['val']:.3f}")

final = evaluate()
print(f"final loss: train {final['train']:.3f}  val {final['val']:.3f}  "
      f"(val perplexity {math.exp(final['val']):.1f})")

# ── Samples, so the page can show what was actually learned ───────────────
# Rendered at build time on /model/. Temperature is the axis worth showing: at
# 0.5 the model recites the corpus, at 1.2 it comes apart. Both are the same
# weights, and seeing that is worth more than any amount of describing it.
model.eval()


def generate(prompt, n=42, temp=0.8):
    with torch.no_grad():
        idx = torch.tensor([encode(prompt) or [0]])
        for _ in range(n):
            logits, _ = model(idx[:, -BLOCK:])
            probs = F.softmax(logits[:, -1, :] / temp, dim=-1)
            idx = torch.cat([idx, torch.multinomial(probs, 1)], dim=1)
        return "".join(vocab[i] for i in idx[0].tolist()).replace(MARK, " ").strip()


samples = [{"temp": t, "text": generate(" Bangladesh", temp=t)}
           for t in (0.5, 0.8, 1.2)]
for s in samples:
    print(f"  T={s['temp']}: {s['text'][:96]}")

# ── Projection basis for the 3D view ──────────────────────────────────────
# PCA over the residual stream at every layer, across the whole corpus, so the
# page's three axes are FIXED. Recomputing them per input would let the same
# token land somewhere different depending on what else was typed, and the whole
# value of the view is watching a trajectory move through a stable space.

@torch.no_grad()
def residual_basis():
    acts = []
    hooks = []

    def grab(_m, _i, o):
        acts.append(o.detach().reshape(-1, D_MODEL))

    for b in model.blocks:
        hooks.append(b.register_forward_hook(grab))

    for i in range(0, min(len(data) - BLOCK, 4000), BLOCK):
        model(data[i:i + BLOCK].unsqueeze(0))
    for h in hooks:
        h.remove()

    A = torch.cat(acts).numpy()
    mean = A.mean(0)
    A = A - mean
    # Full SVD on a 128-column matrix is instant; no need for a randomised one.
    _, S, Vt = np.linalg.svd(A, full_matrices=False)
    var = float((S[:3] ** 2).sum() / (S ** 2).sum())

    # The scale for the 3D view, measured here rather than per input. If the
    # page normalised each pass to its own extent the scene would resize around
    # whatever was typed, and no two trajectories could be compared.
    #
    # The 75th percentile, not the maximum and not the 99th. The maximum lets one
    # outlier activation shrink every ordinary path to a dot; the 99th did the
    # same thing less obviously, because a typical eight-token prompt never comes
    # close to the tail and the whole scene sat in a knot in the middle. At 75
    # the ordinary case fills the frame and the rare excursion runs past the
    # edge, which is the right way round — the stage clips.
    proj = A @ Vt[:3].T
    extent = float(np.percentile(np.abs(proj), 75))
    return Vt[:3], mean, var, extent


basis, centre, explained, extent = residual_basis()
print(f"residual basis: 3 of {D_MODEL} dimensions, {explained * 100:.1f}% of variance, "
      f"extent {extent:.2f}")

# ── Export ────────────────────────────────────────────────────────────────
# int8, symmetric, one scale per tensor. Float32 would be 2MB and this is 510KB
# for a difference in output nobody can detect at this size — and the page gets
# to say, truthfully, that it is running quantised weights, which is the same
# trick that puts a 70B model on a laptop.

tensors = []
blob = bytearray()


def add(name, t):
    a = t.detach().cpu().numpy().astype(np.float32)
    scale = float(np.abs(a).max()) / 127.0 or 1.0
    q = np.clip(np.round(a / scale), -127, 127).astype(np.int8)
    tensors.append({
        "name": name,
        "shape": list(a.shape),
        "offset": len(blob),
        "scale": scale,
    })
    blob.extend(q.tobytes())


add("tok", model.tok.weight)
add("pos", model.pos.weight)
for i, b in enumerate(model.blocks):
    add(f"b{i}.ln1.g", b.ln1.weight)
    add(f"b{i}.ln1.b", b.ln1.bias)
    add(f"b{i}.attn", b.attn.weight)
    add(f"b{i}.proj", b.proj.weight)
    add(f"b{i}.ln2.g", b.ln2.weight)
    add(f"b{i}.ln2.b", b.ln2.bias)
    add(f"b{i}.fc", b.fc.weight)
    add(f"b{i}.out", b.out.weight)
add("lnf.g", model.lnf.weight)
add("lnf.b", model.lnf.bias)

OUT_BIN.write_bytes(bytes(blob))
OUT_JSON.write_text(json.dumps({
    "config": {
        "nLayer": N_LAYER, "nHead": N_HEAD, "dModel": D_MODEL,
        "dFF": D_FF, "block": BLOCK, "vocab": len(vocab),
    },
    "params": n_params,
    "loss": {"train": round(final["train"], 3), "val": round(final["val"], 3)},
    "perplexity": round(math.exp(final["val"]), 1),
    "tokensTrained": len(data),
    "steps": STEPS,
    "history": history,
    "samples": samples,
    "quant": "int8 symmetric, per tensor",
    "bytes": len(blob),
    # The 3D view's axes, and how much of the residual stream they actually
    # carry. Printed on the page for the same reason the atlas prints its
    # explained variance: a projection that has thrown most of its information
    # away should say so.
    "basis": [[round(float(v), 5) for v in row] for row in basis],
    "centre": [round(float(v), 5) for v in centre],
    "basisExplained": round(explained, 4),
    "extent": round(extent, 4),
    "tensors": tensors,
}) + "\n", encoding="utf-8")

# A third, tiny file in _data/ so Liquid can render the headline numbers, the
# loss curve and the samples at build time. The weights have to be fetched — they
# are only useful once someone types — but the page's argument does not depend on
# them, and none of it should wait on a 489KB request to appear.
(ROOT / "_data/tinygpt.json").write_text(json.dumps({
    "params": n_params,
    # Liquid has no thousands separator and the site's other big number splits
    # it by hand in the template. Formatting here keeps that out of the page.
    "paramsHuman": f"{n_params:,}",
    "nLayer": N_LAYER, "nHead": N_HEAD, "dModel": D_MODEL,
    "block": BLOCK, "vocab": len(vocab),
    "tokensTrained": len(data),
    "steps": STEPS,
    "kb": round(len(blob) / 1024),
    "loss": {"train": round(final["train"], 3), "val": round(final["val"], 3)},
    "perplexity": round(math.exp(final["val"]), 1),
    "basisExplained": round(explained, 4),
    "history": history,
    "samples": samples,
}, indent=1) + "\n", encoding="utf-8")

print(f"wrote assets/data/model.bin ({len(blob) / 1024:.0f}KB) + model.json + _data/tinygpt.json")
