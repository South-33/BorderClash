'use client';

import { useState, useEffect, useRef, useLayoutEffect, useMemo } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { api } from '../../convex/_generated/api';

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
    damageAssessment: "DAMAGE ASSESSMENT",
    displacedCivilians: "Displaced Civilians",
    civilianInjuries: "Civilian Injuries",
    propertyDamaged: "Property Damaged",
    status: "Status",
    confirmedOnly: "CONFIRMED ONLY",
    structures: "STRUCTURES",
    monitoring: "MONITORING",
    active: "ACTIVE",
    situationReport: "SITUATION REPORT",
    autoUpdating: "Auto-updating every 60 minutes",
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
    scoutRole: "THE SCOUTS (Data Collection)",
    scoutDesc: "Teams of AI agents scour Thai, Cambodian, and International media 24/7. They don't analyze; they only collect raw articles from every possible source.",
    analystRole: "THE ANALYST (Verification)",
    analystDesc: "A second layer of AI reads every article looking for bias. It cross-references claims against international wire services (Reuters, AP) and flags suspicious, emotional, or unverified content.",
    managerRole: "THE MANAGER (Synthesis)",
    managerDesc: "The 'Neutral AI' reviews conflicting reports without taking sides. If Thailand says X and Cambodia says Y, it reports the discrepancy and calculates a confidence score.",
    trustWarning: "TRUST NO ONE BLINDLY",
    trustWarningDesc: "Every government has an incentive to lie during conflict. Every news outlet has an audience to please. This dashboard is a tool, not a truth machine. Use it to compare narratives, not to validate your biases.",
    statelessApproach: "THE STATELESS APPROACH",
    statelessDesc: "We do not believe in 'National Truth'. Truth is often found in the silence between two shouting governments.",
  },
  th: {
    officialNarrative: "มุมมองจากทางการ",
    militaryIntensity: "สถานการณ์ความตึงเครียด",
    peaceful: "เหตุการณ์ปกติ",
    defensive: "เตรียมพร้อม/ตั้งรับ",
    aggressive: "ปะทะ/ตึงเครียด",
    intelligenceLog: "ข่าวกรองล่าสุด",
    items: "รายการ",
    noArticles: "ยังไม่มีข้อมูล",
    noArticlesFiltered: "ไม่พบบทความในหมวดนี้",
    damageAssessment: "ประเมินความเสียหาย",
    displacedCivilians: "ชาวบ้านที่ต้องอพยพ",
    civilianInjuries: "ชาวบ้านบาดเจ็บ",
    propertyDamaged: "ทรัพย์สินเสียหาย",
    status: "สถานะ",
    confirmedOnly: "ยืนยันแล้ว",
    structures: "สิ่งปลูกสร้าง",
    monitoring: "กำลังจับตา",
    active: "ใช้งานอยู่",
    situationReport: "รายงานสถานการณ์สด",
    autoUpdating: "อัปเดตเองทุก 60 นาที",
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
    propagandaWarningDesc: "ระวัง: ใช้คำดราม่าล้นๆ, ป้ายสีอีกฝั่งเป็นตัวร้าย, ไม่มีหลักฐานชัดเจน, พูดซ้ำๆ แต่ไม่มีเนื้อหา, ปลุกระดมให้รักชาติ/เกลียดชังแทนที่จะพูดด้วยเหตุผล",
    systemDisclaimer: "ระบบนี้พยายามเป็นกลางที่สุด แต่คุณต้องใช้วิจารณญาณตัวเองด้วย",
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
    credibilityScore: "คะแนนความน่าเชื่อถือดูยังไง?",
    credibilityDesc: "คะแนน (0-100%) คือความชัวร์ของข่าว ถ้าต่ำกว่า 50% คือเสี่ยงเป็นข่าวโคมลอย หรือข่าวปั่น",
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
    scoutRole: "หน่วยสอดแนม (หาข่าว)",
    scoutDesc: "AI ทีมแรกจะวิ่งหาข่าวจากสื่อไทย เขมร และตปท. ตลอด 24 ชม. กวาดมาหมดทุกข่าวไม่เลือกข้าง",
    analystRole: "นักวิเคราะห์ (กรองข่าว)",
    analystDesc: "AI ทีมสองจะอ่านทุกข่าวเพื่อจับผิดอคติ เทียบกับสำนักข่าวกลาง (Reuters, AP) อันไหนเขียนเว่อร์หรือมั่วจะถูกติดธงเตือน",
    managerRole: "ผู้จัดการ (สรุปผล)",
    managerDesc: "AI ตัวกลางจะอ่านข้อมูลที่ขัดแย้งกัน (เช่น ไทยบอกอย่าง เขมรบอกอย่าง) แล้วสรุปให้ฟังว่าตรงไหนไม่ตรงกัน พร้อมให้คะแนนความน่าเชื่อถือ",
    trustWarning: "อย่าเชื่อใจใครง่ายๆ",
    trustWarningDesc: "เวลารบกัน รัฐบาลไหนก็อยากพูดให้ตัวเองดูดี สื่อก็ต้องเอาใจคนดู แดชบอร์ดนี้มีไว้ให้คุณเทียบข้อมูลจากหลายๆ ฝั่ง ไม่ใช่เครื่องบอกความจริงสากล",
    statelessApproach: "แนวคิดแบบไม่เลือกข้าง",
    statelessDesc: "เราไม่เชื่อว่ามีความจริงของฝ่ายใดฝ่ายหนึ่ง ความจริงมักซ่อนอยู่ตรงกลางระหว่างเสียงตะโกนของทั้งสองฝ่าย",
  },
  kh: {
    officialNarrative: "គោលជំហរផ្លូវការ", // View of govt - natural
    militaryIntensity: "ស្ថានភាពនៅព្រំដែន", // Situation at border - natural
    peaceful: "ធម្មតា", // Normal
    defensive: "ការពារ", // Defend
    aggressive: "កាច", // Tense
    intelligenceLog: "ព័ត៌មានថ្មីៗ", // Recent news
    items: "អត្ថបទ",
    noArticles: "មិនទាន់មានព័ត៌មាន",
    noArticlesFiltered: "មិនមានអត្ថបទក្នុងផ្នែកនេះទេ",
    damageAssessment: "ការវាយតម្លៃការខូចខាត", // Formal but verify
    displacedCivilians: "ពលរដ្ឋដែលភៀសខ្លួន", // Citizens who fled
    civilianInjuries: "ពលរដ្ឋរងរបួស",
    propertyDamaged: "ទ្រព្យសម្បត្តិខូចខាត",
    status: "ស្ថានភាព",
    confirmedOnly: "បានបញ្ជាក់",
    structures: "សំណង់",
    monitoring: "កំពុងមើល",
    active: "សកម្ម",
    situationReport: "របាយការណ៍សង្ខេប",
    autoUpdating: "អាប់ដេតរៀងរាល់ 60 នាទី",
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
    subTitle: "តាមដានស្ថានការណ៍ព្រំដែនភ្លាមៗ វិភាគដោយ AI ដើម្បីដឹងការពិត មិនមែនតាមអារម្មណ៍",
    fatalities: "អ្នកស្លាប់ (បញ្ជាក់ហើយ)",
    threatLevel: "កម្រិតគ្រោះថ្នាក់",
    low: "ទាប",
    elevated: "ខ្ពស់",
    critical: "គ្រោះថ្នាក់",
    injured: "អ្នករបួស",
    civilian: "ពលរដ្ឋ",
    military: "ទាហាន",
    fromLastWeek: "ពីសប្តាហ៍មុន",
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
    propagandaWarningDesc: "ប្រយ័ត្ន៖ ប្រើពាក្យលើសៗ, ថាគេអាក្រក់ដាក់យើងល្អ, គ្មានភស្តុតាង, និយាយដដែលៗ, យកជាតិនិយមមកនិយាយជំនួសហេតុផល",
    systemDisclaimer: "ប្រព័ន្ធនេះព្យាយាមនៅកណ្តាល ប៉ុន្តែអ្នកត្រូវគិតពិចារណាដោយខ្លួនឯង។",
    incident: "ហេតុការណ៍",
    image: "រូបភាព",
    sector: "តំបន់",
    all: "ទាំងអស់",
    government: "រដ្ឋាភិបាល",
    media: "សារព័ត៌មាន",
    agency: "ទីភ្នាក់ងារ",
    other: "ផ្សេងៗ",
    guideTitle: "របៀបប្រើ & ការយល់ដឹង",
    dashboardGuide: "របៀបមើលតារាងនេះ",
    dashboardGuideDesc: "យើងប្រមូលព័ត៌មានពីថៃ ខ្មែរ និងបរទេស។ 'AI កណ្តាល' ជួយសង្ខេបដើម្បីឱ្យឃើញចំណុចរួម។",
    aiWarning: "ប្រយ័ត្ន៖ AI និងរូបក្លែងក្លាយ",
    aiWarningDesc: "សម័យនេះ AI អាចបង្កើតរូប/វីដេអូក្លែងក្លាយ (Deepfakes) ដូចមែនទែន។ កុំជឿអ្វីដែលឃើញក្នុងអ៊ីនធឺណិតភ្លាមៗ។",
    deepfakeTips: "របៀបមើលរូបក្លែងក្លាយ",
    dfTip1: "មើលកន្លែងខុសប្រក្រតី (ម្រាមដៃ, ភ្នែក, អក្សរ)",
    dfTip2: "មើលថាសារព័ត៌មានធំៗចុះផ្សាយដែរឬទេ",
    dfTip3: "សាកយករូបទៅស្វែងរកក្នុង Google (Reverse Image Search)",
    credibilityScore: "តើពិន្ទុភាពជឿជាក់គឺជាអ្វី?",
    credibilityDesc: "ពិន្ទុ (0-100%) គឺបញ្ជាក់ថាព័ត៌មាននេះគួរឱ្យទុកចិត្តប៉ុណ្ណា។ បើក្រោម 50% ប្រហែលជាព័ត៌មានមិនពិត ឬពាក្យចចាមអារ៉ាម។",
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
    impact: "ផលប៉ះពាល់",
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
    scoutRole: "អ្នកស៊ើបការណ៍ (រកព័ត៌មាន)",
    scoutDesc: "ក្រុម AI ស្វែងរកក្នុងប្រព័ន្ធផ្សព្វផ្សាយថៃ កម្ពុជា និងអន្តរជាតិ 24ម៉ោង។ គេប្រមូលទាំងអស់មិនរើសមុខ។",
    analystRole: "អ្នកវិភាគ (ត្រួតពិនិត្យ)",
    analystDesc: "AI ក្រុមទី2 អានអត្ថបទដើម្បីរកមើលភាពលំអៀង និងផ្ទៀងផ្ទាត់ជាមួយសារព័ត៌មានអន្តរជាតិ (Reuters, AP)។",
    managerRole: "អ្នកគ្រប់គ្រង (សន្និដ្ឋាន)",
    managerDesc: "AI កណ្តាល នឹងមើលរបាយការណ៍ដែលផ្ទុយគ្នា (ថៃថាម៉្យាង ខ្មែរថាម៉្យាង) ហើយរាយការណ៍ប្រាប់យើងថាខុសគ្នត្រង់ណា។",
    trustWarning: "កុំជឿនរណាម្នាក់ងងឹតងងុល",
    trustWarningDesc: "រដ្ឋាភិបាលណាក៏ចង់និយាយឱ្យខ្លួនឯងល្អ។ សារព័ត៌មានក៏ត្រូវយកចិត្តអ្នកមើល។ ប្រើតារាងនេះដើម្បីប្រៀបធៀបព័ត៌មាន មិនមែនដើម្បីបញ្ជាក់ថាខ្លួនឯងត្រូវទេ។",
    statelessApproach: "មិនកាន់ជើងខាងណា",
    statelessDesc: "យើងមិនជឿលើ 'ការពិតរបស់ជាតិ' ទេ។ ការពិតច្រើនតែនៅចន្លោះកណ្តាលរវាងរដ្ឋាភិបាលទាំងពីរ។"
  }
};

