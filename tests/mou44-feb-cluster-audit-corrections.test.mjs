import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function readJsonl(path) {
  return readFileSync(path, "utf8").trim().split(/\r?\n/u).filter(Boolean).map(JSON.parse);
}

test("February MOU 44 chronology keeps preparation, legal study, and pledge stages distinct", () => {
  const timeline = readJsonl("data/timeline/2026-02.jsonl");
  const feb9 = timeline.find((row) => row.id === "ks787k5t29cc2xksq5zaz7zmrs817c8g");
  const duplicate = timeline.find((row) => row.id === "ks7fbj2yzxtz05v8dxysqajy4d813z9c");
  const feb10 = timeline.find((row) => row.id === "ks713gyz618q8bhf5at9zaffps8167vr");
  const feb12 = timeline.find((row) => row.id === "ks7f631tsyxgsswgxb03ah0b51813tdj");
  const feb16 = timeline.find((row) => row.id === "ks7e85q372fs7zx58nfk7bdgfd81qwey");

  assert.ok(feb9);
  assert.equal(duplicate, undefined);
  assert.ok(feb10);
  assert.ok(feb12);
  assert.ok(feb16);

  assert.equal(feb9.date, "2026-02-09");
  assert.equal(feb9.timeOfDay, undefined);
  assert.match(feb9.title, /Prepare MOU 44 Cancellation/u);
  assert.match(feb9.description, /had not yet been legally terminated/u);
  assert.deepEqual(feb9.evidenceIds, ["k972xn7aj1fznnkefc4ch6jatx816tqr"]);

  assert.equal(feb10.date, "2026-02-10");
  assert.equal(feb10.timeOfDay, undefined);
  assert.match(feb10.title, /Legal Study/u);
  assert.match(feb10.description, /proper legal process/u);
  assert.match(feb10.description, /set zero/u);
  assert.deepEqual(feb10.evidenceIds, [
    "js75k1yhqj1yfxkrp3k84bpve980y6sz",
    "k9741n0y9bs31dsmrf0tcf36yx8175yn",
    "js71m8ccc9an8hky64hf57qp3s80zm66",
  ]);

  assert.equal(feb12.date, "2026-02-12");
  assert.equal(feb12.timeOfDay, undefined);
  assert.match(feb12.description, /Cabinet resolution without parliamentary approval/u);
  assert.match(feb12.description, /not an announcement that cancellation had already occurred/u);
  assert.equal(feb12.importance, 70);

  assert.equal(feb16.date, "2026-02-16");
  assert.equal(feb16.timeOfDay, undefined);
  assert.match(feb16.title, /Reaffirms MOU 44 Cancellation Pledge/u);
  assert.match(feb16.description, /not mean the agreement had already been legally terminated/u);
  assert.equal(feb16.importance, 65);
});

test("February 12 fishing incident is not mislabeled as MOU 44 suspension", () => {
  const event = readJsonl("data/timeline/2026-02.jsonl")
    .find((row) => row.id === "ks76qf1m2hejn67h7vnhhhv1tn8183fm");
  const article = readJsonl("data/news/2026-02.jsonl")
    .find((row) => row.id === "k97926d073ed7982dx02hbenfd819y08");

  assert.ok(event);
  assert.ok(article);
  assert.equal(event.date, "2026-02-12");
  assert.equal(event.timeOfDay, undefined);
  assert.match(event.title, /Fishing-Vessel Incursions Near Koh Kut/u);
  assert.match(event.description, /on February 9 and again on February 12/u);
  assert.match(event.description, /attributed to Thai sources/u);
  assert.doesNotMatch(`${event.title} ${event.description}`, /suspend|terminate MOU 44/iu);
  assert.deepEqual(event.evidenceIds, ["k97926d073ed7982dx02hbenfd819y08"]);
  assert.equal(event.importance, 68);
  assert.equal(article.credibility, 60);
  assert.match(article.summary, /citing Thai naval reporting/u);
  assert.match(article.summary, /did not report a formal suspension or termination of MOU 44/u);
});

test("February source metadata preserves the actual reporting dates", () => {
  const articles = readJsonl("data/news/2026-02.jsonl");
  const thaiPbs = articles.find((row) => row.id === "js7b56v814c27yvzmrk03yrggd81p7d5");
  const cabinetStudy = articles.find((row) => row.id === "js75k1yhqj1yfxkrp3k84bpve980y6sz");
  const postToday = articles.find((row) => row.id === "js71m8ccc9an8hky64hf57qp3s80zm66");
  const dailyNews = articles.find((row) => row.id === "js7262mvapnjev807tbes35s8d813tfa");

  assert.ok(thaiPbs);
  assert.ok(cabinetStudy);
  assert.ok(postToday);
  assert.ok(dailyNews);
  assert.equal(
    new Date(thaiPbs.publishedAt + 7 * 60 * 60 * 1000).toISOString().slice(0, 16),
    "2026-02-17T14:29",
  );
  assert.match(thaiPbs.summary, /posted on February 16/u);
  assert.match(thaiPbs.summary, /did not report that MOU 44 had already been legally terminated/u);
  assert.equal(cabinetStudy.category, "political");
  assert.equal(
    new Date(cabinetStudy.publishedAt + 7 * 60 * 60 * 1000).toISOString().slice(0, 16),
    "2026-02-10T15:28",
  );
  assert.match(cabinetStudy.summary, /first Cabinet meeting after the February 8 election, on February 10/u);
  assert.match(cabinetStudy.summary, /proper legal process/u);
  assert.equal(
    new Date(postToday.publishedAt + 7 * 60 * 60 * 1000).toISOString().slice(0, 10),
    "2026-02-10",
  );
  assert.match(postToday.summary, /On February 10/u);
  assert.match(postToday.summary, /not immediate/u);
  assert.equal(
    new Date(dailyNews.publishedAt + 7 * 60 * 60 * 1000).toISOString().slice(0, 16),
    "2026-02-12T14:37",
  );
});

test("February 28 PHL-03 warning is separate from MOU 44 analysis", () => {
  const timeline = readJsonl("data/timeline/2026-02.jsonl");
  const articles = readJsonl("data/news/2026-02.jsonl");
  const event = timeline.find((row) => row.id === "ks7af24059rhy1e6s2pfng0tw9827ffy");
  const warning = articles.find((row) => row.id === "4395f72e956ea87a3cdbf710a944a02f");
  const analysis = articles.find((row) => row.id === "js7f04wabgeztmbz35zemmh1fh8276qp");

  assert.ok(event);
  assert.ok(warning);
  assert.ok(analysis);
  assert.equal(event.date, "2026-02-28");
  assert.equal(event.timeOfDay, undefined);
  assert.match(event.title, /PHL-03/u);
  assert.match(event.description, /detected no PHL-03 movement/u);
  assert.match(event.description, /February 27 landmine incident/u);
  assert.deepEqual(event.evidenceIds, ["4395f72e956ea87a3cdbf710a944a02f"]);
  assert.doesNotMatch(`${event.title} ${event.description}`, /MOU 44/iu);
  assert.match(warning.summary, /On February 28/u);
  assert.match(analysis.summary, /analysis warning/u);
  assert.match(analysis.summary, /did not report the separate Royal Thai Army PHL-03/u);
  assert.equal(
    new Date(analysis.publishedAt + 7 * 60 * 60 * 1000).toISOString().slice(0, 10),
    "2026-02-28",
  );
});
