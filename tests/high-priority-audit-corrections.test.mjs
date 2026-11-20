import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function readJsonl(path) {
  return readFileSync(path, "utf8").trim().split(/\r?\n/u).filter(Boolean).map(JSON.parse);
}

test("US ceasefire endorsement uses relevant Rubio and Trump evidence without invented time", () => {
  const event = readJsonl("data/timeline/2025-12.jsonl")
    .find((row) => row.id === "ks701szj24kvcznt3nm2e59f8s8130jt");
  assert.ok(event);
  assert.equal(event.date, "2025-12-28");
  assert.equal(event.timeOfDay, undefined);
  assert.deepEqual(event.evidenceIds, [
    "jn76am6jkkznh2pk1g1qvkrk6d7y73bf",
    "00c8228f08cc7011b75c236a2691760f",
  ]);
  assert.match(event.description, /Marco Rubio/u);
  assert.match(event.description, /President Donald Trump/u);
  assert.doesNotMatch(event.evidenceIds.join(" "), /js77v5p23br196tsthf3wbfxr97yws6t/u);
});

test("ASEAN special meeting stays date-only and separates official action from analysis", () => {
  const event = readJsonl("data/timeline/2025-12.jsonl")
    .find((row) => row.id === "ks70d6277d7x3wsjdgb71xvt7s812ms2");
  assert.ok(event);
  assert.equal(event.date, "2025-12-22");
  assert.equal(event.timeOfDay, undefined);
  assert.match(event.title, /ASEAN Special Meeting/u);
  assert.match(event.description, /end to hostilities/u);
  assert.match(event.description, /trust deficit/u);
  assert.deepEqual(event.evidenceIds, [
    "k97dne5mx8mcw6q94rzxkznr6d7xwsfx",
    "k975814r2my0jt3ev8k8k8kefs7y0kqa",
  ]);
});

test("Thai civilian casualty snapshot stays date-only when the source gives no exact time", () => {
  const event = readJsonl("data/timeline/2025-12.jsonl")
    .find((row) => row.id === "ks709zh778q8h49n6rd2rw01yn8123hs");
  assert.ok(event);
  assert.equal(event.date, "2025-12-23");
  assert.equal(event.timeOfDay, undefined);
  assert.match(event.description, /42 civilian deaths/u);
  assert.match(event.description, /18 hospitals/u);
  assert.deepEqual(event.evidenceIds, ["js7dd0gn7ypzj7pbz384z9ya6x7xt2g4"]);
});

test("Cambodia border suspension stays date-only and scoped to land crossings", () => {
  const event = readJsonl("data/timeline/2025-12.jsonl")
    .find((row) => row.id === "ks70ykm28v7hk1cpvt2c5j1ybd813ykf");
  assert.ok(event);
  assert.equal(event.date, "2025-12-13");
  assert.equal(event.timeOfDay, undefined);
  assert.match(event.title, /Land Border Crossings/u);
  assert.match(event.description, /all land entry and exit/u);
  assert.match(event.description, /Cambodian authorities attributed to Thailand/u);
});

test("Thailand Laos fuel restriction stays date-only and avoids unsupported encirclement analysis", () => {
  const event = readJsonl("data/timeline/2025-12.jsonl")
    .find((row) => row.id === "ks70t5vc0pm4y1sx3h5ccjv16d812a0v");
  assert.ok(event);
  assert.equal(event.date, "2025-12-15");
  assert.equal(event.timeOfDay, undefined);
  assert.match(event.description, /Chong Mek border crossing/u);
  assert.match(event.description, /diverted to Cambodian troops/u);
  assert.match(event.description, /not intended to harm Laos/u);
  assert.doesNotMatch(event.description, /encircle|energy supply lines|economic pressure/iu);
});

test("Battambang shelling stays date-only when the cited report gives no exact time", () => {
  const event = readJsonl("data/timeline/2025-12.jsonl")
    .find((row) => row.id === "ks70dqarxdth73erdvx68295yx812mdr");
  assert.ok(event);
  assert.equal(event.date, "2025-12-16");
  assert.equal(event.timeOfDay, undefined);
  assert.match(event.description, /Battambang province/u);
  assert.match(event.description, /pagodas/u);
});

