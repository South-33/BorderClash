import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function readJsonl(path) {
  return readFileSync(path, "utf8").trim().split(/\r?\n/u).filter(Boolean).map(JSON.parse);
}

test("May MOU 44 chronology keeps preparation and Cabinet approval distinct", () => {
  const timeline = readJsonl("data/timeline/2026-05.jsonl");
  const may1 = timeline.find((row) => row.id === "ks70fde4yxnv5cwg9bvcaekryh8627yq");
  const falseMay4 = timeline.find((row) => row.id === "ks7b4e40xwvvt34ysasnb767h1864mm3");
  const cabinet = timeline.find((row) => row.id === "ks7bypf1k0hk69y8xpr5gesva9864c9d");
  const duplicateMay5 = timeline.find((row) => row.id === "ks7d3nh9w1tgzsh65e8g2p2nk1865r10");

  assert.ok(may1);
  assert.equal(falseMay4, undefined);
  assert.ok(cabinet);
  assert.equal(duplicateMay5, undefined);

  assert.equal(may1.date, "2026-05-01");
  assert.equal(may1.timeOfDay, undefined);
  assert.match(may1.title, /Prepares MOU 44 Cancellation Proposal/u);
  assert.match(may1.description, /planned to present it to Cabinet on May 5/u);
  assert.match(may1.description, /not the Cabinet decision itself/u);
  assert.deepEqual(may1.evidenceIds, ["js7fn80k96epsqbntqjdxt49y9863r6k"]);

  assert.equal(cabinet.date, "2026-05-05");
  assert.equal(cabinet.timeOfDay, undefined);
  assert.match(cabinet.title, /Cabinet Approves Cancellation/u);
  assert.match(cabinet.description, /domestic approval step/u);
  assert.match(cabinet.description, /international legal effect remained subsequent matters/u);
  assert.deepEqual(cabinet.evidenceIds, [
    "k977x3s72hsv06cenbjj34s1ps865hhn",
    "k97c86bdp1cjvs9d1ys6wqx8418650g8",
    "k973tpvjdjssrgeb4xgs13f1m58654gd",
  ]);
});

test("Cambodia response distinguishes announcement, diplomatic note, and briefing", () => {
  const timeline = readJsonl("data/timeline/2026-05.jsonl");
  const announced = timeline.find((row) => row.id === "ks70ng1rdk21m22x2xav92b0958658f6");
  const note = timeline.find((row) => row.id === "ks73k49h7x2v87cy6qy5ccxxjx86d7hg");
  const briefing = timeline.find((row) => row.id === "ks776dqxq6b1nca8ex9ve30vcx86be50");

  assert.ok(announced);
  assert.ok(note);
  assert.ok(briefing);

  assert.equal(announced.date, "2026-05-05");
  assert.equal(announced.timeOfDay, undefined);
  assert.match(announced.title, /Announces UNCLOS Conciliation Response/u);
  assert.match(announced.description, /formal diplomatic note initiating the process followed on May 6/u);
  assert.deepEqual(announced.evidenceIds, [
    "k977964gsx3wcn7pc6hd0fcg4x8648wf",
    "jn700a8tjaj1apys0gzprm61bh864wxp",
  ]);

  assert.equal(note.date, "2026-05-06");
  assert.equal(note.timeOfDay, undefined);
  assert.match(note.title, /May 6 UNCLOS Conciliation Note/u);
  assert.match(note.description, /diplomatic note on May 6 initiating compulsory conciliation/u);

  assert.equal(briefing.date, "2026-05-06");
  assert.equal(briefing.timeOfDay, undefined);
  assert.match(briefing.title, /Briefs Diplomats/u);
  assert.match(briefing.description, /foreign diplomats and international organizations/u);
});

test("May 12 Hun Manet statement remains a later parliamentary policy position", () => {
  const event = readJsonl("data/timeline/2026-05.jsonl")
    .find((row) => row.id === "ks7ccgb5zbcrkmpqkmgwwbfw2d86zs1z");
  const article = readJsonl("data/news/2026-05.jsonl")
    .find((row) => row.id === "k974mxpcdzqhs6v0abv0t0c1d586zt0r");

  assert.ok(event);
  assert.ok(article);
  assert.equal(event.date, "2026-05-12");
  assert.equal(event.timeOfDay, undefined);
  assert.match(event.title, /Rejects New Bilateral Maritime Framework/u);
  assert.match(event.description, /On May 12/u);
  assert.match(event.description, /compulsory conciliation under UNCLOS/u);
  assert.match(article.summary, /On May 12/u);
  assert.match(article.summary, /Thailand's May 5 Cabinet decision/u);
});

test("canonical May evidence summaries preserve the legal sequence dates", () => {
  const articles = readJsonl("data/news/2026-05.jsonl");
  const may1 = articles.find((row) => row.id === "js7fn80k96epsqbntqjdxt49y9863r6k");
  const cabinet = articles.find((row) => row.id === "k977x3s72hsv06cenbjj34s1ps865hhn");
  const response = articles.find((row) => row.id === "k977964gsx3wcn7pc6hd0fcg4x8648wf");
  const note = articles.find((row) => row.id === "jn7a2a6jhdpjr2545p4bzb4c5s86dqk5");
  const briefing = articles.find((row) => row.id === "jn7fyase1r4nkg8kb1pwp5ngmx86acbg");

  assert.ok(may1);
  assert.ok(cabinet);
  assert.ok(response);
  assert.ok(note);
  assert.ok(briefing);
  assert.match(may1.summary, /On May 1/u);
  assert.match(cabinet.summary, /On May 5/u);
  assert.match(response.summary, /On May 5/u);
  assert.match(note.summary, /diplomatic note on May 6/u);
  assert.match(briefing.summary, /On May 6/u);
});
