# React to Next.js Migration — Dyslexia-Assist

## Phase 0: Planning & Component Inventory
- [x] Explore current project structure
- [x] Map all pages, components, services, hooks, contexts
- [/] Create implementation plan
- [ ] Get user approval on plan & component list

## Phase 1: Next.js Project Scaffolding
- [ ] Create new Next.js app inside the workspace
- [ ] Install dependencies (Tailwind CSS, Framer Motion, shadcn/ui, etc.)
- [ ] Configure environment variables (VITE_ → NEXT_PUBLIC_)
- [ ] Set up TypeScript config
- [ ] Set up Tailwind CSS + shadcn/ui + Aceternity UI

## Phase 2: Core Infrastructure Migration
- [ ] Migrate [services/firebase.js](file:///c:/Users/Pushkar/Documents/Web%20Peojects/Dyslexia-Assist/Dyslexia-Assist/frontend/src/services/firebase.js) (env var prefix change)
- [ ] Migrate [context/AuthContext.jsx](file:///c:/Users/Pushkar/Documents/Web%20Peojects/Dyslexia-Assist/Dyslexia-Assist/frontend/src/context/AuthContext.jsx)
- [ ] Migrate [context/ThemeContext.jsx](file:///c:/Users/Pushkar/Documents/Web%20Peojects/Dyslexia-Assist/Dyslexia-Assist/frontend/src/context/ThemeContext.jsx)
- [ ] Migrate [context/GazeContext.jsx](file:///c:/Users/Pushkar/Documents/Web%20Peojects/Dyslexia-Assist/Dyslexia-Assist/frontend/src/context/GazeContext.jsx) / [.tsx](file:///c:/Users/Pushkar/Documents/Web%20Peojects/Dyslexia-Assist/Dyslexia-Assist/frontend/src/context/GazeContext.tsx)
- [ ] Migrate [stores/dyslexiaStore.js](file:///c:/Users/Pushkar/Documents/Web%20Peojects/Dyslexia-Assist/Dyslexia-Assist/frontend/src/stores/dyslexiaStore.js)
- [ ] Migrate [components/common/DyslexiaProvider.jsx](file:///c:/Users/Pushkar/Documents/Web%20Peojects/Dyslexia-Assist/Dyslexia-Assist/frontend/src/components/common/DyslexiaProvider.jsx)
- [ ] Migrate [components/common/ProtectedRoute.jsx](file:///c:/Users/Pushkar/Documents/Web%20Peojects/Dyslexia-Assist/Dyslexia-Assist/frontend/src/components/common/ProtectedRoute.jsx)

## Phase 3: Layout & Shared Components
- [ ] Create root layout with ThemeProvider, AuthProvider, DyslexiaProvider
- [ ] Migrate Navbar → shadcn/Aceternity style
- [ ] Migrate AccessibilityToolbar + ReadingRuler
- [ ] Apply Aceternity UI background components

## Phase 4: Page-by-Page Migration
- [ ] Landing page → `/`
- [ ] Login page → `/login`
- [ ] Signup page → `/signup`
- [ ] About page → `/about`
- [ ] Dashboard page → `/dashboard`
- [ ] Lecture page → `/lecture`
- [ ] Reading page → `/reading`
- [ ] Handwriting page → `/handwriting`
- [ ] Generator page → `/generator`
- [ ] Analytics page → `/analytics`
- [ ] Onboarding page → `/onboarding`
- [ ] Games Hub → `/games`
- [ ] Game sub-pages (5 games)

## Phase 5: Services & Hooks Migration
- [ ] Migrate all 21 service files (update import.meta.env → process.env)
- [ ] Migrate all 7 hooks
- [ ] Migrate all utility files

## Phase 6: Gaze/Lecture Components Migration
- [ ] Migrate 13 gaze components
- [ ] Migrate 2 lecture components
- [ ] Migrate 4 game components

## Phase 7: Styling & Theme Overhaul
- [ ] Apply dyslexia-friendly color palette
- [ ] Integrate shadcn/Aceternity UI components throughout
- [ ] Add backgrounds (Aurora, Grid, Spotlight, etc.)
- [ ] Add micro-animations and transitions

## Phase 8: Verification
- [ ] Run `npm run build` successfully
- [ ] Test all routes in browser
- [ ] Verify auth flow (login/signup/protected routes)
- [ ] Verify all feature pages work correctly
