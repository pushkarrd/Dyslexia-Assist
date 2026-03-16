# NeuroLex - AI-Powered Learning Assistant for Dyslexia

An accessibility-first learning platform that helps students with dyslexia and reading challenges. Transforms complex lectures into clear, accessible content using AI — featuring real-time transcription, handwriting analysis, cognitive therapy games, and a full dyslexia screening assessment.

---

## Table of Contents

- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Features](#features)
  - [Dyslexia-Friendly Reading](#1-dyslexia-friendly-reading)
  - [Lecture Recording & AI Processing](#2-lecture-recording--ai-processing)
  - [AI Handwriting Analysis](#3-ai-handwriting-analysis)
  - [Smart Content Generator](#4-smart-content-generator)
  - [Dyslexia Screening Assessment](#5-dyslexia-screening-assessment)
  - [Therapy Games](#6-therapy-games)
  - [Progress Analytics](#7-progress-analytics)
  - [Accessibility System](#8-accessibility-system)
- [Getting Started](#getting-started)
  - [Prerequisites](#prerequisites)
  - [Frontend Setup](#frontend-setup)
  - [Backend Setup](#backend-setup)
  - [Environment Variables](#environment-variables)
- [Backend API Reference](#backend-api-reference)
- [Authentication](#authentication)
- [Data Storage](#data-storage)

---

## Tech Stack

### Frontend

| Technology | Purpose |
|---|---|
| Next.js 16 (App Router) | Framework |
| React 19 | UI Library |
| TypeScript | Language |
| Tailwind CSS v4 | Styling |
| shadcn/ui | Component Library |
| Zustand | State Management (accessibility settings) |
| Framer Motion / GSAP | Animations |
| Chart.js | Analytics Charts |
| Firebase SDK | Auth & Firestore |
| pdfjs-dist | PDF Parsing |
| next-themes | Dark/Light Mode |

### Backend

| Technology | Purpose |
|---|---|
| Python / FastAPI | API Server |
| Google Gemini 2.5 Flash | AI Text Processing & Vision |
| scikit-learn | ML Dyslexia Screening Model |
| Firebase Admin SDK | Firestore Database |
| Pillow | Image Enhancement |
| Google Translate TTS | Text-to-Speech Proxy (Hindi/Kannada) |

---

## Project Structure

```
Dyslexia-Assist/
├── frontend-next/          # Next.js app (primary frontend)
│   ├── src/
│   │   ├── app/            # App Router pages
│   │   │   ├── page.tsx              # Landing page
│   │   │   ├── login/                # Login
│   │   │   ├── signup/               # Sign up
│   │   │   ├── dashboard/            # Main dashboard
│   │   │   ├── reading/              # Reading assistant + TTS
│   │   │   ├── lecture/              # Lecture recording & AI
│   │   │   ├── handwriting/          # Handwriting analysis
│   │   │   ├── generator/            # Content generator
│   │   │   ├── analytics/            # Progress analytics
│   │   │   ├── games/               # Therapy games hub
│   │   │   │   ├── dot-connector/
│   │   │   │   ├── monoline/
│   │   │   │   ├── nback/
│   │   │   │   ├── clap-trap/
│   │   │   │   ├── stroop/
│   │   │   │   └── sound-builder/
│   │   │   ├── onboarding/           # Screening assessment
│   │   │   └── about/
│   │   ├── components/
│   │   │   ├── layout/       # AppShell, Sidebar, Footer, Navbar
│   │   │   ├── common/       # AccessibilityToolbar, ReadingRuler, AlphabetRain
│   │   │   ├── providers/    # Auth, Theme, Dyslexia providers
│   │   │   ├── games/        # Shared game components
│   │   │   ├── lecture/       # Audio recorder & upload
│   │   │   └── ui/           # shadcn/ui components
│   │   ├── hooks/            # Custom React hooks
│   │   ├── services/         # API clients, Firebase, progress tracking
│   │   ├── stores/           # Zustand stores
│   │   ├── context/          # Auth & Theme context
│   │   ├── lib/              # Firebase config, utilities
│   │   └── utils/            # Difficulty engine, audio engine
│   ├── public/               # Static assets
│   └── docs/                 # Project documentation
│
└── backend-python/           # FastAPI backend
    ├── app/
    │   ├── main.py           # App entry, CORS, router mounting
    │   ├── routers/
    │   │   ├── assessment.py # Screening questionnaire + ML model
    │   │   ├── games.py      # Game session tracking
    │   │   ├── tts.py        # TTS proxy for Hindi/Kannada
    │   │   ├── generate.py   # Lecture CRUD + Gemini AI processing
    │   │   └── handwriting.py# Handwriting image analysis
    │   └── models/
    │       └── dyslexai_severity_model.pkl  # Pre-trained RF classifier
    └── requirements.txt
```

---

## Features

### 1. Dyslexia-Friendly Reading

A dedicated reading interface designed for accessibility.

- Paste text or upload PDF files
- **Read Aloud with live word highlighting**
  - English: Web Speech API with `onboundary` word-level highlighting
  - Hindi / Kannada: Backend TTS proxy via Google Translate (base64 audio)
- Adjustable speech speed (0.5x to 2x)
- Syllable breakdown toggle (splits words into syllables)
- Language selector: English, Hindi, Kannada
- All dyslexia accessibility settings applied automatically

### 2. Lecture Recording & AI Processing

Record lectures and let AI transform them into study-ready material.

- Browser-based audio recording with real-time transcription
- **5 AI-generated views** (powered by Gemini 2.5 Flash):
  - Live Transcription (raw speech-to-text)
  - Breakdown Text (syllable-split version)
  - Detailed Steps (numbered step-by-step explanation)
  - Mind Map (tree-structured key points)
  - Summary (2-3 sentence overview)
- Each view has its own Read Aloud button
- Lectures saved to Firestore, loadable by ID
- Audio upload support from dashboard

### 3. AI Handwriting Analysis

Upload handwriting samples for AI-powered dyslexia error detection.

- Drag-and-drop image upload (max 50 MB)
- Image enhancement (contrast, sharpness, brightness via Pillow)
- **Gemini Vision AI analysis returns:**
  - Overall score (0-100, weighted across 6 categories)
  - Category scores: Letter Formation (25%), Spelling (25%), Spacing (15%), Alignment (15%), Sizing (10%), Legibility (10%)
  - Extracted text with spelling errors highlighted (wavy underlines)
  - Error classification: misspelling, abbreviation, missing/extra/transposed letters
  - Detected issues with severity levels
  - Strengths and prioritized recommendations

### 4. Smart Content Generator

Transform any text into multiple study formats simultaneously.

- Input: paste text or upload PDF
- **4 parallel AI outputs** (Gemini 2.5 Flash):
  - **Simplified Notes** — dyslexia-friendly rewrite with short sentences and bullet points
  - **Flashcards** — 8-10 interactive Q&A cards with flip animation
  - **Quiz** — 5-question MCQ with scoring and answer review
  - **Mind Map** — tree-structured text visualization
- Quiz scores tracked in progress analytics

### 5. Dyslexia Screening Assessment

A science-backed 8-minute screening with ML-powered severity prediction.

- **4-step flow:**
  1. Welcome introduction
  2. Questionnaire — 10 questions across 8 cognitive categories (5-point scale)
  3. Interactive tasks (3 timed 15-second games):
     - **Letter Spotter** — tap every "B" among b/d/p/q distractors
     - **Sound Match** — match phoneme sounds to letters (8 rounds)
     - **Real or Fake** — identify real vs. made-up words (12 words)
  4. Results with severity level and recommendations
- **Backend ML model**: Pre-trained Random Forest classifier
  - 188-feature vector from task results + demographics
  - 11 cognitive groups scored (phonological awareness, orthographic, working memory, etc.)
  - Severity tiers: None (<30%), Mild (30-55%), Moderate (55-75%), Severe (>75%)
- Results saved to Firestore

### 6. Therapy Games

Six cognitive training games targeting skills affected by dyslexia.

| Game | Category | Description |
|---|---|---|
| Dot Connector | Spatial | Connect matching dots and fill every cell |
| Monoline Puzzle | Spatial | Trace entire diagram in one continuous stroke |
| N-Back Challenge | Memory | Spot repeated patterns on a grid |
| Little Blitz | Rhythm | Rhythm and timing skill building |
| Inhibition Stroop | Focus | Pick ink color, not word text |
| Sound Builder | Phonics | Build words letter by letter from a word bank |

- Adaptive difficulty (adjusts based on performance)
- Session tracking via backend API
- Game history per user

### 7. Progress Analytics

Real-time analytics dashboard showing learning progress across all features.

- **6 stat cards**: Lectures, Total Hours, Reading Sessions, Avg Quiz Score, Handwriting Checks, Content Generated
- **4 charts** (Chart.js):
  - Reading Time Trend (Line)
  - Quiz Scores (Bar)
  - Handwriting Scores (Bar)
  - Activity Overview (Doughnut)
- Recent activity feed (all feature types combined)
- AI-powered recommendations based on usage stats
- Recent lectures with processed/pending status
- Real-time Firestore updates via `onSnapshot`

### 8. Accessibility System

A comprehensive, customizable accessibility toolkit available on every page.

- **Floating toolbar** (bottom-right corner) with:
  - OpenDyslexic font toggle
  - Font size slider (14-28px)
  - Letter spacing, word spacing, line height sliders
  - High contrast mode
  - Reading ruler (horizontal highlight bar following cursor)
  - Focus mode
  - Color overlay picker (cream, blue, green, pink, yellow)
  - Font color picker (7 options)
  - Reset all button
- All settings persisted via Zustand + localStorage
- Applied globally through CSS custom properties
- Dark/Light theme toggle in sidebar

---

## Getting Started

### Prerequisites

- Node.js 18+
- Python 3.10+
- Firebase project with Authentication and Firestore enabled
- Google Gemini API key
- Google Cloud OAuth Client ID

### Frontend Setup

```bash
cd frontend-next
npm install
npm run dev
```

Runs on `http://localhost:3000`

### Backend Setup

```bash
cd backend-python
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8001
```

Runs on `http://localhost:8001`

### Environment Variables

**Frontend** (`frontend-next/.env.local`):

```env
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=
NEXT_PUBLIC_GOOGLE_CLIENT_ID=
NEXT_PUBLIC_BACKEND_URL=http://localhost:8001
```

**Backend** (`backend-python/.env`):

```env
GEMINI_API_KEY=
FIREBASE_CREDENTIALS=path/to/serviceAccountKey.json
```

---

## Backend API Reference

| Method | Endpoint | Description |
|---|---|---|
| **Lectures** | | |
| POST | `/api/lectures` | Create lecture |
| GET | `/api/lectures/{id}` | Get lecture by ID |
| GET | `/api/lectures/user/{userId}` | Get all user lectures |
| PATCH | `/api/lectures/{id}` | Update lecture |
| DELETE | `/api/lectures/{id}` | Delete lecture |
| POST | `/api/lectures/{id}/process` | Process lecture through Gemini AI |
| **Content** | | |
| POST | `/api/content/transform` | Generate notes, flashcards, quiz, mind map |
| POST | `/api/analytics/recommend` | AI learning recommendations |
| **Handwriting** | | |
| POST | `/api/handwriting/analyze` | Analyze handwriting image |
| **Assessment** | | |
| GET | `/assessment/start` | Get screening questions |
| POST | `/assessment/submit` | Submit assessment, get ML prediction |
| **Games** | | |
| POST | `/api/games/session/start` | Start game session |
| POST | `/api/games/session/end` | End game session with results |
| GET | `/api/games/history/{userId}` | Get game history |
| GET | `/api/games/difficulty/{userId}/{gameType}` | Get adaptive difficulty |
| **TTS** | | |
| POST | `/api/tts/synthesize` | TTS proxy (Hindi/Kannada) |
| GET | `/api/tts/health` | Health check |

---

## Authentication

- **Firebase Authentication** with Google Sign-In
- Uses **Google Identity Services (GIS)** popup flow (bypasses `firebaseapp.com` CORS issues)
- Custom `useGoogleAuth` hook handles token exchange with `signInWithCredential`
- Auth state managed via React Context (`AuthContext`)

---

## Data Storage

| Store | Data |
|---|---|
| **Firestore** | Lectures, assessments, game sessions, handwriting uploads, progress tracking |
| **localStorage** | Accessibility settings (Zustand), visit streaks, game difficulty levels |

---

Built by the NeuroLex Team
