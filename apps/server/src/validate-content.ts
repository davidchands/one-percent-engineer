/**
 * Content quality gate. Run: pnpm validate:content
 *
 * A challenge is only trustworthy if its tests can tell right from wrong. For every challenge:
 *   1. challenge.yaml matches the schema and references real skills (done by loadContent)
 *   2. the reference solution passes ALL public + hidden tests
 *   3. the starter code FAILS (otherwise there's nothing to do)
 *   4. every plausible wrong solution in wrong/ fails at least one test
 *      (this proves the hidden tests actually catch the common mistakes)
 *
 * AI-generated challenges (M6) will go through exactly this gate before you ever see them.
 */
import { loadContent } from "./content.ts";
import { runTests } from "./runner.ts";

const content = loadContent();
let problems = 0;
const fail = (id: string, msg: string) => {
  problems++;
  console.log(`  ✗ ${id}: ${msg}`);
};

console.log(`Validating ${content.skills.size} skills and ${content.challenges.size} challenges…\n`);

for (const ch of content.challenges.values()) {
  const suites = { publicTests: ch.publicTests, hiddenTests: ch.hiddenTests };
  const id = ch.meta.id;
  const problemsBefore = problems;

  const ref = await runTests(ch.solution, suites);
  if (ref.failed > 0 || ref.passed === 0) {
    fail(id, `reference solution fails: ${ref.cases.filter((c) => !c.passed).map((c) => c.name).join(", ")}`);
  }
  if (!ref.cases.some((c) => c.hidden)) fail(id, "no hidden tests");

  const starter = await runTests(ch.starter, suites);
  if (starter.failed === 0) fail(id, "starter code already passes every test");

  if (ch.wrongSolutions.length === 0) fail(id, "no wrong/ solutions: can't prove the tests discriminate");
  for (const w of ch.wrongSolutions) {
    const r = await runTests(w.code, suites);
    if (r.failed === 0) fail(id, `wrong/${w.name} passes every test: the tests miss this mistake`);
  }

  if (ch.meta.hints.length < 3) fail(id, "needs at least 3 progressive hints");
  console.log(`  ${problems > problemsBefore ? "·" : "✓"} ${id}  (${ref.passed} tests, ${ch.wrongSolutions.length} wrong solutions caught)`);
}

console.log(problems ? `\n${problems} problem(s) found.` : "\nAll content valid.");
process.exit(problems ? 1 : 0);