test("Poipet strike is kept separate from the broader scam-war framing", () => {
  const event = readJsonl("data/timeline/2025-12.jsonl")
    .find((row) => row.id === "ks70rz0v55yvwhx6g782w165cx813w2s");
  assert.ok(event);
  assert.equal(event.date, "2025-12-18");
  assert.equal(event.timeOfDay, undefined);
  assert.match(event.title, /Poipet/u);
  assert.match(event.description, /logistics centre used to store rockets/u);
  assert.match(event.description, /two civilians/u);
  assert.doesNotMatch(event.title + " " + event.description, /scam army|war on scammers/iu);
  assert.deepEqual(event.evidenceIds, [
    "k97b5whmp0wwj5dfg08bh8yfd97xh09z",
    "k97fh2nbvnm7p9mp59gxq5n6b57xhcsp",
    "k97bt3tmnhdprf2espfpqmv6ms7xqsba",
  ]);
});

test("December 13 Malaysia record distinguishes a ceasefire proposal from an agreement", () => {
  const event = readJsonl("data/timeline/2025-12.jsonl")
    .find((row) => row.id === "ks7bxh7jd55gvct7v3araghx9h812yab");
  assert.ok(event);
  assert.equal(event.date, "2025-12-13");
  assert.equal(event.timeOfDay, undefined);
  assert.match(event.title, /Proposes 22:00 Halt/u);
  assert.match(event.description, /urged Thailand and Cambodia to halt hostilities/u);
  assert.match(event.description, /no ceasefire agreement existed/u);
  assert.doesNotMatch(event.description, /negotiated a ceasefire/u);
  assert.deepEqual(event.evidenceIds, [
    "jn7epg7zmw5sc9fanncc5xm9ws7x7cmr",
    "k974bxkrf58x82wkrpfeygm2d97x6y87",
  ]);
});

test("Thai dissolution and February 8 election scheduling stay on their actual dates", () => {
  const timeline = readJsonl("data/timeline/2025-12.jsonl");
  const dissolution = timeline.find((row) => row.id === "ks79d5qgqwqw2cfe7867n70sv58131dt");
  const scheduling = timeline.find((row) => row.id === "5b8f832bf19c78522ed25ed308d39483");
  assert.ok(dissolution);
  assert.equal(dissolution.date, "2025-12-12");
  assert.equal(dissolution.timeOfDay, undefined);
  assert.match(dissolution.title, /Parliament Dissolved/u);
  assert.doesNotMatch(dissolution.title, /Feb 8/u);
  assert.doesNotMatch(dissolution.description, /officially scheduled for February 8/u);
  assert.ok(scheduling);
  assert.equal(scheduling.date, "2025-12-15");
  assert.equal(scheduling.timeOfDay, undefined);
  assert.equal(scheduling.importance, 70);
  assert.match(scheduling.title, /February 8 General Election/u);
  assert.deepEqual(scheduling.evidenceIds, ["0f9979137045fcf1759b7ff5981e85c9"]);
});

test("February 8 scheduling evidence preserves Reuters provenance and publisher time", () => {
  const article = readJsonl("data/news/2025-12.jsonl")
    .find((row) => row.id === "0f9979137045fcf1759b7ff5981e85c9");
  assert.ok(article);
  assert.equal(article.source, "Reuters / Channel News Asia");
  assert.equal(article.publishedAt, 1765792920000);
  assert.equal(article.provenanceId, "wire:reuters-thailand-election-2025-12-15");
  assert.equal(article.sourceUrl, "https://www.channelnewsasia.com/asia/thailand-election-feb-8-polls-pm-anutin-charnvirakul-cambodia-border-conflict-5583491");
});

test("US December 21 statement stays date-only when no exact issue time is supplied", () => {
  const event = readJsonl("data/timeline/2025-12.jsonl")
    .find((row) => row.id === "ks70ty4wbkwmm4q7b7ca6hjyvs812q56");
  assert.ok(event);
  assert.equal(event.date, "2025-12-21");
  assert.equal(event.timeOfDay, undefined);
  assert.match(event.description, /withdraw heavy weapons/u);
  assert.match(event.description, /landmines/u);
});

test("Hun Manet satellite proposal does not invent Malaysian or ASEAN backing", () => {
  const event = readJsonl("data/timeline/2025-12.jsonl")
    .find((row) => row.id === "ks718qww5a6jnd1x0mgv9k142181220g");
  assert.ok(event);
  assert.equal(event.date, "2025-12-13");
  assert.equal(event.timeOfDay, undefined);
  assert.match(event.title, /Hun Manet/u);
  assert.match(event.description, /independent investigation/u);
  assert.doesNotMatch(`${event.title} ${event.description}`, /Malaysia|Anwar|ASEAN/iu);
  assert.deepEqual(event.evidenceIds, ["jnceabbb6b5608ffc802804ae216fb48"]);
});

