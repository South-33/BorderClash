# BorderClash Agent Guidelines

This document provides essential instructions for AI agents operating within the BorderClash repository. Adhere to these patterns to maintain consistency and safety.

## 1. Project Overview
BorderClash is a real-time conflict monitoring dashboard for the Thailand-Cambodia border. It uses an ISR (Incremental Static Regeneration) approach to reduce Convex database bandwidth by ~99%, fetching data at build/revalidation time rather than per user request.

## 2. Tech Stack
- **Frontend**: Next.js 16 (App Router), React 19
- **Backend**: Convex (Real-time DB & Actions)
- **Styling**: Tailwind CSS 4, CSS Modules
- **Animations**: GSAP (@gsap/react), Framer Motion, Lenis (Smooth Scroll)
- **Icons**: Lucide React
- **Data Fetching**: Convex Client (for mutations/actions), ISR (for initial page load)

## 3. Core Workflows
### Build & Quality Control
- **Build**: `npm run build`
- **Lint**: `npm run lint` (ESLint 9)
- **Type Check**: `npx tsc --noEmit`
- **Dev Mode**: `npm run dev` (Runs both Next.js and Convex dev servers)

### Testing
*Note: No formal test framework (Jest/Vitest) is currently configured. For manual verification, use logging in Convex Actions.*
- **Convex Testing**: Trigger actions via the Convex Dashboard or `npx convex dev`.

## 4. Code Style Guidelines

### Imports
- Use the `@/` alias for all internal paths (e.g., `import { ... } from '@/lib/utils'`).
- Group imports: 1. React/Next.js, 2. External libraries, 3. Local components, 4. Types/Utils.

### Naming Conventions
- **Components**: PascalCase (e.g., `NewsSection.tsx`).
- **Hooks**: camelCase with `use` prefix (e.g., `useCascadeLayout.ts`).
- **Functions/Variables**: camelCase.
- **Types/Interfaces**: PascalCase, often stored in `src/types/index.ts`.
- **Convex Files**: lowercase_underscore or camelCase (e.g., `ai_utils.ts`, `research.ts`).

### TypeScript & Typing
- **Strict Typing**: Avoid `any`. Define interfaces for all API responses and component props.
- **Shared Types**: Centralize domain types in `src/types/index.ts`.
- **Convex Schema**: Use `v` from `convex/values` for strict validation in mutations/queries.

### Backend Logic (Convex)
- **Actions vs. Mutations**: Use `internalAction` for long-running AI tasks (LLM calls) and `internalMutation` for database writes.
- **Retries**: Implement manual retry logic for external API calls (e.g., Gemini Studio) as seen in `convex/research.ts`.
- **Logging**: Use descriptive emojis in logs (e.g., 🚀, ⚠️, ✅) to track backend flow in the Convex dashboard.

### Frontend Components
- **Server Components**: Default to Server Components for data fetching (ISR).
- **Client Components**: Use `"use client"` only when interactive state (GSAP, Framer Motion, Hooks) is required.
- **Animations**: Prefer `@gsap/react` for complex timeline animations and `framer-motion` for simple transitions.

### Error Handling
- **Server-side**: Wrap external fetches and Convex actions in `try/catch`. Log specific errors and return user-friendly messages.
- **Frontend**: Pass error states to `DashboardClient` to display fallback UI or error toasts.

### Styling (Tailwind 4)
- Use Tailwind 4 features. Avoid legacy utility patterns if modern equivalents exist.
- Maintain the "Dark/Military" aesthetic: high contrast, clean lines, and neutral analysis panels.

## 5. Directory Structure
- `convex/`: Backend schema, queries, mutations, and AI curation logic.
- `src/app/`: Next.js App Router pages and layouts.
- `src/components/`: Reusable UI components.
- `src/lib/`: Server/Client utilities and Convex initialization.
- `src/types/`: Global TypeScript definitions.

## 6. Pro-tips for Agents
- **ISR Pattern**: If adding a new page, check `src/app/page.tsx` for how `fetchBorderClashData` is used to implement ISR.
- **Gemini Integration**: Curation logic in `convex/research.ts` uses high-temperature prompts with mandatory `<json>` tag wrapping for reliability. Always follow this pattern for new AI actions.
- **AI Safety**: Never commit API keys. Use Convex environment variables.
