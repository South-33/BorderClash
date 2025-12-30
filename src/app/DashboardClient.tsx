'use client';

import { useState, useEffect, useRef, useLayoutEffect, useMemo, useCallback, useDeferredValue } from 'react';
import { useQuery, useMutation, useConvex } from 'convex/react';
import { FunctionReference } from 'convex/server';
import { api } from '../../convex/_generated/api';
import { Swords, Handshake, Heart, Landmark, Circle, Hourglass, BarChart3, Search, Eye, Globe, Camera, Calendar, AlertTriangle, Radar, History, BookOpen, Clock } from 'lucide-react';
import type { BorderClashData } from '@/lib/convex-server';
import Lenis from 'lenis';
import { useVirtualizer } from '@tanstack/react-virtual';

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

const Gear = (props: any) => (
  <IconBase {...props}>
    <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
    <circle cx="12" cy="12" r="3" />
  </IconBase>
);

const ChevronLeft = (props: any) => (
  <IconBase {...props}>
    <polyline points="15 18 9 12 15 6" />
  </IconBase>
);

const ChevronRight = (props: any) => (
  <IconBase {...props}>
    <polyline points="9 18 15 12 9 6" />
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

const ScanEye = (props: any) => (
  <IconBase {...props}>
    <path d="M3 7V5a2 2 0 0 1 2-2h2" />
    <path d="M17 3h2a2 2 0 0 1 2 2v2" />
    <path d="M21 17v2a2 2 0 0 1-2 2h-2" />
    <path d="M7 21H5a2 2 0 0 1-2-2v-2" />
    <circle cx="12" cy="12" r="1" />
    <path d="M18.944 12.33a1 1 0 0 0 0-.66 7.5 7.5 0 0 0-13.888 0 1 1 0 0 0 0 .66 7.5 7.5 0 0 0 13.888 0" />
  </IconBase>
);

// Custom Timeline Icon (Hourglass)
const TimelineIcon = ({ size = 24, strokeWidth = 2, className = "", ...props }: any) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={strokeWidth}
    strokeLinecap="square"
    strokeLinejoin="miter"
    className={className}
    {...props}
  >
    <path d="M12 12L7.72711 8.43926C7.09226 7.91022 6.77484 7.6457 6.54664 7.32144C6.34444 7.03413 6.19429 6.71354 6.10301 6.37428C6 5.99139 6 5.57819 6 4.7518V2M12 12L16.2729 8.43926C16.9077 7.91022 17.2252 7.6457 17.4534 7.32144C17.6556 7.03413 17.8057 6.71354 17.897 6.37428C18 5.99139 18 5.57819 18 4.7518V2M12 12L7.72711 15.5607C7.09226 16.0898 6.77484 16.3543 6.54664 16.6786C6.34444 16.9659 6.19429 17.2865 6.10301 17.6257C6 18.0086 6 18.4218 6 19.2482V22M12 12L16.2729 15.5607C16.9077 16.0898 17.2252 16.3543 17.4534 16.6786C17.6556 16.9659 17.8057 17.2865 17.897 17.6257C18 18.0086 18 18.4218 18 19.2482V22M4 2H20M4 22H20" />
  </svg>
);

// Custom Report/Analysis Icon (Newspaper)
const ReportIcon = ({ size = 24, strokeWidth = 1.5, className = "", ...props }: any) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={strokeWidth}
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    {...props}
  >
    <path d="M12 7.5h1.5m-1.5 3h1.5m-7.5 3h7.5m-7.5 3h7.5m3-9h3.375c.621 0 1.125.504 1.125 1.125V18a2.25 2.25 0 0 1-2.25 2.25M16.5 7.5V18a2.25 2.25 0 0 0 2.25 2.25M16.5 7.5V4.875c0-.621-.504-1.125-1.125-1.125H4.125C3.504 3.75 3 4.254 3 4.875V18a2.25 2.25 0 0 0 2.25 2.25h13.5M6 7.5h3v3H6v-3Z" />
  </svg>
);

// Custom Guide Icon (Open Book)
const GuideIcon = ({ size = 24, strokeWidth = 1.5, className = "", ...props }: any) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={strokeWidth}
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    {...props}
  >
    <path d="M12 6.042A8.967 8.967 0 0 0 6 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 0 1 6 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 0 1 6-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0 0 18 18a8.967 8.967 0 0 0-6 2.292m0-14.25v14.25" />
  </svg>
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
    escalated: "ESCALATED",
    aggressive: "AGGRESSIVE",
    intelligenceLog: "Intelligence Log",
    items: "items",
    noArticles: "No articles yet",
    noArticlesFiltered: "No articles in this category",
    damageAssessment: "ESTIMATED LOSS",
    displacedCivilians: "Displaced",
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
    analysisPending: "Analysis pending — data will appear after next sync cycle.",
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
    fatalities: "Fatalities",
    threatLevel: "Threat Level",
    low: "LOW",
    elevated: "ELEVATED",
    critical: "CRITICAL",
    injured: "INJURED",
    civilian: "CIVILIAN",
    military: "MILITARY",
    fromLastWeek: "FROM LAST WEEK",
    lastUpdated: "Updated",
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
    disclaimerBody: "This entire dashboard is run by AI agents with absolutely zero human intervention. It may contain errors or hallucinations. Visit the 'GUIDE' to learn more.",
    incident: "INCIDENT",
    image: "IMAGE",
    sector: "SECTOR",
    all: "ALL",
    government: "GOVERNMENT",
    media: "MEDIA",
    agency: "AGENCY",
    other: "OTHER",
    guideTitle: "USER GUIDE / CRITICAL LITERACY",
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
    cat_humanitarian: "AID",
    cat_political: "POLITICAL",
    // Military Posture Context
    postureGaugeTitle: "MILITARY POSTURE",
    territoryOwn: "Own Territory",
    territoryBorder: "Border Zone",
    territoryDisputed: "Disputed Area",
    territoryForeign: "Foreign Territory",
    postureRationale: "WHY?",
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
    trustWarningLabel: "WARNING: SUBJECTIVE REALITY",
    trustWarningDesc: "Every government has an incentive to lie during conflict. Every news outlet has an audience to please. This dashboard is a tool, not a truth machine. Use it to compare narratives, not to validate your biases.",
    statelessApproach: "WE TAKE NO SIDES. WE TRUST NO ONE.",
    statelessDesc: "We don't believe the governments. We don't believe the media. We look past national narratives. We only care about the hard facts on the ground.",
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
    aiSynthesis: "AI SYNTHESIS",
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
    defensive: "ตั้งรับ",
    escalated: "ตึงเครียด",
    aggressive: "เดือด", // Matches 'Kach' (Fierce) - Short for UI
    intelligenceLog: "ข่าวกรองล่าสุด",
    items: "รายการ",
    noArticles: "ยังไม่มีข้อมูล",
    noArticlesFiltered: "ไม่พบบทความในหมวดนี้",
    damageAssessment: "สรุปความสูญเสีย",
    displacedCivilians: "ผู้พลัดถิ่น",
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
    sourcesTracked: "แหล่งข่าว",
    viewMode: "โหมดดูข้อมูล",
    analysis: "วิเคราะห์",
    timeline: "ไทม์ไลน์",
    losses: "ความสูญเสีย",
    guide: "คู่มือ",
    language: "ภาษา",
    nextAutoScan: "สแกน",
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
    analysisPending: "กำลังรอการวิเคราะห์ — ข้อมูลจะแสดงหลังรอบซิงค์ถัดไป",
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
    subTitle: "เกาะติดทุกเรื่องราวชายแดนแบบทันที โดยใช้ AI ช่วยเช็คข้อมูลจากรอบด้านมาสรุปให้เห็นภาพรวม เพื่อให้คุณได้รู้ความจริงที่ชัดเจนและไม่เข้าข้างฝ่ายใด",
    fatalities: "ผู้เสียชีวิต",
    threatLevel: "ระดับภัย",
    low: "ต่ำ",
    elevated: "เฝ้าระวัง",
    critical: "วิกฤต",
    injured: "ผู้บาดเจ็บ",
    civilian: "พลเรือน",
    military: "ทหาร",
    fromLastWeek: "จากสัปดาห์ก่อน",
    lastUpdated: "อัปเดต",
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
    guideTitle: "คู่มือใช้งาน / รู้ทันสื่อ",
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
    postureRationale: "ทำไม?",
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
    trustWarningLabel: "คำเตือน: ความจริงมีหลายด้าน",
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
    aiSynthesis: "สรุปโดย AI",
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
    escalated: "តានតឹង", // Tense
    aggressive: "កាច", // Tense - kept short as requested
    intelligenceLog: "ព័ត៌មានថ្មីៗ", // Recent news
    items: "អត្ថបទ",
    noArticles: "មិនទាន់មានព័ត៌មាន",
    noArticlesFiltered: "មិនមានអត្ថបទក្នុងផ្នែកនេះទេ",
    damageAssessment: "ការខូចខាតសរុប",
    displacedCivilians: "ជនភៀសខ្លួន",
    civilianInjuries: "ពលរដ្ឋរងរបួស",
    propertyDamaged: "ទ្រព្យសម្បត្តិខូចខាត",
    status: "ស្ថានភាព",
    confirmedOnly: "បញ្ជាក់ហើយ",
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
    nextAutoScan: "ស្កេន", // Translated "AUTO-SCAN"
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
    analysisPending: "កំពុងរង់ចាំការវិភាគ — ទិន្នន័យនឹងបង្ហាញបន្ទាប់ពីវដ្តសមកាលកម្មបន្ទាប់។",
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
    subTitle: "តាមដានរឿងរ៉ាវនៅព្រំដែនភ្លាមៗ ដោយប្រើ AI ជួយផ្ទៀងផ្ទាត់ព័ត៌មានពីគ្រប់ភាគី ដើម្បីឱ្យយើងដឹងការពិតបានច្បាស់ និងមិនលំអៀង។",
    fatalities: "ចំនួនស្លាប់",
    threatLevel: "កម្រិតគ្រោះថ្នាក់",
    low: "ទាប",
    elevated: "ខ្ពស់",
    critical: "គ្រោះថ្នាក់",
    injured: "អ្នករបួស",
    civilian: "ពលរដ្ឋ",
    military: "ទាហាន",
    fromLastWeek: "ពីសប្តាហ៍មុន",
    lastUpdated: "អាប់ដេត",
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
    postureRationale: "ហេតុអ្វី?",
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
    trustWarningLabel: "ការព្រមាន៖ ការពិតមានច្រើនជ្រុង",
    trustWarningDesc: "រដ្ឋាភិបាលណាក៏ចង់និយាយឱ្យខ្លួនឯងល្អ។ សារព័ត៌មានក៏ត្រូវយកចិត្តអ្នកមើល។ ប្រើតារាងនេះដើម្បីប្រៀបធៀបព័ត៌មាន មិនមែនដើម្បីបញ្ជាក់ថាខ្លួនឯងត្រូវទេ។",
    statelessApproach: "មិនកាន់ជើង ហើយមិនជឿអ្នកណាទាំងអស់",
    statelessDesc: "យើងមិនជឿសម្តីអ្នកណាទេ។ យើងមិននៅខាងថៃ ហើយក៏មិននៅខាងខ្មែរដែរ។ យើងដើរផ្លូវកណ្តាលបុកទៅរកការពិត។",
    aiAnalysis: "ការវិភាគដោយ AI",
    aiSynthesis: "សង្ខេបដោយ AI",
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
  // Synchronous hydration attempt (for instant render on refresh)
  // This avoids the "flash of loading" by reading localStorage immediately if available.
  const [localData, setLocalData] = useState<any>(() => {
    if (skip) return null;
    if (typeof window !== 'undefined') {
      const cached = localStorage.getItem(storageKey);
      if (cached) {
        try {
          return JSON.parse(cached);
        } catch (e) {
          console.error("Failed to parse cache for", storageKey, e);
        }
      }
    }
    return null;
  });

  const [isHydrated, setIsHydrated] = useState(!!localData || skip);

  // Fallback hydration effect (for SSR mismatch safety)
  useEffect(() => {
    if (skip || isHydrated) return; // Already hydrated synchronously

    if (typeof window !== 'undefined') {
      const cached = localStorage.getItem(storageKey);
      if (cached && !localData) {
        try {
          setLocalData(JSON.parse(cached));
        } catch (e) { }
      }
      setIsHydrated(true);
    }
  }, [storageKey, skip, isHydrated]);

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
  // Synchronous hydration (instant load)
  // Initializes state directly from localStorage if available, skipping the initial blank render
  const [data, setData] = useState<T | undefined>(() => {
    if (skip) return undefined;
    if (typeof window !== 'undefined') {
      const cached = localStorage.getItem(storageKey);
      if (cached) {
        try {
          const parsed = JSON.parse(cached);
          // Also optimistically set the ref so fetching logic knows we have data
          // Note: refs set during render are safe here as they don't trigger re-renders
          return parsed.data;
        } catch (e) {
          console.error("Failed to parse cache for", storageKey, e);
        }
      }
    }
    return undefined;
  });

  const [isLoading, setIsLoading] = useState(!skip && data === undefined);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isHydrated, setIsHydrated] = useState(data !== undefined || skip);
  const lastFetchedAt = useRef<number | null>(null);
  const hasDoneInitialFetch = useRef(skip);

  // Use passed prop if available, otherwise fall back to global ref
  const effectiveLastResearchAt = lastResearchAt ?? globalLastResearchAt.current;

  // Fallback hydration (for SSR safety) - only runs if sync hydration failed/was skipped
  useEffect(() => {
    if (skip || isHydrated) return;

    if (typeof window !== 'undefined') {
      const cached = localStorage.getItem(storageKey);
      if (cached && data === undefined) {
        try {
          const parsed = JSON.parse(cached);
          setData(parsed.data);
          lastFetchedAt.current = parsed.fetchedAt || 0;
        } catch (e) { }
      }
      setIsHydrated(true);
    }
  }, [storageKey, skip, isHydrated]);

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
        <div className="absolute inset-0 bg-riso-ink/5 z-10 flex items-center justify-center">
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

