# nuxt-declarative-ui interface reference

Use the [usage guide](getting-started.md) for the first steps. This reference preserves the current interface details and operational limits. Run command examples from the repository root, after preparing the exact declared dependencies and registered configuration.

## Ownership

- Zixcel: resource/value/action/change contracts and typed application outcomes.
- Crowsi: HTTP/JSONL transport, queue limits, cancellation and connection failures.
- NuxtJP: declaration validation, capability registry, rendering, temporary form
  drafts and view subscription lifecycle.
- Host: authenticated scope, application handler, routes/scenes, business labels,
  adopted meaning references and durable facts.

Install @nuxt/ui and this Nuxt module. NuxtJpInteractionSurface accepts scope,
view and endpoint props. Its read/invoke/subscribe endpoint returns structured
outcomes. A successful read includes ViewSnapshot: declaration revision, scope,
cursor and unchanged Zixcel resources with exact contract/resource revisions.
useAsyncData transfers the initial result into hydration without a second client
initial read. Scope is a cache-isolation identity, not authentication.

NuxtJpInteractionView accepts a snapshot, busy state and feedback and emits typed
invoke requests for hosts using a separate lifecycle. Drafts are transient inputs,
not facts. Live changes preserve edits and original preconditions; required false
is a value rather than absence.

## Runtime data vs installed capabilities

Logical nodes: region, group, display, input, collection, action, feedback.
Documents, fields, collections and actions are data; adding them needs no rebuild.
Declarations cannot select component names, HTML, scripts or code URLs.

A trusted build-time Nuxt module can call registerInteractionCapability(nuxt,
{kind, renderer, required, optional}). The absolute renderer path is compiled
into a private registry, never read from runtime declarations. Only adding new
capability implementations requires a build. Renderers receive selected node and
resource data, not arbitrary unscoped product state.

The former four-section display contract, fixed icon vocabulary and renderer
were physically removed. No compatibility aliases or adapters are provided.
