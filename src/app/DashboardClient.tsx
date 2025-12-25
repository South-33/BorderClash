'use client';

import { useState, useEffect, useRef, useLayoutEffect, useMemo, useCallback } from 'react';
import { useQuery, useMutation, useConvex } from 'convex/react';
import { FunctionReference } from 'convex/server';
import { api } from '../../convex/_generated/api';
import { Swords, Handshake, Heart, Landmark, Circle } from 'lucide-react';
import type { BorderClashData } from '@/lib/convex-server';

// --- Icon Components ---
const IconBase = ({ children, className = "", ...props }: any) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    {...props}
  >
    {children}
  </svg>
);

const Crosshair = (props: any) => (
  <IconBase {...props}>
    <circle cx="12" cy="12" r="10" />
    <line x1="22" y1="12" x2="18" y2="12" />
    <line x1="22" y1="12" x2="18" y2="12" />
    <line x1="6" y1="12" x2="2" y2="12" />
    <line x1="12" y1="6" x2="12" y2="2" />
    <line x1="12" y1="22" x2="12" y2="18" />
  </IconBase>
);

const XIcon = (props: any) => (
  <IconBase {...props}>
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </IconBase>
);


const RefreshCw = (props: any) => (
  <IconBase {...props}>
    <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
    <path d="M3 3v5h5" />
    <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" />
    <path d="M16 21h5v-5" />
  </IconBase>
);

const Terminal = (props: any) => (
  <IconBase {...props}>
    <polyline points="4 17 10 11 4 5" />
    <line x1="12" y1="19" x2="20" y2="19" />
  </IconBase>
);

const Scale = (props: any) => (
  <IconBase {...props}>
    <path d="m16 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z" />
    <path d="m2 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z" />
    <path d="M7 21h10" />
    <path d="M12 3v18" />
    <path d="M3 7h2c2 0 5-1 7-2 2 1 5 2 7 2h2" />
  </IconBase>
);

const CheckCircle = (props: any) => (
  <IconBase {...props}>
    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
    <polyline points="22 4 12 14.01 9 11.01" />
  </IconBase>
);

// --- Category Icons ---
const categoryIcons: Record<string, string> = {
  military: '🎖️',
  political: '🏛️',
  humanitarian: '❤️',
  diplomatic: '🤝',
};

// --- Khmer Date Constants ---
const KH_MONTHS = [
  "មករា", "កុម្ភៈ", "មីនា", "មេសា", "ឧសភា", "មិថុនា",
  "កក្កដា", "សីហា", "កញ្ញា", "តុលា", "វិច្ឆិកា", "ធ្នូ"
];
const TH_MONTHS_SHORT = [
  "ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.",
  "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."
];

