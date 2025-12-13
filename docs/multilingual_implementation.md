# Frontend Multilingual Support Implementation

## Overview
This document outlines the changes made to `src/app/page.tsx` to support English, Thai, and Khmer languages.

## Key Components

### 1. Translations Dictionary
A `TRANSLATIONS` constant was added to centrally manage static strings for all three languages.
```typescript
const TRANSLATIONS = {
  en: { ... },
  th: { ... },
  kh: { ... }
};
```

### 2. State Management
The `Home` component now manages a `lang` state:
```typescript
const [lang, setLang] = useState<'en' | 'th' | 'kh'>('en');
```
This state is toggled via the Language Selector in the sidebar.

### 3. Dynamic Content Translation
Helper functions `getNarrative`, `getSummary`, and `getKeyEvents` were utilized (and `NewsItem` updated) to select the correct field from the backend data based on the selected language:
- `article.titleTh` / `article.summaryTh` for Thai.
- `article.titleKh` / `article.summaryKh` for Khmer.
- Fallback to English fields (`titleEn`, etc.) if specific language data is missing.

### 4. Static UI Translation
All hardcoded English labels (headers, statuses, buttons) were replaced with dynamic lookups:
```typescript
{t.officialNarrative} // Renders "Official Narrative", "การแถลงอย่างเป็นทางการ", or "សេចក្តីថ្លែងការណ៍ផ្លូវការ"
```

## Usage
- **Switching Languages**: Use the EN / ไทย / ខ្មែរ buttons in the left sidebar.
- **Adding New Translations**: Add the new key to `TRANSLATIONS` object under all three language codes, then access it via `t.newKey` in the component.

## Verification
- Validated that switching languages updates:
    - Static headers (e.g., "BORDER WATCH", "Intelligence Log").
    - Dynamic analysis text (Official Narratives, Situation Reports).
    - Article titles and summaries.
    - Status indicators (e.g., "PEACEFUL", "SYNCING...").