type Lang = 'en' | 'th' | 'kh';

// --- Custom Hooks ---
const usePersistentQuery = (query: any, args: any, storageKey: string) => {
  const convexData = useQuery(query, args);
  const [localData, setLocalData] = useState<any>(null);
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
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
  }, [storageKey]);

  useEffect(() => {
    // Update local storage when convex data arrives
    if (convexData !== undefined) {
      setLocalData(convexData);
      if (typeof window !== 'undefined') {
        localStorage.setItem(storageKey, JSON.stringify(convexData));
      }
    }
  }, [convexData, storageKey]);

  const data = convexData !== undefined ? convexData : localData;
  // Loading = We have no data at all (neither local nor remote) AND we have finished hydration check
  // Note: We show loading until hydration check is done to avoid flash of missing content
  const isLoading = !isHydrated || (convexData === undefined && localData === null);
  // Refreshing = We have local data (so we are showing something) BUT we are waiting for fresh remote data
  const isRefreshing = isHydrated && convexData === undefined && localData !== null;

  return { data, isLoading, isRefreshing };
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
      <p className="leading-snug font-semibold">
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
          <p className="text-xs opacity-80 leading-relaxed">
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
export default function Home() {
  const [nextUpdateIn, setNextUpdateIn] = useState<number | null>(null); // Start null to prevent 5:00 flash
  const [viewMode, setViewMode] = useState<'ANALYSIS' | 'LOSSES' | 'GUIDE'>('ANALYSIS');
  const [lang, setLang] = useState<'en' | 'th' | 'kh'>('en');
  const t = TRANSLATIONS[lang as Lang];


  const [selectedEvent, setSelectedEvent] = useState<any>(null);
  const [showAllSources, setShowAllSources] = useState(false);
  const [isModalClosing, setIsModalClosing] = useState(false);
  const modalRef = useRef<HTMLDivElement>(null);
  const currentDragOffset = useRef(0);

  // Animated close function for modal
  const closeModal = () => {
    setIsModalClosing(true);

    // Animate out - force consistent starting point
    if (modalRef.current) {
      // Step 1: Cancel any CSS animation and disable transitions
      modalRef.current.style.animation = 'none';
      modalRef.current.style.transition = 'none';
      // Force starting position (in case CSS animation was mid-flight)
      modalRef.current.style.transform = 'translateY(0)';
      modalRef.current.style.opacity = '1';

      // Step 2: Force browser reflow to apply above styles immediately
      void modalRef.current.offsetHeight;

      // Step 3: Now enable transition and animate to end state
      modalRef.current.style.transition = 'transform 0.25s cubic-bezier(0.32, 0.72, 0, 1), opacity 0.25s ease-in';
      modalRef.current.style.transform = 'translateY(100%)';
      modalRef.current.style.opacity = '0';
    }

    currentDragOffset.current = 0;
    setTimeout(() => {
      setSelectedEvent(null);
      setIsModalClosing(false);
      setHasInteracted(false); // Reset for next open so slide-up animation plays
    }, 250); // Match animation duration
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

  // Persistent Queries
  const {
    data: thailandNews,
    isLoading: thNewsLoading,
    isRefreshing: thNewsRefreshing
  } = usePersistentQuery(api.api.getNews, { country: "thailand", limit: 50 }, "borderclash_th_news") as { data: any[] | undefined, isLoading: boolean, isRefreshing: boolean };

  const {
    data: cambodiaNews,
    isLoading: khNewsLoading,
    isRefreshing: khNewsRefreshing
  } = usePersistentQuery(api.api.getNews, { country: "cambodia", limit: 50 }, "borderclash_kh_news") as { data: any[] | undefined, isLoading: boolean, isRefreshing: boolean };

  const {
    data: thailandMeta,
    isLoading: thMetaLoading,
    isRefreshing: thMetaRefreshing
  } = usePersistentQuery(api.api.getAnalysis, { target: "thailand" }, "borderclash_th_meta") as any;

  const {
    data: cambodiaMeta,
    isLoading: khMetaLoading,
    isRefreshing: khMetaRefreshing
  } = usePersistentQuery(api.api.getAnalysis, { target: "cambodia" }, "borderclash_kh_meta") as any;

  const {
    data: neutralMeta,
    isLoading: neutralMetaLoading,
    isRefreshing: neutralMetaRefreshing
  } = usePersistentQuery(api.api.getAnalysis, { target: "neutral" }, "borderclash_neutral_meta") as any;

  const {
    data: dashboardStats,
    isLoading: dashboardLoading,
    isRefreshing: dashboardRefreshing
  } = usePersistentQuery(api.api.getDashboardStats, {}, "borderclash_dashboard_stats") as any;

  const {
    data: systemStats,
    isLoading: sysStatsLoading,
    isRefreshing: sysStatsRefreshing
  } = usePersistentQuery(api.api.getStats, {}, "borderclash_system_stats") as any;

  const {
    data: articleCounts,
    isLoading: countsLoading
  } = usePersistentQuery(api.api.getArticleCounts, {}, "borderclash_article_counts") as any;

  const {
    data: timelineEvents,
    isLoading: timelineLoading,
    isRefreshing: timelineRefreshing
  } = usePersistentQuery(api.api.getTimeline, { limit: 50 }, "borderclash_timeline") as any;



  // --- Modal Navigation & Touch State ---

  // Compute sorted events for navigation (memoized)
  const sortedEvents = useMemo(() => {
    if (!timelineEvents) return [];
    return [...timelineEvents].sort((a: any, b: any) =>
      new Date(a.date).getTime() - new Date(b.date).getTime()
    );
  }, [timelineEvents]);

  const currentIndex = selectedEvent ? sortedEvents.findIndex((e: any) => e._id === selectedEvent._id) : -1;
  const hasNext = currentIndex !== -1 && currentIndex < sortedEvents.length - 1;
  const hasPrev = currentIndex > 0;

  // Animation logic for Swipe
  const animateSwipe = (direction: 'next' | 'prev') => {
    if (!modalRef.current) return;

    const isNext = direction === 'next';

    // Config
    const exitX = isNext ? '-120vw' : '120vw';
    const exitRotate = isNext ? '-30deg' : '30deg';
    const enterX = isNext ? '100vw' : '-120vw'; // Prev: enters from Left
    const enterRotate = isNext ? '20deg' : '-30deg';

    // 1. Animate Out
    // For 'next' (Swipe Left), we just throw the card away. The Ghost is behind it.
    // For 'prev' (Swipe Right), we throw the card away to reveal... wait.
    // Actually for 'prev', we want the NEW card to enter from Left.
    // So if 'prev': OLD card exits Right (revealing nothing?). NEW card enters Left.

    modalRef.current.style.transition = 'transform 0.4s cubic-bezier(0.32, 0.72, 0, 1), opacity 0.4s ease-in';
    modalRef.current.style.transformOrigin = 'bottom center';
    modalRef.current.style.transform = `translate3d(${exitX}, 0, 0) rotate(${exitRotate})`;
    modalRef.current.style.opacity = '0';

    // 2. Data Update & Reset
    setTimeout(() => {
      if (isNext && hasNext) {
        setSelectedEvent(sortedEvents[currentIndex + 1]);
        // For Next: We revealed the ghost. Now we effectively "become" the ghost.
        // Reset to 0 instantly.
        if (modalRef.current) {
          modalRef.current.style.transition = 'none';
          modalRef.current.style.transform = 'translate3d(0, 0, 0) rotate(0deg)';
          modalRef.current.style.opacity = '1';
        }
      } else if (!isNext && hasPrev) {
        setSelectedEvent(sortedEvents[currentIndex - 1]);
        // For Prev: We need to enter from the Left side.
        if (modalRef.current) {
          modalRef.current.style.transition = 'none';
          modalRef.current.style.transform = `translate3d(${enterX}, 0, 0) rotate(${enterRotate})`;
          modalRef.current.style.opacity = '1'; // Keep opacity 1 for entry

          // Force Reflow
          void modalRef.current.offsetHeight;

          // Animate In
          modalRef.current.style.transition = 'transform 0.5s cubic-bezier(0.18, 0.89, 0.32, 1.28)'; // Bouncy
          modalRef.current.style.transform = 'translate3d(0, 0, 0) rotate(0deg)';
        }
      }
      setShowAllSources(false);
    }, 350);
  };

  const goToNext = () => { animateSwipe('next'); };
  const goToPrev = () => { animateSwipe('prev'); };

  const [hasInteracted, setHasInteracted] = useState(false);

  // Pointer state ref for drag gestures (Mouse & Touch)
  const touchRef = useRef({
    startX: 0,
    startY: 0,
    isDraggingVertical: false,
    isDraggingHorizontal: false,
    isHeaderDrag: false,
    isActive: false
  });

  // Refs for direct DOM manipulation of ghost cards (bypass React render cycle)
  const ghostPrevRef = useRef<HTMLDivElement>(null);
  const ghostNextRef = useRef<HTMLDivElement>(null);

  const handlePointerDown = (e: React.PointerEvent) => {
    const target = e.target as HTMLElement;
    // Check if drag starts on header or handle
    const isHandle = target.closest('.drag-handle-area') !== null;
    const isHeader = target.closest('.modal-header') !== null;
    const isHeaderDrag = isHandle || isHeader;

    // Don't drag if clicking a button
    if (target.closest('button')) return;

    touchRef.current.startX = e.clientX;
    touchRef.current.startY = e.clientY;
    touchRef.current.isDraggingVertical = false;
    touchRef.current.isDraggingHorizontal = false;
    touchRef.current.isHeaderDrag = isHeaderDrag;
    touchRef.current.isActive = true;

    // Set hasInteracted only once (first interaction)
    if (!hasInteracted) setHasInteracted(true);

    // Disable transition for immediate response during drag
    if (modalRef.current) {
      modalRef.current.style.transition = 'none';
    }

    // Only capture pointer if we are dragging the header (controlling the transform)
    if (isHeaderDrag) {
      e.currentTarget.setPointerCapture(e.pointerId);
    }
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!touchRef.current.isActive) return;

    const currentX = e.clientX;
    const currentY = e.clientY;
    const deltaX = touchRef.current.startX - currentX;
    const deltaY = currentY - touchRef.current.startY; // Positive = dragging down

    // Direction Locking Logic
    if (!touchRef.current.isDraggingVertical && !touchRef.current.isDraggingHorizontal) {
      if (Math.abs(deltaY) > 5 && Math.abs(deltaY) > Math.abs(deltaX)) {
        touchRef.current.isDraggingVertical = true;
      } else if (Math.abs(deltaX) > 5) {
        touchRef.current.isDraggingHorizontal = true;
      }
    }

    // Vertical Drag (Dismiss)
    // ONLY move if it is a header drag. Body drag should just be ignored here (allowing scroll if not captured)
    if (touchRef.current.isDraggingVertical && touchRef.current.isHeaderDrag) {
      // 1:1 tracking for immediate "follow finger" feel
      // Apply rubber-banding (resistance) only if dragging UP (negative deltaY)
      const offset = deltaY > 0 ? deltaY : deltaY * 0.3;

      currentDragOffset.current = offset;
      if (modalRef.current) {
        modalRef.current.style.transformOrigin = 'center center';

        modalRef.current.style.transform = `translateY(${offset}px)`;
        modalRef.current.style.opacity = `${Math.max(0.4, 1 - (offset / 400))}`;
      }
    }

    // Horizontal Swipe (Nav)
    if (touchRef.current.isDraggingHorizontal) {
      // Deck of cards feel: Pivot at bottom
      if (modalRef.current) {
        modalRef.current.style.transformOrigin = 'bottom center';
        // Rotate more as you drag further. deltaX (left) is positive in my calc? 
        // Wait: deltaX = start - current. 
        // If I drag Left: current < start. deltaX is Positive. 
        // Drag Left -> Move card Left (negative X).
        // So translateX should be -deltaX.
        const moveX = -deltaX;
        const rotate = moveX * 0.05; // 100px move = 5deg rotation

        modalRef.current.style.transform = `translate3d(${moveX}px, 0, 0) rotate(${rotate}deg)`;

        // Instant Ghost Card Switching via Refs (Bypass React State)
        // Drag Right (moveX > 0) -> Show Prev
        // Drag Left (moveX < 0) -> Show Next
        if (ghostPrevRef.current) {
          ghostPrevRef.current.style.visibility = moveX > 0 ? 'visible' : 'hidden';
        }
        if (ghostNextRef.current) {
          ghostNextRef.current.style.visibility = moveX < 0 ? 'visible' : 'hidden';
        }
      }
    }
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (!touchRef.current.isActive) return;

    const deltaX = touchRef.current.startX - e.clientX;
    const isHorizontalDrag = touchRef.current.isDraggingHorizontal;

    touchRef.current.isActive = false;

    // Safely release capture if we have it
    try { e.currentTarget.releasePointerCapture(e.pointerId); } catch (err) { }

    // Re-enable transition for snap-back animation
    if (modalRef.current) {
      modalRef.current.style.transition = 'transform 0.3s cubic-bezier(0.32, 0.72, 0, 1), opacity 0.3s ease-out';
    }

    // Horizontal Swipe (Navigate)
    if (isHorizontalDrag) {
      // deltaX = start - current.
      // Drag Left (Next): start > current => deltaX > 0.
      // Drag Right (Prev): start < current => deltaX < 0.

      const swipeThreshold = 50;

      if (deltaX > swipeThreshold && hasNext) {
        animateSwipe('next');
      } else if (deltaX < -swipeThreshold && hasPrev) {
        animateSwipe('prev');
      } else {
        // Snap back
        if (modalRef.current) {
          modalRef.current.style.transition = 'transform 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)'; // Bouncy snap back
          modalRef.current.style.transform = 'translate3d(0, 0, 0) rotate(0deg)';
        }
      }

      // Safely release capture if we have it
      try { e.currentTarget.releasePointerCapture(e.pointerId); } catch (err) { }

      currentDragOffset.current = 0;
      return;
    }

    // Vertical Drag (Dismiss)
    if (currentDragOffset.current > 100) {
      closeModal();
    } else {
      // Snap back
      if (modalRef.current) {
        modalRef.current.style.transform = '';
        modalRef.current.style.opacity = '';
      }
      currentDragOffset.current = 0;
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') closeModal();
    if (e.key === 'ArrowRight' || e.key === 'ArrowUp') goToNext();
    if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') goToPrev();
  };

  // Derived loading state updated to check combined loading states
  const isLoading = thNewsLoading || khNewsLoading || neutralMetaLoading || dashboardLoading;
  const isSyncing = systemStats?.systemStatus === 'syncing';

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
  useEffect(() => {
    if (!systemStats?.lastResearchAt) return;

    const updateCountdown = () => {
      // 60 minutes in milliseconds (matches cron schedule)
      const sixtyMinutes = 60 * 60 * 1000;
      // Calculate time since the last research finished
      const timeSinceLastUpdate = Date.now() - systemStats.lastResearchAt;
      // Calculate remaining time until next check
      const remaining = Math.max(0, sixtyMinutes - timeSinceLastUpdate);
      setNextUpdateIn(Math.floor(remaining / 1000));
    };

    updateCountdown();
    const timer = setInterval(updateCountdown, 1000);
    return () => clearInterval(timer);
  }, [systemStats?.lastResearchAt, systemStats?.isPaused]);

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

  // Default stats (analyses table removed - using simple defaults)
  const displayStats = {
    displacedCivilians: 0,
    confirmedInjuries: 0,
    propertyDamaged: 0,
  };

  // Language class for font-size boost (Thai/Khmer need larger text)
  const langClass = lang === 'th' ? 'lang-th' : lang === 'kh' ? 'lang-kh' : '';

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
              <div className={`w-3 h-3 rounded-full ${isSyncing ? 'bg-riso-accent animate-ping' : 'bg-green-600'}`}></div>
              <span className="font-mono text-xs font-bold tracking-widest">
                {isSyncing ? t.syncing : systemStats?.systemStatus === 'error' ? t.error : t.systemOnline}
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
                    <span className="text-yellow-600">PAUSED</span>
                  ) : isSyncing ? (
                    <span className="animate-pulse text-riso-accent">{t.running}</span>
                  ) : (sysStatsLoading || nextUpdateIn === null) ? (
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
                  KH {articleCounts?.cambodia || 0}
                </span>
                <span className="flex items-center gap-1.5 text-gray-600">
                  <span className="w-2 h-2 bg-gray-400 rounded-full"></span>
                  INTL {articleCounts?.international || 0}
                </span>
                <span className="flex items-center gap-1.5 text-[#241D4F]">
                  <span className="w-2 h-2 bg-[#241D4F] rounded-full"></span>
                  TH {articleCounts?.thailand || 0}
                </span>
              </div>
            </div>
          </div>

          {/* View Selector */}
          <div className={`rough-border-sm p-4 bg-white/50 font-mono flex flex-col ${lang === 'kh' || lang === 'th' ? 'text-sm' : 'text-xs'}`}>
            <div className="flex items-center gap-2 mb-3 uppercase font-bold border-b border-riso-ink/20 pb-2">
              {t.viewMode}
            </div>
            <div className="flex flex-col gap-2">
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

          {/* Active Sector Map */}
          <div className="flex flex-col">
            <div className="border border-riso-ink/20 p-1 flex flex-col h-[200px] relative bg-riso-ink/5">
              {/* Map Header */}
              <div className="absolute top-2 left-2 z-10">
                <span className="bg-riso-ink text-riso-paper px-1 text-[10px] font-mono font-bold uppercase tracking-widest">
                  {t.sectorMap}
                </span>
              </div>

              {/* The Map Visualization */}
              <div className="flex-grow relative overflow-hidden">
                {/* Grid Background */}
                <div className="absolute inset-0 opacity-20"
                  style={{ backgroundImage: 'radial-gradient(#1e3a8a 1px, transparent 1px)', backgroundSize: '20px 20px' }}>
                </div>

                <svg className="w-full h-full" viewBox="0 0 300 400" preserveAspectRatio="xMidYMid slice">
                  {/* Terrain/Border Line - Abstract jagged line */}
                  <path
                    d="M-10,150 Q50,140 100,180 T200,160 T350,220"
                    fill="none"
                    stroke="#1e3a8a"
                    strokeWidth="3"
                    vectorEffect="non-scaling-stroke"
                    className="opacity-50"
                  />
                  {/* Disputed Zone Highlight */}
                  <path
                    d="M100,180 Q150,200 200,160 L220,240 L80,260 Z"
                    fill="#ef4444"
                    fillOpacity="0.1"
                    stroke="#ef4444"
                    strokeWidth="1"
                    strokeDasharray="4 4"
                    className="animate-pulse"
                  />

                  {/* Tactical Markers */}
                  <g transform="translate(150, 200)">
                    <circle r="60" fill="none" stroke="#ef4444" strokeWidth="1" opacity="0.5">
                      <animate attributeName="r" from="0" to="80" dur="2s" repeatCount="indefinite" />
                      <animate attributeName="opacity" from="0.8" to="0" dur="2s" repeatCount="indefinite" />
                    </circle>
                    <circle r="4" fill="#ef4444" />
                    <text x="10" y="-10" fontSize="10" fontFamily="monospace" fill="#ef4444" fontWeight="bold">{t.clashDetected}</text>
                  </g>

                  {/* Friendly Units */}
                  <rect x="50" y="250" width="8" height="8" fill="#1e3a8a" />
                  <text x="65" y="258" fontSize="8" fontFamily="monospace" fill="#1e3a8a">{t.thBase}</text>

                  {/* Enemy Units */}
                  <rect x="220" y="120" width="8" height="8" fill="none" stroke="#1e3a8a" strokeWidth="2" />
                  <text x="235" y="128" fontSize="8" fontFamily="monospace" fill="#1e3a8a">{t.khOutpost}</text>
                </svg>
              </div>

              {/* Map Footer / Coords */}
              <div className="h-8 bg-riso-ink/10 flex items-center justify-between px-2 font-mono text-[9px] text-riso-ink">
                <span>{t.lat}: 14.39N</span>
                <span>{t.lon}: 104.67E</span>
                <span className="animate-pulse text-riso-accent">{t.live}</span>
              </div>
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
                      {/* Trend Indicator */}
                      <div className={`text-[10px] font-mono font-bold uppercase tracking-wider flex items-center gap-1 ${(dashboardStats?.displacedTrend || 0) > 0 ? 'text-riso-accent' :
                        (dashboardStats?.displacedTrend || 0) < 0 ? 'text-green-600' : 'opacity-50'
                        }`}>
                        {(dashboardStats?.displacedTrend || 0) !== 0 && (
                          <>
                            <span>{(dashboardStats?.displacedTrend || 0) > 0 ? '↑' : '↓'}</span>
                            <span>{Math.abs(dashboardStats?.displacedTrend || 0)}% {t.fromLastWeek}</span>
                          </>
                        )}
                        {(dashboardStats?.displacedTrend || 0) === 0 && <span>{t.noChange}</span>}
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
                    <div className="bg-riso-ink/5 p-4 border border-riso-ink/10 flex flex-col justify-between h-32">
                      <div>
                        <h4 className={`font-mono font-bold uppercase opacity-60 mb-1 ${lang === 'kh' || lang === 'th' ? 'text-[13px]' : 'text-[10px]'}`}>{t.threatLevel}</h4>
                        <span className={`font-display text-4xl md:text-5xl leading-none uppercase ${(dashboardStats?.conflictLevel || 'Low').toUpperCase() === 'CRITICAL' ? 'text-riso-accent animate-pulse' :
                          (dashboardStats?.conflictLevel || 'Low').toUpperCase() === 'ELEVATED' ? 'text-yellow-600' : 'text-green-700'
                          }`}>
                          {(dashboardStats?.conflictLevel || 'Low').toUpperCase() === 'CRITICAL' ? t.critical :
                            (dashboardStats?.conflictLevel || 'Low').toUpperCase() === 'ELEVATED' ? t.elevated :
                              t.low}
                        </span>
                      </div>
                      <div className="text-[10px] font-mono opacity-40 uppercase tracking-wider">{t.active}</div>
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
                        <h4 className="font-mono text-xs font-bold uppercase mb-2 border-b border-riso-ink/20 pb-1">{t.officialNarrative}</h4>
                        {getNarrative(cambodiaMeta) ? (
                          <>
                            <p className={`font-serif italic leading-relaxed ${lang === 'kh' || lang === 'th' ? 'text-base' : 'text-sm'}`}>
                              "{getNarrative(cambodiaMeta)}"
                            </p>
                            <p className="text-right text-[10px] font-mono mt-1 opacity-60">— {cambodiaMeta.narrativeSource || 'AI Analysis'}</p>
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
                <div className="flex flex-col gap-4 self-start min-h-[600px]" id="neutral-master" ref={neutralRef}>
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

                      <div className={`flex-1 font-mono leading-relaxed text-justify mb-6 ${lang === 'kh' || lang === 'th' ? 'text-base' : 'text-sm'}`}>
                        {getSummary(neutralMeta) || "Analyzing global intelligence feeds... The system is monitoring news from both Thailand and Cambodia perspectives to synthesize a balanced report."}
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
                            <p className={`font-serif italic leading-relaxed ${lang === 'kh' || lang === 'th' ? 'text-base' : 'text-sm'}`}>
                              "{getNarrative(thailandMeta)}"
                            </p>
                            <p className="text-right text-[10px] font-mono mt-1 opacity-60">— {thailandMeta.narrativeSource || 'AI Analysis'}</p>
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
                <div className="md:col-span-2 lg:col-span-3" style={{ height: sidebarHeight }}>
                  <Card title={`📜 ${t.historicalTimeline}`} loading={timelineLoading} refreshing={timelineRefreshing} className="h-full">
                    {(!timelineEvents || timelineEvents.length === 0) ? (
                      <div className="text-center py-8">
                        <p className="font-mono text-sm opacity-60">{t.noTimelineEvents}</p>
                        <p className="font-mono text-xs opacity-40 mt-2">{t.runHistorian}</p>
                      </div>
                    ) : (
                      <>
                        {/* Timeline Section - fills remaining space */}
                        <div className="flex-1 flex flex-col px-8 md:px-16 pt-2 pb-4 min-h-0">
                          {/* Serpentine Timeline - fills available space */}
                          {(() => {
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

                            // Layout Configuration
                            // Mobile: 2 items per row (left/right), unlimited rows (user scrolls)
                            // Desktop: 5 fixed rows, items distributed evenly
                            const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;

                            // Sort by date first, then by timeOfDay for same-day events
                            const sortedEvents = [...timelineEvents].sort((a: any, b: any) => {
                              // First compare by date string (YYYY-MM-DD format)
                              const dateCompare = (a.date || '').localeCompare(b.date || '');
                              if (dateCompare !== 0) return dateCompare;

                              // Same date: compare by timeOfDay (HH:MM format)
                              // Events without timeOfDay sort to end of their day
                              const timeA = a.timeOfDay || '99:99';
                              const timeB = b.timeOfDay || '99:99';
                              return timeA.localeCompare(timeB);
                            });

                            const totalEvents = sortedEvents.length;
                            const rows: any[][] = [];

                            if (isMobile) {
                              // Mobile: Fixed 2 items per row
                              const itemsPerRow = 2;
                              for (let i = 0; i < totalEvents; i += itemsPerRow) {
                                rows.push(sortedEvents.slice(i, i + itemsPerRow));
                              }
                            } else {
                              // Desktop: Fixed 5 rows, distribute evenly
                              const targetRows = 5;
                              const baseEventsPerRow = Math.floor(totalEvents / targetRows);
                              const extraEvents = totalEvents % targetRows;
                              let eventIndex = 0;
                              for (let rowIdx = 0; rowIdx < targetRows && eventIndex < totalEvents; rowIdx++) {
                                const itemsThisRow = rowIdx < extraEvents ? baseEventsPerRow + 1 : baseEventsPerRow;
                                if (itemsThisRow > 0) {
                                  rows.push(sortedEvents.slice(eventIndex, eventIndex + itemsThisRow));
                                  eventIndex += itemsThisRow;
                                }
                              }
                            }

                            const categoryColors: Record<string, string> = {
                              military: 'bg-red-500',
                              diplomatic: 'bg-blue-500',
                              humanitarian: 'bg-yellow-500',
                              political: 'bg-purple-500',
                            };

                            // Dot size based on importance (0-100)
                            const getDotSize = (importance: number) => {
                              const minSize = 20;  // Small dots for low impact (0)
                              const maxSize = 56;  // Large dots for high impact (100)
                              const clampedImportance = Math.max(0, Math.min(100, importance || 50));
                              const size = minSize + ((clampedImportance / 100) * (maxSize - minSize));
                              return Math.round(size);
                            };

                            // Lane configuration - taller on mobile to give labels space
                            const LANE_HEIGHT = isMobile ? 60 : 80;
                            const LINE_OFFSET = isMobile ? 30 : 40;
                            const ROW_MIN_HEIGHT = isMobile ? 160 : undefined; // Extra height for mobile labels

                            return (
                              <div className={`flex-1 flex flex-col ${isMobile ? '' : 'justify-between'}`}>
                                {rows.map((row, rowIndex) => {
                                  const isReversed = rowIndex % 2 === 1;
                                  const isLastRow = rowIndex === rows.length - 1;
                                  const itemCount = row.length;

                                  // Pre-calculate all dot sizes for this row
                                  const dotSizes = row.map((event: any) => getDotSize(event.importance || 50));

                                  // Line spans from first dot center to last dot center
                                  const firstDotHalfWidth = dotSizes[0] / 2;
                                  const lastDotHalfWidth = dotSizes[dotSizes.length - 1] / 2;

                                  return (
                                    <div
                                      key={rowIndex}
                                      className="relative flex flex-col justify-start group/row"
                                      style={{ minHeight: ROW_MIN_HEIGHT }}
                                    >
                                      {/* 1. The Horizontal Road Line - from first dot center to last dot center */}
                                      <div
                                        className="absolute h-0 border-t-2 border-dashed border-stone-400 z-0"
                                        style={{
                                          top: `${LINE_OFFSET}px`,
                                          left: `${firstDotHalfWidth}px`,
                                          right: `${lastDotHalfWidth}px`,
                                        }}
                                      />

                                      {/* 2. The Vertical Connector to Next Row */}
                                      {!isLastRow && (
                                        <div
                                          className="absolute border-l-2 border-dashed border-stone-400 z-0"
                                          style={{
                                            top: `${LINE_OFFSET}px`,
                                            height: '100%',
                                            [isReversed ? 'left' : 'right']: `${isReversed ? firstDotHalfWidth : lastDotHalfWidth}px`,
                                            width: '0px',
                                          }}
                                        />
                                      )}

                                      {/* 3. The Content Container - dots at exact edges */}
                                      <div
                                        className={`w-full flex items-start z-10 ${itemCount === 1 ? 'justify-center' : 'justify-between'} ${isReversed ? 'flex-row-reverse' : ''}`}
                                      >
                                        {row.map((event: any, idx: number) => {
                                          const dotColor = categoryColors[event.category] || 'bg-gray-500';
                                          const dotSize = dotSizes[idx];

                                          return (
                                            <div
                                              key={event._id}
                                              className="relative flex flex-col items-center"
                                              style={{ width: `${dotSize}px` }} // Container width = dot width, so center aligns with edge
                                            >
                                              {/* Dot - centered in container (which IS edge-aligned) */}
                                              <div
                                                className="flex items-center justify-center relative z-20 cursor-pointer"
                                                style={{ height: `${LANE_HEIGHT}px`, width: `${dotSize}px` }}
                                                onClick={() => { setSelectedEvent(event); setShowAllSources(false); }}
                                              >
                                                <div
                                                  className={`rounded-full ${dotColor} shadow-lg
                                                  ring-4 ring-riso-paper hover:scale-110 active:scale-95 transition-transform duration-200`}
                                                  style={{ width: `${dotSize}px`, height: `${dotSize}px` }}
                                                />
                                              </div>

                                              {/* Text Label - overflows to center on dot, max 3 lines */}
                                              <div
                                                className="absolute z-30 cursor-pointer text-center"
                                                style={{
                                                  top: `${LANE_HEIGHT - 8}px`,
                                                  left: '50%',
                                                  transform: 'translateX(-50%)',
                                                  minWidth: isMobile ? '160px' : '130px',
                                                  maxWidth: isMobile ? '160px' : '180px',
                                                }}
                                                onClick={() => { setSelectedEvent(event); setShowAllSources(false); }}
                                              >
                                                <div className="inline-block bg-[#F2F2E9] bg-opacity-95 px-2 py-1 pb-2 rounded-md shadow-sm border border-white/20 backdrop-blur-sm">
                                                  <p className="font-mono text-[10px] font-bold opacity-50 mb-0.5">{event.date}</p>
                                                  <p
                                                    className="font-display text-[12px] md:text-sm text-riso-ink"
                                                    style={{
                                                      display: '-webkit-box',
                                                      WebkitLineClamp: 3,
                                                      WebkitBoxOrient: 'vertical',
                                                      overflow: 'hidden',
                                                      textOverflow: 'ellipsis',
                                                      lineHeight: '1.4',
                                                      paddingBottom: '2px', // Space for descenders
                                                    }}
                                                  >
                                                    {getEventTitle(event)}
                                                  </p>
                                                </div>
                                              </div>
                                            </div>
                                          );
                                        })}
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            );
                          })()}
                        </div>

                        {/* Event Details Modal - Bottom Sheet with Swipe */}
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

                          return (
                            <div
                              className={`fixed inset-0 z-[100] flex items-end md:items-center justify-center md:p-4 bg-black/60 backdrop-blur-sm modal-backdrop ${isModalClosing ? 'closing' : ''}`}
                              onClick={(e) => { if (e.target === e.currentTarget) closeModal(); }}
                              onKeyDown={handleKeyDown}
                              tabIndex={0}
                              ref={(el) => el?.focus()}
                            >
                              {/* Card + Navigation Wrapper */}
                              <div className="relative flex items-center w-full max-w-lg">
                                {/* Desktop Nav Arrow - Left */}
                                <button
                                  onClick={(e) => { e.stopPropagation(); animateSwipe('prev'); }}
                                  disabled={!hasPrev}
                                  className={`hidden md:flex absolute -left-16 top-1/2 -translate-y-1/2 w-12 h-12 items-center justify-center rounded-full bg-white/90 shadow-lg transition-all z-10 ${hasPrev ? 'hover:bg-white hover:scale-110' : 'opacity-30 cursor-not-allowed'}`}
                                >
                                  <span className="text-2xl">←</span>
                                </button>

                                {/* Desktop Nav Arrow - Right */}
                                <button
                                  onClick={(e) => { e.stopPropagation(); animateSwipe('next'); }}
                                  disabled={!hasNext}
                                  className={`hidden md:flex absolute -right-16 top-1/2 -translate-y-1/2 w-12 h-12 items-center justify-center rounded-full bg-white/90 shadow-lg transition-all z-10 ${hasNext ? 'hover:bg-white hover:scale-110' : 'opacity-30 cursor-not-allowed'}`}
                                >
                                  <span className="text-2xl">→</span>
                                </button>

                                {(() => {
                                  /**
                              * Inner Component for Card Content
                              * Defined here to access closure variables like 't', 'lang', 'closeModal'
                              */
                                  const CardContent = ({ eventData, isGhost = false, style, forwardedRef, ...props }: any) => {
                                    if (!eventData) return null;
                                    return (
                                      <div
                                        ref={forwardedRef}
                                        className={`modal-sheet bg-[#F2F2E9] w-full max-h-[85vh] md:max-h-[90vh] overflow-y-auto rounded-2xl md:rounded-lg border-4 border-riso-ink shadow-xl flex flex-col ${isGhost ? 'absolute inset-0 z-0 pointer-events-none' : 'relative z-10 shadow-2xl'}`}
                                        style={style}
                                        {...props}
                                      >
                                        {/* Mobile Drag Handle */}
                                        <div
                                          className="drag-handle-area md:hidden flex flex-col items-center pt-6 pb-4 sticky top-0 bg-[#F2F2E9] z-20 cursor-grab active:cursor-grabbing select-none"
                                          style={{ touchAction: 'none' }}
                                        >
                                          <div className="w-16 h-2 bg-riso-ink/40 rounded-full mb-3 pointer-events-none"></div>
                                          <span className="font-mono text-[10px] opacity-50 font-bold pointer-events-none">
                                            {sortedEvents.indexOf(eventData) + 1}/{sortedEvents.length} • {isGhost ? 'NEXT INTEL' : 'DRAG TO CLOSE'}
                                          </span>
                                        </div>

                                        {/* Header */}
                                        <div
                                          className="modal-header bg-riso-ink text-riso-paper p-4 flex justify-between items-start sticky top-0 z-10 cursor-grab active:cursor-grabbing"
                                          style={{ touchAction: 'none' }}
                                        >
                                          <div className="pointer-events-none">
                                            <div className="flex items-center gap-2 mb-1">
                                              <span className="text-[10px] font-mono tracking-[0.2em] uppercase opacity-70">INTEL REPORT</span>
                                              <div className={`w-2 h-2 rounded-full ${isGhost ? 'bg-gray-500' : 'bg-red-500 animate-pulse'}`}></div>
                                            </div>
                                            <h3 className={`font-display text-2xl leading-tight ${lang === 'th' ? 'font-bold' : ''}`}>
                                              {getEventTitle(eventData)}
                                            </h3>
                                          </div>
                                          <button
                                            onClick={(e) => { e.stopPropagation(); closeModal(); }}
                                            className="p-1 hover:bg-white/10 rounded-full transition-colors pointer-events-auto"
                                          >
                                            <IconBase className="w-6 h-6"><path d="M18 6L6 18M6 6l12 12" /></IconBase>
                                          </button>
                                        </div>

                                        {/* Body */}
                                        <div className="p-4 md:p-6 space-y-6 flex-1 min-h-[50vh]">
                                          {/* Meta Row */}
                                          <div className="flex flex-wrap gap-4 text-xs font-mono border-b border-riso-ink/10 pb-4">
                                            <div>
                                              <p className="opacity-50 uppercase tracking-wider mb-1">DATE</p>
                                              <p className="font-bold">{new Date(eventData.date).toLocaleDateString(lang === 'th' ? 'th-TH' : 'en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
                                            </div>
                                            <div>
                                              <p className="opacity-50 uppercase tracking-wider mb-1">IMPACT</p>
                                              <div className="flex items-center gap-2">
                                                <div className="w-16 h-2 bg-gray-200 rounded-full overflow-hidden">
                                                  <div className="h-full bg-riso-ink" style={{ width: `${eventData.importance}%` }}></div>
                                                </div>
                                                <span className="font-bold">{eventData.importance}/100</span>
                                              </div>
                                            </div>
                                            <div>
                                              <p className="opacity-50 uppercase tracking-wider mb-1">TYPE</p>
                                              <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase text-white ${categoryColors[eventData.category] || 'bg-gray-500'}`}>
                                                {eventData.category}
                                              </span>
                                            </div>
                                          </div>

                                          {/* If GHOST, show blurred placeholder structure (optional) or full content? 
                                                   User wants to "see card below". Rendering full text behind might be heavy but accurate.
                                                   Let's revert to full content but visually dimmed by parent class. 
                                                */}

                                          {/* Status */}
                                          <div className={`p-3 border-l-4 ${eventData.status === 'confirmed' ? 'border-green-500 bg-green-500/10' :
                                            eventData.status === 'disputed' ? 'border-yellow-500 bg-yellow-500/10' : 'border-red-500 bg-red-500/10'}`}>
                                            <p className="font-mono text-[10px] uppercase tracking-widest opacity-60 mb-1">STATUS</p>
                                            <p className={`font-bold uppercase tracking-wider ${eventData.status === 'confirmed' ? 'text-green-700' :
                                              eventData.status === 'disputed' ? 'text-yellow-700' : 'text-red-700'}`}>
                                              {eventData.status || 'UNVERIFIED'}
                                            </p>
                                          </div>

                                          {/* Description */}
                                          <div>
                                            <p className="font-mono text-[10px] uppercase tracking-widest opacity-60 mb-2">SUMMARY</p>
                                            <p className={`font-serif text-base leading-relaxed text-gray-800`}>
                                              {getEventDescription(eventData)}
                                            </p>
                                          </div>

                                          {/* Sources */}
                                          {eventData.sources?.length > 0 && (() => {
                                            const sources = eventData.sources;
                                            // For ghost, just show first 3. For active, logic applies.
                                            const displaySources = (showAllSources && !isGhost) ? sources : sources.slice(0, 3);
                                            const hasMore = sources.length > 3;

                                            return (
                                              <div>
                                                <p className="font-mono text-[10px] uppercase tracking-widest opacity-60 mb-2">
                                                  SOURCES ({sources.length})
                                                </p>
                                                <div className="flex flex-wrap gap-2">
                                                  {displaySources.map((s: any, idx: number) => (
                                                    <div
                                                      key={idx}
                                                      className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-mono
                                                                        ${s.credibility > 70 ? 'bg-green-100 border border-green-200' : 'bg-gray-100 border border-gray-200'}`}
                                                    >
                                                      <span className="font-bold truncate max-w-[120px]">{s.name}</span>
                                                      {s.credibility && (
                                                        <span className={`text-[9px] px-1 py-0.5 rounded ${s.credibility > 70 ? 'bg-green-500 text-white' : 'bg-gray-400 text-white'}`}>
                                                          {s.credibility}%
                                                        </span>
                                                      )}
                                                    </div>
                                                  ))}
                                                  {hasMore && (
                                                    <button
                                                      onClick={() => !isGhost && setShowAllSources(!showAllSources)}
                                                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-mono bg-riso-ink/10 hover:bg-riso-ink/20 transition-colors border border-riso-ink/20"
                                                    >
                                                      {showAllSources && !isGhost ? '− Less' : `+${sources.length - 3} more`}
                                                    </button>
                                                  )}
                                                </div>
                                              </div>
                                            );
                                          })()}
                                        </div>

                                        {/* Footer */}
                                        <div className="p-3 border-t border-riso-ink/10 bg-riso-ink/5 flex flex-col items-center justify-center">
                                          <div className="flex items-center gap-3">
                                            <div className="flex gap-1">
                                              {sortedEvents.map((_: any, idx: number) => (
                                                <div
                                                  key={idx}
                                                  className={`w-1.5 h-1.5 rounded-full transition-all ${idx === sortedEvents.indexOf(eventData) ? 'bg-riso-ink scale-125' : 'bg-riso-ink/20'}`}
                                                />
                                              ))}
                                            </div>
                                            <span className="font-mono text-[10px] font-bold opacity-60">{sortedEvents.indexOf(eventData) + 1} / {sortedEvents.length}</span>
                                          </div>
                                          <p className="font-mono text-[8px] opacity-40 uppercase mt-1 hidden md:block">ESC to close • ←→ or arrows to navigate</p>
                                          <p className="font-mono text-[8px] opacity-40 uppercase mt-1 md:hidden">←→ swipe • drag handle ↓ to close</p>
                                        </div>
                                      </div>
                                    )
                                  }

                                  const prevEvent = hasPrev ? sortedEvents[currentIndex - 1] : null;
                                  const nextEvent = hasNext ? sortedEvents[currentIndex + 1] : null;

                                  return (
                                    <>
                                      {/* Ghost Prev (Hidden by default, shown by JS when dragging Right) */}
                                      {prevEvent && (
                                        <CardContent
                                          eventData={prevEvent}
                                          isGhost={true}
                                          forwardedRef={ghostPrevRef}
                                          style={{ visibility: 'hidden' }}
                                        />
                                      )}

                                      {/* Ghost Next (Hidden by default, shown by JS when dragging Left) */}
                                      {nextEvent && (
                                        <CardContent
                                          eventData={nextEvent}
                                          isGhost={true}
                                          forwardedRef={ghostNextRef}
                                          style={{ visibility: 'hidden' }}
                                        />
                                      )}

                                      {/* Active Card - Rendered ON TOP */}
                                      <CardContent
                                        eventData={selectedEvent}
                                        forwardedRef={modalRef}
                                        style={{
                                          touchAction: 'pan-y',
                                          willChange: 'transform, opacity',
                                          animation: hasInteracted ? 'none' : undefined
                                        }}
                                        onClick={(e: any) => e.stopPropagation()}
                                        onPointerDown={handlePointerDown}
                                        onPointerMove={handlePointerMove}
                                        onPointerUp={handlePointerUp}
                                        onPointerCancel={handlePointerUp}
                                      />
                                    </>
                                  );
                                })()}
                              </div>
                            </div>
                          );
                        })()}

                        {/* Legend - OUTSIDE the timeline flex container, fixed at bottom */}
                        <div className="flex-shrink-0 flex justify-center gap-8 py-3 px-4 border-t border-riso-ink/10">
                          {Object.entries({
                            military: 'bg-red-500',
                            diplomatic: 'bg-blue-500',
                            humanitarian: 'bg-yellow-500',
                            political: 'bg-purple-500'
                          }).map(([cat, color]) => (
                            <div key={cat} className="flex items-center gap-2">
                              <div className={`w-3 h-3 rounded-full ${color}`}></div>
                              <span className="text-[10px] font-mono uppercase tracking-widest opacity-60">{cat}</span>
                            </div>
                          ))}
                        </div>
                      </>
                    )
                    }
                  </Card>
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
                        <div className="space-y-4">
                          <h4 className="font-mono text-sm font-bold uppercase border-b-2 border-riso-ink/20 pb-2">{t.verificationChecklist}</h4>
                          <ul className="space-y-3 font-mono text-xs">
                            {[
                              { icon: "🕵️", text: t.checkSources },
                              { icon: "📸", text: t.lookForEvidence },
                              { icon: "🧠", text: t.considerBias },
                              { icon: "📅", text: t.checkDates },
                              { icon: "🎭", text: t.emotionalManipulation }
                            ].map((item, i) => (
                              <li key={i} className="flex items-start gap-4 p-2 bg-white/50 border border-transparent hover:border-riso-ink/20 transition-all rounded group">
                                <span className="text-xl filter sepia-[1] hue-rotate-[60deg] saturate-[1] opacity-70 group-hover:filter-none group-hover:opacity-100 transition-all duration-300">{item.icon}</span>
                                <span className={`opacity-80 mt-1 ${lang === 'kh' || lang === 'th' ? 'text-sm' : 'text-xs'}`}>{item.text}</span>
                              </li>
                            ))}
                          </ul>
                        </div>

                        {/* Deepfake Warning */}
                        <div className="border-l-4 border-riso-accent pl-4 py-2 bg-riso-accent/5">
                          <h5 className="font-display text-lg text-riso-accent mb-1">{t.aiWarning}</h5>
                          <p className={`font-mono opacity-70 mb-2 ${lang === 'kh' || lang === 'th' ? 'text-xs' : 'text-[10px]'}`}>{t.aiWarningDesc}</p>
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

                          <div className="relative space-y-8 pl-8 before:absolute before:left-[11px] before:top-2 before:bottom-2 before:w-0.5 before:bg-riso-ink/10">
                            {/* Step 1: Scout */}
                            <div className="relative">
                              <div className="absolute -left-8 top-0 w-6 h-6 rounded-full bg-riso-ink text-white flex items-center justify-center font-bold font-mono text-xs">1</div>
                              <h5 className="font-mono font-bold uppercase mb-1">{t.scoutRole}</h5>
                              <p className={`font-mono opacity-70 leading-relaxed ${lang === 'kh' || lang === 'th' ? 'text-sm' : 'text-xs'}`}>{t.scoutDesc}</p>
                            </div>

                            {/* Step 2: Analyst */}
                            <div className="relative">
                              <div className="absolute -left-8 top-0 w-6 h-6 rounded-full bg-riso-ink text-white flex items-center justify-center font-bold font-mono text-xs">2</div>
                              <h5 className="font-mono font-bold uppercase mb-1">{t.analystRole}</h5>
                              <p className={`font-mono opacity-70 leading-relaxed ${lang === 'kh' || lang === 'th' ? 'text-sm' : 'text-xs'}`}>{t.analystDesc}</p>
                            </div>

                            {/* Step 3: Manager */}
                            <div className="relative">
                              <div className="absolute -left-8 top-0 w-6 h-6 rounded-full bg-riso-ink text-white flex items-center justify-center font-bold font-mono text-xs">3</div>
                              <h5 className="font-mono font-bold uppercase mb-1">{t.managerRole}</h5>
                              <p className={`font-mono opacity-70 leading-relaxed ${lang === 'kh' || lang === 'th' ? 'text-sm' : 'text-xs'}`}>{t.managerDesc}</p>
                            </div>
                          </div>
                        </div>

                        {/* Stateless Approach Badge */}
                        <div className="mt-8 bg-riso-ink text-riso-paper p-6 text-center transform rotate-1 hover:rotate-0 transition-transform cursor-crosshair">
                          <h3 className="font-display text-2xl uppercase mb-2">{t.statelessApproach}</h3>
                          <p className={`font-mono opacity-80 ${lang === 'kh' || lang === 'th' ? 'text-sm' : 'text-xs'}`}>{t.statelessDesc}</p>
                        </div>

                      </div>
                    </div>
                  </Card>
                </div>
              </>
            )
          }
        </main>
        {/* Decorative footer elements */}
        <div className="fixed bottom-4 right-4 hidden lg:block">
          <div className="vertical-text font-display text-6xl text-riso-ink opacity-10 pointer-events-none select-none">
            {t.peaceWar}
          </div>
        </div>
      </div>
    </div >
  );
}