// --- Translations ---
const TRANSLATIONS = {
  en: {
    officialNarrative: "Official Narrative",
    militaryIntensity: "Military Intensity",
    peaceful: "PEACEFUL",
    defensive: "DEFENSIVE",
    aggressive: "AGGRESSIVE",
    intelligenceLog: "Intelligence Log",
    items: "items",
    noArticles: "No articles yet",
    noArticlesFiltered: "No articles in this category",
    damageAssessment: "ESTIMATED DAMAGE",
    displacedCivilians: "Displaced Civilians",
    civilianInjuries: "Civilian Injuries",
    propertyDamaged: "Property Damaged",
    status: "Status",
    confirmedOnly: "CONFIRMED ONLY",
    structures: "STRUCTURES",
    monitoring: "MONITORING",
    active: "ACTIVE",
    situationReport: "SITUATION REPORT",
    autoUpdating: "Auto-updating every 6 hours",
    keyDevelopments: "Key Developments",
    sourcesTracked: "SOURCES TRACKED",
    viewMode: "VIEW MODE",
    analysis: "ANALYSIS",
    timeline: "TIMELINE",
    losses: "LOSSES",
    guide: "GUIDE",
    language: "LANGUAGE",
    nextAutoScan: "AUTO-SCAN",
    articles: "ARTICLES",
    articlesRead: "ARTICLES READ",
    articlesFetched: "Articles Fetched",
    total: "Total",
    sectorMap: "SECTOR 4 MAP",
    clashDetected: "CLASH DETECTED",
    live: "LIVE",
    syncing: "SYNCING...",
    running: "RUNNING...",
    systemOnline: "SYSTEM ONLINE",
    error: "ERROR",
    awaitingAnalysis: "Awaiting analysis...",
    keyPoints: "Key Points",
    positive: "Positive",
    negative: "Negative",
    neutral: "Neutral",
    justNow: "Just now",
    thailand: "Thailand",
    cambodia: "Cambodia",
    neutralAI: "Neutral AI",
    intl: "International",
    credibility: "Credibility",
    subTitle: "Real-time monitoring of border tensions through multi-perspective analysis and AI-verified intelligence.",
    fatalities: "Confirmed Fatalities",
    threatLevel: "Threat Level",
    low: "LOW",
    elevated: "ELEVATED",
    critical: "CRITICAL",
    injured: "INJURED",
    civilian: "CIVILIAN",
    military: "MILITARY",
    fromLastWeek: "FROM LAST WEEK",
    lastUpdated: "Last updated",
    estimated: "ESTIMATED",
    noChange: "NO CHANGE",
    visualDamageAssessment: "VISUAL DAMAGE ASSESSMENT",
    infrastructureDamage: "INFRASTRUCTURE DAMAGE",
    buildingsDestroyed: "Buildings Destroyed",
    displacedPersons: "Displaced Persons",
    lossImagesPlaceholder: "[Images and videos would be displayed here with verified sources]",
    criticalThinkingGuide: "CRITICAL THINKING GUIDE",
    dontTrustBlindly: "DON'T TRUST BLINDLY",
    dontTrustBlindlyDesc: "Question everything. Governments have agendas. Media has biases. Verify claims independently. Cross-reference multiple sources.",
    verificationChecklist: "VERIFICATION CHECKLIST",
    checkSources: "Check multiple independent sources",
    lookForEvidence: "Look for primary evidence (photos, videos, documents)",
    considerBias: "Consider the source's potential bias",
    checkDates: "Check publication dates and context",
    emotionalManipulation: "Be skeptical of emotional manipulation",
    propagandaWarning: "PROPAGANDA WARNING SIGNS",
    propagandaWarningDesc: "Watch for: Overly emotional language. Demonization of \"the other side\". Lack of concrete evidence. Repetition without substance. Appeals to fear or patriotism over facts.",
    systemDisclaimer: "THIS SYSTEM ATTEMPTS NEUTRAL ANALYSIS BUT REMAIN CRITICAL. VERIFY EVERYTHING YOURSELF.",
    disclaimerTitle: "100% AUTOMATED SYSTEM",
    disclaimerBody: "This entire dashboard is run by AI agents with absolutely zero human intervention. It may contain errors or hallucinations. Visit the 'GUIDE' section to learn how it works.",
    incident: "INCIDENT",
    image: "IMAGE",
    sector: "SECTOR",
    all: "ALL",
    government: "GOVERNMENT",
    media: "MEDIA",
    agency: "AGENCY",
    other: "OTHER",
    guideTitle: "USER GUIDE & CRITICAL LITERACY",
    dashboardGuide: "USING THIS DASHBOARD",
    dashboardGuideDesc: "This tool aggregates conflict data from Thai, Cambodian, and International sources. The 'Neutral AI' synthesizes these perspectives to find common ground.",
    aiWarning: "WARNING: AI & DEEPFAKES",
    aiWarningDesc: "Generative AI makes it easy to create fake images and videos (Deepfakes) that look real. Never trust media based solely on its appearance.",
    deepfakeTips: "SPOTTING FALSE MEDIA",
    dfTip1: "Check for visual glitches (hands, eyes, text).",
    dfTip2: "Verify if the event is reported by reputable credible outlets.",
    dfTip3: "Use reverse image search to find the original context.",
    credibilityScore: "UNDERSTANDING CREDIBILITY",
    credibilityDesc: "Scores (0-100%) reflect source reliability and cross-verification. Scores <50% likely indicate propaganda or unverified rumors.",
    // Categories
    cat_military: "MILITARY",
    cat_diplomatic: "DIPLOMATIC",
    cat_humanitarian: "HUMANITARIAN",
    cat_political: "POLITICAL",
    // Military Posture Context
    postureGaugeTitle: "MILITARY POSTURE",
    territoryOwn: "Own Territory",
    territoryBorder: "Border Zone",
    territoryDisputed: "Disputed Area",
    territoryForeign: "Foreign Territory",
    postureRationale: "Analysis",
    // Timeline & Map
    historicalTimeline: "OPERATIONAL TIMELINE",
    noTimelineEvents: "NO INTEL LOGGED",
    runHistorian: "Run the Historian to build the timeline from news articles.",
    impact: "Impact",
    sourcesLower: "sources",
    peaceWar: "PEACE / WAR",
    thBase: "TH-BASE",
    khOutpost: "KH-OUTPOST",
    thBaseFull: "Thai Base",
    khOutpostFull: "Cambodian Outpost",
    lat: "LAT",
    lon: "LON",

    // Guide Section
    howItWorks: "HOW IT WORKS",
    curatorRole: "THE CURATOR (Scanning)",
    curatorDesc: "AI agents monitor thousands of sources across Thailand, Cambodia, and the world 24/7. They don't judge; they just collect everything related to the border conflict.",
    verifierRole: "THE VERIFIER (Fact-Checking)",
    verifierDesc: "A specialized AI reads every collected article. It checks for dead links, identifies the publisher's bias, and flags potential propaganda or emotional language.",
    historianRole: "THE HISTORIAN (Context)",
    historianDesc: "This AI looks at the bigger picture. It connects new reports to past events, building a chronological timeline operation-by-operation to show how we got here.",
    synthRole: "THE SYNTHESIZER (Synthesis)",
    synthDesc: "The final 'Neutral AI' compares conflicting narratives. If one side says 'Attack' and the other says 'Defense', it analyzes the discrepancies and produces a balanced Situation Report.",
    trustWarning: "TRUST NO ONE BLINDLY",
    trustWarningDesc: "Every government has an incentive to lie during conflict. Every news outlet has an audience to please. This dashboard is a tool, not a truth machine. Use it to compare narratives, not to validate your biases.",
    statelessApproach: "WE TAKE NO SIDES. WE TRUST NO ONE.",
    statelessDesc: "We don't believe the governments. We don't believe the media. We don't care about 'national pride'. We only care about the hard facts on the ground.",
    intelReport: "INTEL REPORT",
    date: "Date",
    category: "Category",
    topSources: "Top Sources",
    hide: "Hide",
    show: "Show",
    moreSources: "more sources",
    prev: "PREV",
    next: "NEXT",
    navHint: "Use ← → keys to navigate",
    reports: "REPORTS",
    sources: "Sources",
    paused: "PAUSED",
    aiAnalysis: "AI Analysis",
    analyzingFeeds: "Analyzing global intelligence feeds... The system is monitoring news from both Thailand and Cambodia perspectives to synthesize a balanced report.",
    events: "Events",
    // New Guide Content
    factVsPropaganda: "FACT VS PROPAGANDA",
    fact1: "Fact: Describes what happened, where, and when.",
    propaganda1: "Propaganda: Uses emotional words (hero, traitor, evil).",
    fact2: "Fact: Cites verified sources or photos.",
    propaganda2: "Propaganda: Says 'sources say' but doesn't name them.",
    understandingScores: "WHAT DO THE SCORES MEAN?",
    scoreHigh: "70-100% (High Confidence): Multiple sources agree. Likely true.",
    scoreMid: "40-69% (Unverified): Sources conflict or are vague. Be careful.",
    scoreLow: "0-39% (Rumor/Fake): Likely propaganda or fake news. Don't share.",
    whoIsTalking: "WHO IS TALKING?",
    sourceGov: "GOVT: Official statements (Usually biased/PR).",
    sourceMedia: "MEDIA: News outlets (Check who owns them).",
    sourceAgency: "AGENCY: Wire services like Reuters/AP (More neutral).",
    // Country labels
    labelKH: "KH",
    labelINTL: "INTL",
    labelTH: "TH",
  },
  th: {
    officialNarrative: "มุมมองจากทางการ",
    militaryIntensity: "สถานการณ์ความตึงเครียด",
    peaceful: "เหตุการณ์ปกติ",
    defensive: "เตรียมพร้อม/ตั้งรับ",
    aggressive: "เดือด", // Matches 'Kach' (Fierce) - Short for UI
    intelligenceLog: "ข่าวกรองล่าสุด",
    items: "รายการ",
    noArticles: "ยังไม่มีข้อมูล",
    noArticlesFiltered: "ไม่พบบทความในหมวดนี้",
    damageAssessment: "สรุปความเสียหาย", // Simplified
    displacedCivilians: "ชาวบ้านพลัดถิ่น", // Matches 'Relocated citizens' nuance
    civilianInjuries: "ชาวบ้านบาดเจ็บ",
    propertyDamaged: "ทรัพย์สินเสียหาย",
    status: "สถานะ",
    confirmedOnly: "ยืนยันแล้ว",
    structures: "สิ่งปลูกสร้าง",
    monitoring: "กำลังจับตา",
    active: "ใช้งานอยู่",
    situationReport: "รายงานสถานการณ์สด",
    autoUpdating: "อัปเดตเองทุก 6 ชั่วโมง",
    keyDevelopments: "เหตุการณ์สำคัญ",
    sourcesTracked: "แหล่งข่าวที่ติดตาม",
    viewMode: "โหมดดูข้อมูล",
    analysis: "วิเคราะห์",
    timeline: "ไทม์ไลน์",
    losses: "ความสูญเสีย",
    guide: "คู่มือ",
    language: "ภาษา",
    nextAutoScan: "สแกนรอบถัดไป",
    articles: "บทความ",
    articlesRead: "อ่านแล้ว",
    articlesFetched: "ดึงข้อมูลแล้ว",
    total: "ทั้งหมด",
    sectorMap: "แผนที่เขต 4",
    clashDetected: "พบการปะทะ",
    live: "สด",
    syncing: "กำลังซิงค์...",
    running: "กำลังทำงาน...",
    systemOnline: "ระบบพร้อมใช้งาน",
    error: "ขัดข้อง",
    awaitingAnalysis: "รอผลวิเคราะห์...",
    keyPoints: "ประเด็นที่น่าสนใจ",
    positive: "ทางบวก",
    negative: "ทางลบ",
    neutral: "เป็นกลาง",
    justNow: "เมื่อกี้",
    thailand: "ไทย",
    cambodia: "กัมพูชา",
    neutralAI: "AI ตัวกลาง",
    intl: "ตปท.",
    credibility: "ความน่าเชื่อถือ",
    subTitle: "เกาะติดชายแดนแบบเรียลไทม์ วิเคราะห์รอบด้านด้วย AI เพื่อข้อเท็จจริง ไม่ใช่อารมณ์",
    fatalities: "ผู้เสียชีวิต (ยืนยันแล้ว)",
    threatLevel: "ระดับภัยคุกคาม",
    low: "ต่ำ",
    elevated: "สูง",
    critical: "วิกฤต",
    injured: "ผู้บาดเจ็บ",
    civilian: "พลเรือน",
    military: "ทหาร",
    fromLastWeek: "จากสัปดาห์ก่อน",
    lastUpdated: "อัปเดตล่าสุด",
    estimated: "ประมาณ",
    noChange: "เท่าเดิม",
    visualDamageAssessment: "ภาพความเสียหาย",
    infrastructureDamage: "ความเสียหายโครงสร้างพื้นฐาน",
    buildingsDestroyed: "อาคารที่เสียหาย",
    displacedPersons: "ผู้อพยพ",
    lossImagesPlaceholder: "[พื้นที่แสดงภาพและคลิปที่ผ่านการตรวจสอบแล้ว]",
    criticalThinkingGuide: "คู่มือรู้ทันสื่อ",
    dontTrustBlindly: "อย่าเพิ่งเชื่อถ้าไม่ได้เช็ค",
    dontTrustBlindlyDesc: "ตั้งคำถามไว้ก่อนเสมอ รัฐบาลก็มีเกมการเมือง สื่อก็เลือกข้างได้ เช็คหลายๆ แหล่งก่อนเชื่อ",
    verificationChecklist: "เช็คลิสต์ก่อนแชร์",
    checkSources: "เช็คจากหลายสื่อที่ไม่เกี่ยวข้องกัน",
    lookForEvidence: "หาหลักฐานยืนยัน (รูป, คลิป, เอกสาร)",
    considerBias: "ดูว่าค่ายนี้เชียร์ใครเป็นพิเศษไหม",
    checkDates: "ดูวันที่ดีๆ ข่าวเก่าเล่าใหม่หรือเปล่า",
    emotionalManipulation: "ระวังข่าวที่เขียนปลุกอารมณ์โกรธ/เกลียด",
    propagandaWarning: "สัญญาณจับผิดโฆษณาชวนเชื่อ",
    propagandaWarningDesc: "ระวังโพสต์ยั่วโมโห หวังยอด Like และ Share", // Social media context
    systemDisclaimer: "ระบบนี้พยายามเป็นกลางที่สุด แต่คุณต้องใช้วิจารณญาณตัวเองด้วย",
    disclaimerTitle: "ระบบอัตโนมัติ 100%",
    disclaimerBody: "แดชบอร์ดนี้รันโดย AI ทั้งหมดโดยไม่มีคนเข้ามาแทรกแซง ข้อมูลอาจมีความผิดพลาดได้ โปรดอ่านวิธีใช้งานในหน้า 'คู่มือ'",
    incident: "เหตุการณ์",
    image: "รูปภาพ",
    sector: "เขต",
    all: "ทั้งหมด",
    government: "รัฐบาล",
    media: "สื่อ",
    agency: "สำนักข่าว",
    other: "อื่นๆ",
    guideTitle: "คู่มือใช้งาน & รู้ทันสื่อ",
    dashboardGuide: "วิธีใช้แดชบอร์ดนี้",
    dashboardGuideDesc: "เรารวมข่าวจากทั้งฝั่งไทย เขมร และสื่อโลก แล้วให้ AI ตัวกลางช่วยสรุปให้เห็นภาพรวมที่ไม่อิงฝ่ายใดฝ่ายหนึ่ง",
    aiWarning: "เตือนภัย: ระวัง AI และ Deepfakes",
    aiWarningDesc: "เดี๋ยวนี้ AI สร้างรูป/คลิปปลอม (Deepfakes) ได้เนียนมาก อย่าเชื่อสิ่งทีเห็นในเน็ตง่ายๆ",
    deepfakeTips: "วิธีจับผิดภาพปลอม",
    dfTip1: "สังเกตจุดแปลกๆ (นิ้วมือ, แววตา, ตัวหนังสือเบี้ยว)",
    dfTip2: "เช็คว่ามีสำนักข่าวหลักรายงานเรื่องนี้ไหม",
    dfTip3: "ลองเอารูปไปค้นหาต้นฉบับ (Reverse Image Search)",
    credibilityScore: "คะแนนพวกนี้บอกอะไร?", // Casual
    credibilityDesc: "คะแนน (0-100%) คือความชัวร์ของข่าว ถ้าต่ำกว่า 50% คือเสี่ยงเป็นข่าวโคมลอย หรือข่าวปั่น",
    // Categories
    cat_military: "การทหาร",
    cat_diplomatic: "การทูต",
    cat_humanitarian: "มนุษยธรรม",
    cat_political: "การเมือง",
    // Military Posture Context
    postureGaugeTitle: "ท่าทีของกองทัพ",
    territoryOwn: "ในเขตแดนตนเอง",
    territoryBorder: "พื้นที่ชายแดน",
    territoryDisputed: "พื้นที่ทับซ้อน",
    territoryForeign: "ในเขตเพื่อนบ้าน",
    postureRationale: "บทวิเคราะห์",
    // Timeline & Map
    historicalTimeline: "ลำดับเหตุการณ์ยุทธการ", // Operational Timeline
    noTimelineEvents: "ยังไม่มีรายงานข่าวกรอง",
    runHistorian: "ระบบกำลังรวบรวมข้อมูลเหตุการณ์...",
    impact: "ผลกระทบ",
    sourcesLower: "แหล่งข่าว",
    peaceWar: "สันติภาพ / สงคราม",
    thBase: "ฐานไทย",
    khOutpost: "ฐานกัมพูชา",
    thBaseFull: "ฐานทัพไทย",
    khOutpostFull: "ฐานทัพกัมพูชา",
    lat: "พิกัด",
    lon: "ลองจิจูด",

    // Guide Section
    howItWorks: "ระบบทำงานยังไง?",
    curatorRole: "THE CURATOR (คนหาข่าว)",
    curatorDesc: "ทีม AI จะคอยส่องข่าวจากทุกที่ ทั้งไทย เขมร แล้วก็สื่อโลกตลอด 24 ชั่วโมง คือเก็บหมดทุกเม็ดที่เกี่ยวกับเรื่องชายแดน ไม่เลือกข้าง",
    verifierRole: "THE VERIFIER (คนคัดกรอง)",
    verifierDesc: "พอได้ข่าวมา ตัวนี้จะคอยเช็คเลยว่าลิงก์เสียมั้ย ใครเป็นคนเขียน เชียร์ข้างไหน หรือใช้ภาษาปลุกปั่นหรือเปล่า เพื่อคัดของดีออกมา",
    historianRole: "THE HISTORIAN (คนจดบันทึก)",
    historianDesc: "ตัวนี้จะดูภาพรวม ย้อนดูอดีตว่าเมื่อก่อนเกิดอะไรขึ้นบ้าง แล้วเอาข่าวใหม่มาเรียงต่อกันเป็นไทม์ไลน์ จะได้เห็นชัดๆ ว่าเรื่องมันมายังไง",
    synthRole: "THE SYNTHESIZER (คนสรุป)",
    synthDesc: "AI ตัวสุดท้ายจะเป็นกรรมการกลาง เอาข้อมูลที่ขัดแย้งกันมาเทียบดู ถ้าฝั่งนึงบอกบุก อีกฝั่งบอกกัน ตัวนี้จะสรุปให้ว่าจริงๆ แล้วมันน่าจะเป็นยังไงกันแน่",
    trustWarning: "อย่าเชื่อใจใครง่ายๆ",
    trustWarningDesc: "เวลารบกัน รัฐบาลไหนก็อยากพูดให้ตัวเองดูดี สื่อก็ต้องเอาใจคนดู แดชบอร์ดนี้มีไว้ให้คุณเทียบข้อมูลจากหลายๆ ฝั่ง ไม่ใช่เครื่องบอกความจริงสากล",
    statelessApproach: "ไม่เข้าข้างใคร และไม่เชื่อใครทั้งนั้น",
    statelessDesc: "เราไม่สนว่าใครเป็นใคร ไม่ได้อยู่ฝั่งไทย ไม่ได้อยู่ฝั่งเขมร เราสนแค่ความจริงที่เกิดขึ้นตรงหน้าเท่านั้น",
    intelReport: "รายงานข่าวกรอง",
    date: "วันที่",
    category: "หมวดหมู่",
    topSources: "แหล่งข่าวหลัก",
    hide: "ซ่อน",
    show: "แสดง",
    moreSources: "แหล่งข่าวเพิ่มเติม",
    prev: "ก่อนหน้า",
    next: "ถัดไป",
    navHint: "ใช้ปุ่ม ← → เพื่อเปลี่ยนหน้า",
    reports: "รายงาน",
    sources: "แหล่งข่าว",
    paused: "หยุดชั่วคราว",
    aiAnalysis: "วิเคราะห์โดย AI",
    analyzingFeeds: "กำลังวิเคราะห์ข้อมูลข่าวกรองทั่วโลก... ระบบกำลังติดตามข่าวสารจากทั้งฝั่งไทยและกัมพูชาเพื่อสรุปรายงานที่สมดุล",
    events: "เหตุการณ์",
    // New Guide Content (Thai Spoken/Casual)
    factVsPropaganda: "เรื่องจริง vs ข่าวปั่น",
    fact1: "เรื่องจริง: บอกแค่เกิดอะไร ที่ไหน เมื่อไหร่ จบ",
    propaganda1: "ข่าวปั่น: ชอบใช้คําเว่อร์ๆ (ฮีโร่, คนขายชาติ, เลว)",
    fact2: "เรื่องจริง: มีรูป มีหลักฐาน อ้างที่มาชัดเจน",
    propaganda2: "ข่าวปั่น: บอกว่า 'เขาเล่าว่า' แต่ไม่บอกว่าใคร",
    understandingScores: "คะแนนพวกนี้หมายถึงอะไร?",
    scoreHigh: "70-100% (ชัวร์): หลายสื่อลงตรงกัน เชื่อได้",
    scoreMid: "40-69% (ฟังหูไว้หู): ข่าวยังไม่นิ่ง แหล่งข่าวพูดไม่ตรงกัน",
    scoreLow: "0-39% (มั่ว): ข่าวลือ ข่าวปั่น อย่าเพิ่งแชร์",
    whoIsTalking: "ใครเป็นคนพูด?",
    sourceGov: "รัฐบาล: แถลงการณ์ทางการ (มักจะอวยตัวเอง)",
    sourceMedia: "สื่อ: ข่าวทั่วไป (ต้องดูว่าเจ้าของสื่อเป็นใคร)",
    sourceAgency: "สำนักข่าวตปท.: พวก Reuters/AP (เป็นกลางกว่า)",
    // Country labels
    labelKH: "กัมพูชา",
    labelINTL: "ตปท.",
    labelTH: "ไทย",
  },
  kh: {
    officialNarrative: "គោលជំហរផ្លូវការ", // View of govt - natural
    militaryIntensity: "ស្ថានភាពនៅព្រំដែន", // Situation at border - natural
    peaceful: "ធម្មតា", // Normal
    defensive: "ការពារ", // Defend
    aggressive: "កាច", // Tense - kept short as requested
    intelligenceLog: "ព័ត៌មានថ្មីៗ", // Recent news
    items: "អត្ថបទ",
    noArticles: "មិនទាន់មានព័ត៌មាន",
    noArticlesFiltered: "មិនមានអត្ថបទក្នុងផ្នែកនេះទេ",
    damageAssessment: "ការខូចខាតសរុប", // Total damage - Simplified
    displacedCivilians: "ពលរដ្ឋដែលបានផ្លាស់​ទីលំនៅ", // Citizen relocation
    civilianInjuries: "ពលរដ្ឋរងរបួស",
    propertyDamaged: "ទ្រព្យសម្បត្តិខូចខាត",
    status: "ស្ថានភាព",
    confirmedOnly: "បានបញ្ជាក់",
    structures: "សំណង់",
    monitoring: "កំពុងមើល",
    active: "សកម្ម",
    situationReport: "របាយការណ៍សង្ខេប",
    autoUpdating: "អាប់ដេតរៀងរាល់ 6 ម៉ោង",
    keyDevelopments: "ព្រឹត្តិការណ៍សំខាន់ៗ",
    sourcesTracked: "ប្រភពព័ត៌មាន",
    viewMode: "មើលជា",
    analysis: "ការវិភាគ",
    timeline: "កាលប្បវត្តិ",
    losses: "ការខូចខាត",
    guide: "ការណែនាំ",
    language: "ភាសា",
    nextAutoScan: "ស្កេនម្តងទៀតក្នុង",
    articles: "អត្ថបទ",
    articlesRead: "អានបាន",
    articlesFetched: "ប្រមូលបាន",
    total: "សរុប",
    sectorMap: "ផែនទីតំបន់ 4",
    clashDetected: "មានការប៉ះទង្គិច",
    live: "ផ្ទាល់",
    syncing: "កំពុងអាប់ដេត...",
    running: "កំពុងដើរ...",
    systemOnline: "ដំណើរការធម្មតា",
    error: "មានបញ្ហា",
    awaitingAnalysis: "កំពុងរង់ចាំការវិភាគ...",
    keyPoints: "ចំណុចសំខាន់ៗ",
    positive: "វិជ្ជមាន", // Positive
    negative: "អវិជ្ជមាន", // Negative
    neutral: "កណ្តាល", // Middle/Neutral
    justNow: "មុននេះបន្តិច",
    thailand: "ថៃ",
    cambodia: "កម្ពុជា", // Kampuchea
    neutralAI: "AI អាជ្ញាកណ្តាល",
    intl: "អន្តរជាតិ",
    credibility: "ភាពជឿជាក់",
    subTitle: "តាមដានស្ថានការណ៍ព្រំដែនភ្លាមៗ វិភាគដោយ AI ដើម្បីដឹងការពិត មិនលំអៀង",
    fatalities: "អ្នកស្លាប់ (បញ្ជាក់ហើយ)",
    threatLevel: "កម្រិតគ្រោះថ្នាក់",
    low: "ទាប",
    elevated: "ខ្ពស់",
    critical: "ខ្លាំង",
    injured: "អ្នករបួស",
    civilian: "ពលរដ្ឋ",
    military: "ទាហាន",
    fromLastWeek: "ពីសប្តាហ៍មុន",
    lastUpdated: "អាប់ដេតចុងក្រោយ ",
    estimated: "ប៉ាន់ស្មាន",
    noChange: "នៅដដែល",
    visualDamageAssessment: "រូបភាពការខូចខាត",
    infrastructureDamage: "ការខូចខាតហេដ្ឋារចនាសម្ព័ន្ធ",
    buildingsDestroyed: "អគារដែលខូច",
    displacedPersons: "ជនភៀសខ្លួន",
    lossImagesPlaceholder: "[កន្លែងបង្ហាញរូបភាពនិងវីដេអូដែលបានត្រួតពិនិត្យ]",
    criticalThinkingGuide: "គិតមុនគូរ", // Think before believing (Idiom-like) -> "សៀវភៅណែនាំពីការគិត"
    dontTrustBlindly: "កុំអាលជឿ", // Don't believe immediately
    dontTrustBlindlyDesc: "សួរខ្លួនឯងសិន។ រដ្ឋាភិបាលមាននយោបាយ។ សារព័ត៌មានអាចលំអៀង។ ពិនិត្យមើលខ្លួនឯងសិន។",
    verificationChecklist: "អ្វីដែលត្រូវធ្វើមុនជឿ",
    checkSources: "មើលប្រភពផ្សេងៗគ្នា",
    lookForEvidence: "រកមើលភស្តុតាង (រូបភាព, វីដេអូ)",
    considerBias: "តើគេឈរខាងណា?",
    checkDates: "មើលកាលបរិច្ឆេទ ក្រែងលោរឿងចាស់",
    emotionalManipulation: "ប្រយ័ត្នព័ត៌មានដែលធ្វើឱ្យខឹងឬស្អប់",
    propagandaWarning: "សញ្ញានៃការឃោសនា",
    propagandaWarningDesc: "សង្ស័យការបង្ហោះដែលបង្កកំហឹង ដើម្បីទាក់ទាញ like និង share",
    systemDisclaimer: "ប្រព័ន្ធនេះព្យាយាមនៅកណ្តាល ប៉ុន្តែអ្នកត្រូវគិតពិចារណាដោយខ្លួនឯង។",
    disclaimerTitle: "ប្រព័ន្ធស្វ័យប្រវត្តិ 100%",
    disclaimerBody: "ផ្ទាំងព័ត៌មាននេះដំណើរការដោយ AI ទាំងស្រុង គ្មានមនុស្សគ្រប់គ្រងទេ។ វាអាចមានកំហុសខ្លះ។ សូមអានបន្ថែមនៅក្នុងផ្នែក 'ការណែនាំ'។",
    incident: "ហេតុការណ៍",
    image: "រូបភាព",
    sector: "តំបន់",
    all: "ទាំងអស់",
    government: "រដ្ឋាភិបាល",
    media: "សារព័ត៌មាន",
    agency: "ទីភ្នាក់ងារ",
    other: "ផ្សេងៗ",
    guideTitle: "របៀបប្រើ និង ការយល់ដឹង",
    dashboardGuide: "របៀបមើលតារាងនេះ",
    dashboardGuideDesc: "យើងប្រមូលព័ត៌មានពីថៃ ខ្មែរ និងបរទេស។ 'AI កណ្តាល' ជួយសង្ខេបដើម្បីឱ្យឃើញចំណុចរួម។",
    aiWarning: "ប្រយ័ត្ន៖ AI និងរូបក្លែងក្លាយ",
    aiWarningDesc: "សម័យនេះ AI អាចបង្កើតរូប/វីដេអូក្លែងក្លាយ (Deepfakes) ដូចមែនទែន។ កុំជឿអ្វីដែលឃើញក្នុងអ៊ីនធឺណិតភ្លាមៗ។",
    deepfakeTips: "របៀបមើលរូបក្លែងក្លាយ",
    dfTip1: "មើលកន្លែងខុសធម្មតា (ម្រាមដៃ, ភ្នែក, អក្សរ)",
    dfTip2: "មើលថាសារព័ត៌មានធំៗចុះផ្សាយដែរឬទេ",
    dfTip3: "សាកយករូបទៅស្វែងរកក្នុង Google (Reverse Image Search)",
    credibilityScore: "តើពិន្ទុភាពជឿជាក់គឺជាអ្វី?",
    credibilityDesc: "ពិន្ទុ (0-100%) គឺបញ្ជាក់ថាព័ត៌មាននេះគួរឱ្យទុកចិត្តប៉ុណ្ណា។ បើក្រោម 50% ប្រហែលជាព័ត៌មានមិនពិត ឬពាក្យចចាមអារ៉ាម។",
    // Categories
    cat_military: "យោធា",
    cat_diplomatic: "ការទូត",
    cat_humanitarian: "មនុស្សធម៌",
    cat_political: "នយោបាយ",
    // Military Posture Context
    postureGaugeTitle: "ជំហរយោធា",
    territoryOwn: "ទឹកដីខ្លួនឯង",
    territoryBorder: "តំបន់ព្រំដែន",
    territoryDisputed: "តំបន់ជម្លោះ",
    territoryForeign: "ទឹកដីគេ",
    postureRationale: "ការវិភាគ",
    // Timeline & Map
    historicalTimeline: "កាលប្បវត្តិប្រតិបត្តិការ", // Operational Timeline
    noTimelineEvents: "មិនទាន់មានរបាយការណ៍ចារកម្ម",
    runHistorian: "កំពុងប្រមូលទិន្នន័យ...",
    impact: "សារៈសំខាន់",
    sourcesLower: "ប្រភព",
    peaceWar: "សន្តិភាព / សង្គ្រាម",
    thBase: "មូលដ្ឋានថៃ",
    khOutpost: "ប៉ុស្តិ៍កម្ពុជា",
    thBaseFull: "មូលដ្ឋានទ័ពថៃ",
    khOutpostFull: "ប៉ុស្តិ៍ទាហានកម្ពុជា",
    lat: "LAT",
    lon: "LON",

    // Guide Section
    howItWorks: "តើគេហទំព័រនេះដំណើរការយ៉ាងដូចម្តេច?",
    curatorRole: "THE CURATOR (អ្នកប្រមូល)",
    curatorDesc: "ក្រុម AI តាមដានគ្រប់ប្រភពព័ត៌មានទាំងនៅថៃ ខ្មែរ និងបរទេស 24 ម៉ោង។ គេប្រមូលយកទាំងអស់មិនរើសមុខ ឱ្យតែទាក់ទងនឹងរឿងព្រំដែន។",
    verifierRole: "THE VERIFIER (អ្នកផ្ទៀងផ្ទាត់)",
    verifierDesc: "ពេលបានព័ត៌មានហើយ AI នេះនឹងឆែកមើលថា ដំណឹងហ្នឹងពិតឬអត់ អ្នកណាជាអ្នកសរសេរ ហើយមានលំអៀងទៅខាងណា ដើម្បីកុំឱ្យយើងចាញ់បោកគេ។",
    historianRole: "THE HISTORIAN (អ្នកកត់ត្រា)",
    historianDesc: "AI នេះមើលរឿងរ៉ាវពីដើមដល់ចប់។ វាភ្ជាប់រឿងថ្មីទៅនឹងរឿងចាស់ ដើម្បីឱ្យដឹងថាហេតុការណ៍ហ្នឹងមានដើមទងមកពីណា។",
    synthRole: "THE SYNTHESIZER (អ្នកសរុប)",
    synthDesc: "AI ចុងក្រោយដូចជាអាជ្ញាកណ្តាល។ បើខាងនេះថាម៉្យាង ខាងនោះថាម៉្យាង វាជាអ្នកយកមកថ្លឹងថ្លែង រកចំណុចកណ្តាល ដើម្បីឱ្យយើងយល់សាច់រឿងពិត។",
    trustWarning: "កុំជឿនរណាម្នាក់ងងឹតងងុល",
    trustWarningDesc: "រដ្ឋាភិបាលណាក៏ចង់និយាយឱ្យខ្លួនឯងល្អ។ សារព័ត៌មានក៏ត្រូវយកចិត្តអ្នកមើល។ ប្រើតារាងនេះដើម្បីប្រៀបធៀបព័ត៌មាន មិនមែនដើម្បីបញ្ជាក់ថាខ្លួនឯងត្រូវទេ។",
    statelessApproach: "មិនកាន់ជើង ហើយមិនជឿអ្នកណាទាំងអស់",
    statelessDesc: "យើងមិនជឿសម្តីអ្នកណាទេ។ យើងមិននៅខាងថៃ ហើយក៏មិននៅខាងខ្មែរដែរ។ យើងដើរផ្លូវកណ្តាលបុកទៅរកការពិត។",
    intelReport: "របាយការណ៍ចារកម្ម",
    date: "កាលបរិច្ឆេទ",
    category: "ប្រភេទ",
    topSources: "ប្រភពសំខាន់ៗ",
    hide: "លាក់",
    show: "បង្ហាញ",
    moreSources: "ប្រភពបន្ថែម",
    prev: "ថយក្រោយ",
    next: "ទៅមុខ",
    navHint: "ប្រើប៊ូតុង ← → ដើម្បីប្តូរទំព័រ",
    reports: "របាយការណ៍",
    sources: "ប្រភព",
    paused: "ផ្អាក",
    aiAnalysis: "ការវិភាគដោយ AI",
    analyzingFeeds: "កំពុងវិភាគទិន្នន័យចារកម្មសកល... ប្រព័ន្ធកំពុងតាមដានព័ត៌មានពីទាំងភាគីថៃនិងកម្ពុជាដើម្បីសង្ខេបរបាយការណ៍ដែលមានតុល្យភាព។",
    events: "ព្រឹត្តិការណ៍",
    // New Guide Content (Khmer Casual/Spoken)
    factVsPropaganda: "ការពិត vs ព័ត៌មានបំប៉ោង",
    fact1: "ការពិត: ប្រាប់ថាមានរឿងអី នៅណា ពេលណា ចប់។",
    propaganda1: "ព័ត៌មានបំប៉ោង: ប្រើពាក្យលើសៗ (វីរបុរស, ជនក្បត់ជាតិ, អាក្រក់)។",
    fact2: "ការពិត: មានរូប មានភស្តុតាង ប្រាប់ប្រភពច្បាស់លាស់។",
    propaganda2: "ព័ត៌មានបំប៉ោង: ថា 'គេប្រាប់ថា' តែមិនប្រាប់ថាជាអ្នកណា។",
    understandingScores: "ពិន្ទុទាំងនេះប្រាប់អីខ្លះ?",
    scoreHigh: "70-100% (ច្បាស់): សារព័ត៌មានច្រើនចុះដូចគ្នា ជឿបាន។",
    scoreMid: "40-69% (ស្តាប់បានខ្លះ): ព័ត៌មានមិនទាន់ច្បាស់ ប្រភពនិយាយមិនត្រូវគ្នា។",
    scoreLow: "0-39% (មិនពិត): ពាក្យចចាមអារ៉ាម ព័ត៌មានបំប៉ោង កុំអាលចែករំលែកត។",
    whoIsTalking: "នរណាជាអ្នកនិយាយ?",
    sourceGov: "រដ្ឋាភិបាល: សេចក្តីប្រកាសផ្លូវការ (ភាគច្រើននិយាយល្អពីខ្លួនឯង)។",
    sourceMedia: "សារព័ត៌មាន: ព័ត៌មានទូទៅ (មើលថានរណាជាម្ចាស់ផង)។",
    sourceAgency: "ទីភ្នាក់ងារបរទេស: ដូចជា Reuters/AP (មានភាពកណ្តាលជាង)។",
    // Country labels
    labelKH: "កម្ពុជា",
    labelINTL: "អន្តរជាតិ",
    labelTH: "ថៃ",
  }
};