test("China trilateral-talks record stays date-only and names the correct conflict in Thai", () => {
  const event = readJsonl("data/timeline/2025-12.jsonl")
    .find((row) => row.id === "ks71eaf0n90d5ebf3syb8ezt1s813rn0");
  assert.ok(event);
  assert.equal(event.date, "2025-12-27");
  assert.equal(event.timeOfDay, undefined);
  assert.match(event.titleTh, /\u0e44\u0e17\u0e22-\u0e01\u0e31\u0e21\u0e1e\u0e39\u0e0a\u0e32/u);
  assert.doesNotMatch(event.titleTh, /\u0e14\u0e31\u0e1a\u0e44\u0e1f\u0e43\u0e15\u0e49/u);
  assert.match(event.description, /December 28-29/u);
});

test("Anutin televised address keeps the source-supported noon time and bounded military wording", () => {
  const event = readJsonl("data/timeline/2025-12.jsonl")
    .find((row) => row.id === "ks71g1pmnvanxfga6f8fy7sm918131cm");
  const article = readJsonl("data/news/2025-12.jsonl")
    .find((row) => row.id === "js79zn19ebdm2rh4wvmd57fscn7xenaj");
  assert.ok(event);
  assert.ok(article);
  assert.equal(event.date, "2025-12-08");
  assert.equal(event.timeOfDay, "12:00");
  assert.match(event.description, /as circumstances required/u);
  assert.match(event.description, /claimed Thailand had not initiated or invaded/u);
  assert.doesNotMatch(event.description, /all military power|all military means/iu);
  assert.match(article.summary, /At 12:00 on December 8/u);
  assert.match(article.summary, /as circumstances required/u);
});

test("combined Dec 16 humanitarian snapshot stays date-only across differently timed reports", () => {
  const event = readJsonl("data/timeline/2025-12.jsonl")
    .find((row) => row.id === "ks71f620s2qsehka5v4q05n185812pb6");
  assert.ok(event);
  assert.equal(event.date, "2025-12-16");
  assert.equal(event.timeOfDay, undefined);
  assert.match(event.description, /16 civilian deaths/u);
  assert.match(event.description, /423,715 people displaced/u);
  assert.deepEqual(event.evidenceIds, [
    "js74mffpwspx7rjwbpkgszpa8x7xc2bm",
    "k97ajbydhy6rt3tdye5rjdrd7x7xegpp",
    "js78cwyh47jq5xwnbbf6kkgtdx7xdkzy",
    "js768ajhpvvhvff7bf2gzjszpd7xcgm5",
    "jn79rq95c01q873hzhp2wry7ns7xdy33",
  ]);
});

test("Rubio ceasefire push is dated to his Dec 19 statement and remains an expectation", () => {
  const event = readJsonl("data/timeline/2025-12.jsonl")
    .find((row) => row.id === "ks721d0wf7fmm88q3scpr8daex812f48");
  assert.ok(event);
  assert.equal(event.date, "2025-12-19");
  assert.equal(event.timeOfDay, undefined);
  assert.match(event.title, /Hopes for Ceasefire Progress/u);
  assert.match(event.description, /hoped for progress/u);
  assert.doesNotMatch(event.description, /confirmed.*agreement/iu);
  assert.deepEqual(event.evidenceIds, [
    "js7c3k0dt1yvvjf00mqdz3k5s57xpacb",
    "js728svdf72gv5r73dfqjp9m817xnbgt",
  ]);
});

