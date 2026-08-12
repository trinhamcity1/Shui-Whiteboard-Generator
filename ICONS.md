# Icon library

**Library:** [Heroicons](https://heroicons.com) v2, `@heroicons/react` package (24px solid set).

**License:** MIT. Free for commercial use, modification, and redistribution;
no attribution required (though Heroicons is made by the Tailwind CSS team
and crediting them is appreciated). Full license text ships with the npm
package at `node_modules/@heroicons/react/LICENSE`.

**Fixed vocabulary:** scene authors (human or the Phase 3 LLM planner) may
only reference icon names listed in `src/render/icons/registry.ts`
(`AVAILABLE_ICON_NAMES`) — never a raw file path or an invented name. An
unrecognized name falls back to a generic placeholder icon at render time
with a console warning, rather than crashing the render.

To add more icons: import the additional Heroicons component in
`src/render/icons/registry.ts` and add it to `ICON_REGISTRY` under a new
name. No other code needs to change — the vocabulary is read from this one
file everywhere it's used (components, the LLM planner's system prompt).