type Lang = 'en' | 'th' | 'kh';

// --- Custom Hooks ---
// IMPORTANT: The 'skip' parameter allows completely bypassing Convex subscriptions
// when ISR provides data. Pass skip=true when server data is available.
const usePersistentQuery = (query: any, args: any, storageKey: string, skip: boolean = false) => {
  // When skip is true, we use Convex's "skip" sentinel to prevent subscription
  const convexData = useQuery(query, skip ? "skip" : args);
  const [localData, setLocalData] = useState<any>(null);
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    // Skip all localStorage operations when skipped
    if (skip) {
      setIsHydrated(true);
      return;
    }

    // Hydrate from local storage on mount
    if (typeof window !== 'undefined') {
      const cached = localStorage.getItem(storageKey);
      if (cached) {
        try {
          setLocalData(JSON.parse(cached));
        } catch (e) {
          console.error("Failed to parse cache for", storageKey, e);
        }
      }
      setIsHydrated(true);
    }
  }, [storageKey, skip]);

  useEffect(() => {
    // Skip localStorage writes when skipped
    if (skip) return;

    // Update local storage when convex data arrives
    if (convexData !== undefined) {
      setLocalData(convexData);
      if (typeof window !== 'undefined') {
        localStorage.setItem(storageKey, JSON.stringify(convexData));
      }
    }
  }, [convexData, storageKey, skip]);

  // When skipped, return immediately with no data (caller uses ISR data instead)
  if (skip) {
    return { data: null, isLoading: false, isRefreshing: false };
  }

  const data = convexData !== undefined ? convexData : localData;
  // Loading = We have no data at all (neither local nor remote) AND we have finished hydration check
  // Note: We show loading until hydration check is done to avoid flash of missing content
  const isLoading = !isHydrated || (convexData === undefined && localData === null);
  // Refreshing = We have local data (so we are showing something) BUT we are waiting for fresh remote data
  const isRefreshing = isHydrated && convexData === undefined && localData !== null;

  return { data, isLoading, isRefreshing };
};

// =============================================================================
// BANDWIDTH-OPTIMIZED QUERY HOOK
// Only fetches data on mount and when research cycle completes (lastResearchAt changes)
// Uses manual fetch instead of live subscriptions = ~90% bandwidth reduction
// IMPORTANT: Pass skip=true when ISR provides data to eliminate ALL bandwidth usage
// =============================================================================

// Global ref to track lastResearchAt (updated by Home component)
const globalLastResearchAt = { current: null as number | null };

// The optimized query hook - NO live subscription, just cached data
const useCachedQuery = <T,>(
  queryFn: FunctionReference<"query">,
  args: Record<string, unknown>,
  storageKey: string,
  lastResearchAt?: number | null, // Pass this from the component that has systemStats
  skip: boolean = false // When true, completely bypass all fetching
): { data: T | undefined; isLoading: boolean; isRefreshing: boolean } => {
  const convex = useConvex();

  // When skip is true, return immediately without any operations
  // This hook still needs to be called (React rules), but it does nothing
  const [data, setData] = useState<T | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(!skip);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isHydrated, setIsHydrated] = useState(skip);
  const lastFetchedAt = useRef<number | null>(null);
  const hasDoneInitialFetch = useRef(skip);

  // Use passed prop if available, otherwise fall back to global ref
  const effectiveLastResearchAt = lastResearchAt ?? globalLastResearchAt.current;

  // Hydrate from localStorage on mount (skip if ISR provides data)
  useEffect(() => {
    if (skip) return;

    if (typeof window !== 'undefined') {
      const cached = localStorage.getItem(storageKey);
      if (cached) {
        try {
          const parsed = JSON.parse(cached);
          setData(parsed.data);
          lastFetchedAt.current = parsed.fetchedAt || 0;
        } catch (e) {
          console.error("Failed to parse cache for", storageKey, e);
        }
      }
      setIsHydrated(true);
    }
  }, [storageKey, skip]);

  // Fetch data function (skip if ISR provides data)
  const fetchData = useCallback(async () => {
    if (skip) return;

    try {
      const result = await convex.query(queryFn, args);
      setData(result as T);
      lastFetchedAt.current = Date.now();

      // Save to localStorage with timestamp
      if (typeof window !== 'undefined') {
        localStorage.setItem(storageKey, JSON.stringify({
          data: result,
          fetchedAt: Date.now()
        }));
      }
    } catch (error) {
      console.error("Failed to fetch data for", storageKey, error);
    }
  }, [convex, queryFn, JSON.stringify(args), storageKey, skip]);

  // Initial fetch after hydration (skip if ISR provides data)
  useEffect(() => {
    if (skip) return;
    if (!isHydrated || hasDoneInitialFetch.current) return;

    const doInitialFetch = async () => {
      hasDoneInitialFetch.current = true;
      setIsLoading(data === undefined);
      setIsRefreshing(data !== undefined);
      await fetchData();
      setIsLoading(false);
      setIsRefreshing(false);
    };

    doInitialFetch();
  }, [isHydrated, fetchData, data, skip]);

  // Refresh when research cycle completes (skip if ISR provides data)
  useEffect(() => {
    if (skip) return;
    if (!isHydrated || effectiveLastResearchAt === null) return;

    // Skip if we haven't done initial fetch yet
    if (lastFetchedAt.current === null) return;

    // Only refresh if cycle completed AFTER our last fetch
    if (effectiveLastResearchAt > lastFetchedAt.current) {
      console.log(`🔄 [${storageKey}] Cycle completed, refreshing data...`);
      setIsRefreshing(true);
      fetchData().then(() => setIsRefreshing(false));
    }
  }, [effectiveLastResearchAt, isHydrated, fetchData, storageKey, skip]);

  // When skipped, return no-op values (caller uses ISR data instead)
  if (skip) {
    return { data: undefined, isLoading: false, isRefreshing: false };
  }

  return {
    data,
    isLoading: !isHydrated || (isLoading && data === undefined),
    isRefreshing,
  };
};

// --- Reusable Components ---
const Card = ({ children, className = "", title, icon: Icon, loading = false, refreshing = false }: any) => {
  // When h-full is used, we need flex layout to properly distribute space
  const isFlexLayout = className.includes('h-full');

  return (
    <div className={`bg-riso-paper rough-border p-4 relative overflow-hidden ${isFlexLayout ? 'flex flex-col' : ''} ${className}`}>
      {loading && (
        <div className="absolute inset-0 bg-riso-ink/5 z-10 flex items-center justify-center backdrop-blur-[1px]">
          <div className="flex flex-col items-center">
            <RefreshCw className="w-8 h-8 text-riso-ink animate-spin mb-2" />
            <span className="font-mono text-xs uppercase tracking-widest">Updating Data Stream...</span>
          </div>
        </div>
      )}
      {!loading && refreshing && (
        <div className="absolute top-2 right-2 z-20 pointer-events-none">
          <RefreshCw className="w-3 h-3 text-riso-ink/40 animate-spin" />
        </div>
      )}
      {(title || Icon) && (
        <div className="flex items-center justify-between mb-4 border-b-2 border-riso-ink/20 pb-2 flex-shrink-0">
          <h3 className="font-display uppercase text-2xl tracking-wide text-riso-ink">{title}</h3>
          {Icon && <Icon className="w-6 h-6 text-riso-ink" />}
        </div>
      )}
      {isFlexLayout ? (
        <div className="flex-1 flex flex-col min-h-0">
          {children}
        </div>
      ) : (
        children
      )}
    </div>
  );
};

const Badge = ({ children, type = "neutral" }: any) => {
  const styles: any = {
    neutral: "bg-riso-ink text-riso-paper",
    alert: "bg-riso-accent text-white",
    outline: "border border-riso-ink text-riso-ink"
  };
  return (
    <span className={`px-2 py-0.5 text-xs font-mono font-bold uppercase tracking-wider ${styles[type]}`}>
      {children}
    </span>
  );
};

const ProgressBar = ({ value, max = 100, label, color = "bg-riso-ink" }: any) => (
  <div className="mb-3">
    <div className="flex justify-between text-xs font-mono mb-1">
      <span>{label}</span>
      <span>{value}</span>
    </div>
    <div className="h-3 w-full border border-riso-ink p-[1px]">
      <div
        className={`h-full ${color} transition-all duration-1000 ease-out`}
        style={{ width: `${(value / max) * 100}%` }}
      ></div>
    </div>
  </div>
);

