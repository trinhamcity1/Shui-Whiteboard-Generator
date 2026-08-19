import "dotenv/config";
import { planScenesFromScript } from "../src/schema/planning";

// Revision-3 WS5's own recommended finish line: 8-10 varied real topics
// through the real scene-planning LLM, reviewing template and asset
// selection quality. Planning-only (no TTS, no render) — cheap and fast,
// and the thing actually under test is whether the planner reaches for
// the new templates/features sensibly, not render output.

const TOPICS: Array<{ id: string; script: string }> = [
  {
    id: "judicial-review",
    script:
      "When Congress passes a law, it doesn't automatically survive forever. Someone can challenge it in court, arguing it violates the Constitution. The Supreme Court then reviews the law against constitutional principles. If the Court finds the law unconstitutional, it strikes the law down, and the law can no longer be enforced anywhere in the country.",
  },
  {
    id: "water-cycle",
    script:
      "Water is always moving through a cycle. The sun heats the ocean, and water evaporates into the air as vapor. High in the sky, that vapor cools and condenses into clouds. When the clouds get heavy enough, the water falls back down as rain. That rain collects in rivers and lakes, and eventually flows back to the ocean, where the whole cycle starts again.",
  },
  {
    id: "hierarchy-of-law",
    script:
      "In the United States, laws come from three levels of government. At the top is the Constitution. Below it, federal law applies to the whole country. State law applies within one state. And local law applies within a city or county. A judge and an officer both help enforce these laws every day.",
  },
  {
    id: "fall-of-rome",
    script:
      "By the fifth century, the Western Roman Empire was collapsing under its own weight. Barbarian tribes pressed at every border. Corruption hollowed out the government from within. Emperors rose and fell in rapid succession, each too weak to hold the empire together. In 476 AD, the last Western emperor was deposed, and Rome's thousand-year dominance came to an end.",
  },
  {
    id: "photosynthesis-vs-respiration",
    script:
      "Plants and animals depend on two opposite chemical processes. Photosynthesis takes in carbon dioxide and water, and using sunlight, produces glucose and oxygen. Cellular respiration does the reverse: it takes in glucose and oxygen, and releases carbon dioxide, water, and usable energy. Together, these two processes keep the planet's oxygen and carbon in balance.",
  },
  {
    id: "roman-senate",
    script:
      "The Roman Senate was never a single all-powerful body. It was a council of roughly 300 to 600 men, mostly former magistrates, who advised the consuls and debated policy. Individually, senators disagreed constantly — on war, on taxation, on who should hold power. Collectively, though, the Senate's accumulated prestige made its advice almost impossible for any single official to ignore.",
  },
  {
    id: "how-a-bill-becomes-law",
    script:
      "A bill starts as an idea, introduced by a member of Congress. It goes to committee, where it's studied, amended, or sometimes killed outright. If it survives committee, the full chamber debates and votes on it. It then has to pass the other chamber too. Finally, it goes to the President, who can sign it into law or veto it and send it back.",
  },
  {
    id: "election-day",
    script:
      "On election day, voters across the country head to their local polling places. Each voter checks in, receives a ballot, and marks their choices in private. Poll workers then collect and count the ballots, and results are reported up through local, state, and federal officials until a final tally is announced.",
  },
  {
    id: "public-trust-crisis",
    script:
      "When a major scandal breaks, public trust in government can collapse almost overnight. Citizens who once assumed officials were acting in good faith suddenly demand accountability. Judges, officers, and elected representatives all find themselves under scrutiny at once, each institution forced to prove it still deserves the public's confidence.",
  },
  {
    id: "checks-and-balances",
    script:
      "The framers of the Constitution split government power into three branches specifically so no single branch could dominate the others. The legislative branch writes the laws. The executive branch enforces them. The judicial branch interprets them. Each branch can check the others — Congress can override a veto, the President appoints judges, and courts can strike down unconstitutional laws.",
  },
];

async function main() {
  console.log(`Running WS5 pressure test: ${TOPICS.length} topics through the scene planner.\n`);
  let totalCost = 0;

  for (const topic of TOPICS) {
    try {
      const result = await planScenesFromScript(topic.script);
      totalCost += result.costUsd;

      const summary = result.actions.map((a) => {
        if (a.type === "sketchDiagram" && a.sketchDiagram) {
          return `sketchDiagram(${a.sketchDiagram.diagramType ?? "pyramid"})`;
        }
        if (a.type === "composition" && a.composition) {
          return `composition(${a.composition.templateId}${a.composition.dividerStyle ? `, divider=${a.composition.dividerStyle}` : ""})`;
        }
        return a.type;
      });

      console.log(`--- ${topic.id} --- ($${result.costUsd.toFixed(4)}, ${result.actions.length} actions)`);
      console.log(`  ${summary.join(" -> ")}`);

      // Flag anything worth a human look: an assetId reference (worth
      // checking it's a real library id), or a composition/sketchDiagram
      // action, since those are exactly what this pressure test exists to
      // review — plain typographic actions are low-risk by construction.
      for (const a of result.actions) {
        if (a.assetId) console.log(`    action "${a.id}" assetId: ${a.assetId}`);
        if (a.sketchDiagram?.leftCharacterAssetId) console.log(`    sketchDiagram leftCharacterAssetId: ${a.sketchDiagram.leftCharacterAssetId}`);
        if (a.sketchDiagram?.rightCharacterAssetId) console.log(`    sketchDiagram rightCharacterAssetId: ${a.sketchDiagram.rightCharacterAssetId}`);
        if (a.composition) {
          for (const [slotName, slot] of Object.entries(a.composition.slots)) {
            if (slot.assetId) console.log(`    composition slot "${slotName}" assetId: ${slot.assetId}`);
            if (slot.attachTo) console.log(`    composition slot "${slotName}" attachTo: ${slot.attachTo}`);
          }
        }
      }
      console.log("");
    } catch (err) {
      console.error(`--- ${topic.id} --- FAILED: ${(err as Error).message}\n`);
    }
  }

  console.log(`Total planning cost: $${totalCost.toFixed(4)}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