const Badge = ({ children, type = "neutral", className = "" }: any) => {
  const styles: any = {
    neutral: "bg-riso-ink text-riso-paper",
    alert: "bg-riso-accent text-white",
    outline: "border border-riso-ink text-riso-ink"
  };
  return (
    <span className={`px-2 py-0.5 text-xs font-mono font-bold uppercase tracking-wider ${styles[type]} ${className}`}>
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
      className="group relative border-b border-riso-ink/15 hover:bg-riso-ink/[0.02] transition-colors cursor-pointer last:border-0"
      onClick={() => article.sourceUrl && window.open(article.sourceUrl, '_blank')}
    >
      <div className="flex">
        {/* Subtle Accent Bar - Always on, but light */}
        <div className={`w-[2px] self-stretch ${borderColor} opacity-30 group-hover:opacity-100 transition-opacity`}></div>

        <div className="flex-1 py-2 px-3 xl:py-2.5 xl:px-4">
          {/* Metadata Row - Condensed */}
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-riso-ink/50">
                {article.source}
              </span>
              {article.isVerified && <CheckCircle className="w-2.5 h-2.5 text-riso-ink/20" />}
            </div>
            <span className="text-[9px] font-mono text-riso-ink/30 uppercase" suppressHydrationWarning>
              {formatRelativeTime(article.publishedAt, article.fetchedAt)}
            </span>
          </div>

          {/* Headline - Standard Sentence Case, Slightly smaller */}
          <h5 className={`font-bold text-[13px] xl:text-[15px] leading-tight text-riso-ink tracking-tight transition-colors ${lang === 'kh' ? 'font-mono' : lang === 'th' ? 'font-mono' : ''}`}>
            {lang === 'th' && article.titleTh ? article.titleTh :
              lang === 'kh' && article.titleKh ? article.titleKh :
                article.titleEn || article.title}
          </h5>

          {/* Minimal Stats Row - Always Visible */}
          <div className="flex items-center gap-3 mt-1.5 transition-opacity">
            <div className="flex items-center gap-2 flex-1">
              <span className="text-[9px] font-mono font-bold uppercase tracking-widest opacity-25">{t.credibility}</span>
              <div className="flex-1 h-[2px] bg-riso-ink/5">
                <div
                  className={`h-full ${(article.credibility ?? 50) >= 70 ? 'bg-green-600' : (article.credibility ?? 50) >= 40 ? 'bg-yellow-500' : 'bg-red-500'}`}
                  style={{ width: `${article.credibility ?? 50}%` }}
                />
              </div>
            </div>
            <span className="text-[10px] font-mono text-riso-ink/30">{article.credibility ?? 50}%</span>
          </div>

          {/* Detail Section */}
          {isExpanded && (
            <div className="mt-3 pt-3 border-t border-dashed border-riso-ink/20 space-y-3">
              <p className={`text-[13px] text-riso-ink/70 leading-relaxed ${lang === 'kh' || lang === 'th' ? 'font-mono' : 'font-serif'}`}>
                {lang === 'th' && article.summaryTh ? article.summaryTh :
                  lang === 'kh' && article.summaryKh ? article.summaryKh :
                    article.summaryEn || article.summary}
              </p>
            </div>
          )}
        </div>
      </div>
    </li>

  );
};

// Category Filter Editorial Tabs
const CategoryFilter = ({
  selected,
  onChange,
  perspective,
  itemCount,
  lang = 'en'
}: {
  selected: string | null;
  onChange: (cat: string | null) => void;
  perspective: 'thailand' | 'cambodia';
  itemCount: number;
  lang?: 'en' | 'th' | 'kh';
}) => {
  const categories = [
    { key: null, label: TRANSLATIONS[lang as Lang].all },
    { key: 'military', label: TRANSLATIONS[lang as Lang].cat_military },
    { key: 'political', label: TRANSLATIONS[lang as Lang].cat_political },
    { key: 'humanitarian', label: TRANSLATIONS[lang as Lang].cat_humanitarian },
    { key: 'diplomatic', label: TRANSLATIONS[lang as Lang].cat_diplomatic },
  ];

  return (
    <div className="flex items-center justify-between px-4 pt-1 border-b border-riso-ink/10">
      <div className="flex gap-3">
        {categories.map(cat => (
          <button
            key={cat.key || 'all'}
            onClick={() => onChange(cat.key)}
            className={`pb-1.5 transition-colors uppercase tracking-widest ${lang === 'kh' || lang === 'th' ? 'text-[12px] font-medium font-mono' : 'text-[10px] font-bold font-mono'
              } ${selected === cat.key
                ? `text-riso-ink border-b-2 border-riso-ink`
                : 'text-riso-ink/65 hover:text-riso-ink border-b-2 border-transparent'
              }`}
          >
            {cat.label}
          </button>
        ))}
      </div>
    </div>
  );
};