// Expandable News Article Component
const NewsItem = ({ article, perspective, lang = 'en', isExpanded = false, onToggle }: {
  article: any;
  perspective: 'thailand' | 'cambodia';
  lang?: 'en' | 'th' | 'kh';
  isExpanded?: boolean;
  onToggle?: () => void;
}) => {
  const borderColor = perspective === 'thailand' ? 'border-[#241D4F]' : 'border-[#032EA1]';
  const hoverBg = perspective === 'thailand' ? 'hover:bg-[#241D4F]/5' : 'hover:bg-[#032EA1]/5';
  const expandedBg = perspective === 'thailand' ? 'bg-[#241D4F]/5' : 'bg-[#032EA1]/5';

  const t = TRANSLATIONS[lang as Lang] || TRANSLATIONS.en;

  // Format relative time with fallback: if publishedAt is in the future or very recent, use fetchedAt
  const formatRelativeTime = (publishedAt: number | undefined, fetchedAt: number) => {
    // Check if publishedAt would result in "Just now" (future date or < 1 min ago)
    const publishedDiff = publishedAt ? Date.now() - publishedAt : -1;
    const publishedMinutes = Math.floor(publishedDiff / 60000);

    // If publishedAt is missing, in the future, or would show "Just now", use fetchedAt instead
    const timestamp = (!publishedAt || publishedMinutes < 1) ? fetchedAt : publishedAt;

    const diff = Date.now() - timestamp;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 3600000 / 24);

    if (days > 0) {
      const remainingHours = hours % 24;
      return `${days}d ${remainingHours}h ago`;
    }
    if (hours > 0) return `${hours}h ago`;
    if (minutes > 0) return `${minutes}m ago`;
    return t.justNow;
  };

  return (
    <li
      className={`text-sm font-medium border-l-2 ${borderColor} pl-3 pr-3 py-2 ${hoverBg} transition-all cursor-pointer`}
      onClick={() => article.sourceUrl && window.open(article.sourceUrl, '_blank')}
    >
      {/* Header Row */}
      <div className="flex items-center justify-between gap-2 mb-1">
        <div className="flex items-center gap-2">
          <span className="text-xs">{categoryIcons[article.category] || '📰'}</span>
          {article.isVerified && <CheckCircle className="w-3 h-3 text-green-600" />}
          <span className="text-[10px] font-mono opacity-60">{article.source}</span>
        </div>
        <span className="text-[9px] font-mono opacity-40 whitespace-nowrap">{formatRelativeTime(article.publishedAt, article.fetchedAt)}</span>
      </div>

      {/* Title - use language-specific title if available */}
      <p className={`font-semibold ${lang === 'kh' ? 'font-mono leading-relaxed' : lang === 'th' ? 'font-mono leading-snug' : 'leading-snug'}`}>
        {lang === 'th' && article.titleTh ? article.titleTh :
          lang === 'kh' && article.titleKh ? article.titleKh :
            article.titleEn || article.title}
      </p>

      {/* Credibility Bar (always visible) */}
      <div className="flex items-center gap-2 mt-2">
        <span className={`font-mono font-bold opacity-40 uppercase tracking-wider ${lang === 'kh' || lang === 'th' ? 'text-[12px]' : 'text-[9px]'}`}>{t.credibility}</span>
        <div className="flex-1 h-1.5 bg-riso-ink/10">
          <div
            className={`h-full ${(article.credibility ?? 50) >= 70 ? 'bg-green-600' : (article.credibility ?? 50) >= 40 ? 'bg-yellow-500' : 'bg-red-500'}`}
            style={{ width: `${article.credibility ?? 50}%` }}
          />
        </div>
        <span className="text-[9px] font-mono opacity-60 min-w-[3ch] text-right">{article.credibility ?? 50}%</span>
      </div>

      {/* Expanded Details */}
      {isExpanded && (
        <div className="mt-3 pt-3 border-t border-riso-ink/10 space-y-3">
          {/* Summary */}
          <p className={`text-xs opacity-80 ${lang === 'kh' ? 'leading-relaxed' : lang === 'th' ? 'leading-relaxed' : 'leading-relaxed'}`}>
            {lang === 'th' && article.summaryTh ? article.summaryTh :
              lang === 'kh' && article.summaryKh ? article.summaryKh :
                article.summaryEn || article.summary}
          </p>

          {/* Key Points */}
          {article.keyPoints && article.keyPoints.length > 0 && (
            <div>
              <p className="text-[10px] font-mono font-bold uppercase opacity-60 mb-1">{t.keyPoints}</p>
              <ul className="space-y-1">
                {article.keyPoints.map((point: string, i: number) => (
                  <li key={i} className="text-[11px] flex items-start gap-1.5">
                    <span className="text-green-600 mt-0.5">▸</span>
                    <span>{point}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Entities */}
          {article.entities && article.entities.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {article.entities.map((entity: string, i: number) => (
                <span key={i} className="text-[9px] font-mono bg-riso-ink/10 px-1.5 py-0.5 rounded">
                  {entity}
                </span>
              ))}
            </div>
          )}

          {/* Source Type Badge */}
          <div className="flex items-center justify-between">
            <span className={`text-[9px] font-mono uppercase px-1.5 py-0.5 rounded ${article.sourceType === 'government' ? 'bg-blue-100 text-blue-700' :
              article.sourceType === 'media' ? 'bg-purple-100 text-purple-700' :
                article.sourceType === 'agency' ? 'bg-orange-100 text-orange-700' :
                  'bg-gray-100 text-gray-700'
              }`}>
              {t[article.sourceType as keyof typeof t] || article.sourceType}
            </span>
            <span className={`text-[9px] font-mono ${article.sentiment === 'positive' ? 'text-green-600' :
              article.sentiment === 'negative' ? 'text-red-600' :
                'text-gray-600'
              }`}>
              {article.sentiment === 'positive' ? `↑ ${t.positive}` :
                article.sentiment === 'negative' ? `↓ ${t.negative}` :
                  `→ ${t.neutral}`}
            </span>
          </div>
        </div>
      )
      }
    </li >
  );
};

// Category Filter Pills
const CategoryFilter = ({
  selected,
  onChange,
  perspective,
  lang = 'en'
}: {
  selected: string | null;
  onChange: (cat: string | null) => void;
  perspective: 'thailand' | 'cambodia';
  lang?: 'en' | 'th' | 'kh';
}) => {
  const categories = [
    { key: null, label: TRANSLATIONS[lang as Lang].all },
    { key: 'military', label: '🎖️' },
    { key: 'political', label: '🏛️' },
    { key: 'humanitarian', label: '❤️' },
    { key: 'diplomatic', label: '🤝' },
  ];

  const activeColor = perspective === 'thailand' ? 'bg-[#241D4F] text-white' : 'bg-[#032EA1] text-white';

  return (
    <div className="flex gap-1 mb-2">
      {categories.map(cat => (
        <button
          key={cat.key || 'all'}
          onClick={() => onChange(cat.key)}
          className={`px-2 py-0.5 text-[10px] font-mono rounded transition-colors ${selected === cat.key ? activeColor : 'bg-riso-ink/10 hover:bg-riso-ink/20'
            }`}
        >
          {cat.label}
        </button>
      ))}
    </div>
  );
};

// Intelligence Log Component - Scrollable feed with filters
const IntelligenceLog = ({
  articles,
  perspective,
  lang = 'en',
  isLoading
}: {
  articles: any[] | undefined;
  perspective: 'thailand' | 'cambodia';
  lang?: 'en' | 'th' | 'kh';
  isLoading: boolean;
}) => {
  const t = TRANSLATIONS[lang as Lang];
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Filter articles by category and sort by most recent
  const filteredArticles = (articles?.filter(a =>
    categoryFilter ? a.category === categoryFilter : true
  ) || []).sort((a, b) => {
    const timeA = a.publishedAt || a.fetchedAt;
    const timeB = b.publishedAt || b.fetchedAt;
    return timeB - timeA; // Descending (newest first)
  });

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <div className="flex items-center justify-between mb-2">
        <h4 className="font-mono text-xs font-bold uppercase">{TRANSLATIONS[lang as Lang].intelligenceLog}</h4>
        <span className={`font-mono opacity-50 ${lang === 'kh' || lang === 'th' ? 'text-[14px]' : 'text-[9px]'}`}>{filteredArticles.length} {TRANSLATIONS[lang as Lang].items}</span>
      </div>

      <CategoryFilter
        selected={categoryFilter}
        onChange={setCategoryFilter}
        perspective={perspective}
        lang={lang}
      />

      {/* Scrollable Container - flex-1 fills remaining space, max-h on mobile */}
      <div className="flex-1 min-h-[150px] max-h-[350px] md:max-h-none overflow-y-auto border border-riso-ink/10 rounded bg-white/50 scrollbar-thin">
        {isLoading ? (
          <div className="h-full flex items-center justify-center">
            <RefreshCw className="w-5 h-5 animate-spin opacity-40" />
          </div>
        ) : filteredArticles.length > 0 ? (
          <ul className="divide-y divide-riso-ink/5">
            {filteredArticles.map((article) => (
              <NewsItem
                key={article._id}
                article={article}
                perspective={perspective}
                lang={lang}
                isExpanded={expandedId === article._id}
                onToggle={() => setExpandedId(expandedId === article._id ? null : article._id)}
              />
            ))}
          </ul>
        ) : (
          <div className="h-full flex items-center justify-center">
            <p className="text-xs font-mono opacity-40">
              {categoryFilter ? (
                <>
                  {t.noArticlesFiltered} <span className="opacity-50">({categoryFilter})</span>
                </>
              ) : t.noArticles}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

// Auto-scrolling Label Component that checks overflow on resize/zoom
const AutoScrollLabel = ({ text, className = "", fontSizeClass = "text-[10px]" }: { text: string, className?: string, fontSizeClass?: string }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const ghostRef = useRef<HTMLSpanElement>(null);
  const [isOverflowing, setIsOverflowing] = useState(false);

  useLayoutEffect(() => {
    const checkOverflow = () => {
      if (containerRef.current && ghostRef.current) {
        // Ghost width (text content) > Container visible width
        // We subtract a tiny buffer (e.g. 2px) to prevent sub-pixel jitter
        const hasOverflow = ghostRef.current.offsetWidth > containerRef.current.clientWidth;
        setIsOverflowing(hasOverflow);
      }
    };

    // Check immediately
    checkOverflow();

    // Check whenever the container is resized (e.g. window resize, zoom in/out)
    const observer = new ResizeObserver(checkOverflow);
    if (containerRef.current) {
      observer.observe(containerRef.current);
    }

    return () => observer.disconnect();
  }, [text]);

  return (
    <div
      ref={containerRef}
      className={`flex-1 min-w-0 overflow-hidden relative h-6 flex items-center ${className}`}
      title={text}
    >
      {/* Ghost element for precise measurement - hidden but functionally identical in styling */}
      <span
        ref={ghostRef}
        className={`absolute invisible whitespace-nowrap ${fontSizeClass} font-mono pointer-events-none px-1.5`}
        aria-hidden="true"
      >
        {text}
      </span>

      {isOverflowing ? (
        <>
          {/* Marquee Container */}
          <div className="animate-marquee items-center cursor-help inline-flex">
            <span className={`${fontSizeClass} font-mono whitespace-nowrap mr-8`}>{text}</span>
            <span className={`${fontSizeClass} font-mono whitespace-nowrap mr-8`}>{text}</span>
            <span className={`${fontSizeClass} font-mono whitespace-nowrap mr-8`}>{text}</span>
            <span className={`${fontSizeClass} font-mono whitespace-nowrap mr-8`}>{text}</span>
          </div>
          {/* Edge Fades */}
          <div className="absolute left-0 top-0 bottom-0 w-2 bg-gradient-to-r from-[#f8f5e6] to-transparent mix-blend-multiply pointer-events-none"></div>
          <div className="absolute right-0 top-0 bottom-0 w-2 bg-gradient-to-l from-[#f8f5e6] to-transparent mix-blend-multiply pointer-events-none"></div>
        </>
      ) : (
        <div className="w-full text-center px-1.5 min-w-0">
          <span className={`block whitespace-nowrap truncate cursor-help ${fontSizeClass} font-mono`}>
            {text}
          </span>
        </div>
      )}
    </div>
  );
};

// Military Intensity Gauge - Enhanced with territorial context and AI rationale
const MilitaryIntensityGauge = ({
  intensity,
  posture,
  postureLabel,
  postureLabelTh,
  postureLabelKh,
  postureRationale,
  postureRationaleTh,
  postureRationaleKh,
  territorialContext,
  perspective,
  lang = 'en'
}: {
  intensity: number;
  posture: "PEACEFUL" | "DEFENSIVE" | "AGGRESSIVE" | undefined;
  postureLabel?: string;
  postureLabelTh?: string;
  postureLabelKh?: string;
  postureRationale?: string;
  postureRationaleTh?: string;
  postureRationaleKh?: string;
  territorialContext?: "OWN_TERRITORY" | "DISPUTED_ZONE" | "FOREIGN_TERRITORY" | "BORDER_ZONE";
  perspective: 'thailand' | 'cambodia';
  lang?: 'en' | 'th' | 'kh';
}) => {
  const [showAnalysis, setShowAnalysis] = useState(false);
  const t = TRANSLATIONS[(lang as Lang) || 'en'];
  const displayIntensity = intensity ?? 50;
  const displayPosture = posture ?? "DEFENSIVE";

  // Select the correct translation based on language
  const displayLabel = lang === 'th' && postureLabelTh ? postureLabelTh
    : lang === 'kh' && postureLabelKh ? postureLabelKh
      : postureLabel;

  const displayRationale = lang === 'th' && postureRationaleTh ? postureRationaleTh
    : lang === 'kh' && postureRationaleKh ? postureRationaleKh
      : postureRationale;

  const postureColors: Record<string, string> = {
    PEACEFUL: 'text-green-600',
    DEFENSIVE: 'text-yellow-600',
    AGGRESSIVE: 'text-red-600',
  };

  const postureBgColors: Record<string, string> = {
    PEACEFUL: 'bg-green-600/10 border-green-600/30',
    DEFENSIVE: 'bg-yellow-500/10 border-yellow-500/30',
    AGGRESSIVE: 'bg-red-500/10 border-red-500/30',
  };

  const labelFontSize = (lang === 'th' || lang === 'kh') ? 'text-[13px]' : 'text-[10px]';

  return (
    <div className="mb-4">
      {/* Title and Intensity Number Row */}
      <div className="flex items-center justify-between mb-2">
        <h4 className={`font-mono font-bold uppercase opacity-60 ${lang === 'kh' || lang === 'th' ? 'text-[13px]' : 'text-[10px]'}`}>{t.postureGaugeTitle || t.militaryIntensity}</h4>
        <span className="text-[10px] font-mono opacity-50">{displayIntensity}/100</span>
      </div>

      {/* Gradient Gauge Bar */}
      <div className="relative h-8 bg-gradient-to-r from-green-400 via-yellow-400 to-red-500 rounded overflow-hidden">
        {/* Indicator needle */}
        <div
          className="absolute top-0 bottom-0 w-1 bg-riso-ink shadow-lg transition-all duration-700"
          style={{ left: `calc(${displayIntensity}% - 2px)` }}
        />
        {/* Scale markers */}
        <div className={`absolute inset-0 flex justify-between px-2 items-center font-mono font-bold text-white/80 ${lang === 'kh' || lang === 'th' ? 'text-[12px]' : 'text-[8px]'}`}>
          <span className="posture-label">{t.peaceful}</span>
          <span className="posture-label">{t.defensive}</span>
          <span className="posture-label">{t.aggressive}</span>
        </div>
      </div>

      {/* Posture Readout Row */}
      <div className="flex items-center gap-2 mt-2">
        {/* Main Posture Label */}
        <span className={`text-xs font-mono font-bold flex-shrink-0 ${postureColors[displayPosture]}`}>
          {displayPosture === 'PEACEFUL' ? t.peaceful : displayPosture === 'AGGRESSIVE' ? t.aggressive : t.defensive}
        </span>

        {/* Unified Label - Dynamic Width (Fills available space) */}
        {/* Unified Label - Dynamic Width with Auto-Scroll if Overflowing */}
        {displayLabel && (
          <AutoScrollLabel
            text={displayLabel}
            className={`border rounded ${postureBgColors[displayPosture]}`}
            fontSizeClass={labelFontSize}
          />
        )}

        {/* Dropdown arrow for Analysis */}
        {displayRationale && (
          <button
            onClick={() => setShowAnalysis(!showAnalysis)}
            className="flex-shrink-0 ml-auto flex items-center justify-center w-6 h-6 rounded hover:bg-black/5 transition-colors"
            aria-label="Toggle analysis"
          >
            <span style={{
              display: 'inline-block',
              fontSize: '18px',
              lineHeight: '1',
              opacity: 0.6,
              transition: 'transform 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
              transform: showAnalysis ? 'rotate(90deg)' : 'rotate(180deg)'
            }}>›</span>
          </button>
        )}
      </div>

      {/* AI Rationale (collapsible with smooth animation) */}
      <div
        className="overflow-hidden"
        style={{
          maxHeight: showAnalysis && displayRationale ? '500px' : '0',
          opacity: showAnalysis && displayRationale ? 1 : 0,
          marginTop: showAnalysis && displayRationale ? '8px' : '0',
          transition: 'all 0.2s ease'
        }}
      >
        {displayRationale && (
          <div className="p-2 bg-riso-ink/5 border border-riso-ink/10 rounded">
            <p className={`font-mono italic opacity-70 ${labelFontSize}`}>
              <span className="font-bold not-italic opacity-50">{t.postureRationale || 'Analysis'}:</span> {displayRationale}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};


// Hacker Scramble Effect Component
const HackerScramble = ({ duration = 3000, className = "" }: any) => {
  const [text, setText] = useState("00:00");
  const chars = "0123456789";

  useEffect(() => {
    const interval = setInterval(() => {
      setText(
        Array(2).fill(0).map(() => chars[Math.floor(Math.random() * chars.length)]).join('') + ":" +
        Array(2).fill(0).map(() => chars[Math.floor(Math.random() * chars.length)]).join('')
      );
    }, 50);
    return () => clearInterval(interval);
  }, []);

  return <span className={`font-mono ${className}`}>{text}</span>;
};

// --- Main Application ---
// Props interface for ISR data injection
interface DashboardClientProps {
  initialData: BorderClashData | null;
  serverError?: string | null;
}

export function DashboardClient({ initialData, serverError }: DashboardClientProps) {
  const [nextUpdateIn, setNextUpdateIn] = useState<number | null>(null); // Start null to prevent 5:00 flash

  // Always start with ANALYSIS for SSR hydration, then sync from hash on client mount
  const [viewMode, setViewMode] = useState<'ANALYSIS' | 'LOSSES' | 'GUIDE'>('ANALYSIS');
  const hasInitializedFromHash = useRef(false);

  // On mount, read URL hash and update viewMode (client-only, avoids hydration mismatch)
  useEffect(() => {
    const hash = window.location.hash.toLowerCase().replace('#', '');
    if (hash === 'timeline' || hash === 'losses') {
      setViewMode('LOSSES');
    } else if (hash === 'guide') {
      setViewMode('GUIDE');
    }
    hasInitializedFromHash.current = true;
  }, []);

  // Sync viewMode changes back to URL hash (skip first run to avoid clearing hash before reading)
  useEffect(() => {
    if (!hasInitializedFromHash.current) return; // Skip initial mount
    const hashMap: Record<string, string> = { 'ANALYSIS': '', 'LOSSES': '#timeline', 'GUIDE': '#guide' };
    const newHash = hashMap[viewMode] || '';
    if (window.location.hash !== newHash) {
      window.history.replaceState(null, '', newHash || window.location.pathname);
    }
  }, [viewMode]);

  const [lang, setLang] = useState<'en' | 'th' | 'kh'>('en');
  const t = TRANSLATIONS[lang as Lang];


  const [selectedEvent, setSelectedEvent] = useState<any>(null);
  const [showAllSources, setShowAllSources] = useState(false);
  const [isModalClosing, setIsModalClosing] = useState(false);

  // Simple close function for modal
  const closeModal = () => {
    setIsModalClosing(true);
    setTimeout(() => {
      setSelectedEvent(null);
      setIsModalClosing(false);
    }, 300); // Give animation time to complete (200ms transition + buffer)
  };

  // Lock body scroll when modal is open
  useEffect(() => {
    if (selectedEvent) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [selectedEvent]);



  // Logic for height synchronization
  const neutralRef = useRef<HTMLDivElement>(null);
  const [neutralColumnHeight, setNeutralColumnHeight] = useState<number | undefined>(undefined);

  // Sidebar height sync for timeline view
  const sidebarRef = useRef<HTMLDivElement>(null);
  const [sidebarHeight, setSidebarHeight] = useState<number | undefined>(undefined);

  // =============================================================================
  // ISR-AWARE DATA LOADING
  // If initialData is provided (from server-side ISR), we SKIP all Convex calls.
  // This means ZERO Convex bandwidth per user - data comes from Vercel's cache!
  // =============================================================================

  const hasServerData = initialData !== null;

  const [forceClientMode, setForceClientMode] = useState(false);
  const [tabFocusKey, setTabFocusKey] = useState(0);

  // Re-sync data when tab regains focus (handles browser cache staleness)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        console.log("👁️ [BorderClash] Tab became visible, triggering data refresh check...");
        setTabFocusKey(prev => prev + 1);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []);

  // SystemStats subscription - NEVER skip this!
  // This is our "heartbeat" to detect when static ISR data becomes stale.
  const {
    data: clientSystemStats,
    isLoading: clientSysStatsLoading,
    isRefreshing: sysStatsRefreshing
  } = usePersistentQuery(
    api.api.getStats,
    {},
    "borderclash_system_stats",
    false // ALWAYS subscribe to status to detect new research cycles
  ) as any;

  // Use server data if available, unless fresh client stats detect a newer update
  const systemStats = (hasServerData && !forceClientMode) ? initialData.systemStats : clientSystemStats;
  const sysStatsLoading = (hasServerData && !forceClientMode) ? false : clientSysStatsLoading;

  // Detect when new research data exists on the server compared to our static ISR load
  useEffect(() => {
    if (hasServerData && !forceClientMode && clientSystemStats?.lastResearchAt && initialData?.systemStats?.lastResearchAt) {
      if (clientSystemStats.lastResearchAt > initialData.systemStats.lastResearchAt) {
        console.log("🚀 [BorderClash] New research cycle detected via heartbeat. Switching to live mode...");
        setForceClientMode(true);
      }
    }
  }, [clientSystemStats?.lastResearchAt, hasServerData, forceClientMode, initialData?.systemStats?.lastResearchAt]);

  // All other queries - skip if we have valid server data AND no newer cycle has been detected
  const shouldSkip = hasServerData && !forceClientMode;

  // Update global ref so any remaining cached queries can access it
  useEffect(() => {
    if (systemStats?.lastResearchAt) {
      globalLastResearchAt.current = systemStats.lastResearchAt;
    }
  }, [systemStats?.lastResearchAt]);

  // All other queries - SKIP entirely when we have server data
  // The 5th parameter is the skip flag

  const {
    data: clientThailandNews,
    isLoading: clientThNewsLoading,
    isRefreshing: thNewsRefreshing
  } = useCachedQuery<any[]>(
    api.api.getNewsSlim,
    { country: "thailand", limit: 20 },
    "borderclash_th_news_v2",
    systemStats?.lastResearchAt,
    shouldSkip
  );

  const {
    data: clientCambodiaNews,
    isLoading: clientKhNewsLoading,
    isRefreshing: khNewsRefreshing
  } = useCachedQuery<any[]>(
    api.api.getNewsSlim,
    { country: "cambodia", limit: 20 },
    "borderclash_kh_news_v2",
    systemStats?.lastResearchAt,
    shouldSkip
  );

  const {
    data: clientThailandMeta,
    isLoading: clientThMetaLoading,
    isRefreshing: thMetaRefreshing
  } = useCachedQuery<any>(
    api.api.getAnalysis,
    { target: "thailand" },
    "borderclash_th_meta_v2",
    systemStats?.lastResearchAt,
    shouldSkip
  );

  const {
    data: clientCambodiaMeta,
    isLoading: clientKhMetaLoading,
    isRefreshing: khMetaRefreshing
  } = useCachedQuery<any>(
    api.api.getAnalysis,
    { target: "cambodia" },
    "borderclash_kh_meta_v2",
    systemStats?.lastResearchAt,
    shouldSkip
  );

  const {
    data: clientNeutralMeta,
    isLoading: clientNeutralMetaLoading,
    isRefreshing: neutralMetaRefreshing
  } = useCachedQuery<any>(
    api.api.getAnalysis,
    { target: "neutral" },
    "borderclash_neutral_meta_v2",
    systemStats?.lastResearchAt,
    shouldSkip
  );

  const {
    data: clientDashboardStats,
    isLoading: clientDashboardLoading,
    isRefreshing: dashboardRefreshing
  } = useCachedQuery<any>(
    api.api.getDashboardStats,
    {},
    "borderclash_dashboard_stats_v2",
    systemStats?.lastResearchAt,
    shouldSkip
  );

  const {
    data: clientArticleCounts,
    isLoading: clientCountsLoading
  } = useCachedQuery<any>(
    api.api.getArticleCounts,
    {},
    "borderclash_article_counts_v2",
    systemStats?.lastResearchAt,
    shouldSkip
  );

  const {
    data: clientTimelineEvents,
    isLoading: clientTimelineLoading,
    isRefreshing: timelineRefreshing
  } = useCachedQuery<any>(
    api.api.getTimeline,
    {},
    "borderclash_timeline_v2",
    systemStats?.lastResearchAt,
    shouldSkip
  );

  // Final data: prefer server data (if not stale), fall back to client data
  const thailandNews = shouldSkip ? initialData.thailandNews : clientThailandNews;
  const cambodiaNews = shouldSkip ? initialData.cambodiaNews : clientCambodiaNews;
  const thailandMeta = shouldSkip ? initialData.thailandAnalysis : clientThailandMeta;
  const cambodiaMeta = shouldSkip ? initialData.cambodiaAnalysis : clientCambodiaMeta;
  const neutralMeta = shouldSkip ? initialData.neutralAnalysis : clientNeutralMeta;
  const dashboardStats = shouldSkip ? initialData.dashboardStats : clientDashboardStats;
  const articleCounts = shouldSkip ? initialData.articleCounts : clientArticleCounts;
  const timelineEvents = shouldSkip ? initialData.timelineEvents : clientTimelineEvents;

  // Loading states: if we have server data, we're never "loading"
  const thNewsLoading = hasServerData ? false : clientThNewsLoading;
  const khNewsLoading = hasServerData ? false : clientKhNewsLoading;
  const thMetaLoading = hasServerData ? false : clientThMetaLoading;
  const khMetaLoading = hasServerData ? false : clientKhMetaLoading;
  const neutralMetaLoading = hasServerData ? false : clientNeutralMetaLoading;
  const dashboardLoading = hasServerData ? false : clientDashboardLoading;
  const countsLoading = hasServerData ? false : clientCountsLoading;
  const timelineLoading = hasServerData ? false : clientTimelineLoading;



  // --- Modal Navigation & Touch State ---

  // Compute sorted events for navigation (memoized)
  // Sort by date first, then by timeOfDay, then by importance (matching timeline display order)
  const sortedEvents = useMemo(() => {
    if (!timelineEvents) return [];
    return [...timelineEvents].sort((a: any, b: any) => {
      // First sort by date
      const dateCompare = new Date(a.date).getTime() - new Date(b.date).getTime();
      if (dateCompare !== 0) return dateCompare;

      // Then by time of day (ascending - earliest first)
      const timeA = a.timeOfDay || '23:59';
      const timeB = b.timeOfDay || '23:59';
      if (timeA !== timeB) return timeA.localeCompare(timeB);

      // Finally by importance (descending - most important first)
      return (b.importance || 0) - (a.importance || 0);
    });
  }, [timelineEvents]);

  const currentIndex = selectedEvent ? sortedEvents.findIndex((e: any) => e._id === selectedEvent._id) : -1;
  const hasNext = currentIndex !== -1 && currentIndex < sortedEvents.length - 1;
  const hasPrev = currentIndex > 0;

  // Navigation fade state
  const [isNavigating, setIsNavigating] = useState(false);
  const [previousEvent, setPreviousEvent] = useState<any>(null);

  // Crossfade navigation - overlap old and new
  const goToNext = () => {
    if (hasNext && !isNavigating) {
      setPreviousEvent(selectedEvent);
      setSelectedEvent(sortedEvents[currentIndex + 1]);
      setShowAllSources(false);
      setIsNavigating(true);

      setTimeout(() => {
        setIsNavigating(false);
        setPreviousEvent(null);
      }, 300);
    }
  };

  const goToPrev = () => {
    if (hasPrev && !isNavigating) {
      setPreviousEvent(selectedEvent);
      setSelectedEvent(sortedEvents[currentIndex - 1]);
      setShowAllSources(false);
      setIsNavigating(true);

      setTimeout(() => {
        setIsNavigating(false);
        setPreviousEvent(null);
      }, 300);
    }
  };

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') closeModal();
    if (e.key === 'ArrowRight' || e.key === 'ArrowUp') goToNext();
    if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') goToPrev();
  };

  // Derived loading state updated to check combined loading states
  const isLoading = thNewsLoading || khNewsLoading || neutralMetaLoading || dashboardLoading;
  const isSyncing = systemStats?.systemStatus === 'syncing';

  // --- TIMELINE STATE AND LOGIC ---
  const [selectedTimelineDate, setSelectedTimelineDate] = useState<string | null>(null);
  const timelineScrollRef = useRef<HTMLDivElement>(null);
  const datePickerRef = useRef<HTMLDivElement>(null);

  // Derive available dates and group ALL events by date (for continuous scroll)
  const { timelineDates, groupedEvents, dateCounts } = useMemo(() => {
    if (!timelineEvents || timelineEvents.length === 0) {
      return { timelineDates: [], groupedEvents: {} as Record<string, any[]>, dateCounts: {} };
    }

    // counts per date and group events
    const counts: Record<string, number> = {};
    const groups: Record<string, any[]> = {};

    timelineEvents.forEach((e: any) => {
      if (e.date) {
        counts[e.date] = (counts[e.date] || 0) + 1;
        if (!groups[e.date]) groups[e.date] = [];
        groups[e.date].push(e);
      }
    });

    // Sort events within each group by time ascending (morning first)
    Object.keys(groups).forEach(date => {
      groups[date].sort((a: any, b: any) => {
        const timeA = a.timeOfDay || '23:59';
        const timeB = b.timeOfDay || '23:59';
        if (timeA !== timeB) return timeA.localeCompare(timeB);
        return (b.importance || 0) - (a.importance || 0);
      });
    });

    // Unique dates sorted ascending (oldest first)
    const dates = Object.keys(counts).sort();

    return { timelineDates: dates, groupedEvents: groups, dateCounts: counts };
  }, [timelineEvents]);

  // Set default selected date to the last (newest) because users want the most recent info
  useEffect(() => {
    if (!selectedTimelineDate && timelineDates.length > 0) {
      const latestDate = timelineDates[timelineDates.length - 1];
      setSelectedTimelineDate(latestDate);
    }
  }, [timelineDates, selectedTimelineDate]);

  // Handle auto-scroll to latest date on initial load or view switch
  useEffect(() => {
    if (viewMode === 'LOSSES' && timelineDates.length > 0) {
      const latestDate = timelineDates[timelineDates.length - 1];
      // Small delay to ensure the timeline container is rendered and height is calculated
      const timer = setTimeout(() => {
        scrollToDate(latestDate);
      }, 150);
      return () => clearTimeout(timer);
    }
  }, [viewMode, timelineDates.length]); // Re-run if view changes or new dates are added

  // Auto-scroll date picker to show selected date
  // Needs delay on initial render since the picker may not be visible yet
  useEffect(() => {
    if (!selectedTimelineDate || !datePickerRef.current) return;

    // Small delay to ensure the date picker is rendered (especially on view switch)
    const timer = setTimeout(() => {
      const button = datePickerRef.current?.querySelector(`[data-date="${selectedTimelineDate}"]`) as HTMLElement;
      if (button) {
        // Scroll the button into view within the horizontal container
        button.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
      }
    }, 200);

    return () => clearTimeout(timer);
  }, [selectedTimelineDate, viewMode]); // Also re-run when viewMode changes (picker becomes visible)

  // Scroll to selected date section
  const scrollToDate = (date: string) => {
    setSelectedTimelineDate(date);
    const element = document.getElementById(`timeline-date-${date}`);
    if (element && timelineScrollRef.current) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  // Sync date selector when user scrolls (debounced for smooth mobile)
  useEffect(() => {
    if (!timelineScrollRef.current || timelineDates.length === 0) return;

    let debounceTimer: NodeJS.Timeout | null = null;
    const lastSelectedDateRef = { current: selectedTimelineDate };

    const findNearestDate = () => {
      const container = timelineScrollRef.current;
      if (!container) return null;

      let nearestDate = timelineDates[0];
      let nearestDistance = Infinity;

      // Find the date section closest to the top of the container
      for (const date of timelineDates) {
        const element = document.getElementById(`timeline-date-${date}`);
        if (element) {
          const rect = element.getBoundingClientRect();
          const containerRect = container.getBoundingClientRect();
          const distanceFromTop = rect.top - containerRect.top;

          // Find section closest to top (within reasonable range)
          if (Math.abs(distanceFromTop) < Math.abs(nearestDistance)) {
            nearestDistance = distanceFromTop;
            nearestDate = date;
          }
          // If this section is below viewport, previous was our target
          if (distanceFromTop > container.clientHeight * 0.3) break;
        }
      }
      return nearestDate;
    };

    const handleScroll = () => {
      // Clear previous debounce
      if (debounceTimer) clearTimeout(debounceTimer);

      // Debounce: wait 80ms after scroll stops to update
      debounceTimer = setTimeout(() => {
        const nearestDate = findNearestDate();
        if (nearestDate && nearestDate !== lastSelectedDateRef.current) {
          lastSelectedDateRef.current = nearestDate;
          setSelectedTimelineDate(nearestDate);
        }
      }, 80);
    };

    const container = timelineScrollRef.current;
    container.addEventListener('scroll', handleScroll, { passive: true });

    // Run initial check after a short delay to ensure DOM is ready
    const initialCheck = setTimeout(() => {
      const nearestDate = findNearestDate();
      if (nearestDate) {
        lastSelectedDateRef.current = nearestDate;
        setSelectedTimelineDate(nearestDate);
      }
    }, 100);

    return () => {
      container.removeEventListener('scroll', handleScroll);
      if (debounceTimer) clearTimeout(debounceTimer);
      clearTimeout(initialCheck);
    };
  }, [timelineDates, lang]); // Re-initialize when language changes (date headers re-render)


  // Measure Neutral Card Height to set siblings
  useLayoutEffect(() => {
    const measureHeight = () => {
      // Only sync height on large screens (lg breakpoint is 1024px)
      if (window.innerWidth >= 1024 && neutralRef.current) {
        setNeutralColumnHeight(neutralRef.current.offsetHeight);
      } else {
        setNeutralColumnHeight(undefined);
      }
    };

    // Measure initially and when content might change
    measureHeight();

    const resizeObserver = new ResizeObserver(measureHeight);
    if (neutralRef.current) {
      resizeObserver.observe(neutralRef.current);
    }

    window.addEventListener('resize', measureHeight);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener('resize', measureHeight);
    };
  }, [neutralMeta, isLoading, lang, viewMode]); // Re-measure if data, language, or VIEW MODE changes

  // Measure sidebar height for timeline view sync
  useLayoutEffect(() => {
    const measureSidebarHeight = () => {
      if (window.innerWidth >= 768 && sidebarRef.current) {
        setSidebarHeight(sidebarRef.current.offsetHeight);
      } else {
        setSidebarHeight(undefined);
      }
    };

    measureSidebarHeight();

    const resizeObserver = new ResizeObserver(measureSidebarHeight);
    if (sidebarRef.current) {
      resizeObserver.observe(sidebarRef.current);
    }

    window.addEventListener('resize', measureSidebarHeight);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener('resize', measureSidebarHeight);
    };
  }, [viewMode]); // Re-measure for timeline view

  // Timer Logic for countdown display
  // Also detect "possibly stale" state when we think the cycle should have completed
  const [isPossiblyStale, setIsPossiblyStale] = useState(false);

  useEffect(() => {
    if (!systemStats?.lastResearchAt) return;

    const updateCountdown = () => {
      // 360 minutes (6 hours) in milliseconds (matches cron schedule)
      const cycleInterval = 360 * 60 * 1000;
      // Calculate time since the last research finished
      const timeSinceLastUpdate = Date.now() - systemStats.lastResearchAt;
      // Calculate remaining time until next check
      const remaining = Math.max(0, cycleInterval - timeSinceLastUpdate);
      setNextUpdateIn(Math.floor(remaining / 1000));

      // If remaining is 0 and has been for more than 60 seconds, data might be stale
      // (the server should have updated by now)
      if (remaining === 0 && timeSinceLastUpdate > cycleInterval + 60000) {
        setIsPossiblyStale(true);
      } else {
        setIsPossiblyStale(false);
      }
    };

    updateCountdown();
    const timer = setInterval(updateCountdown, 1000);
    return () => clearInterval(timer);
  }, [systemStats?.lastResearchAt, systemStats?.isPaused, tabFocusKey]);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const formatTimestamp = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString();
  };

  // Helper to get narrative based on language
  const getNarrative = (meta: any) => {
    if (!meta) return null;
    if (lang === 'th' && meta.officialNarrativeTh) return meta.officialNarrativeTh;
    if (lang === 'kh' && meta.officialNarrativeKh) return meta.officialNarrativeKh;
    return meta.officialNarrativeEn || meta.officialNarrative;
  };

  // Helper to get summary based on language
  const getSummary = (meta: any) => {
    if (!meta) return null;
    if (lang === 'th' && meta.generalSummaryTh) return meta.generalSummaryTh;
    if (lang === 'kh' && meta.generalSummaryKh) return meta.generalSummaryKh;
    return meta.generalSummaryEn || meta.generalSummary;
  };

  // Helper to get key events based on language
  const getKeyEvents = (meta: any) => {
    if (!meta) return [];
    if (lang === 'th' && meta.keyEventsTh?.length) return meta.keyEventsTh;
    if (lang === 'kh' && meta.keyEventsKh?.length) return meta.keyEventsKh;
    return meta.keyEventsEn || meta.keyEvents || [];
  };



  // Helper to format dates correctly for all languages (fixing Chrome/Khmer issues)
  const formatDate = (dateInput: string | number | Date, formatStr: 'short' | 'long' | 'weekday' = 'long') => {
    const d = new Date(dateInput);

    if (lang === 'kh') {
      const day = d.getDate();
      const month = KH_MONTHS[d.getMonth()];
      const year = d.getFullYear();

      if (formatStr === 'short') return `${day} ${month}`;
      if (formatStr === 'weekday') return `${day} ${month}`; // Simplified for header if needed
      return `${day} ${month} ${year}`; // Default long
    }

    if (lang === 'th' && formatStr === 'short') {
      const day = d.getDate();
      const month = TH_MONTHS_SHORT[d.getMonth()];
      return `${day} ${month}`;
    }

    // Existing logic for others
    const locale = lang === 'th' ? 'th-TH' : 'en-US';

    if (formatStr === 'short') {
      return d.toLocaleDateString(locale, { month: 'short', day: 'numeric' });
    }
    if (formatStr === 'weekday') {
      return d.toLocaleDateString(locale, { weekday: 'long', month: 'long', day: 'numeric' });
    }
    return d.toLocaleDateString(locale, { year: 'numeric', month: 'long', day: 'numeric' });
  };

  // Default stats (analyses table removed - using simple defaults)
  const displayStats = {
    displacedCivilians: 0,
    confirmedInjuries: 0,
    propertyDamaged: 0,
  };

  // Language class for font-size boost (Thai/Khmer need larger text)
  const langClass = lang === 'th' ? 'lang-th' : lang === 'kh' ? 'lang-kh' : '';

  // Memoize the timeline list to prevent re-renders on scroll (Date Picker updates)
  const timelineContent = useMemo(() => {
    return timelineDates.map((date) => {
      const events = groupedEvents[date] || [];
      const categoryColors: Record<string, string> = {
        military: 'bg-red-500',
        diplomatic: 'bg-blue-500',
        humanitarian: 'bg-yellow-500',
        political: 'bg-purple-500',
      };

      return (
        <div key={date} id={`timeline-date-${date}`}>
          {/* Date Header - pins flush to top */}
          <div className="sticky top-0 z-30 transform-gpu">
            <div className="bg-riso-paper border-b border-riso-ink/10 py-3 px-4 md:px-8 shadow-sm">
              <div className="flex items-center justify-between max-w-2xl mx-auto">
                <div className="flex items-center gap-3">
                  <div className="w-3 h-3 rounded-full bg-riso-ink"></div>
                  <h3 className="font-display text-xl uppercase tracking-wide">
                    {formatDate(date, 'weekday')}
                  </h3>
                </div>
                <span className="font-mono text-xs opacity-50">{events.length} {t.reports}</span>
              </div>
            </div>
          </div>

          {/* Events for this date */}
          <div className="space-y-6 px-4 md:px-8 py-6">
            {events.map((event: any, index: number) => {
              const isRight = index % 2 === 0;
              const isImportant = (event.importance || 0) > 75;

              return (
                <div key={event._id} className={`relative flex md:items-center ${isRight ? 'md:flex-row' : 'md:flex-row-reverse'} flex-row ml-6 md:ml-0`}>
                  <div className="hidden md:block flex-1"></div>

                  {/* Center Node - Vertically centered on mobile */}
                  <div className="absolute left-[-2.25rem] md:left-1/2 top-1/2 -translate-y-1/2 flex items-center justify-center w-6 h-6 md:w-8 md:h-8 md:-translate-x-1/2 z-10">
                    <div
                      className={`rounded-full border-2 border-riso-paper shadow-sm transition-all hover:scale-125 cursor-pointer
                        ${categoryColors[event.category?.toLowerCase()] || 'bg-gray-500'}
                        ${isImportant ? 'animate-pulse ring-2 ring-offset-1 md:ring-offset-2 ring-riso-accent' : ''}
                        w-6 h-6 md:w-8 md:h-8 flex items-center justify-center`}
                      onClick={() => setSelectedEvent(event)}
                    >
                      {(() => {
                        const cat = event.category?.toLowerCase();
                        const IconClass = "w-3 h-3 md:w-4 md:h-4 text-white drop-shadow-sm";
                        if (cat === 'military') return <Swords className={IconClass} />;
                        if (cat === 'diplomatic') return <Handshake className={IconClass} />;
                        if (cat === 'humanitarian') return <Heart className={IconClass} />;
                        if (cat === 'political') return <Landmark className={IconClass} />;
                        return null;
                      })()}
                    </div>
                  </div>

                  {/* Connector Line */}
                  <div className={`hidden md:block absolute top-1/2 h-px bg-riso-ink/20 w-8 md:w-16 ${isRight ? 'left-8 md:left-[calc(50%+1rem)]' : 'right-8 md:right-[calc(50%+1rem)]'}`}></div>

                  {/* Event Card */}
                  <div className={`flex-1 ${isRight ? 'md:pl-12' : 'md:pr-12'}`}>
                    <div
                      className={`relative bg-riso-paper p-3 rounded-sm border hover:shadow-lg transition-all cursor-pointer group
                        ${isImportant ? 'border-riso-accent border-2' : 'border-riso-ink/20 dashed-border-sm'}`}
                      onClick={() => setSelectedEvent(event)}
                    >
                      <div className="flex justify-between items-start mb-1">
                        <span className={`font-mono ${lang === 'kh' || lang === 'th' ? 'text-[13px] font-semibold' : 'text-[10px] font-bold uppercase'} ${lang === 'kh' ? 'leading-relaxed py-1' : 'py-0.5'} px-1.5 rounded text-white ${categoryColors[event.category?.toLowerCase()] || 'bg-gray-500'}`}>
                          {t[`cat_${event.category?.toLowerCase()}` as keyof typeof t] || event.category}
                        </span>
                        <span className="font-mono text-[10px] opacity-50">
                          {event.timeOfDay || 'All Day'}
                        </span>
                      </div>

                      <h4 className={`font-bold leading-tight mb-1 group-hover:text-blue-700 transition-colors ${lang === 'kh' ? 'text-base font-mono leading-relaxed' : lang === 'th' ? 'text-base font-mono' : 'text-sm font-display uppercase tracking-wide'}`}>
                        {(() => {
                          if (lang === 'th' && event.titleTh) return event.titleTh;
                          if (lang === 'kh' && event.titleKh) return event.titleKh;
                          return event.title;
                        })()}
                      </h4>

                      <p className={`line-clamp-2 opacity-70 ${lang === 'kh' ? 'text-sm leading-relaxed' : lang === 'th' ? 'text-sm' : 'text-xs font-mono'}`}>
                        {(() => {
                          if (lang === 'th' && event.descriptionTh) return event.descriptionTh;
                          if (lang === 'kh' && event.descriptionKh) return event.descriptionKh;
                          return event.description;
                        })()}
                      </p>

                      {event.sources && event.sources.length > 0 && (
                        <div className="mt-2 flex items-center gap-1">
                          <div className="flex -space-x-1">
                            {[...Array(Math.min(3, event.sources.length))].map((_, i) => (
                              <div key={i} className="w-4 h-4 rounded-full bg-gray-200 border border-white flex items-center justify-center text-[8px] font-mono">📄</div>
                            ))}
                          </div>
                          <span className="text-[9px] font-mono opacity-50">+{event.sources.length} {t.sources}</span>
                        </div>
                      )}

                      <div className={`absolute top-1/2 w-2 h-2 bg-riso-ink rounded-full ${isRight ? '-left-1' : '-right-1'} transform -translate-y-1/2 hidden md:block opacity-20`}></div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      );
    });
  }, [timelineDates, groupedEvents, lang]);

  // Show error state if server-side fetching failed and we have no fallback data
  if (serverError && !hasServerData) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f8f5e6] p-8">
        <div className="max-w-md w-full bg-white p-8 border-4 border-red-500 shadow-lg">
          <h1 className="font-display text-4xl text-red-600 mb-4">SYSTEM ERROR</h1>
          <p className="font-mono text-sm text-gray-700 mb-4">
            Failed to load data from the server. This could be a temporary issue.
          </p>
          <pre className="font-mono text-xs bg-gray-100 p-3 overflow-x-auto mb-4 text-red-700">
            {serverError}
          </pre>
          <button
            onClick={() => window.location.reload()}
            className="w-full bg-red-500 text-white py-3 font-mono font-bold uppercase tracking-wider hover:bg-red-600 transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen flex flex-col justify-center ${langClass}`}>
      <div className="relative p-4 md:p-8 flex flex-col md:flex-row gap-6 max-w-[1600px] mx-auto w-full">
        {/* The Risograph Grain Overlay */}
        <div className="riso-grain"></div>

        {/* Left Sidebar / Header (Mobile Top) */}
        <aside ref={sidebarRef} className="md:w-64 flex-shrink-0 flex flex-col gap-3 self-start">
          <div className="border-4 border-riso-ink p-4 bg-riso-paper">
            <h1 className="font-display text-5xl md:text-6xl leading-none tracking-tighter text-riso-ink mb-2">
              BORDER CLASH
            </h1>
            <div className="flex items-center gap-2 mb-4">
              <div className={`w-3 h-3 rounded-full ${isPossiblyStale ? 'bg-yellow-500 animate-pulse' :
                isSyncing ? 'bg-riso-accent animate-ping' :
                  'bg-green-600'
                }`}></div>
              <span className="font-mono text-xs font-bold tracking-widest">
                {isPossiblyStale ? 'REFRESHING...' :
                  isSyncing ? t.syncing :
                    systemStats?.systemStatus === 'error' ? t.error :
                      t.systemOnline}
              </span>
              {/* Data source indicator (dev helper) */}
              <span className={`ml-auto text-[8px] font-mono px-1 rounded ${forceClientMode ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                {forceClientMode ? 'LIVE' : 'ISR'}
              </span>
            </div>
            <div className={`font-mono space-y-2 border-t border-riso-ink pt-4 opacity-80 ${lang === 'kh' || lang === 'th' ? 'text-sm' : 'text-xs'}`}>
              <p className="leading-relaxed">
                {t.subTitle}
              </p>
            </div>
          </div>

          {/* Control Panel */}
          <div className="bg-riso-ink text-riso-paper p-4 rough-border-sm">
            <div className="flex justify-between items-start mb-3">
              <div>
                <p className={`font-mono opacity-70 mb-1 ${lang === 'kh' || lang === 'th' ? 'text-[15px]' : 'text-[10px]'}`}>{t.nextAutoScan}</p>
                <p className="font-mono text-3xl font-bold">
                  {systemStats?.isPaused ? (
                    <span className="text-yellow-600">{t.paused}</span>
                  ) : isSyncing ? (
                    <span className="animate-pulse text-riso-accent">{t.running}</span>
                  ) : (sysStatsLoading || nextUpdateIn === null || isPossiblyStale) ? (
                    <HackerScramble />
                  ) : (
                    formatTime(nextUpdateIn)
                  )}
                </p>
              </div>
              <div className="text-right">
                <p className="font-mono text-[10px] opacity-70 mb-1">{t.sourcesTracked}</p>
                <p className="font-mono text-xl font-bold">
                  {sysStatsLoading || countsLoading ? (
                    <HackerScramble />
                  ) : (
                    (articleCounts?.cambodia || 0) + (articleCounts?.international || 0) + (articleCounts?.thailand || 0)
                  )}
                </p>
              </div>
            </div>

            {/* Sources Tracked - Visual Bar */}
            <div className="bg-riso-paper text-riso-ink p-2 rounded rough-border-sm">

              {/* Proportional Bar */}
              <div className="flex h-3 rounded-sm overflow-hidden bg-black/5 border border-black/10">
                {(() => {
                  const kh = articleCounts?.cambodia || 0;
                  const intl = articleCounts?.international || 0;
                  const th = articleCounts?.thailand || 0;
                  const total = (kh + intl + th) || 1;
                  return (
                    <>
                      <div
                        className="bg-[#032EA1] transition-all duration-500"
                        style={{ width: `${(kh / total) * 100}%` }}
                        title={`Cambodia: ${kh}`}
                      />
                      <div
                        className="bg-gray-400 transition-all duration-500"
                        style={{ width: `${(intl / total) * 100}%` }}
                        title={`International: ${intl}`}
                      />
                      <div
                        className="bg-[#241D4F] transition-all duration-500"
                        style={{ width: `${(th / total) * 100}%` }}
                        title={`Thailand: ${th}`}
                      />
                    </>
                  );
                })()}
              </div>

              {/* Legend with counts & labels */}
              <div className="flex justify-between text-[10px] font-mono font-bold pt-1.5">
                <span className="flex items-center gap-1.5 text-[#032EA1]">
                  <span className="w-2 h-2 bg-[#032EA1] rounded-full"></span>
                  {t.labelKH} {articleCounts?.cambodia || 0}
                </span>
                <span className="flex items-center gap-1.5 text-gray-600">
                  <span className="w-2 h-2 bg-gray-400 rounded-full"></span>
                  {t.labelINTL} {articleCounts?.international || 0}
                </span>
                <span className="flex items-center gap-1.5 text-[#241D4F]">
                  <span className="w-2 h-2 bg-[#241D4F] rounded-full"></span>
                  {t.labelTH} {articleCounts?.thailand || 0}
                </span>
              </div>
            </div>
          </div>

          {/* View Selector */}
          <div className={`rough-border-sm p-4 bg-white/50 font-mono flex flex-col ${lang === 'kh' || lang === 'th' ? 'text-sm' : 'text-xs'}`}>
            <div className="flex items-center gap-2 mb-1 uppercase font-bold border-b border-riso-ink/20 pb-1">
              {t.viewMode}
            </div>
            <div className="flex flex-col gap-1">
              <label className="flex items-center gap-2 cursor-pointer hover:bg-riso-ink/5 p-1 transition-colors">
                <input
                  type="radio"
                  name="viewMode"
                  value="ANALYSIS"
                  checked={viewMode === 'ANALYSIS'}
                  onChange={(e) => setViewMode(e.target.value as any)}
                  className="accent-riso-ink"
                />
                <span className="font-bold">{t.analysis}</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer hover:bg-riso-ink/5 p-1 transition-colors">
                <input
                  type="radio"
                  name="viewMode"
                  value="LOSSES"
                  checked={viewMode === 'LOSSES'}
                  onChange={(e) => setViewMode(e.target.value as any)}
                  className="accent-riso-ink"
                />
                <span className="font-bold">{t.timeline}</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer hover:bg-riso-ink/5 p-1 transition-colors">
                <input
                  type="radio"
                  name="viewMode"
                  value="GUIDE"
                  checked={viewMode === 'GUIDE'}
                  onChange={(e) => setViewMode(e.target.value as any)}
                  className="accent-riso-ink"
                />
                <span className="font-bold">{t.guide}</span>
              </label>
            </div>
          </div>

          {/* Language Selector */}
          <div className="rough-border-sm p-3 bg-white/50 font-mono text-xs">
            <div className="flex items-center justify-between mb-2">
              <span className="uppercase font-bold">{t.language}</span>
            </div>
            <div className="flex gap-1">
              <button
                onClick={() => setLang('kh')}
                className={`flex-1 py-1.5 rounded text-xs font-bold transition-colors ${lang === 'kh' ? 'bg-riso-ink text-riso-paper' : 'bg-riso-ink/10 hover:bg-riso-ink/20'
                  }`}
              >
                ខ្មែរ
              </button>
              <button
                onClick={() => setLang('en')}
                className={`flex-1 py-1.5 rounded text-xs font-bold transition-colors ${lang === 'en' ? 'bg-riso-ink text-riso-paper' : 'bg-riso-ink/10 hover:bg-riso-ink/20'
                  }`}
              >
                EN
              </button>
              <button
                onClick={() => setLang('th')}
                className={`flex-1 py-1.5 rounded text-xs font-bold transition-colors ${lang === 'th' ? 'bg-riso-ink text-riso-paper' : 'bg-riso-ink/10 hover:bg-riso-ink/20'
                  }`}
              >
                ไทย
              </button>
            </div>
          </div>

          {/* Automation Disclaimer - Technical "System Status" Look */}
          <div className="flex flex-col">
            <div className="relative border border-riso-ink/20 bg-riso-ink/5 p-4">
              {/* Technical Corner Accents */}
              <div className="absolute top-0 left-0 w-1.5 h-1.5 border-t border-l border-riso-ink"></div>
              <div className="absolute top-0 right-0 w-1.5 h-1.5 border-t border-r border-riso-ink"></div>
              <div className="absolute bottom-0 left-0 w-1.5 h-1.5 border-b border-l border-riso-ink"></div>
              <div className="absolute bottom-0 right-0 w-1.5 h-1.5 border-b border-r border-riso-ink"></div>

              {/* Header */}
              <div className="flex items-center gap-2 mb-2 pb-2 border-b border-riso-ink/10">
                <Terminal size={12} className="text-riso-ink" />
                <h4 className="font-bold font-mono text-[10px] uppercase tracking-widest text-riso-ink">
                  {t.disclaimerTitle}
                </h4>
              </div>

              {/* Body */}
              <p className={`font-mono text-riso-ink/80 leading-relaxed ${lang === 'kh' || lang === 'th' ? 'text-[13px] leading-6' : 'text-xs'}`}>
                {t.disclaimerBody}
              </p>
            </div>

            {/* Minimized System Log */}
            <div className="mt-2 border-t border-dashed border-riso-ink/30 pt-3">
            </div>
          </div>
        </aside>

        {/* Main Content Grid */}
        <main className="flex-1 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 items-stretch">

          {viewMode === 'ANALYSIS' && (
            <>
              <div className="md:col-span-2 lg:col-span-3">
                <Card title={t.damageAssessment} icon={Crosshair} loading={dashboardLoading} refreshing={dashboardRefreshing}>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {/* Displaced Civilians */}
                    <div className="bg-riso-ink/5 p-4 border border-riso-ink/10 flex flex-col justify-between h-32">
                      <div>
                        <h4 className={`font-mono font-bold uppercase opacity-60 mb-1 ${lang === 'kh' || lang === 'th' ? 'text-[13px]' : 'text-[10px]'}`}>{t.displacedCivilians}</h4>
                        <span className="font-display text-5xl md:text-6xl text-riso-ink leading-none">{(dashboardStats?.displacedCount || 0).toLocaleString()}</span>
                      </div>
                      {/* Trend Indicator - Show last updated instead */}
                      <div className={`font-mono opacity-50 uppercase tracking-wider ${lang === 'kh' || lang === 'th' ? 'text-xs' : 'text-[10px]'}`}>
                        {dashboardStats?.lastUpdatedAt ? (
                          <span>{t.lastUpdated}: {(() => {
                            const d = new Date(dashboardStats.lastUpdatedAt);
                            const day = d.getDate();
                            const month = lang === 'kh' ? KH_MONTHS[d.getMonth()] : lang === 'th' ? TH_MONTHS_SHORT[d.getMonth()] : d.toLocaleDateString('en-US', { month: 'short' }).toUpperCase();
                            const time = d.toLocaleTimeString(lang === 'th' ? 'th-TH' : 'en-US', { hour: '2-digit', minute: '2-digit' });
                            return `${month} ${day}, ${time}`;
                          })()}</span>
                        ) : (
                          <span>{t.estimated}</span>
                        )}
                      </div>
                    </div>

                    {/* Fatalities (Replaces old Injuries box position) */}
                    <div className="bg-riso-ink/5 p-4 border border-riso-ink/10 flex flex-col justify-between h-32">
                      <div>
                        <h4 className={`font-mono font-bold uppercase opacity-60 mb-1 ${lang === 'kh' || lang === 'th' ? 'text-[13px]' : 'text-[10px]'}`}>{t.fatalities}</h4>
                        <span className="font-display text-5xl md:text-6xl text-riso-ink leading-none">{dashboardStats?.casualtyCount || 0}</span>
                      </div>
                      <div className="text-[10px] font-mono text-riso-accent font-bold uppercase tracking-wider">{t.confirmedOnly}</div>
                    </div>

                    {/* Injuries - Split into Civilian / Military */}
                    <div className="bg-riso-ink/5 p-4 border border-riso-ink/10 flex flex-col justify-between h-32">
                      {/* Top: Title + Numbers */}
                      <div>
                        <h4 className={`font-mono font-bold uppercase opacity-60 mb-1 ${lang === 'kh' || lang === 'th' ? 'text-[13px]' : 'text-[10px]'}`}>{t.injured}</h4>
                        <div className="flex items-center gap-4">
                          {/* Civilian */}
                          <span className="font-display text-4xl md:text-6xl text-riso-ink leading-none">{dashboardStats?.civilianInjuredCount || 0}</span>
                          {/* Divider */}
                          <div className="w-px h-10 bg-riso-ink/20"></div>
                          {/* Military */}
                          <span className="font-display text-4xl md:text-6xl text-riso-ink leading-none">{dashboardStats?.militaryInjuredCount || 0}</span>
                        </div>
                      </div>
                      {/* Bottom: Labels */}
                      <div className="flex items-center gap-4">
                        <span className={`font-mono opacity-50 ${lang === 'kh' || lang === 'th' ? 'text-[11px]' : 'text-[9px]'}`}>{t.civilian}</span>
                        <div className="w-px h-3 bg-transparent"></div>
                        <span className={`font-mono opacity-50 ${lang === 'kh' || lang === 'th' ? 'text-[11px]' : 'text-[9px]'}`}>{t.military}</span>
                      </div>
                    </div>

                    {/* Status / Threat Level - Uses dashboardStats for conflict level */}
                    <div className="bg-riso-ink/5 p-4 border border-riso-ink/10 flex flex-col h-32">
                      <h4 className={`font-mono font-bold uppercase opacity-60 mb-1 ${lang === 'kh' || lang === 'th' ? 'text-[13px]' : 'text-[10px]'}`}>{t.threatLevel}</h4>
                      <div className="flex-1 flex items-center">
                        <span className={`font-display text-4xl md:text-5xl leading-none uppercase ${(dashboardStats?.conflictLevel || 'Low').toUpperCase() === 'CRITICAL' ? 'text-riso-accent animate-pulse' :
                          (dashboardStats?.conflictLevel || 'Low').toUpperCase() === 'ELEVATED' ? 'text-yellow-600' : 'text-green-700'
                          }`}>
                          {(dashboardStats?.conflictLevel || 'Low').toUpperCase() === 'CRITICAL' ? t.critical :
                            (dashboardStats?.conflictLevel || 'Low').toUpperCase() === 'ELEVATED' ? t.elevated :
                              t.low}
                        </span>
                      </div>
                    </div>
                  </div>
                </Card>
              </div>
              {/* Three Perspectives Grid - Equal Height Columns where Neutral AI determines the height */}
              <div className="md:col-span-2 lg:col-span-3 grid grid-cols-1 lg:grid-cols-3 gap-6 items-stretch">

                {/* Section 2: Cambodia Perspective - matches height of Neutral AI */}
                <div className="flex flex-col gap-4" style={{ height: neutralColumnHeight }}>
                  <div className="bg-[#032EA1] text-[#f2f0e6] p-2 text-center font-display uppercase tracking-widest text-xl">
                    {t.cambodia}
                  </div>
                  <Card className="flex-1 h-full flex flex-col" loading={khNewsLoading || khMetaLoading} refreshing={khNewsRefreshing || khMetaRefreshing}>
                    <div className="flex-1 flex flex-col space-y-4 min-h-0">
                      {/* Official Narrative */}
                      <div>
                        <h4 className="font-mono text-[12px] font-bold uppercase mb-2 border-b border-riso-ink/20 pb-1">{t.officialNarrative}</h4>
                        {getNarrative(cambodiaMeta) ? (
                          <>
                            <p className={`italic leading-relaxed ${lang === 'kh' ? 'text-[17px] font-mono leading-relaxed' : lang === 'th' ? 'text-[17px] font-mono' : 'text-base font-serif'}`}>
                              "{getNarrative(cambodiaMeta)}"
                            </p>
                            <p className="text-right text-[10px] font-mono mt-1 opacity-60">— {cambodiaMeta.narrativeSource || t.aiAnalysis}</p>
                          </>
                        ) : (
                          <p className="font-mono text-xs opacity-50">{t.awaitingAnalysis}</p>
                        )}
                      </div>

                      {/* Military Intensity */}
                      <MilitaryIntensityGauge
                        intensity={cambodiaMeta?.militaryIntensity ?? 50}
                        posture={cambodiaMeta?.militaryPosture}
                        postureLabel={cambodiaMeta?.postureLabel}
                        postureLabelTh={cambodiaMeta?.postureLabelTh}
                        postureLabelKh={cambodiaMeta?.postureLabelKh}
                        postureRationale={cambodiaMeta?.postureRationale}
                        postureRationaleTh={cambodiaMeta?.postureRationaleTh}
                        postureRationaleKh={cambodiaMeta?.postureRationaleKh}
                        territorialContext={cambodiaMeta?.territorialContext}
                        perspective="cambodia"
                        lang={lang}
                      />

                      {/* Intelligence Log - Scrollable & Filterable */}
                      <IntelligenceLog
                        articles={cambodiaNews}
                        perspective="cambodia"
                        lang={lang}
                        isLoading={cambodiaNews === undefined}
                      />
                    </div>
                  </Card>
                </div>

                {/* Section 3: Neutral Analysis (Center) - MASTER height */}
                <div className="flex flex-col gap-4 self-start min-h-[400px] lg:min-h-[670px]" id="neutral-master" ref={neutralRef}>
                  <div className="bg-riso-ink text-riso-paper p-2 text-center font-display uppercase tracking-widest text-xl flex items-center justify-center gap-2">
                    <Scale size={18} /> {t.neutralAI}
                  </div>
                  <Card className="h-full flex flex-col border-dotted border-2 !shadow-none" loading={neutralMetaLoading} refreshing={neutralMetaRefreshing}>
                    <div className="flex-1 flex flex-col space-y-4 min-h-0">
                      <div className="mb-6">
                        <div className="flex items-center gap-2 mb-2">
                          <Badge type="outline">AI SYNTHESIS</Badge>
                          {neutralMeta?.conflictLevel && (
                            <Badge type="alert">{neutralMeta.conflictLevel}</Badge>
                          )}
                        </div>
                        <h3 className="font-display text-3xl mt-2 leading-none py-1">
                          {t.situationReport}
                        </h3>
                        <p className="font-mono text-xs opacity-50 mt-1">
                          {t.autoUpdating}
                        </p>
                      </div>

                      <div className={`flex-1 font-mono leading-relaxed text-justify mb-6 ${lang === 'kh' || lang === 'th' ? 'text-[17px]' : 'text-[15px]'}`}>
                        {getSummary(neutralMeta) || t.analyzingFeeds}
                      </div>

                      {getKeyEvents(neutralMeta).length > 0 && (
                        <div className="mb-4">
                          <p className={`font-bold font-mono mb-2 uppercase ${lang === 'kh' || lang === 'th' ? 'text-base' : 'text-xs'}`}>{t.keyDevelopments}:</p>
                          <ul className="list-disc pl-4 space-y-1">
                            {getKeyEvents(neutralMeta).map((event: string, i: number) => (
                              <li key={i} className={`font-mono ${lang === 'kh' || lang === 'th' ? 'text-base' : 'text-xs'}`}>{event}</li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* Source Stats - Compact */}

                    </div>
                  </Card>
                </div>

                {/* Section 4: Thailand Perspective - matches height of Neutral AI */}
                <div className="flex flex-col gap-4" style={{ height: neutralColumnHeight }}>
                  <div className="bg-[#241D4F] text-[#f2f0e6] p-2 text-center font-display uppercase tracking-widest text-xl">
                    {t.thailand}
                  </div>
                  <Card className="flex-1 h-full flex flex-col" loading={thNewsLoading || thMetaLoading} refreshing={thNewsRefreshing || thMetaRefreshing}>
                    <div className="flex-1 flex flex-col space-y-4 min-h-0">
                      {/* Official Narrative */}
                      <div>
                        <h4 className="font-mono text-xs font-bold uppercase mb-2 border-b border-riso-ink/20 pb-1">{t.officialNarrative}</h4>
                        {getNarrative(thailandMeta) ? (
                          <>
                            <p className={`italic leading-relaxed ${lang === 'kh' ? 'text-[17px] font-mono leading-relaxed' : lang === 'th' ? 'text-[17px] font-mono' : 'text-base font-serif'}`}>
                              "{getNarrative(thailandMeta)}"
                            </p>
                            <p className="text-right text-[10px] font-mono mt-1 opacity-60">— {thailandMeta.narrativeSource || t.aiAnalysis}</p>
                          </>
                        ) : (
                          <p className="font-mono text-xs opacity-50">{t.awaitingAnalysis}</p>
                        )}
                      </div>

                      {/* Military Intensity */}
                      <MilitaryIntensityGauge
                        intensity={thailandMeta?.militaryIntensity ?? 50}
                        posture={thailandMeta?.militaryPosture}
                        postureLabel={thailandMeta?.postureLabel}
                        postureLabelTh={thailandMeta?.postureLabelTh}
                        postureLabelKh={thailandMeta?.postureLabelKh}
                        postureRationale={thailandMeta?.postureRationale}
                        postureRationaleTh={thailandMeta?.postureRationaleTh}
                        postureRationaleKh={thailandMeta?.postureRationaleKh}
                        territorialContext={thailandMeta?.territorialContext}
                        perspective="thailand"
                        lang={lang}
                      />

                      {/* Intelligence Log - Scrollable & Filterable */}
                      <IntelligenceLog
                        articles={thailandNews}
                        perspective="thailand"
                        lang={lang}
                        isLoading={thailandNews === undefined}
                      />
                    </div>
                  </Card>
                </div>

              </div> {/* End of Three Perspectives Grid */}

            </>
          )
          }

          {
            viewMode === 'LOSSES' && (
              <>
                <div className="md:col-span-2 lg:col-span-3 flex flex-col gap-4 h-[calc(100dvh-4rem)] md:h-auto" style={{ height: typeof sidebarHeight !== 'undefined' ? sidebarHeight : undefined }}>
                  <Card title={`📜 ${t.historicalTimeline}`} loading={timelineLoading} refreshing={timelineRefreshing} className="h-full flex flex-col overflow-hidden">

                    {(!timelineEvents || timelineEvents.length === 0) ? (
                      <div className="text-center py-12 flex-1 flex flex-col justify-center items-center">
                        <p className="font-mono text-sm opacity-60">{t.noTimelineEvents}</p>
                        <p className="font-mono text-xs opacity-40 mt-2">{t.runHistorian}</p>
                      </div>
                    ) : (
                      <div className="flex flex-col h-full min-h-0">
                        {/* --- DATE SELECTOR BAR --- */}
                        <div className="flex-none p-4 border-b border-riso-ink/10 bg-riso-ink/5">
                          <div ref={datePickerRef} className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-2" style={{ scrollbarWidth: 'none' }}>
                            {timelineDates.map((date) => {
                              const isSelected = selectedTimelineDate === date;
                              const count = dateCounts[date] || 0;
                              return (
                                <button
                                  key={date}
                                  data-date={date}
                                  onClick={() => scrollToDate(date)}
                                  className={`
                                     flex flex-col items-center justify-center
                                     min-w-[80px] px-3 ${lang === 'kh' || lang === 'th' ? 'py-3' : 'py-2'} rounded-sm border-2 transition-colors duration-150 flex-shrink-0
                                     ${isSelected
                                      ? 'bg-riso-ink border-riso-ink text-riso-paper'
                                      : 'bg-riso-paper border-riso-ink/20 text-riso-ink hover:border-riso-ink/50 hover:bg-white'}
                                   `}
                                >
                                  <span className={`font-mono text-[10px] uppercase tracking-wider mb-1 ${isSelected ? 'opacity-70' : 'opacity-50'}`}>
                                    {new Date(date).getFullYear()}
                                  </span>
                                  <span className={`font-display text-xl uppercase ${lang === 'kh' || lang === 'th' ? 'leading-relaxed py-0.5' : 'leading-none'}`}>
                                    {formatDate(date, 'short')}
                                  </span>
                                  <span className={`text-[9px] font-mono mt-1 px-1.5 rounded-full ${isSelected ? 'bg-riso-paper text-riso-ink' : 'bg-riso-ink/10 text-riso-ink'}`}>
                                    {count} {t.events}
                                  </span>
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        {/* --- CONTINUOUS SCROLL TIMELINE --- */}
                        <div ref={timelineScrollRef} className="flex-1 overflow-y-auto min-h-0 bg-[url('/grid.svg')] bg-[length:20px_20px] overscroll-contain">
                          <div className="relative pb-12">
                            {/* Center Line - spans full content height, z-0 so headers cover it */}
                            <div className="absolute left-4 md:left-1/2 top-0 bottom-0 w-px border-l-2 border-dashed border-riso-ink/20 transform md:-translate-x-1/2 z-0"></div>
                            {timelineContent}

                            {timelineDates.length === 0 && (
                              <div className="flex flex-col items-center justify-center py-20 opacity-50">
                                <div className="w-16 h-16 border-2 border-dashed border-riso-ink rounded-full flex items-center justify-center mb-4">
                                  <span className="text-2xl">?</span>
                                </div>
                                <p className="font-mono text-sm">No confirmed reports.</p>
                              </div>
                            )}

                          </div>
                        </div>

                        {/* Legend - Fixed at bottom */}
                      </div>
                    )}
                  </Card>

                  {/* --- MODAL (Kept outside loop but assumes selectedEvent is global in this scope) --- */}
                  {/* Event Details Modal - Bottom Sheet with Swipe logic preserved */}
                  {selectedEvent && (() => {
                    const getEventTitle = (event: any) => {
                      if (lang === 'th' && event.titleTh) return event.titleTh;
                      if (lang === 'kh' && event.titleKh) return event.titleKh;
                      return event.title;
                    };
                    const getEventDescription = (event: any) => {
                      if (lang === 'th' && event.descriptionTh) return event.descriptionTh;
                      if (lang === 'kh' && event.descriptionKh) return event.descriptionKh;
                      return event.description;
                    };
                    const categoryColors: Record<string, string> = {
                      military: 'bg-red-500',
                      diplomatic: 'bg-blue-500',
                      humanitarian: 'bg-yellow-500',
                      political: 'bg-purple-500',
                    };

                    const renderInnerContent = (evt: any, isGhost: boolean) => {
                      if (!evt) return null;
                      const evtIndex = sortedEvents.indexOf(evt);
                      const evtHasNext = evtIndex !== -1 && evtIndex < sortedEvents.length - 1;
                      const evtHasPrev = evtIndex > 0;

                      return (
                        <div
                          className={`flex flex-col h-full w-full overflow-hidden ${isGhost ? 'absolute inset-0 z-20 bg-[#F2F2E9]' : 'relative z-10'}`}
                          style={isGhost ? { animation: 'borderClashFadeOut 200ms ease-out forwards', pointerEvents: 'none' } : {}}
                        >
                          {/* Header with Navigation */}
                          <div className="bg-riso-ink text-riso-paper p-4 flex justify-between items-start flex-shrink-0">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="text-[10px] font-mono tracking-[0.2em] uppercase opacity-70">{t.intelReport}</span>
                                <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></div>
                                <span className="text-[10px] font-mono opacity-50 ml-auto">
                                  {evtIndex + 1} / {sortedEvents.length}
                                </span>
                              </div>
                              <h3 className={`font-display text-xl md:text-2xl leading-tight ${lang === 'th' ? 'font-bold' : ''}`}>
                                {getEventTitle(evt)}
                              </h3>
                            </div>
                            <button
                              onClick={closeModal}
                              className="p-2 hover:bg-white/10 rounded-full transition-colors ml-4"
                              aria-label="Close modal"
                            >
                              <XIcon className="w-6 h-6" />
                            </button>
                          </div>

                          {/* Scrollable Body */}
                          <div className={`p-4 md:p-6 space-y-6 flex-1 ${isGhost ? 'overflow-hidden' : 'overflow-y-auto'}`}>
                            {/* Meta Info */}
                            <div className="flex flex-wrap gap-4 text-xs font-mono border-b border-riso-ink/10 pb-4">
                              <div>
                                <p className="opacity-50 uppercase tracking-wider mb-1">{t.date}</p>
                                <p className="font-bold">{formatDate(evt.date, 'long')}</p>
                                {evt.timeOfDay && (
                                  <p className="text-[10px] opacity-60 mt-0.5">{evt.timeOfDay}</p>
                                )}
                              </div>
                              <div>
                                <p className="opacity-50 uppercase tracking-wider mb-1">{t.impact}</p>
                                <div className="flex items-center gap-2">
                                  <span className="font-bold">{evt.importance}/100</span>
                                </div>
                              </div>
                              <div>
                                <p className="opacity-50 uppercase tracking-wider mb-1">{t.category}</p>
                                <span className={`inline-block px-2 rounded text-white font-bold ${categoryColors[evt.category?.toLowerCase()] || 'bg-gray-500'} ${lang === 'kh' ? 'text-[13px] font-semibold leading-relaxed py-1' : lang === 'th' ? 'text-[13px] font-semibold py-0.5' : 'text-[10px] uppercase py-0.5'}`}>
                                  {t[`cat_${evt.category?.toLowerCase()}` as keyof typeof t] || evt.category}
                                </span>
                              </div>
                            </div>

                            {/* Description */}
                            <p className={`text-base leading-relaxed text-gray-800 ${lang === 'kh' ? 'font-mono leading-relaxed' : lang === 'th' ? 'font-mono' : 'font-serif'}`}>
                              {getEventDescription(evt)}
                            </p>

                            {/* Sources */}
                            {evt.sources?.length > 0 && (() => {
                              // Sort by credibility (highest first)
                              const sortedSources = [...evt.sources].sort((a: any, b: any) => (b.credibility || 0) - (a.credibility || 0));
                              const topSources = sortedSources.slice(0, 3);
                              const remainingSources = sortedSources.slice(3);

                              return (
                                <div className="space-y-3">
                                  <p className="font-mono text-[10px] uppercase opacity-50">{t.topSources} ({evt.sources.length} {t.total})</p>
                                  <div className="flex flex-wrap gap-2">
                                    {topSources.map((s: any, idx: number) => (
                                      s.url ? (
                                        <a
                                          key={idx}
                                          href={s.url}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="inline-flex items-center gap-1 px-2 py-1 bg-white border border-gray-200 rounded text-xs font-mono hover:bg-blue-50 hover:border-blue-300 transition-colors cursor-pointer"
                                        >
                                          {s.name} ({s.credibility}%)
                                          <span className="opacity-50">↗</span>
                                        </a>
                                      ) : (
                                        <span key={idx} className="inline-block px-2 py-1 bg-white border border-gray-200 rounded text-xs font-mono">
                                          {s.name} ({s.credibility}%)
                                        </span>
                                      )
                                    ))}
                                  </div>

                                  {/* Expandable remaining sources */}
                                  {remainingSources.length > 0 && (
                                    <div>
                                      <button
                                        onClick={() => setShowAllSources(!showAllSources)}
                                        className="text-xs font-mono text-blue-600 hover:text-blue-800 underline"
                                      >
                                        {showAllSources ? `↑ ${t.hide}` : `↓ ${t.show} ${remainingSources.length} ${t.moreSources}`}
                                      </button>

                                      {showAllSources && (
                                        <div className="flex flex-wrap gap-2 mt-2">
                                          {remainingSources.map((s: any, idx: number) => (
                                            s.url ? (
                                              <a
                                                key={idx + 3}
                                                href={s.url}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="inline-flex items-center gap-1 px-2 py-1 bg-gray-50 border border-gray-200 rounded text-xs font-mono hover:bg-blue-50 hover:border-blue-300 transition-colors cursor-pointer"
                                              >
                                                {s.name} ({s.credibility}%)
                                                <span className="opacity-50">↗</span>
                                              </a>
                                            ) : (
                                              <span key={idx + 3} className="inline-block px-2 py-1 bg-gray-50 border border-gray-200 rounded text-xs font-mono">
                                                {s.name} ({s.credibility}%)
                                              </span>
                                            )
                                          ))}
                                        </div>
                                      )}
                                    </div>
                                  )}
                                </div>
                              );
                            })()}
                          </div>

                          {/* Navigation Footer */}
                          <div className="bg-riso-ink/5 border-t border-riso-ink/20 p-3 flex-shrink-0">
                            <div className="flex items-center justify-between gap-4">
                              <button
                                onClick={goToPrev}
                                disabled={!evtHasPrev}
                                className={`flex items-center gap-2 px-4 py-2 rounded-lg font-mono text-sm transition-all ${evtHasPrev ? 'bg-riso-ink text-riso-paper hover:bg-riso-ink/80' : 'bg-gray-200 text-gray-400 cursor-not-allowed'}`}
                              >
                                <span>←</span>
                                <span className="hidden sm:inline">{t.prev}</span>
                              </button>

                              <span className="font-mono text-xs opacity-50">
                                {t.navHint}
                              </span>

                              <button
                                onClick={goToNext}
                                disabled={!evtHasNext}
                                className={`flex items-center gap-2 px-4 py-2 rounded-lg font-mono text-sm transition-all ${evtHasNext ? 'bg-riso-ink text-riso-paper hover:bg-riso-ink/80' : 'bg-gray-200 text-gray-400 cursor-not-allowed'}`}
                              >
                                <span className="hidden sm:inline">{t.next}</span>
                                <span>→</span>
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    };

                    return (
                      <div
                        className="fixed inset-0 z-[100] flex items-center justify-center p-4 backdrop-blur-sm"
                        onClick={(e) => { if (e.target === e.currentTarget) closeModal(); }}
                        onKeyDown={handleKeyDown}
                        tabIndex={0}
                        ref={(el) => el?.focus()}
                        style={{
                          backgroundColor: 'rgba(0, 0, 0, 0.7)',
                          animation: isModalClosing
                            ? 'borderClashFadeOut 250ms ease-out forwards'
                            : 'borderClashFadeIn 250ms ease-out forwards',
                        }}
                      >
                        {/* Full-screen Card Modal */}
                        <div
                          className="relative bg-[#F2F2E9] w-full max-w-2xl max-h-[90vh] overflow-hidden rounded-xl border-4 border-riso-ink shadow-2xl flex flex-col"
                          onClick={(e) => e.stopPropagation()}
                          style={{
                            // Only handle Open/Close animations on the container
                            animation: isModalClosing
                              ? 'borderClashCardOut 250ms ease-out forwards'
                              : 'borderClashCardIn 250ms cubic-bezier(0.16, 1, 0.3, 1) forwards',
                          }}
                        >
                          {/* Main Card (always visible underneath) */}
                          {renderInnerContent(selectedEvent, false)}

                          {/* Ghost Card (fades out on top) */}
                          {isNavigating && previousEvent && renderInnerContent(previousEvent, true)}
                        </div>
                      </div>
                    );
                  })()}
                </div>
              </>
            )
          }

          {
            viewMode === 'GUIDE' && (
              <>
                <div className="md:col-span-2 lg:col-span-3">
                  <Card title={t.guideTitle}>
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

                      {/* LEFT COLUMN: CRITICAL LITERACY */}
                      <div className="space-y-8">
                        {/* Trust No One Warning */}
                        <div className="border-2 border-riso-ink p-6 relative overflow-hidden bg-riso-ink/5">
                          <div className="absolute top-0 left-0 w-16 h-16 bg-riso-ink -translate-x-8 -translate-y-8 rotate-45"></div>
                          <div className="relative z-10">
                            <h3 className="font-display text-2xl uppercase tracking-wide mb-3 flex items-center gap-3">
                              <span className="text-3xl">👁️</span> {t.trustWarning}
                            </h3>
                            <p className={`font-mono leading-relaxed opacity-90 ${lang === 'kh' || lang === 'th' ? 'text-sm' : 'text-xs'}`}>
                              {t.trustWarningDesc}
                            </p>
                          </div>
                        </div>

                        {/* Anti-Propaganda Checklist */}
                        <div>
                          <h4 className={`font-mono font-bold uppercase border-b-2 border-riso-ink/20 pb-2 ${lang === 'kh' || lang === 'th' ? 'text-base' : 'text-sm'}`}>{t.verificationChecklist}</h4>
                          <ul className="space-y-2 font-mono text-xs">
                            {[
                              { icon: "🕵️", text: t.checkSources },
                              { icon: "📸", text: t.lookForEvidence },
                              { icon: "🧠", text: t.considerBias },
                              { icon: "📅", text: t.checkDates },
                              { icon: "🎭", text: t.emotionalManipulation }
                            ].map((item, i) => (
                              <li key={i} className="flex items-start gap-4 p-2 bg-white/50 border border-transparent hover:border-riso-ink/20 transition-all rounded group">
                                <span className="text-xl filter sepia-[1] hue-rotate-[60deg] saturate-[1] opacity-70 group-hover:filter-none group-hover:opacity-100 transition-all duration-300">{item.icon}</span>
                                <span className={`opacity-80 mt-1 ${lang === 'kh' || lang === 'th' ? 'text-base' : 'text-xs'}`}>{item.text}</span>
                              </li>
                            ))}
                          </ul>
                        </div>

                        {/* Deepfake Warning */}
                        <div className="border-l-4 border-riso-accent pl-4 py-2 bg-riso-accent/5">
                          <h5 className="font-display text-lg text-riso-accent mb-1">{t.aiWarning}</h5>
                          <p className={`font-mono opacity-70 mb-2 ${lang === 'kh' || lang === 'th' ? 'text-sm' : 'text-[10px]'}`}>{t.aiWarningDesc}</p>
                          <div className="flex gap-2 text-xs font-mono font-bold text-riso-accent">
                            <span>{t.dfTip1}</span>
                          </div>
                        </div>


                        {/* FACT VS PROPAGANDA */}
                        <div className="space-y-4">
                          <h4 className={`font-mono font-bold uppercase border-b-2 border-riso-ink/20 pb-2 flex items-center gap-2 ${lang === 'kh' || lang === 'th' ? 'text-base' : 'text-sm'}`}>
                            <span className="text-xl">⚖️</span> {t.factVsPropaganda}
                          </h4>
                          <div className="grid grid-cols-1 gap-3">
                            {/* Comparison 1 */}
                            <div className={`bg-white/50 p-3 rounded border border-riso-ink/10 font-mono space-y-2 ${lang === 'kh' || lang === 'th' ? 'text-sm' : 'text-xs'}`}>
                              <p className="text-green-700 flex gap-2"><span className="font-bold">✓</span> {t.fact1}</p>
                              <p className="text-red-700 flex gap-2"><span className="font-bold">✗</span> {t.propaganda1}</p>
                            </div>
                            {/* Comparison 2 */}
                            <div className={`bg-white/50 p-3 rounded border border-riso-ink/10 font-mono space-y-2 ${lang === 'kh' || lang === 'th' ? 'text-sm' : 'text-xs'}`}>
                              <p className="text-green-700 flex gap-2"><span className="font-bold">✓</span> {t.fact2}</p>
                              <p className="text-red-700 flex gap-2"><span className="font-bold">✗</span> {t.propaganda2}</p>
                            </div>
                          </div>
                        </div>

                        {/* Open Source Link */}
                        <div className="pt-0">
                          <a
                            href="https://github.com/South-33/BorderClash"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-2 font-mono text-xs opacity-60 hover:opacity-100 transition-opacity"
                          >
                            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                              <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
                            </svg>
                            <span>View Source Code on GitHub</span>
                          </a>
                        </div>

                      </div>

                      {/* RIGHT COLUMN: HOW IT WORKS */}
                      <div className="space-y-8">
                        <div>
                          <h4 className="font-display text-xl uppercase mb-6 flex items-center gap-2">
                            <span className="w-2 h-2 bg-riso-ink rounded-full"></span>
                            {t.howItWorks}
                          </h4>

                          <div className="relative space-y-8 pl-8 before:absolute before:left-[11px] before:top-2 before:bottom-2 before:w-0.5 before:bg-riso-ink/10">
                            {/* Step 1: Curator */}
                            <div className="relative">
                              <div className="absolute -left-8 top-0 w-6 h-6 rounded-full bg-riso-ink text-white flex items-center justify-center font-bold font-mono text-xs">1</div>
                              <h5 className="font-mono font-bold uppercase mb-1">{t.curatorRole}</h5>
                              <p className={`font-mono opacity-70 leading-relaxed ${lang === 'kh' || lang === 'th' ? 'text-sm' : 'text-xs'}`}>{t.curatorDesc}</p>
                            </div>

                            {/* Step 2: Verifier */}
                            <div className="relative">
                              <div className="absolute -left-8 top-0 w-6 h-6 rounded-full bg-riso-ink text-white flex items-center justify-center font-bold font-mono text-xs">2</div>
                              <h5 className="font-mono font-bold uppercase mb-1">{t.verifierRole}</h5>
                              <p className={`font-mono opacity-70 leading-relaxed ${lang === 'kh' || lang === 'th' ? 'text-sm' : 'text-xs'}`}>{t.verifierDesc}</p>
                            </div>

                            {/* Step 3: Historian */}
                            <div className="relative">
                              <div className="absolute -left-8 top-0 w-6 h-6 rounded-full bg-riso-ink text-white flex items-center justify-center font-bold font-mono text-xs">3</div>
                              <h5 className="font-mono font-bold uppercase mb-1">{t.historianRole}</h5>
                              <p className={`font-mono opacity-70 leading-relaxed ${lang === 'kh' || lang === 'th' ? 'text-sm' : 'text-xs'}`}>{t.historianDesc}</p>
                            </div>

                            {/* Step 4: Synth */}
                            <div className="relative">
                              <div className="absolute -left-8 top-0 w-6 h-6 rounded-full bg-riso-ink text-white flex items-center justify-center font-bold font-mono text-xs">4</div>
                              <h5 className="font-mono font-bold uppercase mb-1">{t.synthRole}</h5>
                              <p className={`font-mono opacity-70 leading-relaxed ${lang === 'kh' || lang === 'th' ? 'text-sm' : 'text-xs'}`}>{t.synthDesc}</p>
                            </div>
                          </div>
                        </div>

                        {/* Stateless Approach Badge */}
                        <div className="mt-8 bg-riso-ink text-riso-paper p-6 text-center transform rotate-1 hover:rotate-0 transition-transform cursor-crosshair">
                          <h3 className="font-display text-2xl uppercase mb-2">{t.statelessApproach}</h3>
                          <p className={`font-mono opacity-80 ${lang === 'kh' || lang === 'th' ? 'text-sm' : 'text-xs'}`}>{t.statelessDesc}</p>
                        </div>

                        {/* DATA EXPLAINER */}
                        <div className="space-y-6 pt-4 border-t border-riso-ink/10">
                          {/* Scores */}
                          <div>
                            <h4 className={`font-mono font-bold uppercase mb-3 ${lang === 'kh' || lang === 'th' ? 'text-base' : 'text-sm'}`}>{t.understandingScores}</h4>
                            <div className={`space-y-2 font-mono ${lang === 'kh' || lang === 'th' ? 'text-sm' : 'text-xs'}`}>
                              <div className="flex items-center gap-3">
                                <div className="w-3 h-3 rounded-full bg-green-500"></div>
                                <p>{t.scoreHigh}</p>
                              </div>
                              <div className="flex items-center gap-3">
                                <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                                <p>{t.scoreMid}</p>
                              </div>
                              <div className="flex items-center gap-3">
                                <div className="w-3 h-3 rounded-full bg-red-500"></div>
                                <p>{t.scoreLow}</p>
                              </div>
                            </div>
                          </div>

                          {/* Sources */}
                          <div>
                            <h4 className={`font-mono font-bold uppercase mb-3 ${lang === 'kh' || lang === 'th' ? 'text-base' : 'text-sm'}`}>{t.whoIsTalking}</h4>
                            <div className={`space-y-2 font-mono opacity-80 ${lang === 'kh' || lang === 'th' ? 'text-sm' : 'text-xs'}`}>
                              <p>🏛️ {t.sourceGov}</p>
                              <p>📰 {t.sourceMedia}</p>
                            </div>
                          </div>
                        </div>

                      </div>
                    </div>
                  </Card>
                </div>
              </>
            )
          }
        </main >
        {/* Decorative footer elements */}
        < div className="fixed bottom-4 right-4 hidden lg:block" >
          <div className="vertical-text font-display text-6xl text-riso-ink opacity-10 pointer-events-none select-none">
            {t.peaceWar}
          </div>
        </div >
      </div >
    </div >
  );
}