test("Anutin ceasefire rejection and prisoner-release stance stay as separate dated events", () => {
  const timeline = readJsonl("data/timeline/2025-12.jsonl");
  const anutin = timeline.find((row) => row.id === "ks73cpyb4yz0cv1prvqznbm3ns813h0y");
  const prisoners = timeline.find((row) => row.id === "99035a5b0fb579984045e36c7caaa9a9");
  assert.ok(anutin);
  assert.ok(prisoners);
  assert.equal(anutin.date, "2025-12-13");
  assert.equal(anutin.timeOfDay, undefined);
  assert.match(anutin.title, /No Ceasefire Agreement/u);
  assert.doesNotMatch(anutin.description, /18 Cambodian soldiers|mine-laying|BM-21/iu);
  assert.deepEqual(anutin.evidenceIds, ["js79k1n386qd6zhbcmt5af2at97x8yph"]);

  assert.equal(prisoners.date, "2025-12-14");
  assert.equal(prisoners.timeOfDay, undefined);
  assert.match(prisoners.title, /18 Cambodian Soldiers/u);
  assert.match(prisoners.description, /ending hostile actions/u);
  assert.match(prisoners.description, /mine-laying/u);
  assert.match(prisoners.description, /BM-21/u);
  assert.deepEqual(prisoners.evidenceIds, ["js78p9vwvn58thnnx2n8e5wgk17x8f2h"]);
});

test("Thai 90% control claim stays attributed, scoped, and date-only", () => {
  const event = readJsonl("data/timeline/2025-12.jsonl")
    .find((row) => row.id === "ks73ge0fg9hemts69936t2fpe98136bw");
  const article = readJsonl("data/news/2025-12.jsonl")
    .find((row) => row.id === "js7fa5sbkwn2fx0wz0k1r5ppjh7xy0va");
  assert.ok(event);
  assert.ok(article);
  assert.equal(event.date, "2025-12-25");
  assert.equal(event.timeOfDay, undefined);
  assert.match(event.title, /Claims 90% Progress/u);
  assert.match(event.description, /areas Thailand regards as its sovereign territory/u);
  assert.doesNotMatch(event.description, /90% of previously contested border territory/iu);
  assert.doesNotMatch(event.description, /only agree to a ceasefire.*stockpiling/iu);
  assert.match(article.summary, /Cambodia should declare a ceasefire first/u);
  assert.match(article.summary, /without making removal of those weapons a stated precondition/u);
});

test("Dec 12 Hill 677 row stays a coherent control update instead of mixing older casualty and gas claims", () => {
  const event = readJsonl("data/timeline/2025-12.jsonl")
    .find((row) => row.id === "ks73prp6p3ahqcfr9dftzsps3h812b9n");
  assert.ok(event);
  assert.equal(event.date, "2025-12-12");
  assert.equal(event.timeOfDay, undefined);
  assert.match(event.title, /Hill 677 and Ban Nong Ya Kaeo/u);
  assert.match(event.description, /Thai military briefings/u);
  assert.doesNotMatch(event.description, /102|chemical|toxic/iu);
  assert.deepEqual(event.evidenceIds, [
    "jnf1d6f6a9e6579b0d9265f0fdf8cf5c",
    "js7ekp1q8gwjsq682fwhtd315x7x4dsj",
  ]);
});

test("Trat martial-law update stays date-only and keeps battlefield claims attributed", () => {
  const event = readJsonl("data/timeline/2025-12.jsonl")
    .find((row) => row.id === "ks73qneqtz0mc4pr1mn1abwxf1813300");
  assert.ok(event);
  assert.equal(event.date, "2025-12-14");
  assert.equal(event.timeOfDay, undefined);
  assert.match(event.description, /martial law and a curfew/u);
  assert.match(event.description, /Thai Navy said marines had recaptured most of Ban Sam Lang and Ban Nong Ree/u);
  assert.match(event.description, /Cambodia's Defence Ministry denied Thai claims/u);
  assert.doesNotMatch(event.description, /had recaptured most of Ban Sam Lang, while Cambodia/iu);
});

test("Deng Xijun meeting is anchored to Dec 19 and does not invent a Thai-attack condition", () => {
  const event = readJsonl("data/timeline/2025-12.jsonl")
    .find((row) => row.id === "ks73vpmk92mhg37g26q8z7vwfs813rt8");
  assert.ok(event);
  assert.equal(event.date, "2025-12-19");
  assert.equal(event.timeOfDay, undefined);
  assert.match(event.description, /met Prime Minister Hun Manet/u);
  assert.match(event.description, /immediate ceasefire and peaceful dialogue/u);
  assert.doesNotMatch(event.description, /provided Thai attacks cease/iu);
  assert.deepEqual(event.evidenceIds, [
    "jn7b7q2g3rg8ht4wnny57b8dp97xm7b7",
    "k97fbs9c5r3mccfn6bz8n07veh7xts2s",
  ]);
});
