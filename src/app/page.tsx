'use client';

import { useState, useEffect, useRef, useLayoutEffect } from 'react';
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
    <line x1="6" y1="12" x2="2" y2="12" />
    <line x1="12" y1="6" x2="12" y2="2" />
    <line x1="12" y1="22" x2="12" y2="18" />
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
    autoUpdating: "Auto-updating every 15 minutes",
    keyDevelopments: "Key Developments",
    sourcesTracked: "SOURCES TRACKED",
    viewMode: "VIEW MODE",
    analysis: "ANALYSIS",
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
    intl: "Intl",
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
    officialNarrative: "ท่าทีอย่างเป็นทางการ",
    militaryIntensity: "ระดับความตึงเครียดทางทหาร",
    peaceful: "สงบ",
    defensive: "ตั้งรับ",
    aggressive: "เชิงรุก",
    intelligenceLog: "บันทึกข่าวกรอง",
    items: "รายการ",
    noArticles: "ยังไม่มีบทความ",
    damageAssessment: "การประเมินความเสียหาย",
    displacedCivilians: "พลเรือนพลัดถิ่น",
    civilianInjuries: "ผู้ได้รับบาดเจ็บพลเรือน",
    propertyDamaged: "ทรัพย์สินเสียหาย",
    status: "สถานะ",
    confirmedOnly: "ยืนยันแล้วเท่านั้น",
    structures: "อาคารสิ่งปลูกสร้าง",
    monitoring: "กำลังเฝ้าระวัง",
    active: "ใช้งานอยู่",
    situationReport: "รายงานสถานการณ์",
    autoUpdating: "อัปเดตอัตโนมัติทุก 15 นาที",
    keyDevelopments: "เหตุการณ์สำคัญ",
    sourcesTracked: "แหล่งข้อมูลที่ติดตาม",
    viewMode: "โหมดการดู",
    analysis: "วิเคราะห์",
    losses: "ความสูญเสีย",
    guide: "คู่มือ",
    language: "ภาษา",
    nextAutoScan: "การสแกนอัตโนมัติ",
    articles: "บทความ",
    articlesRead: "บทความที่อ่านแล้ว",
    articlesFetched: "บทความที่ดึงมา",
    total: "ทั้งหมด",
    sectorMap: "แผนที่เขต 4",
    clashDetected: "ตรวจพบการปะทะ",
    live: "สด",
    syncing: "กำลังอัปเดต...",
    running: "กำลังทำงาน...",
    systemOnline: "ระบบออนไลน์",
    error: "ข้อผิดพลาด",
    awaitingAnalysis: "รอการวิเคราะห์...",
    keyPoints: "ประเด็นสำคัญ",
    positive: "เชิงบวก",
    negative: "เชิงลบ",
    neutral: "เป็นกลาง",
    justNow: "เมื่อสักครู่",
    thailand: "ประเทศไทย",
    cambodia: "กัมพูชา",
    neutralAI: "AI เป็นกลาง",
    intl: "ตปท.",
    credibility: "ความน่าเชื่อถือ",
    subTitle: "การติดตามสถานการณ์ความตึงเครียดบริเวณชายแดนแบบเรียลไทม์ ผ่านการวิเคราะห์หลายมุมมองและข่าวกรองที่ตรวจสอบโดย AI",
    fatalities: "ผู้เสียชีวิตที่ยืนยันแล้ว",
    threatLevel: "ระดับภัยคุกคาม",
    low: "ต่ำ",
    elevated: "สูง",
    critical: "วิกฤต",
    injured: "ผู้บาดเจ็บ",
    civilian: "พลเรือน",
    military: "ทหาร",
    fromLastWeek: "จากสัปดาห์ก่อน",
    noChange: "ไม่เปลี่ยนแปลง",
    visualDamageAssessment: "การประเมินความเสียหายเชิงประจักษ์",
    infrastructureDamage: "ความเสียหายต่อโครงสร้างพื้นฐาน",
    buildingsDestroyed: "อาคารที่ถูกทำลาย",
    displacedPersons: "ผู้พลัดถิ่น",
    lossImagesPlaceholder: "[รูปภาพและวิดีโอจะแสดงที่นี่พร้อมแหล่งที่มาที่ได้รับการตรวจสอบแล้ว]",
    criticalThinkingGuide: "คู่มือการคิดเชิงวิพากษ์",
    dontTrustBlindly: "อย่าเชื่อโดยปราศจากการไตร่ตรอง",
    dontTrustBlindlyDesc: "จงตั้งคำถามกับทุกสิ่ง รัฐบาลมีวาระซ่อนเร้น สื่อมีอคติ ตรวจสอบข้อกล่าวหาด้วยตนเอง และตรวจสอบเทียบเคียงจากหลายแหล่งข้อมูล",
    verificationChecklist: "รายการตรวจสอบข้อเท็จจริง",
    checkSources: "ตรวจสอบจากแหล่งข้อมูลอิสระหลายแห่ง",
    lookForEvidence: "มองหาหลักฐานชั้นต้น (ภาพถ่าย วิดีโอ เอกสาร)",
    considerBias: "พิจารณาอคติที่อาจมีของแหล่งข้อมูล",
    checkDates: "ตรวจสอบวันที่เผยแพร่และบริบท",
    emotionalManipulation: "ระวังการชักจูงด้วยอารมณ์",
    propagandaWarning: "สัญญาณเตือนการโฆษณาชวนเชื่อ",
    propagandaWarningDesc: "ระวัง: ภาษาที่ใช้อารมณ์เกินจริง การสร้างภาพปิศาจให้ \"อีกฝ่าย\" การขาดหลักฐานที่เป็นรูปธรรม การทำซ้ำโดยไม่มีเนื้อหาสาระ การกระตุ้นความกลัวหรือความรักชาติเหนือข้อเท็จจริง",
    systemDisclaimer: "ระบบนี้พยายามวิเคราะห์อย่างเป็นกลาง แต่โปรดใช้วิจารณญาณและตรวจสอบข้อมูลด้วยตัวคุณเองเสมอ",
    incident: "เหตุการณ์",
    image: "รูปภาพ",
    sector: "เขต",
    all: "ทั้งหมด",
    government: "รัฐบาล",
    media: "สื่อ",
    agency: "หน่วยงาน",
    other: "อื่นๆ",
    guideTitle: "คู่มือผู้ใช้และการรู้เท่าทันสื่อ",
    dashboardGuide: "การใช้งานแดชบอร์ด",
    dashboardGuideDesc: "เครื่องมือนี้รวบรวมข้อมูลความขัดแย้งจากแหล่งข่าวไทย กัมพูชา และต่างประเทศ โดยมี 'AI เป็นกลาง' ทำหน้าที่สังเคราะห์ประเด็นเพื่อหาจุดร่วม",
    aiWarning: "คำเตือน: AI และ Deepfakes",
    aiWarningDesc: "AI สามารถสร้างภาพและวิดีโอปลอม (Deepfakes) ได้เหมือนจริง อย่าเชื่อสื่อเพียงแค่ตาเห็น",
    deepfakeTips: "การสังเกตสื่อปลอม",
    dfTip1: "จุดสังเกตความผิดปกติ (มือ, ดวงตา, ตัวอักษร)",
    dfTip2: "ตรวจสอบว่ามีการรายงานจากสำนักข่าวที่น่าเชื่อถือหรือไม่",
    dfTip3: "ค้นหาต้นฉบับรูปภาพ (Reverse Image Search) เพื่อดูบริบทที่แท้จริง",
    credibilityScore: "ความเข้าใจเรื่องความน่าเชื่อถือ",
    credibilityDesc: "คะแนน (0-100%) สะท้อนความน่าเชื่อถือของแหล่งข่าวและการตรวจสอบไขว้ คะแนนต่ำกว่า 50% อาจเป็นโฆษณาชวนเชื่อหรือข่าวลือ",
    // Military Posture Context
    postureGaugeTitle: "ท่าทีทางทหาร",
    territoryOwn: "ดินแดนตนเอง",
    territoryBorder: "แนวชายแดน",
    territoryDisputed: "พื้นที่พิพาท",
    territoryForeign: "ดินแดนต่างประเทศ",
    postureRationale: "การวิเคราะห์",

    // Guide Section
    howItWorks: "การทำงานของระบบ",
    scoutRole: "หน่วยลาดตระเวน (เก็บข้อมูล)",
    scoutDesc: "ทีม AI ค้นหาสื่อไทย กัมพูชา และต่างประเทศตลอด 24 ชม. เพื่อรวบรวมบทความดิบจากทุกแหล่งโดยไม่ปรุงแต่ง",
    analystRole: "นักวิเคราะห์ (ตรวจสอบ)",
    analystDesc: "AI ชั้นที่สองอ่านทุกบทความเพื่อหาอคติ ตรวจสอบข้อกล่าวหากับสำนักข่าวระดับโลก (Reuters, AP) และแจ้งเตือนเนื้อหาที่ใช้อารมณ์หรือยังไม่ได้รับการยืนยัน",
    managerRole: "ผู้จัดการ (สังเคราะห์)",
    managerDesc: "AI ที่เป็นกลางจะทบทวนรายงานที่ขัดแย้งกันโดยไม่เลือกข้าง หากไทยบอก X และกัมพูชาบอก Y ระบบจะรายงานความขัดแย้งนั้นและคำนวณคะแนนความน่าเชื่อถือ",
    trustWarning: "อย่าไว้ใจใครอย่างมืดบอด",
    trustWarningDesc: "ทุกรัฐบาลมีแรงจูงใจที่จะบิดเบือนข้อมูลในยามขัดแย้ง ทุกสำนักข่าวมีฐานเสียงที่ต้องเอาใจ แดชบอร์ดนี้เป็นเครื่องมือเทียบเคียงข้อมูล ไม่ใช่เครื่องผลิตความจริง จงใช้มันเพื่อเปรียบเทียบคำกล่าวอ้าง ไม่ใช่เพื่อยืนยันอคติของคุณ",
    statelessApproach: "แนวทางไร้รัฐ",
    statelessDesc: "เราไม่เชื่อใน 'ความจริงของชาติ' หรือความจริงฝ่ายเดียว ความจริงมักซ่อนอยู่ในความเงียบและช่องว่างระหว่างรัฐบาลสองฝ่ายที่กำลังตะโกนใส่กัน"
  },
  kh: {
    officialNarrative: "គោលជំហរផ្លូវការ",
    militaryIntensity: "កម្រិតភាពតានតឹងយោធា",
    peaceful: "សន្តិភាព",
    defensive: "ការពារខ្លួន",
    aggressive: "វាយលុក",
    intelligenceLog: "កំណត់ត្រាស៊ើបការណ៍",
    items: "ប្រភព",
    noArticles: "មិនទាន់មានអត្ថបទនៅឡើយទេ",
    damageAssessment: "ការវាយតម្លៃការខូចខាត",
    displacedCivilians: "ជនស៊ីវិលដែលផ្លាស់ទីលំនៅ",
    civilianInjuries: "ជនស៊ីវិលរងរបួស",
    propertyDamaged: "ទ្រព្យសម្បត្តិខូចខាត",
    status: "ស្ថានភាព",
    confirmedOnly: "បានបញ្ជាក់តែប៉ុណ្ណោះ",
    structures: "រចនាសម្ព័ន្ធ",
    monitoring: "ការតាមដាន",
    active: "សកម្ម",
    situationReport: "របាយការណ៍ស្ថានភាព",
    autoUpdating: "ធ្វើបច្ចុប្បន្នភាពដោយស្វ័យប្រវត្តរៀងរាល់ 15 នាទីម្តង",
    keyDevelopments: "ការវិវត្តសំខាន់ៗ",
    sourcesTracked: "ប្រភពដែលបានតាមដាន",
    viewMode: "របៀបមើល",
    analysis: "វិភាគ",
    losses: "ការបាត់បង់",
    guide: "ការណែនាំ",
    language: "ភាសា",
    nextAutoScan: "ស្កេនដោយស្វ័យប្រវត្តិ",
    articles: "អត្ថបទ",
    articlesRead: "អត្ថបទដែលបានអាន",
    articlesFetched: "អត្ថបទបានទាញយក",
    total: "សរុប",
    sectorMap: "ផែនទីតំបន់ ៤",
    clashDetected: "បានរកឃើញការប៉ះទង្គិច",
    live: "ផ្សាយបន្តផ្ទាល់",
    syncing: "កំពុងធ្វើបច្ចុប្បន្នភាព...",
    running: "កំពុងដំណើរការ...",
    systemOnline: "ប្រព័ន្ធដំណើរការ",
    error: "កំហុស",
    awaitingAnalysis: "កំពុងរង់ចាំការវិភាគ...",
    keyPoints: "ចំណុចសំខាន់ៗ",
    positive: "វិជ្ជមាន",
    negative: "អវិជ្ជមាន",
    neutral: "អព្យាក្រឹត",
    justNow: "ថ្មីៗនេះ",
    thailand: "ប្រទេសថៃ",
    cambodia: "កម្ពុជា",
    neutralAI: "AI អព្យាក្រឹត",
    intl: "អន្តរជាតិ",
    credibility: "ភាពជឿជាក់",
    subTitle: "ការត្រួតពិនិត្យភាពតានតឹងនៅព្រំដែនក្នុងពេលវេលាជាក់ស្តែង តាមរយៈការវិភាគពហុទស្សនៈ និងការស៊ើបអង្កេតដែលបានផ្ទៀងផ្ទាត់ដោយ AI",
    fatalities: "អ្នកស្លាប់ដែលបានបញ្ជាក់",
    threatLevel: "កម្រិតគំរាមកំហែង",
    low: "ទាប",
    elevated: "ខ្ពស់",
    critical: "គ្រោះថ្នាក់",
    injured: "របួស",
    civilian: "ជនស៊ីវិល",
    military: "យោធា",
    fromLastWeek: "ពីសប្តាហ៍មុន",
    noChange: "មិនមានការផ្លាស់ប្តូរ",
    visualDamageAssessment: "ការវាយតម្លៃការខូចខាតតាមរូបភាព",
    infrastructureDamage: "ការខូចខាតហេដ្ឋារចនាសម្ព័ន្ធ",
    buildingsDestroyed: "អគារដែលត្រូវបានបំផ្លាញ",
    displacedPersons: "ជនផ្លាស់ទីលំនៅ",
    lossImagesPlaceholder: "[រូបភាពនិងវីដេអូនឹងត្រូវបានបង្ហាញនៅទីនេះជាមួយប្រភពដែលបានផ្ទៀងផ្ទាត់]",
    criticalThinkingGuide: "មគ្គុទ្ទេសក៍ការគិតពិចារណា",
    dontTrustBlindly: "កុំជឿដោយងងឹតងងុល",
    dontTrustBlindlyDesc: "ចូរចោទសួរគ្រប់យ៉ាង។ រដ្ឋាភិបាលមានរបៀបវារៈ។ ប្រព័ន្ធផ្សព្វផ្សាយមានភាពលំអៀង។ ផ្ទៀងផ្ទាត់ការអះអាងដោយឯករាជ្យ។ ផ្ទៀងផ្ទាត់ជាមួយប្រភពជាច្រើន។",
    verificationChecklist: "បញ្ជីផ្ទៀងផ្ទាត់",
    checkSources: "ពិនិត្យប្រភពឯករាជ្យជាច្រើន",
    lookForEvidence: "ស្វែងរកភស្តុតាងបឋម (រូបថត វីដេអូ ឯកសារ)",
    considerBias: "ពិចារណាពីភាពលំអៀងដែលអាចកើតមានរបស់ប្រភព",
    checkDates: "ពិនិត្យកាលបរិច្ឆេទនៃការផ្សព្វផ្សាយ និងបរិបទ",
    emotionalManipulation: "ត្រូវសង្ស័យចំពោះការញុះញង់ដោយអារម្មណ៍",
    propagandaWarning: "សញ្ញាព្រមានអំពីការឃោសនា",
    propagandaWarningDesc: "ប្រយ័ត្នចំពោះ៖ ភាសាដែលប្រើអារម្មណ៍ខ្លាំងពេក។ ការចោទប្រកាន់ \"ភាគីម្ខាងទៀត\" ថាជាបិសាច។ កង្វះភស្តុតាងជាក់ស្តែង។ ការនិយាយដដែលៗដោយគ្មានខ្លឹមសារ។ ការអំពាវនាវដល់ការភ័យខ្លាច ឬស្នេហាជាតិជាងការពិត។",
    systemDisclaimer: "ប្រព័ន្ធនេះព្យាយាមវិភាគដោយអព្យាក្រឹត ប៉ុន្តែត្រូវប្រុងប្រយ័ត្ន។ ផ្ទៀងផ្ទាត់អ្វីៗគ្រប់យ៉ាងដោយខ្លួនឯង។",
    incident: "ឧប្បត្តិហេតុ",
    image: "រូបភាព",
    sector: "តំបន់",
    all: "ទាំងអស់",
    government: "រដ្ឋាភិបាល",
    media: "សារព័ត៌មាន",
    agency: "ទីភ្នាក់ងារ",
    other: "ផ្សេងទៀត",
    guideTitle: "មគ្គុទ្ទេសក៍អ្នកប្រើប្រាស់ & អក្ខរកម្មប្រព័ន្ធផ្សព្វផ្សាយ",
    dashboardGuide: "ការប្រើប្រាស់ផ្ទាំងព័ត៌មាននេះ",
    dashboardGuideDesc: "ឧបករណ៍នេះប្រមូលផ្តុំទិន្នន័យជម្លោះពីប្រភពថៃ កម្ពុជា និងអន្តរជាតិ។ 'AI អព្យាក្រឹត' វិភាគទស្សនៈទាំងនេះដើម្បីស្វែងរកចំណុចរួម។",
    aiWarning: "ការព្រមាន៖ AI & Deepfakes",
    aiWarningDesc: "AI អាចបង្កើតរូបភាពនិងវីដេអូក្លែងក្លាយ (Deepfakes) ដូចការពិត។ កុំជឿជាក់លើប្រព័ន្ធផ្សព្វផ្សាយដោយគ្រាន់តែឃើញនឹងភ្នែក។",
    deepfakeTips: "ការសម្គាល់ប្រព័ន្ធផ្សព្វផ្សាយក្លែងក្លាយ",
    dfTip1: "ពិនិត្យមើលភាពមិនប្រក្រតី (ដៃ ភ្នែក អត្ថបទ)",
    dfTip2: "ផ្ទៀងផ្ទាត់ថាតើព្រឹត្តិការណ៍នេះត្រូវបានរាយការណ៍ដោយសារព័ត៌មានដែលគួរឱ្យទុកចិត្តដែរឬទេ",
    dfTip3: "ប្រើការស្វែងរកតាមរូបភាពដើម្បីស្វែងរកប្រភពដើម",
    credibilityScore: "ការយល់ដឹងអំពីភាពជឿជាក់",
    credibilityDesc: "ពិន្ទុ (០-១០០%) ឆ្លុះបញ្ចាំងពីភាពអាចទុកចិត្តបាននៃប្រភព។ ពិន្ទុទាបជាង ៥០% ទំនងជាការឃោសនា ឬពាក្យចចាមអារ៉ាម។",
    // Military Posture Context
    postureGaugeTitle: "ជំហរយោធា",
    territoryOwn: "ទឹកដីខ្លួន",
    territoryBorder: "តំបន់ព្រំដែន",
    territoryDisputed: "តំបន់ជម្លោះ",
    territoryForeign: "ទឹកដីបរទេស",
    postureRationale: "ការវិភាគ",

    // Guide Section
    howItWorks: "ដំណើរការប្រព័ន្ធ",
    scoutRole: "ភ្នាក់ងារស្វែងរក (ប្រមូលទិន្នន័យ)",
    scoutDesc: "ក្រុម AI ស្វែងរកក្នុងប្រព័ន្ធផ្សព្វផ្សាយថៃ កម្ពុជា និងអន្តរជាតិ ២៤/៧។ ពួកគេគ្រាន់តែប្រមូលអត្ថបទដើមពីគ្រប់ប្រភពប៉ុណ្ណោះដោយមិនកែប្រែ។",
    analystRole: "អ្នកវិភាគ (ការផ្ទៀងផ្ទាត់)",
    analystDesc: "ស្រទាប់ AI ទីពីរអានរាល់អត្ថបទដើម្បីស្វែងរកភាពលំអៀង។ វាផ្ទៀងផ្ទាត់ការអះអាងជាមួយសារព័ត៌មានអន្តរជាតិ (Reuters, AP) និងសម្គាល់ខ្លឹមសារដែលគួរឱ្យសង្ស័យ ឬប្រើអារម្មណ៍។",
    managerRole: "អ្នកគ្រប់គ្រង (ការសំយោគ)",
    managerDesc: "'AI អព្យាក្រឹត' ពិនិត្យមើលរបាយការណ៍ដែលផ្ទុយគ្នាដោយមិនកាន់ជើងខាងណា។ ប្រសិនបើថៃនិយាយ X ហើយកម្ពុជានិយាយ Y វាបង្ហាញពីភាពខុសគ្នានេះ និងគណនាពិន្ទុភាពជឿជាក់។",
    trustWarning: "កុំជឿជាក់លើនរណាម្នាក់ទាំងស្រុង",
    trustWarningDesc: "រាល់រដ្ឋាភិបាលមានហេតុផលដើម្បីកុហកអំឡុងពេលជម្លោះ។ រាល់សារព័ត៌មានមានទស្សនិកជនដែលត្រូវផ្គាប់ចិត្ត។ ផ្ទាំងព័ត៌មាននេះគឺជាឧបករណ៍សម្រាប់ប្រៀបធៀបការនិទានរឿង មិនមែនជាម៉ាស៊ីនផលិតការពិតទេ។ ប្រើវាដើម្បីផ្ទៀងផ្ទាត់ មិនមែនដើម្បីបញ្ជាក់អគតិរបស់អ្នកទេ។",
    statelessApproach: "អភិក្រមឥតរដ្ឋ",
    statelessDesc: "យើងមិនជឿលើ 'ការពិតរបស់ជាតិ' ទេ។ ការពិតច្រើនតែស្ថិតនៅក្នុងភាពស្ងៀមស្ងាត់រវាងរដ្ឋាភិបាលទាំងពីរដែលកំពុងស្រែកដាក់គ្នា។"
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
const Card = ({ children, className = "", title, icon: Icon, loading = false, refreshing = false }: any) => (
  <div className={`bg-riso-paper rough-border p-4 relative overflow-hidden ${className}`}>
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
      <div className="flex items-center justify-between mb-4 border-b-2 border-riso-ink/20 pb-2">
        <h3 className="font-display uppercase text-2xl tracking-wide text-riso-ink">{title}</h3>
        {Icon && <Icon className="w-6 h-6 text-riso-ink" />}
      </div>
    )}
    {children}
  </div>
);

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

  const formatRelativeTime = (timestamp: number) => {
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
        <span className="text-[9px] font-mono opacity-40 whitespace-nowrap">{formatRelativeTime(article.publishedAt || article.fetchedAt)}</span>
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

      {/* Scrollable Container - flex-1 fills remaining space */}
      <div className="flex-1 min-h-[150px] overflow-y-auto border border-riso-ink/10 rounded bg-white/50 scrollbar-thin">
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
              {categoryFilter ? `No ${categoryFilter} articles` : TRANSLATIONS[lang as Lang].noArticles}
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

  // Logic for height synchronization
  const neutralRef = useRef<HTMLDivElement>(null);
  const [neutralColumnHeight, setNeutralColumnHeight] = useState<number | undefined>(undefined);

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

  // Timer Logic for countdown display
  useEffect(() => {
    if (!systemStats?.lastResearchAt) return;

    const updateCountdown = () => {
      // 15 minutes in milliseconds
      const fifteenMinutes = 15 * 60 * 1000;
      // Calculate time since the last research finished
      const timeSinceLastUpdate = Date.now() - systemStats.lastResearchAt;
      // Calculate remaining time until next check
      const remaining = Math.max(0, fifteenMinutes - timeSinceLastUpdate);
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
        <aside className="md:w-64 flex-shrink-0 flex flex-col gap-3 self-start">
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
            <div className="flex justify-between items-end mb-4">
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
                <p className="font-mono text-[10px] opacity-70 mb-1">{t.articlesRead}</p>
                <p className="font-mono text-xl font-bold">
                  {sysStatsLoading ? <HackerScramble /> : systemStats?.totalArticlesFetched || 0}
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between text-[10px] font-mono uppercase">
                <span>{t.articlesFetched}</span>
                <span>{countsLoading ? <HackerScramble /> : `${articleCounts?.total || 0} ${t.total}`}</span>
              </div>
              <div className="flex gap-1 h-1">
                {[...Array(10)].map((_, i) => (
                  <div key={i} className={`flex-1 ${i < 8 ? 'bg-riso-paper' : 'bg-riso-paper/30'}`}></div>
                ))}
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
                <span className="font-bold">{t.losses}</span>
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
                  <text x="65" y="258" fontSize="8" fontFamily="monospace" fill="#1e3a8a">TH-BASE</text>

                  {/* Enemy Units */}
                  <rect x="220" y="120" width="8" height="8" fill="none" stroke="#1e3a8a" strokeWidth="2" />
                  <text x="235" y="128" fontSize="8" fontFamily="monospace" fill="#1e3a8a">KH-OUTPOST</text>
                </svg>
              </div>

              {/* Map Footer / Coords */}
              <div className="h-8 bg-riso-ink/10 flex items-center justify-between px-2 font-mono text-[9px] text-riso-ink">
                <span>LAT: 14.39N</span>
                <span>LON: 104.67E</span>
                <span className="animate-pulse text-riso-accent">{t.live}</span>
              </div>
            </div>

            {/* Minimized System Log */}
            <div className="mt-2 border-t border-dashed border-riso-ink/30 pt-2">
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
                      <div>
                        <h4 className={`font-mono font-bold uppercase opacity-60 mb-1 ${lang === 'kh' || lang === 'th' ? 'text-[13px]' : 'text-[10px]'}`}>{t.injured}</h4>
                        <div className="flex items-center gap-4">
                          {/* Civilian */}
                          <div className="flex-1">
                            <span className="font-display text-4xl md:text-6xl text-riso-ink leading-none">{dashboardStats?.civilianInjuredCount || 0}</span>
                            <p className={`font-mono opacity-50 mt-1 ${lang === 'kh' || lang === 'th' ? 'text-[11px]' : 'text-[9px]'}`}>{t.civilian}</p>
                          </div>
                          {/* Divider - fixed height, centered */}
                          <div className="w-px h-14 bg-riso-ink/20"></div>
                          {/* Military */}
                          <div className="flex-1">
                            <span className="font-display text-4xl md:text-6xl text-riso-ink leading-none">{dashboardStats?.militaryInjuredCount || 0}</span>
                            <p className={`font-mono opacity-50 mt-1 ${lang === 'kh' || lang === 'th' ? 'text-[11px]' : 'text-[9px]'}`}>{t.military}</p>
                          </div>
                        </div>
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
                <div className="flex flex-col gap-4 self-start" id="neutral-master" ref={neutralRef}>
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

                      {/* Source Stats */}
                      <div className={`bg-riso-ink/5 p-3 rounded font-mono ${lang === 'kh' || lang === 'th' ? 'text-sm' : 'text-xs'}`}>
                        <p className="font-bold mb-2">{t.sourcesTracked}:</p>
                        <div className="grid grid-cols-3 gap-2 text-center">
                          <div>
                            <span className="block text-lg font-bold">{articleCounts?.cambodia || 0}</span>
                            <span className="opacity-60">{t.cambodia}</span>
                          </div>
                          <div>
                            <span className="block text-lg font-bold">{articleCounts?.international || 0}</span>
                            <span className="opacity-60">{t.intl}</span>
                          </div>
                          <div>
                            <span className="block text-lg font-bold">{articleCounts?.thailand || 0}</span>
                            <span className="opacity-60">{t.thailand}</span>
                          </div>
                        </div>
                      </div>
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
                <div className="md:col-span-2 lg:col-span-3">
                  <Card title={t.visualDamageAssessment}>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                      {[1, 2, 3, 4, 5, 6].map(i => (
                        <div key={i} className="aspect-video bg-riso-ink/10 border-2 border-riso-ink/20 flex items-center justify-center relative overflow-hidden">
                          <div className="absolute inset-0 bg-riso-ink/5 flex items-center justify-center">
                            <p className="font-mono text-xs text-riso-ink/40">{t.image} {i}</p>
                          </div>
                          <div className="absolute bottom-0 left-0 right-0 bg-riso-ink/90 text-riso-paper p-2">
                            <p className="font-mono text-[10px]">{t.incident}: {t.sector} {Math.floor(Math.random() * 10)}</p>
                            <p className="font-mono text-[9px] opacity-70">{new Date(Date.now() - Math.random() * 10000000000).toLocaleDateString()}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </Card>
                </div>

                <div className="md:col-span-2 lg:col-span-3">
                  <Card title={t.infrastructureDamage}>
                    <div className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="bg-riso-ink/5 p-4 border border-riso-ink/10">
                          <p className="font-mono text-xs uppercase opacity-60 mb-2">{t.buildingsDestroyed}</p>
                          <p className="font-display text-5xl text-riso-ink">{displayStats.propertyDamaged}</p>
                        </div>
                        <div className="bg-riso-ink/5 p-4 border border-riso-ink/10">
                          <p className="font-mono text-xs uppercase opacity-60 mb-2">{t.displacedPersons}</p>
                          <p className="font-display text-5xl text-riso-ink">{displayStats.displacedCivilians.toLocaleString()}</p>
                        </div>
                      </div>
                      <p className="font-mono text-xs opacity-70 text-center mt-4">
                        {t.lossImagesPlaceholder}
                      </p>
                    </div>
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

        </main >

        {/* Decorative footer elements */}
        < div className="fixed bottom-4 right-4 hidden lg:block" >
          <div className="vertical-text font-display text-6xl text-riso-ink opacity-10 pointer-events-none select-none">
            PEACE / WAR
          </div>
        </div >
      </div>
    </div>
  );
}