// Intelligence Log Component - Editorial Feed
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

  const filteredArticles = (articles?.filter(a =>
    categoryFilter ? a.category === categoryFilter : true
  ) || []).sort((a, b) => {
    const timeA = a.publishedAt || a.fetchedAt;
    const timeB = b.publishedAt || b.fetchedAt;
    return timeB - timeA;
  });

  return (
    <div className="flex flex-col flex-1 min-h-0 border border-riso-ink/20">
      <div className="flex flex-col flex-1 min-h-0">
        <CategoryFilter
          selected={categoryFilter}
          onChange={setCategoryFilter}
          perspective={perspective}
          itemCount={filteredArticles.length}
          lang={lang}
        />

        {/* Scrollable Feed */}
        <div className="flex-1 max-h-[220px] xl:max-h-[350px] overflow-y-auto scrollbar-thin">
          {isLoading ? (
            <div className="h-full flex items-center justify-center">
              <RefreshCw className="w-5 h-5 animate-spin opacity-40" />
            </div>
          ) : filteredArticles.length > 0 ? (
            <ul className="pr-1">
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
            <div className="h-full flex items-center justify-center opacity-40 text-center py-8">
              <p className="text-[11px] font-mono tracking-widest uppercase">
                {categoryFilter ? (
                  <>
                    {t.noArticlesFiltered} <span className="opacity-50">[{categoryFilter}]</span>
                  </>
                ) : t.noArticles}
              </p>
            </div>
          )}
        </div>
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
      className={`flex-1 min-w-0 overflow-hidden relative h-8 flex items-center ${className}`}
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
  posture: "PEACEFUL" | "DEFENSIVE" | "ESCALATED" | "AGGRESSIVE" | undefined;
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
    ESCALATED: 'text-orange-600',
    AGGRESSIVE: 'text-red-600',
  };

  const postureBgColors: Record<string, string> = {
    PEACEFUL: 'bg-green-600/10 border-green-600/30',
    DEFENSIVE: 'bg-yellow-500/10 border-yellow-500/30',
    ESCALATED: 'bg-orange-500/10 border-orange-500/30',
    AGGRESSIVE: 'bg-red-500/10 border-red-500/30',
  };

  const labelFontSize = (lang === 'th' || lang === 'kh') ? 'text-[15px]' : 'text-[12px]';

  return (
    <div className="mb-4">
      {/* Title and Intensity Number Row */}
      <div className="flex items-center justify-between mb-2">
        <h4 className={`font-mono font-bold uppercase opacity-60 ${lang === 'kh' || lang === 'th' ? 'text-[15px]' : 'text-[12px]'}`}>{t.postureGaugeTitle || t.militaryIntensity}</h4>
        <span className={`font-mono opacity-80 font-bold ${lang === 'kh' || lang === 'th' ? 'text-[12px]' : 'text-[10px]'}`}>{displayIntensity}/100</span>
      </div>

      {/* Gradient Gauge Bar */}
      {/* Segmented LCD-style Gauge Bar */}
      <div className="relative h-8 bg-riso-ink/5 border border-riso-ink/20 flex gap-[2px] p-[2px]">
        {/* 20 Segments (5% each for even split) */}
        {Array.from({ length: 20 }).map((_, i) => {
          const threshold = (i + 1) * 5;
          const isActive = displayIntensity >= threshold;

          // Use inline styles to avoid Tailwind purging issues in production
          // Color hex values: Green #188d45, Yellow #eab308, Orange #ea580c, Red #dc2626
          let color = '';
          if (threshold <= 30) color = '#188d45';      // Green
          else if (threshold <= 55) color = '#eab308'; // Yellow
          else if (threshold < 70) color = '#ea580c';  // Orange
          else color = '#dc2626';                       // Red

          return (
            <div
              key={i}
              className="flex-1 transition-all duration-300"
              style={{
                backgroundColor: color,
                opacity: isActive ? 1 : 0.2
              }}
            />
          );
        })}


      </div>

      <div className="flex items-center gap-2 mt-2">
        {/* Low Key Tactical Label */}
        <div className={`flex-shrink-0 h-8 flex items-center justify-center px-3 border ${labelFontSize} font-mono font-bold uppercase tracking-widest transition-colors duration-300 ${displayPosture === 'PEACEFUL' ? 'text-[#188d45] border-[#188d45]/30' :
          displayPosture === 'DEFENSIVE' ? 'text-[#ca8a04] border-[#ca8a04]/30' :
            displayPosture === 'ESCALATED' ? 'text-[#ea580c] border-[#ea580c]/30' :
              'text-[#b91c1c] border-[#b91c1c]/30'
          }`}>
          {displayPosture === 'PEACEFUL' ? t.peaceful : displayPosture === 'AGGRESSIVE' ? t.aggressive : displayPosture === 'ESCALATED' ? t.escalated : t.defensive}
        </div>

        {/* Unified Label - Dynamic Width with Auto-Scroll if Overflowing */}
        {displayLabel && (
          <AutoScrollLabel
            text={displayLabel}
            className={`border ${postureBgColors[displayPosture]}`}
            fontSizeClass={labelFontSize}
          />
        )}

        {/* Dedicated Analysis Toggle Button */}
        {displayRationale && (
          <button
            onClick={() => setShowAnalysis(!showAnalysis)}
            className={`
              ml-auto flex-shrink-0 h-8 flex items-center gap-1.5 px-4 border 
              font-mono uppercase transition-all duration-100 ease-out active:translate-y-px
              ${labelFontSize}
              ${showAnalysis
                ? 'bg-riso-ink text-riso-paper border-riso-ink'
                : 'bg-riso-ink/5 text-riso-ink border-riso-ink/30 hover:border-riso-ink/100 hover:bg-riso-ink/10'}
            `}
          >
            <span className="font-bold tracking-wider">{t.postureRationale}</span>
            <span
              className="transition-transform duration-300"
              style={{
                display: 'inline-block',
                fontSize: lang === 'kh' || lang === 'th' ? '14px' : '16px',
                lineHeight: '1',
                transform: showAnalysis ? 'rotate(90deg)' : 'rotate(180deg)'
              }}
            >›</span>
          </button>
        )}
      </div>

      {/* AI Rationale (collapsible with smooth animation) */}
      <div
        className={`grid transition-[grid-template-rows] duration-300 ease-[cubic-bezier(0.25,1,0.5,1)] ${showAnalysis ? 'grid-rows-[1fr] mt-0' : 'grid-rows-[0fr] mt-0'}`}
      >
        <div className="overflow-hidden">
          {displayRationale && (
            <div className="mt-2 p-3 bg-riso-ink/5 border-l-4 border-l-riso-ink border-y border-r border-y-riso-ink/10 border-r-riso-ink/10">
              <p className={`font-mono text-justify leading-relaxed ${labelFontSize}`}>
                <span className="mr-2 uppercase tracking-wider opacity-70">[{t.analysis}]:</span>
                {displayRationale}
              </p>
            </div>
          )}
        </div>
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

// LazySection removed to eliminate layout shift jitter.
// Relying on CSS containment and optimized transitions for performance instead.

export function DashboardClient({ initialData, serverError }: DashboardClientProps) {
  const [nextUpdateIn, setNextUpdateIn] = useState<number | null>(null); // Start null to prevent 5:00 flash

  // Always start with ANALYSIS for SSR hydration, then sync from hash on client mount
  const [viewMode, setViewMode] = useState<'ANALYSIS' | 'LOSSES' | 'GUIDE'>('ANALYSIS');
  const deferredViewMode = useDeferredValue(viewMode); // Deferred for heavy renders
  const hasInitializedFromHash = useRef(false);
  const hasAutoScrolledTimeline = useRef(false);

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



  // Sidebar height sync for all cards

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

  // Final data: prefer server data if skipping, otherwise use client data WITH fallback to server
  // This ensures we never show empty/placeholder states when valid cached data exists
  const thailandNews = shouldSkip ? initialData.thailandNews : (clientThailandNews ?? initialData?.thailandNews ?? []);
  const cambodiaNews = shouldSkip ? initialData.cambodiaNews : (clientCambodiaNews ?? initialData?.cambodiaNews ?? []);
  const thailandMeta = shouldSkip ? initialData.thailandAnalysis : (clientThailandMeta ?? initialData?.thailandAnalysis);
  const cambodiaMeta = shouldSkip ? initialData.cambodiaAnalysis : (clientCambodiaMeta ?? initialData?.cambodiaAnalysis);
  const neutralMeta = shouldSkip ? initialData.neutralAnalysis : (clientNeutralMeta ?? initialData?.neutralAnalysis);
  const dashboardStats = shouldSkip ? initialData.dashboardStats : (clientDashboardStats ?? initialData?.dashboardStats);
  const articleCounts = shouldSkip ? initialData.articleCounts : (clientArticleCounts ?? initialData?.articleCounts);
  const timelineEvents = shouldSkip ? initialData.timelineEvents : (clientTimelineEvents ?? initialData?.timelineEvents ?? []);

  // Loading states: if we have server data, we're never "loading"
  const thNewsLoading = hasServerData ? false : clientThNewsLoading;
  const khNewsLoading = hasServerData ? false : clientKhNewsLoading;
  const thMetaLoading = hasServerData ? false : clientThMetaLoading;
  const khMetaLoading = hasServerData ? false : clientKhMetaLoading;
  const neutralMetaLoading = hasServerData ? false : clientNeutralMetaLoading;
  const dashboardLoading = hasServerData ? false : clientDashboardLoading;
  const countsLoading = hasServerData ? false : clientCountsLoading;
  const timelineLoading = hasServerData ? false : clientTimelineLoading;

  // Track if we're on desktop (xl+ breakpoint) for conditional CSS
  const [isDesktop, setIsDesktop] = useState(true);
  useEffect(() => {
    const checkDesktop = () => setIsDesktop(window.innerWidth >= 1280);
    checkDesktop();
    window.addEventListener('resize', checkDesktop);
    return () => window.removeEventListener('resize', checkDesktop);
  }, []);

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
  const [isScrollJump, setIsScrollJump] = useState(false);
  const timelineScrollRef = useRef<HTMLDivElement>(null);
  const datePickerRef = useRef<HTMLDivElement>(null);

  // Anti-Snapback Refs: Lock updates during programmatic scrolling
  const isProgrammaticScroll = useRef(false);
  const scrollTargetDate = useRef<string | null>(null);
  const scrollTimeout = useRef<NodeJS.Timeout | null>(null);

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

  // Handle auto-scroll to latest date on initial load or view switch (ONLY ONCE)
  useEffect(() => {
    if (viewMode === 'LOSSES' && timelineDates.length > 0 && !hasAutoScrolledTimeline.current) {
      const latestDate = timelineDates[timelineDates.length - 1];
      // Small delay to ensure the timeline container is rendered and height is calculated
      const timer = setTimeout(() => {
        scrollToDate(latestDate, 'auto');
        hasAutoScrolledTimeline.current = true;
      }, 150);
      return () => clearTimeout(timer);
    }
  }, [viewMode, timelineDates.length]); // Still track dates in case they load after view switch

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

  // NOTE: Lenis removed from timeline - it conflicts with virtualization.
  // Native scrolling + virtualization = optimal performance.

  // Initialize Lenis for horizontal date picker
  useEffect(() => {
    if (viewMode !== 'LOSSES' || !datePickerRef.current) return;

    // Small delay to ensure render
    const timer = setTimeout(() => {
      if (!datePickerRef.current) return;

      const lenis = new Lenis({
        wrapper: datePickerRef.current,
        orientation: 'horizontal',
        gestureOrientation: 'both', // Allows vertical trackpad swipe to scroll horizontally if desired, or 'horizontal'
        smoothWheel: true,
        wheelMultiplier: 1,
        // Optional: adjusting Lerp for different feel, default is 0.1
        // lerp: 0.1 
      });

      let rafId: number;
      function raf(time: number) {
        lenis.raf(time);
        rafId = requestAnimationFrame(raf);
      }
      rafId = requestAnimationFrame(raf);

      (datePickerRef.current as any).lenis = lenis;

      return () => {
        lenis.destroy();
        cancelAnimationFrame(rafId);
        if (datePickerRef.current) {
          delete (datePickerRef.current as any).lenis;
        }
      };
    }, 100);

    return () => clearTimeout(timer);
  }, [viewMode]);

  const scrollDatePicker = (direction: 'left' | 'right') => {
    if (datePickerRef.current) {
      const scrollAmount = 300;
      datePickerRef.current.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth'
      });
    }
  };

  // Measure sidebar height for layout synchronization
  useLayoutEffect(() => {
    const measureSidebarHeight = () => {
      if (window.innerWidth >= 1280 && sidebarRef.current) {
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
  }, [viewMode, lang, sysStatsLoading]);

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
  const formatDate = (dateInput: string | number | Date, formatStr: 'short' | 'long' | 'weekday' | 'weekday-short' = 'long') => {
    const d = new Date(dateInput);

    if (lang === 'kh') {
      const day = d.getDate();
      const month = KH_MONTHS[d.getMonth()];
      const year = d.getFullYear();

      if (formatStr === 'short') return `${day} ${month}`;
      if (formatStr === 'weekday' || formatStr === 'weekday-short') return `${day} ${month}`; // Simplified for header if needed
      return `${day} ${month} ${year}`; // Default long
    }

    if (lang === 'th' && (formatStr === 'short' || formatStr === 'weekday-short')) {
      const day = d.getDate();
      const month = TH_MONTHS_SHORT[d.getMonth()];
      if (formatStr === 'weekday-short') {
        const weekday = d.toLocaleDateString('th-TH', { weekday: 'short' });
        return `${weekday} ${day} ${month}`;
      }
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
    if (formatStr === 'weekday-short') {
      return d.toLocaleDateString(locale, { weekday: 'long', month: 'short', day: 'numeric' });
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

  // Build flat list for virtualization: [header, event, event, ..., header, event, ...]
  // Each item has { type: 'header' | 'event', date: string, event?: any, eventIndex?: number }
  const virtualItems = useMemo(() => {
    const items: Array<{ type: 'header' | 'event'; date: string; event?: any; eventIndex?: number; eventsInDate?: number }> = [];
    timelineDates.forEach(date => {
      const events = groupedEvents[date] || [];
      items.push({ type: 'header', date, eventsInDate: events.length });
      events.forEach((event, idx) => {
        items.push({ type: 'event', date, event, eventIndex: idx });
      });
    });
    return items;
  }, [timelineDates, groupedEvents]);

  // Date-to-index mapping for scrollToDate
  const dateToVirtualIndex = useMemo(() => {
    const map: Record<string, number> = {};
    virtualItems.forEach((item, idx) => {
      if (item.type === 'header' && !map[item.date]) {
        map[item.date] = idx;
      }
    });
    return map;
  }, [virtualItems]);

  // Virtualizer setup
  const rowVirtualizer = useVirtualizer({
    count: virtualItems.length,
    getScrollElement: () => timelineScrollRef.current,
    estimateSize: (index) => virtualItems[index]?.type === 'header' ? 60 : 160,
    overscan: 10, // Render 10 extra items above/below viewport for smooth scroll
  });

  // Scroll to selected date section (uses virtualizer for smooth navigation)
  const scrollToDate = (date: string, behavior: 'auto' | 'smooth' = 'smooth') => {
    // LOCK: Prevent scroll listener from overwriting selection during animation
    isProgrammaticScroll.current = true;
    scrollTargetDate.current = date;

    // Clear existing timeout
    if (scrollTimeout.current) clearTimeout(scrollTimeout.current);

    // Set safety unlock (fallback if scroll event logic fails)
    scrollTimeout.current = setTimeout(() => {
      isProgrammaticScroll.current = false;
      scrollTargetDate.current = null;
      setIsScrollJump(false); // Safety reset
    }, 1200);

    setSelectedTimelineDate(date);
    const index = dateToVirtualIndex[date];

    if (index !== undefined) {
      // Fade-Jump Logic:
      // Check if the target is currently visible (or very close)
      const virtualItems = rowVirtualizer.getVirtualItems();
      const isVisible = virtualItems.some(item => Math.abs(item.index - index) < 3);

      if (isVisible) {
        // Smooth scroll for visible/nearby items
        rowVirtualizer.scrollToIndex(index, { align: 'start', behavior: 'smooth' });
      } else {
        // Fade-Jump for off-screen items
        setIsScrollJump(true); // Fade out

        setTimeout(() => {
          // Instant jump after fade out
          rowVirtualizer.scrollToIndex(index, { align: 'start', behavior: 'auto' });

          // Fade back in after brief delay to allow layout to settle
          requestAnimationFrame(() => {
            setTimeout(() => {
              setIsScrollJump(false);
            }, 50);
          });
        }, 200);
      }
    }
  };

  // Sync date selector when user scrolls (optimized with refs to avoid re-binding)
  const virtualizerRef = useRef(rowVirtualizer);
  const virtualItemsRef = useRef(virtualItems);

  useEffect(() => {
    virtualizerRef.current = rowVirtualizer;
    virtualItemsRef.current = virtualItems;
  });

  useEffect(() => {
    if (!timelineScrollRef.current || timelineDates.length === 0) return;

    let debounceTimer: NodeJS.Timeout | null = null;
    const lastSelectedDateRef = { current: selectedTimelineDate };

    const handleScroll = () => {
      const container = timelineScrollRef.current;
      if (!container) return;

      // 1. Check if we are at the very bottom (to fix the "Dec 28 vs 29" issue)
      const isAtBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 50;
      if (isAtBottom && timelineDates.length > 0) {
        const latestDate = timelineDates[timelineDates.length - 1];

        // Always force update if at bottom, but respect lock if we aimed for an earlier date?
        // Actually, if we aimed for bottom, this is fine. If we aimed elsewhere, we shouldn't be at bottom.
        if (latestDate !== lastSelectedDateRef.current) {
          lastSelectedDateRef.current = latestDate;
          setSelectedTimelineDate(latestDate);
        }
        return;
      }

      // 2. Clear previous debounce
      if (debounceTimer) clearTimeout(debounceTimer);

      // 3. Debounce the precise calculation
      debounceTimer = setTimeout(() => {
        // Calculate threshold line (20% from top of view)
        const threshold = container.scrollTop + (container.clientHeight * 0.2);

        // Get currently rendered virtual items
        const currentVirtualItems = virtualizerRef.current.getVirtualItems();

        // Find the item that overlaps the threshold line
        const match = currentVirtualItems.find(item => item.end >= threshold);

        if (match) {
          const allItems = virtualItemsRef.current;
          if (allItems && allItems[match.index]) {
            const date = allItems[match.index].date;

            // LOCK CHECK: If programmatically scrolling, ignore intermediate dates
            if (isProgrammaticScroll.current) {
              // If we reached our target, unlock and allow update
              if (date === scrollTargetDate.current) {
                isProgrammaticScroll.current = false;
                scrollTargetDate.current = null;
              } else {
                // We are just passing through, do not update state
                return;
              }
            }

            if (date && date !== lastSelectedDateRef.current) {
              lastSelectedDateRef.current = date;
              setSelectedTimelineDate(date);
            }
          }
        }
      }, 50); // Faster debounce for responsiveness
    };

    const container = timelineScrollRef.current;

    // Unlock on manual interaction (user grabs scrollbar, touches screen, or uses wheel)
    const unlockScroll = () => {
      if (isProgrammaticScroll.current) {
        isProgrammaticScroll.current = false;
        scrollTargetDate.current = null;
      }
    };

    container.addEventListener('scroll', handleScroll, { passive: true });
    container.addEventListener('wheel', unlockScroll, { passive: true });
    container.addEventListener('touchstart', unlockScroll, { passive: true });

    return () => {
      container.removeEventListener('scroll', handleScroll);
      container.removeEventListener('wheel', unlockScroll);
      container.removeEventListener('touchstart', unlockScroll);
      if (debounceTimer) clearTimeout(debounceTimer);
    };
  }, [timelineDates, lang]); // keep simple dependencies

  // Category colors for event rendering
  const categoryColors: Record<string, string> = {
    military: 'bg-red-500',
    diplomatic: 'bg-blue-500',
    humanitarian: 'bg-yellow-500',
    political: 'bg-purple-500',
  };

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

  // Detect if we're in a pending view transition state
  const isContentPending = viewMode !== deferredViewMode;

  // --- SIMPLE SNUG-FIT LAYOUT ---
  // Calculate optimal width on page load. Recalculates fresh on each refresh
  // but skips when switching view modes (to prevent bad measurements).
  const layoutContainerRef = useRef<HTMLDivElement>(null);
  const neutralTextRef = useRef<HTMLDivElement>(null);
  const hasCalculated = useRef(false);
  const [layoutWidth, setLayoutWidth] = useState<number | null>(null);
  const [isLayoutReady, setIsLayoutReady] = useState(false);

  useLayoutEffect(() => {
    // Skip if already calculated this session
    if (hasCalculated.current) {
      return;
    }

    const container = layoutContainerRef.current;
    const textEl = neutralTextRef.current;

    // Only calculate on desktop in Analysis mode when elements exist
    if (!container || !textEl) return;

    // On mobile or non-Analysis, just show immediately (no snug-fit needed)
    if (!isDesktop || viewMode !== 'ANALYSIS') {
      setIsLayoutReady(true);
      hasCalculated.current = true;
      return;
    }

    if (neutralMetaLoading) return;

    const calculateSnugWidth = () => {
      // STRATEGY: Start BIG, shrink until overflow, then step back + buffer
      // This ensures all content is rendered before we measure
      // Dynamic bounds based on viewport (keeps ~1.18 ratio like the original 2000/1700)
      const viewportWidth = window.innerWidth;
      const maxWidth = Math.min(viewportWidth * 0.95, 2000); // 95% of viewport, capped at 2000
      const minWidth = Math.min(viewportWidth * 0.80, 1700); // 80% of viewport, capped at 1700
      let width = maxWidth;

      container.style.transition = 'none';
      container.style.maxWidth = `${maxWidth}px`;

      // Force reflow at max size to ensure all content renders
      void textEl.offsetHeight;

      const checkOverflow = () => {
        void textEl.offsetHeight; // Force reflow before checking
        return textEl.scrollHeight > textEl.clientHeight + 2;
      };

      // Shrink until we find overflow
      let lastGoodWidth = maxWidth;
      while (width > minWidth) {
        container.style.maxWidth = `${width}px`;
        void textEl.offsetHeight; // Force reflow

        if (checkOverflow()) {
          // Found overflow - use the last good width
          break;
        }
        lastGoodWidth = width;
        width -= 25;
      }

      // Use the last width that didn't overflow, plus 2.5% buffer for other languages
      const snugWidth = checkOverflow() ? lastGoodWidth : width;
      const finalWidth = Math.min(Math.round(snugWidth * 1.025), maxWidth);

      // Apply final width
      container.style.maxWidth = `${finalWidth}px`;

      setLayoutWidth(finalWidth);
      hasCalculated.current = true;

      // Fade in after a tiny delay to ensure DOM is updated
      requestAnimationFrame(() => {
        setIsLayoutReady(true);
      });

      // Restore transitions
      requestAnimationFrame(() => {
        container.style.removeProperty('transition');
      });
    };

    // Run after fonts are ready
    document.fonts.ready.then(() => {
      requestAnimationFrame(calculateSnugWidth);
    });
  }, [isDesktop, viewMode, neutralMetaLoading]);

  return (
    <div className={`min-h-screen grid grid-rows-[1fr_auto_1fr] ${langClass}`}>
      {/* Top spacer - flexes equally with bottom */}
      <div />
      <div
        ref={layoutContainerRef}
        className={`dashboard-layout relative p-4 xl:p-6 2xl:p-8 flex flex-col xl:flex-row gap-4 xl:gap-6 mx-auto w-full transition-opacity duration-200 ${isLayoutReady ? 'opacity-100' : 'opacity-0'}`}
        style={{ maxWidth: layoutWidth ? `${layoutWidth}px` : '1600px' }}
      >
        {/* The Risograph Grain Overlay */}
        <div className="riso-grain"></div>

        {/* Left Sidebar / Header (Mobile Top) */}
        <aside ref={sidebarRef} className="w-full xl:w-64 flex-shrink-0 flex flex-col gap-2 self-start">
          <div className="border-4 border-riso-ink p-3 bg-riso-paper">
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

            </div>
            <div className={`font-mono space-y-2 border-t border-riso-ink pt-4 opacity-80 ${lang === 'kh' || lang === 'th' ? 'text-sm' : 'text-xs'}`}>
              <p className="leading-relaxed">
                {t.subTitle}
              </p>
            </div>
          </div>

          {/* Control Panel */}
          <div className="bg-riso-ink text-riso-paper p-3 rough-border-sm">
            <div className="flex justify-between items-start mb-2">
              <div>
                <p className={`font-mono opacity-70 mb-1 ${lang === 'kh' || lang === 'th' ? 'text-[15px]' : 'text-[10px]'}`}>{t.nextAutoScan}</p>
                <p className="font-mono text-3xl font-bold" suppressHydrationWarning>
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
                <p className={`font-mono opacity-70 mb-1 ${lang === 'kh' || lang === 'th' ? 'text-[15px]' : 'text-[10px]'}`}>{t.sourcesTracked}</p>
                <p className="font-mono text-xl">
                  {sysStatsLoading || countsLoading ? (
                    <HackerScramble />
                  ) : (
                    (articleCounts?.cambodia || 0) + (articleCounts?.international || 0) + (articleCounts?.thailand || 0)
                  )}
                </p>
              </div>
            </div>

            {/* Sources Tracked - Visual Bar */}
            <div className="bg-riso-paper text-riso-ink p-2 rough-border-sm">

              {/* Proportional Bar */}
              <div className="flex h-3 overflow-hidden bg-black/5 border border-black/10">
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
              <div className={`flex justify-between font-mono pt-1.5 ${lang === 'kh' || lang === 'th' ? 'text-[11px]' : 'text-[10px] font-bold'}`}>
                <span className="flex items-center gap-1.5 text-[#032EA1]">
                  <span className="w-2 h-2 bg-[#032EA1]"></span>
                  {t.labelKH} {articleCounts?.cambodia || 0}
                </span>
                <span className="flex items-center gap-1.5 text-gray-600">
                  <span className="w-2 h-2 bg-gray-400"></span>
                  {t.labelINTL} {articleCounts?.international || 0}
                </span>
                <span className="flex items-center gap-1.5 text-[#241D4F]">
                  <span className="w-2 h-2 bg-[#241D4F]"></span>
                  {t.labelTH} {articleCounts?.thailand || 0}
                </span>
              </div>
            </div>
          </div>

          {/* Language Selector */}
          <div className="rough-border p-3 bg-white/50 font-mono flex flex-col gap-2">
            <div className={`flex items-center gap-2 uppercase font-black text-riso-ink/60 tracking-widest ${lang === 'kh' || lang === 'th' ? 'text-[14px]' : 'text-[10px]'}`}>
              <div className="w-4 h-[1px] bg-riso-ink/20"></div>
              {t.language}
              <div className="flex-1 h-[1px] bg-riso-ink/20"></div>
            </div>

            <div className="flex gap-2">
              {[
                { id: 'kh', label: 'ខ្មែរ' },
                { id: 'en', label: 'EN' },
                { id: 'th', label: 'ไทย' }
              ].map((l) => (
                <button
                  key={l.id}
                  onClick={() => setLang(l.id as any)}
                  className={`
                    flex-1 flex items-center justify-center py-2 px-1 border-2 active:scale-95
                    transition-all duration-100 ease-out
                    ${lang === l.id
                      ? 'bg-riso-ink text-riso-paper border-riso-ink shadow-[3px_3px_0px_rgba(30,58,138,0.3)]'
                      : 'bg-riso-ink/5 text-riso-ink border-transparent hover:bg-riso-ink/10 hover:border-riso-ink/20'
                    }
                  `}
                >
                  <span className={`font-bold tracking-tight ${l.id === 'en' ? 'text-sm' : 'text-base'}`}>
                    {l.label}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* View Selector */}
          <div className="rough-border p-3 bg-riso-ink/5 font-mono flex flex-col gap-2 text-xs">
            <div className={`flex items-center gap-2 uppercase font-black text-riso-ink/60 tracking-widest ${lang === 'kh' || lang === 'th' ? 'text-[14px]' : 'text-[10px]'}`}>
              <div className="w-4 h-[1px] bg-riso-ink/20"></div>
              {t.viewMode}
              <div className="flex-1 h-[1px] bg-riso-ink/20"></div>
            </div>
            <div className={`grid grid-cols-1 gap-2 ${lang === 'kh' || lang === 'th' ? 'text-[14px]' : 'text-[12px]'}`}>
              {[
                { id: 'ANALYSIS', label: t.analysis, icon: ReportIcon, size: 22 },
                { id: 'LOSSES', label: t.timeline, icon: TimelineIcon, size: 20 },
                { id: 'GUIDE', label: t.guide, icon: GuideIcon, size: 20 }
              ].map((mode) => (
                <button
                  key={mode.id}
                  onClick={() => setViewMode(mode.id as any)}
                  className={`
                    flex items-center gap-3 p-2.5 border-2 active:scale-[0.98]
                    transition-all duration-100 ease-out
                    ${viewMode === mode.id
                      ? 'bg-riso-ink text-riso-paper border-riso-ink shadow-[4px_4px_0px_rgba(30,58,138,0.3)]'
                      : 'bg-white/40 text-riso-ink border-transparent hover:border-riso-ink/30 hover:bg-white/60'
                    }
                  `}
                >
                  <mode.icon size={mode.size} strokeWidth={viewMode === mode.id ? 2.5 : 1.5} />
                  <span className="uppercase font-black tracking-wider">
                    {mode.label}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Automation Disclaimer - Technical "System Status" Look */}
          <div className="flex flex-col">
            <div className="relative border border-riso-ink/20 bg-riso-ink/5 p-3">
              {/* Technical Corner Accents */}
              <div className="absolute top-0 left-0 w-1.5 h-1.5 border-t border-l border-riso-ink"></div>
              <div className="absolute top-0 right-0 w-1.5 h-1.5 border-t border-r border-riso-ink"></div>
              <div className="absolute bottom-0 left-0 w-1.5 h-1.5 border-b border-l border-riso-ink"></div>
              <div className="absolute bottom-0 right-0 w-1.5 h-1.5 border-b border-r border-riso-ink"></div>

              {/* Header */}
              <div className="flex items-center gap-2 mb-2 pb-2 border-b border-riso-ink/10">
                <Gear size={11} className="text-riso-ink animate-[spin_30s_linear_infinite]" />
                <h4 className="font-bold font-mono text-xs uppercase tracking-widest text-riso-ink">
                  {t.disclaimerTitle}
                </h4>
              </div>

              {/* Body */}
              <p className={`font-mono text-riso-ink leading-relaxed ${lang === 'kh' || lang === 'th' ? 'text-[15px] leading-6' : 'text-[13px]'}`}>
                {t.disclaimerBody.split(`'${t.guide}'`).map((part, i, arr) => (
                  <span key={i}>
                    {part}
                    {i < arr.length - 1 && (
                      <button
                        onClick={() => setViewMode('GUIDE')}
                        className="text-riso-ink font-bold border-b border-riso-ink hover:bg-riso-ink hover:text-riso-paper px-0.5 transition-colors cursor-pointer"
                        title={`Go to ${t.guide}`}
                      >
                        '{t.guide}'
                      </button>
                    )}
                  </span>
                ))}
              </p>
            </div>
          </div>
        </aside>

        {/* Main Content Grid */}
        <main className="flex-1 grid grid-cols-1 xl:grid-cols-3 gap-6 items-stretch">

          {/* ANALYSIS VIEW - Viewport-contained like Timeline */}
          <div className={`xl:col-span-3 ${deferredViewMode !== 'ANALYSIS' ? 'hidden' : ''}`}>
            <div className="flex flex-col gap-4" style={{ height: (isDesktop && typeof sidebarHeight !== 'undefined') ? sidebarHeight : undefined }}>
              {/* Stats Row - Fixed Height */}
              <div className="flex-none">
                <Card title={t.damageAssessment} icon={Crosshair} loading={dashboardLoading} refreshing={dashboardRefreshing}>

                  <div className="stats-grid grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
                    {/* Displaced Civilians */}
                    <div className="bg-riso-ink/5 py-5 px-3 md:p-4 border border-riso-ink/10 flex flex-col justify-center min-h-[140px] md:min-h-24">
                      <h4 className={`font-mono font-bold uppercase opacity-60 mb-3 ${lang === 'kh' || lang === 'th' ? 'text-[15px]' : 'text-[12px]'}`}>{t.displacedCivilians}</h4>
                      <span className="font-display text-3xl md:text-5xl text-riso-ink leading-none">{(dashboardStats?.displacedCount || 0).toLocaleString()}</span>
                      {/* Trend Indicator - Show last updated instead */}
                      <div className={`mt-3 font-mono opacity-50 uppercase tracking-wider ${lang === 'kh' || lang === 'th' ? 'text-[13px]' : 'text-[11px]'} leading-tight`}>
                        {dashboardStats?.lastUpdatedAt ? (
                          <span className="block" title={`${t.lastUpdated}: ${new Date(dashboardStats.lastUpdatedAt).toLocaleString()}`}>
                            {t.lastUpdated} {(() => {
                              const d = new Date(dashboardStats.lastUpdatedAt);
                              const day = d.getDate();
                              const month = lang === 'kh' ? KH_MONTHS[d.getMonth()] : lang === 'th' ? TH_MONTHS_SHORT[d.getMonth()] : d.toLocaleDateString('en-US', { month: 'short' }).toUpperCase();
                              const time = d.toLocaleTimeString(lang === 'th' || lang === 'kh' ? 'en-GB' : 'en-US', { hour: '2-digit', minute: '2-digit', hour12: lang === 'en' });
                              return <>{month} {day} <span className="hidden md:inline ml-1">{time}</span></>;
                            })()}
                          </span>
                        ) : (
                          <span>{t.estimated}</span>
                        )}
                      </div>
                    </div>

                    {/* Fatalities (Replaces old Injuries box position) */}
                    <div className="bg-riso-ink/5 py-5 px-3 md:p-4 border border-riso-ink/10 flex flex-col justify-center min-h-[140px] md:min-h-24">
                      <h4 className={`font-mono font-bold uppercase opacity-60 mb-3 ${lang === 'kh' || lang === 'th' ? 'text-[15px]' : 'text-[12px]'}`}>{t.fatalities}</h4>
                      <span className="font-display text-3xl md:text-5xl text-riso-ink leading-none">{dashboardStats?.casualtyCount || 0}</span>
                      <div className={`mt-3 font-mono text-riso-accent font-bold uppercase tracking-wider ${lang === 'kh' || lang === 'th' ? 'text-[13px]' : 'text-[11px]'}`}>{t.confirmedOnly}</div>
                    </div>

                    {/* Injuries - Split into Civilian / Military */}
                    <div className="bg-riso-ink/5 py-5 px-3 md:p-4 border border-riso-ink/10 flex flex-col justify-center min-h-[140px] md:min-h-24">
                      {/* Top: Title + Numbers */}
                      <h4 className={`font-mono font-bold uppercase opacity-60 mb-3 ${lang === 'kh' || lang === 'th' ? 'text-[15px]' : 'text-[12px]'}`}>{t.injured}</h4>
                      <div className="flex items-start gap-6">
                        {/* Civilian */}
                        <div className="text-left">
                          <span className="font-display text-3xl md:text-5xl text-riso-ink leading-none block">{dashboardStats?.civilianInjuredCount || 0}</span>
                          <span className={`mt-2 font-mono opacity-50 uppercase tracking-tighter md:tracking-normal block ${lang === 'kh' || lang === 'th' ? 'text-[13px]' : 'text-[11px]'}`}>{t.civilian}</span>
                        </div>
                        {/* Military */}
                        <div className="text-left">
                          <span className="font-display text-3xl md:text-5xl text-riso-ink leading-none block">{dashboardStats?.militaryInjuredCount || 0}</span>
                          <span className={`mt-2 font-mono opacity-50 uppercase tracking-tighter md:tracking-normal block ${lang === 'kh' || lang === 'th' ? 'text-[13px]' : 'text-[11px]'}`}>{t.military}</span>
                        </div>
                      </div>
                    </div>

                    {/* Status / Threat Level - Uses dashboardStats for conflict level */}
                    <div className="bg-riso-ink/5 py-5 px-3 md:p-4 border border-riso-ink/10 flex flex-col justify-center min-h-[140px] md:min-h-24">
                      <h4 className={`font-mono font-bold uppercase opacity-60 mb-3 ${lang === 'kh' || lang === 'th' ? 'text-[15px]' : 'text-[12px]'}`}>{t.threatLevel}</h4>
                      <span className={`font-display text-3xl md:text-5xl leading-none uppercase ${(dashboardStats?.conflictLevel || 'Low').toUpperCase() === 'CRITICAL' ? 'text-riso-accent animate-pulse' :
                        (dashboardStats?.conflictLevel || 'Low').toUpperCase() === 'ELEVATED' ? 'text-yellow-600' : 'text-green-700'
                        }`}>
                        {(dashboardStats?.conflictLevel || 'Low').toUpperCase() === 'CRITICAL' ? t.critical :
                          (dashboardStats?.conflictLevel || 'Low').toUpperCase() === 'ELEVATED' ? t.elevated :
                            t.low}
                      </span>
                      <div className={`mt-3 font-mono opacity-50 uppercase tracking-wider ${lang === 'kh' || lang === 'th' ? 'text-[13px]' : 'text-[11px]'}`}>{t.estimated}</div>
                    </div>
                  </div>
                </Card>
              </div>

              {/* Three Perspectives Grid - Equal 1fr columns */}
              <div className="flex-1 min-h-0 overflow-visible">
                <div
                  className={`perspectives-grid grid gap-4 h-full ${isDesktop ? 'grid-cols-3' : 'grid-cols-1'}`}
                  suppressHydrationWarning
                >

                  {/* Section 3: Neutral Analysis (Center) - ORDER 1 ON MOBILE */}
                  <div className="flex flex-col gap-2 order-1 xl:order-2 perspective-neutral min-h-0">
                    <div className="bg-riso-ink text-riso-paper py-2 px-2 text-center font-display uppercase tracking-widest text-xl flex items-center justify-center gap-2 overflow-visible">
                      <Scale size={18} /> {t.neutralAI}
                    </div>
                    <Card className="h-full flex flex-col border-dotted border-2 !shadow-none" loading={neutralMetaLoading} refreshing={neutralMetaRefreshing}>
                      <div ref={neutralTextRef} className="flex-1 flex flex-col space-y-2 min-h-0 overflow-visible">
                        <div className="mb-2 flex items-center justify-between border-b border-riso-ink/10 pb-2">
                          <h3 className={`font-display uppercase tracking-tight ${lang === 'th' ? 'font-bold text-[18px] leading-normal' : lang === 'kh' ? 'text-[18px] leading-normal' : 'text-2xl leading-none'}`}>
                            {t.situationReport}
                          </h3>
                          <div className="px-3 py-1.5 border border-dashed border-riso-ink/40 bg-riso-ink/[0.03] flex items-center justify-center">
                            <span className={`font-mono font-black uppercase tracking-[0.2em] leading-none text-riso-ink/70 ${lang === 'kh' || lang === 'th' ? 'text-[15px]' : 'text-[12px]'}`}>
                              {t.aiSynthesis}
                            </span>
                          </div>
                        </div>

                        <div className={`font-mono leading-relaxed text-justify indent-3 ${lang === 'kh' || lang === 'th' ? 'text-[18px]' : 'text-[15px]'}`}>
                          {getSummary(neutralMeta) || t.analyzingFeeds}
                        </div>

                        {getKeyEvents(neutralMeta).length > 0 && (
                          <div className="mt-auto pt-2 border-t border-riso-ink/10">
                            <p className={`font-bold font-mono mb-2 uppercase ${lang === 'kh' || lang === 'th' ? 'text-[18px]' : 'text-[15px]'}`}>{t.keyDevelopments}:</p>
                            <ul className="list-disc pl-4 space-y-1">
                              {getKeyEvents(neutralMeta).map((event: string, i: number) => (
                                <li key={i} className={`font-mono ${lang === 'kh' || lang === 'th' ? 'text-[18px]' : 'text-[15px]'}`}>{event}</li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {/* Source Stats - Compact */}

                      </div>
                    </Card>
                  </div>

                  {/* Section 2: Cambodia Perspective - ORDER 2 ON MOBILE */}
                  <div className="flex flex-col gap-2 order-2 xl:order-1 perspective-cambodia min-h-0">
                    <div className="bg-[#032EA1] text-[#f2f0e6] p-2 text-center font-display uppercase tracking-widest text-lg flex-none">
                      {t.cambodia}
                    </div>
                    <Card className="flex-1 flex flex-col overflow-hidden !pb-2" loading={khNewsLoading || khMetaLoading} refreshing={khNewsRefreshing || khMetaRefreshing}>
                      <div className="flex-1 flex flex-col space-y-3 min-h-0 pb-2">
                        {/* Official Narrative */}
                        <div>
                          <h4 className={`font-mono font-bold uppercase mb-2 border-b border-riso-ink/20 pb-1 ${lang === 'kh' || lang === 'th' ? 'text-[15px]' : 'text-[12px]'}`}>{t.officialNarrative}</h4>
                          {getNarrative(cambodiaMeta) ? (
                            <>
                              <p className={`italic leading-relaxed ${lang === 'kh' ? 'text-[18px] font-mono leading-relaxed' : lang === 'th' ? 'text-[18px] font-mono' : 'text-base font-serif'}`}>
                                "{getNarrative(cambodiaMeta)}"
                              </p>
                              <p className="text-right text-[10px] font-mono mt-1 opacity-60">— {cambodiaMeta.narrativeSource || t.aiAnalysis}</p>
                            </>
                          ) : (
                            <p className="font-mono text-xs opacity-50">{t.analysisPending}</p>
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

                  {/* Section 4: Thailand Perspective - ORDER 3 ON MOBILE */}
                  <div className="flex flex-col gap-2 order-3 xl:order-3 perspective-thailand min-h-0">
                    <div className="bg-[#241D4F] text-[#f2f0e6] p-2 text-center font-display uppercase tracking-widest text-lg flex-none">
                      {t.thailand}
                    </div>
                    <Card className="flex-1 flex flex-col overflow-hidden !pb-2" loading={thNewsLoading || thMetaLoading} refreshing={thNewsRefreshing || thMetaRefreshing}>
                      <div className="flex-1 flex flex-col space-y-3 min-h-0 pb-2">
                        {/* Official Narrative */}
                        <div>
                          <h4 className={`font-mono font-bold uppercase mb-2 border-b border-riso-ink/20 pb-1 ${lang === 'kh' || lang === 'th' ? 'text-[15px]' : 'text-[12px]'}`}>{t.officialNarrative}</h4>
                          {getNarrative(thailandMeta) ? (
                            <>
                              <p className={`italic leading-relaxed ${lang === 'kh' ? 'text-[18px] font-mono leading-relaxed' : lang === 'th' ? 'text-[18px] font-mono' : 'text-base font-serif'}`}>
                                "{getNarrative(thailandMeta)}"
                              </p>
                              <p className="text-right text-[10px] font-mono mt-1 opacity-60">— {thailandMeta.narrativeSource || t.aiAnalysis}</p>
                            </>
                          ) : (
                            <p className="font-mono text-xs opacity-50">{t.analysisPending}</p>
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
              </div> {/* End of perspectives container */}
            </div> {/* End of main flex container */}
          </div>

          {/* LOSSES VIEW */}
          <div className={`xl:col-span-3 ${deferredViewMode !== 'LOSSES' ? 'hidden' : ''}`}>
            <div className="xl:col-span-3 flex flex-col gap-4 h-[calc(100dvh-4rem)] xl:h-auto" style={{ height: (isDesktop && typeof sidebarHeight !== 'undefined') ? sidebarHeight : undefined }}>
              <Card title={`${t.historicalTimeline}`} loading={timelineLoading} refreshing={timelineRefreshing} className="h-full flex flex-col overflow-hidden">

                {(!timelineEvents || timelineEvents.length === 0) ? (
                  <div className="text-center py-12 flex-1 flex flex-col justify-center items-center">
                    <p className="font-mono text-sm opacity-60">{t.noTimelineEvents}</p>
                    <p className="font-mono text-xs opacity-40 mt-2">{t.runHistorian}</p>
                  </div>
                ) : (
                  <div className="flex flex-col h-full min-h-0">
                    {/* --- DATE SELECTOR BAR --- */}
                    <div className="flex-none p-4 border-b border-riso-ink/10 bg-riso-ink/5 relative group">

                      {/* Date Range Header */}
                      <div className="flex justify-between items-center mb-2 px-1">
                        <span className={`font-mono ${lang === 'kh' || lang === 'th' ? 'text-[13px]' : 'text-[11px]'} font-bold uppercase tracking-widest text-riso-ink/40`}>
                          {timelineDates.length > 0 ? formatDate(timelineDates[0], 'short') : '-'}
                        </span>
                        <div className="h-px flex-1 bg-riso-ink/10 mx-4"></div>
                        <span className={`font-mono ${lang === 'kh' || lang === 'th' ? 'text-[13px]' : 'text-[11px]'} font-bold uppercase tracking-widest text-riso-ink/40`}>
                          {timelineDates.length > 0 ? formatDate(timelineDates[timelineDates.length - 1], 'short') : '-'}
                        </span>
                      </div>

                      {/* Left/Right Scroll Indicators (Visual Masks) */}
                      <div className="absolute left-0 top-10 bottom-0 w-8 bg-gradient-to-r from-riso-paper/40 to-transparent z-10 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity"></div>
                      <div className="absolute right-0 top-10 bottom-0 w-8 bg-gradient-to-l from-riso-paper/40 to-transparent z-10 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity"></div>

                      <div
                        ref={datePickerRef}
                        className="flex items-center gap-2 overflow-x-auto pb-2 scroll-auto overscroll-x-contain no-scrollbar"
                      >
                        {timelineDates.map((date) => {
                          const isSelected = selectedTimelineDate === date;
                          const count = dateCounts[date] || 0;
                          return (
                            <button
                              key={date}
                              data-date={date}
                              onClick={() => scrollToDate(date)}
                              className={`
                                     flex flex-col items-center justify-center snap-center
                                     min-w-[80px] px-3 ${lang === 'kh' || lang === 'th' ? 'py-3' : 'py-2'} rounded-sm border-2 transition-colors duration-150 flex-shrink-0
                                     ${isSelected
                                  ? 'bg-riso-ink border-riso-ink text-riso-paper'
                                  : 'bg-riso-paper border-riso-ink/20 text-riso-ink hover:border-riso-ink/50 hover:bg-black/5'}
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

                    {/* --- VIRTUALIZED TIMELINE --- */}
                    <div
                      ref={timelineScrollRef}
                      className={`flex-1 overflow-y-auto min-h-0 bg-[url('/grid.svg')] bg-[length:20px_20px] transition-opacity duration-200 ${isScrollJump ? 'opacity-0' : 'opacity-100'}`}
                      style={{ overflowAnchor: 'none', transform: 'translate3d(0,0,0)' }}
                    >
                      {/* Virtual container with total height */}
                      <div
                        className="relative w-full"
                        style={{ height: `${rowVirtualizer.getTotalSize()}px` }}
                      >
                        {/* Center Line */}
                        <div className="absolute left-4 md:left-1/2 top-0 bottom-0 w-px border-l-2 border-dashed border-riso-ink/20 transform md:-translate-x-1/2 z-0"></div>

                        {/* Virtualized items */}
                        {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                          const item = virtualItems[virtualRow.index];
                          if (!item) return null;

                          if (item.type === 'header') {
                            // Date Header
                            return (
                              <div
                                key={`header-${item.date}`}
                                id={`timeline-date-${item.date}`}
                                data-index={virtualRow.index}
                                ref={rowVirtualizer.measureElement}
                                className="absolute top-0 left-0 w-full z-20"
                                style={{ transform: `translateY(${virtualRow.start}px)` }}
                              >
                                <div className="bg-riso-paper border-t border-b border-riso-ink/10 py-3 px-4 md:px-8 shadow-sm">
                                  <div className="flex items-center justify-between max-w-2xl mx-auto">
                                    <div className="flex items-center gap-3">
                                      <div className="w-3 h-3 rounded-full bg-riso-ink"></div>
                                      <h3 className="font-display text-xl uppercase tracking-wide">
                                        <span className="md:hidden">{formatDate(item.date, 'weekday-short')}</span>
                                        <span className="hidden md:inline">{formatDate(item.date, 'weekday')}</span>
                                      </h3>
                                    </div>
                                    <span className="font-mono text-sm opacity-100">{item.eventsInDate} {t.reports}</span>
                                  </div>
                                </div>
                              </div>
                            );
                          } else {
                            // Event Card
                            const event = item.event;
                            const isRight = (item.eventIndex || 0) % 2 === 0;
                            const isImportant = (event?.importance || 0) > 75;

                            return (
                              <div
                                key={event?._id || `event-${virtualRow.index}`}
                                data-index={virtualRow.index}
                                ref={rowVirtualizer.measureElement}
                                className="absolute top-0 left-0 w-full px-4 md:px-8 py-3"
                                style={{ transform: `translateY(${virtualRow.start}px)` }}
                              >
                                <div
                                  className={`relative flex md:items-center ${isRight ? 'md:flex-row' : 'md:flex-row-reverse'} flex-row ml-6 md:ml-0`}
                                >
                                  <div className="hidden md:block flex-1"></div>

                                  {/* Center Node */}
                                  <div className="absolute left-[-2.25rem] md:left-1/2 top-1/2 -translate-y-1/2 flex items-center justify-center w-6 h-6 md:w-8 md:h-8 md:-translate-x-1/2 z-10">
                                    <div
                                      className={`rounded-full border-2 border-riso-paper shadow-sm cursor-pointer
                                        ${categoryColors[event?.category?.toLowerCase()] || 'bg-gray-500'}
                                        ${isImportant ? 'animate-pulse ring-2 ring-offset-1 md:ring-offset-2 ring-riso-accent' : ''}
                                        w-6 h-6 md:w-8 md:h-8 flex items-center justify-center`}
                                      onClick={() => setSelectedEvent(event)}
                                    >
                                      {(() => {
                                        const cat = event?.category?.toLowerCase();
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
                                      className={`relative bg-riso-paper p-3 rounded-sm border cursor-pointer group
                                        ${isImportant ? 'border-riso-accent border-2' : 'border-riso-ink/20 dashed-border-sm'}`}
                                      onClick={() => setSelectedEvent(event)}
                                    >
                                      <div className="flex justify-between items-start mb-1">
                                        <span className={`font-mono ${lang === 'kh' || lang === 'th' ? 'text-[13px] font-semibold' : 'text-[10px] font-bold uppercase'} ${lang === 'kh' ? 'leading-relaxed py-1' : 'py-0.5'} px-1.5 rounded text-white ${categoryColors[event?.category?.toLowerCase()] || 'bg-gray-500'}`}>
                                          {t[`cat_${event?.category?.toLowerCase()}` as keyof typeof t] || event?.category}
                                        </span>
                                        <span className="font-mono text-[10px] opacity-50">
                                          {event?.timeOfDay || 'All Day'}
                                        </span>
                                      </div>

                                      <h4 className={`leading-tight mb-1 ${lang === 'kh' ? 'font-bold text-base font-mono leading-relaxed' : lang === 'th' ? 'font-bold text-base font-mono' : 'font-semibold text-[15px] font-display uppercase tracking-wide'}`}>
                                        {(() => {
                                          if (lang === 'th' && event?.titleTh) return event.titleTh;
                                          if (lang === 'kh' && event?.titleKh) return event.titleKh;
                                          return event?.title;
                                        })()}
                                      </h4>

                                      <p className={`line-clamp-2 opacity-70 ${lang === 'kh' ? 'text-sm leading-relaxed' : lang === 'th' ? 'text-sm' : 'text-xs font-mono'}`}>
                                        {(() => {
                                          if (lang === 'th' && event?.descriptionTh) return event.descriptionTh;
                                          if (lang === 'kh' && event?.descriptionKh) return event.descriptionKh;
                                          return event?.description;
                                        })()}
                                      </p>

                                      {event?.sources && event.sources.length > 0 && (
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
                              </div>
                            );
                          }
                        })}

                        {virtualItems.length === 0 && (
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
                          <h3 className={`font-display text-xl md:text-2xl leading-snug ${lang === 'th' ? 'font-bold' : ''} ${lang === 'en' ? 'text-3xl' : ''}`}>
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
                                      className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-white border border-gray-200 rounded shadow-sm text-xs font-mono hover:bg-blue-50 hover:border-blue-200 transition-all duration-200 cursor-pointer group"
                                    >
                                      <span className="text-gray-900">{s.name}</span>
                                      <span className="opacity-40 font-bold group-hover:opacity-70">{s.credibility}%</span>
                                      <span className="opacity-30 group-hover:opacity-60 transition-opacity">↗</span>
                                    </a>
                                  ) : (
                                    <span key={idx} className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-white border border-gray-200 rounded shadow-sm text-xs font-mono">
                                      <span className="text-gray-900">{s.name}</span>
                                      <span className="opacity-40 font-bold">{s.credibility}%</span>
                                    </span>
                                  )
                                ))}

                                {/* Integrated Toggle Button */}
                                {remainingSources.length > 0 && !showAllSources && (
                                  <button
                                    onClick={() => setShowAllSources(true)}
                                    className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-gray-100 border border-gray-200 rounded shadow-sm text-xs font-mono hover:bg-gray-200 transition-all duration-200 text-gray-600 hover:text-gray-900"
                                  >
                                    + {remainingSources.length} {t.moreSources}
                                  </button>
                                )}
                              </div>

                              {/* Expanded remaining sources */}
                              {remainingSources.length > 0 && showAllSources && (
                                <div className="space-y-3 pt-1">
                                  <div className="flex flex-wrap gap-2 animate-in fade-in slide-in-from-top-1 duration-300">
                                    {remainingSources.map((s: any, idx: number) => (
                                      s.url ? (
                                        <a
                                          key={idx + 3}
                                          href={s.url}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-gray-50 border border-gray-200 rounded text-xs font-mono hover:bg-blue-50 hover:border-blue-200 transition-all duration-200 cursor-pointer group"
                                        >
                                          <span className="text-gray-800">{s.name}</span>
                                          <span className="opacity-40 font-bold group-hover:opacity-70">{s.credibility}%</span>
                                          <span className="opacity-30 group-hover:opacity-60 transition-opacity">↗</span>
                                        </a>
                                      ) : (
                                        <span key={idx + 3} className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-gray-50 border border-gray-200 rounded text-xs font-mono text-gray-700">
                                          <span>{s.name}</span>
                                          <span className="opacity-40 font-bold">{s.credibility}%</span>
                                        </span>
                                      )
                                    ))}
                                  </div>

                                  <button
                                    onClick={() => setShowAllSources(false)}
                                    className="flex items-center gap-1 text-[10px] font-mono text-gray-400 hover:text-gray-600 transition-colors uppercase tracking-wider"
                                  >
                                    ↑ {t.hide}
                                  </button>
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
                    className="fixed inset-0 z-[100] flex items-center justify-center p-4"
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
          </div>

          {/* GUIDE VIEW - Viewport-contained like other views */}
          <div className={`xl:col-span-3 ${deferredViewMode !== 'GUIDE' ? 'hidden' : ''}`}>
            <div className="flex flex-col bg-riso-paper rough-border h-[calc(100dvh-4rem)] xl:h-auto" style={{ height: (isDesktop && typeof sidebarHeight !== 'undefined') ? sidebarHeight : undefined }}>
              {/* Fixed header with GitHub link */}
              <div className="flex items-center justify-between p-4 border-b-2 border-riso-ink/20 flex-shrink-0">
                <h3 className="font-display uppercase text-2xl tracking-wide text-riso-ink">
                  {t.guideTitle}
                </h3>
                <a
                  href="https://github.com/South-33/BorderClash"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 font-mono text-xs opacity-60 hover:opacity-100 transition-opacity"
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
                  </svg>
                  <span className="hidden sm:inline">GitHub</span>
                </a>
              </div>
              {/* Scrollable content */}
              <div className="flex-1 overflow-y-auto p-4">
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">

                  {/* LEFT COLUMN: CRITICAL LITERACY */}
                  <div className="space-y-8">
                    {/* Trust No One Warning */}
                    <div className="border-4 border-double border-riso-ink relative overflow-hidden bg-riso-ink/5">
                      <div className="p-6 relative z-10">
                        <h3 className="font-display text-3xl uppercase tracking-tighter mb-4 flex items-center gap-3">
                          <ScanEye className="w-10 h-10 text-riso-ink" strokeWidth={1.5} /> {t.trustWarning}
                        </h3>
                        <p className={`font-mono leading-relaxed font-medium ${lang === 'kh' || lang === 'th' ? 'text-base' : 'text-sm'}`}>
                          {t.trustWarningDesc}
                        </p>
                      </div>
                    </div>

                    {/* Anti-Propaganda Checklist */}
                    <div>
                      <h4 className={`font-mono font-bold uppercase border-b-2 border-riso-ink pb-2 mb-4 ${lang === 'kh' || lang === 'th' ? 'text-base' : 'text-sm'}`}>{t.verificationChecklist}</h4>
                      <ul className="grid grid-cols-1 gap-2 font-mono text-xs">
                        {[
                          { icon: Globe, text: t.checkSources },
                          { icon: Camera, text: t.lookForEvidence },
                          { icon: Scale, text: t.considerBias },
                          { icon: Calendar, text: t.checkDates },
                          { icon: AlertTriangle, text: t.emotionalManipulation }
                        ].map((item, i) => (
                          <li key={i} className="flex items-center gap-3 p-3 bg-white/40 border border-riso-ink/20 hover:border-riso-ink transition-all cursor-crosshair group">
                            <div className="w-8 h-8 border border-riso-ink flex items-center justify-center bg-white group-hover:bg-riso-ink group-hover:text-white transition-colors flex-shrink-0">
                              <item.icon className="w-4 h-4" strokeWidth={2} />
                            </div>
                            <span className={`font-medium ${lang === 'kh' || lang === 'th' ? 'text-base' : 'text-sm tracking-tight'}`}>
                              {item.text}
                            </span>
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







                  </div>

                  {/* RIGHT COLUMN: HOW IT WORKS */}
                  <div className="space-y-8">
                    <div>
                      <h4 className="font-display text-xl uppercase mb-6 flex items-center gap-2">
                        <span className="w-2 h-2 bg-riso-ink rounded-full"></span>
                        {t.howItWorks}
                      </h4>

                      <div className="relative space-y-12 pl-8 before:absolute before:left-[14px] before:top-2 before:bottom-2 before:w-[2px] before:bg-riso-ink/20 before:border-l before:border-r before:border-riso-ink/10">
                        {/* Step 1: Curator */}
                        <div className="relative">
                          <div className="absolute -left-[34px] top-0 bg-riso-paper border-2 border-riso-ink text-riso-ink font-bold font-mono text-xs px-1 py-0.5">01</div>
                          <h5 className="font-mono font-black uppercase mb-2 tracking-widest text-[#032EA1]">{t.curatorRole}</h5>
                          <p className={`font-mono opacity-80 leading-relaxed max-w-prose ${lang === 'kh' || lang === 'th' ? 'text-base' : 'text-sm'}`}>{t.curatorDesc}</p>
                        </div>

                        {/* Step 2: Verifier */}
                        <div className="relative">
                          <div className="absolute -left-[34px] top-0 bg-riso-paper border-2 border-riso-ink text-riso-ink font-bold font-mono text-xs px-1 py-0.5">02</div>
                          <h5 className="font-mono font-black uppercase mb-2 tracking-widest text-[#032EA1]">{t.verifierRole}</h5>
                          <p className={`font-mono opacity-80 leading-relaxed max-w-prose ${lang === 'kh' || lang === 'th' ? 'text-base' : 'text-sm'}`}>{t.verifierDesc}</p>
                        </div>

                        {/* Step 3: Historian */}
                        <div className="relative">
                          <div className="absolute -left-[34px] top-0 bg-riso-paper border-2 border-riso-ink text-riso-ink font-bold font-mono text-xs px-1 py-0.5">03</div>
                          <h5 className="font-mono font-black uppercase mb-2 tracking-widest text-[#032EA1]">{t.historianRole}</h5>
                          <p className={`font-mono opacity-80 leading-relaxed max-w-prose ${lang === 'kh' || lang === 'th' ? 'text-base' : 'text-sm'}`}>{t.historianDesc}</p>
                        </div>

                        {/* Step 4: Synth */}
                        <div className="relative">
                          <div className="absolute -left-[34px] top-0 bg-riso-paper border-2 border-riso-ink text-riso-ink font-bold font-mono text-xs px-1 py-0.5">04</div>
                          <h5 className="font-mono font-black uppercase mb-2 tracking-widest text-[#032EA1]">{t.synthRole}</h5>
                          <p className={`font-mono opacity-80 leading-relaxed max-w-prose ${lang === 'kh' || lang === 'th' ? 'text-base' : 'text-sm'}`}>{t.synthDesc}</p>
                        </div>
                      </div>
                    </div>

                    {/* Stateless Approach Badge */}
                    <div className="mt-8 bg-riso-ink text-riso-paper p-6 text-center transform rotate-1 hover:rotate-0 transition-transform cursor-crosshair">
                      <h3 className="font-display text-2xl uppercase mb-2">{t.statelessApproach}</h3>
                      <p className={`font-mono opacity-80 ${lang === 'kh' || lang === 'th' ? 'text-sm' : 'text-xs'}`}>{t.statelessDesc}</p>
                    </div>





                  </div> {/* End of right column */}
                </div> {/* End of grid */}

                {/* BOTTOM ROW: SIDE-BY-SIDE EQUAL HEIGHT */}
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-8 mt-8">
                  {/* Left: Fact vs Propaganda */}
                  <div className="space-y-4">
                    <h4 className={`font-mono font-bold uppercase border-b-2 border-riso-ink pb-2 mb-4 flex items-center gap-2 ${lang === 'kh' || lang === 'th' ? 'text-base' : 'text-sm'}`}>
                      {t.factVsPropaganda}
                    </h4>
                    <div className="grid grid-cols-1 gap-0 border-2 border-riso-ink/10 bg-white/30 h-[calc(100%-3rem)] content-start">
                      {/* Comparison 1 */}
                      <div className={`p-4 font-mono space-y-2 border-b-2 border-dashed border-riso-ink/10 hover:bg-white transition-colors ${lang === 'kh' || lang === 'th' ? 'text-sm' : 'text-xs'}`}>
                        <p className="text-[#188d45] flex gap-3 font-bold"><span className="opacity-50">[FACT]</span> {t.fact1}</p>
                        <p className="text-[#b91c1c] flex gap-3 font-bold opacity-80"><span className="opacity-50">[SPIN]</span> {t.propaganda1}</p>
                      </div>
                      {/* Comparison 2 */}
                      <div className={`p-4 font-mono space-y-2 hover:bg-white transition-colors flex-1 ${lang === 'kh' || lang === 'th' ? 'text-sm' : 'text-xs'}`}>
                        <p className="text-[#188d45] flex gap-3 font-bold"><span className="opacity-50">[FACT]</span> {t.fact2}</p>
                        <p className="text-[#b91c1c] flex gap-3 font-bold opacity-80"><span className="opacity-50">[SPIN]</span> {t.propaganda2}</p>
                      </div>
                    </div>
                  </div>

                  {/* Right: Scores Meaning */}
                  <div className="space-y-4">
                    <h4 className={`font-mono font-bold uppercase border-b-2 border-riso-ink pb-2 mb-4 flex items-center gap-2 ${lang === 'kh' || lang === 'th' ? 'text-base' : 'text-sm'}`}>
                      {t.understandingScores}
                    </h4>
                    <div className="grid grid-cols-1 gap-0 border-2 border-riso-ink/10 bg-white/30 h-[calc(100%-3rem)] content-start">
                      {[
                        { color: "bg-green-500", text: t.scoreHigh },
                        { color: "bg-yellow-500", text: t.scoreMid },
                        { color: "bg-red-500", text: t.scoreLow }
                      ].map((score, i) => (
                        <div key={i} className={`p-4 font-mono flex items-center gap-3 hover:bg-white transition-colors ${i !== 2 ? 'border-b-2 border-dashed border-riso-ink/10' : ''} ${lang === 'kh' || lang === 'th' ? 'text-sm' : 'text-xs'}`}>
                          <div className={`w-3 h-3 rounded-full ${score.color} flex-shrink-0`}></div>
                          <p className="font-bold opacity-80">{score.text}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div> {/* End of scrollable content */}
            </div> {/* End of inner flex container */}
          </div> {/* End of GUIDE outer container */}
        </main>
        {/* Decorative footer elements */}
        <div className="fixed bottom-4 right-4 hidden lg:block">
        </div>
      </div >
      {/* Bottom spacer - flexes equally with top */}
      < div />
    </div >
  );
}