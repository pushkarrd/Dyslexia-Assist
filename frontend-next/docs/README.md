# SimplifiED - AI-Powered Learning Assistant

SimplifiED is an educational tool that helps students, especially those with dyslexia, by converting live lecture transcriptions into multiple accessible formats using local AI.

## 🎯 Features

- **Live Audio Recording**: Record lectures with real-time speech-to-text transcription
- **Multiple Output Formats**:
  - **Simple Text**: Dyslexia-friendly simplified version
  - **Detailed Steps**: Step-by-step breakdown of concepts
  - **Mind Map**: Hierarchical visual structure
  - **Summary**: Concise key points
- **Local AI Processing**: Uses Ollama with llama3.2:3b (no API keys needed!)
- **Firebase Integration**: Save and retrieve lectures
- **Responsive UI**: Modern design with dark/light theme support

## 🚀 Getting Started

### Prerequisites

1. **Node.js** (v18 or higher) - for the React frontend
2. **Python** (v3.9 or higher) - for the FastAPI backend
3. **Ollama** - for local AI processing
4. **Firebase Account** - for data persistence

### Installation

#### 1. Install Ollama

Download and install from: https://ollama.com/download

Then pull the model:
```powershell
ollama pull llama3.2:3b
```

#### 2. Setup Backend (Python)

```powershell
cd backend-python
pip install -r requirements.txt
```

Copy your Firebase service account key to `backend-python/serviceAccountKey.json`

#### 3. Setup Frontend (React)

```powershell
cd frontend
npm install
```

Configure Firebase in `frontend/src/firebase.js` with your Firebase config.

### Running the Application

#### 1. Start Ollama (if not running as service)

```powershell
ollama serve
```

#### 2. Start the Python Backend

```powershell
cd backend-python
python -m uvicorn main:app --port 8000
```

Backend will be available at: http://localhost:8000

#### 3. Start the React Frontend

```powershell
cd frontend
npm run dev
```

Frontend will be available at: http://localhost:5173

## 📝 How to Use

1. **Sign In**: Create an account or sign in with email/password
2. **Start Recording**: Click the microphone button to start recording
3. **Speak Clearly**: Your speech will be transcribed in real-time
4. **Stop Recording**: Click stop when done
5. **View Results**: The AI will automatically generate:
   - Simplified text (dyslexia-friendly)
   - Step-by-step breakdown
   - Mind map structure
   - Concise summary

## 🔧 Configuration

### Backend Environment Variables

Create a `.env` file in `backend-python/` (optional):

```env
OLLAMA_MODEL=llama3.2:3b
FIREBASE_SERVICE_ACCOUNT_PATH=./serviceAccountKey.json
```

### Frontend Configuration

Update `frontend/src/firebase.js` with your Firebase config.

## 🏗️ Architecture

```
SimplifiED/
├── frontend/              # React + Vite
│   ├── src/
│   │   ├── components/   # Reusable components
│   │   ├── pages/        # Page components
│   │   ├── services/     # API services
│   │   └── hooks/        # Custom React hooks
│   └── package.json
│
└── backend-python/       # FastAPI + Ollama
    ├── main.py           # API endpoints
    ├── requirements.txt  # Python dependencies
    └── serviceAccountKey.json  # Firebase credentials (DO NOT COMMIT)
```

## 🔒 Security Notes

- `serviceAccountKey.json` is in `.gitignore` - never commit it!
- Firebase credentials should be secured
- Backend uses CORS to allow only localhost origins
- All data is stored in Firebase Firestore with user authentication

## 🎓 Technology Stack

### Frontend
- React 19.2.0
- Vite 7.2.4
- Tailwind CSS 4.1.17
- Framer Motion
- Firebase SDK
- Web Speech API

### Backend
- Python 3.13
- FastAPI
- Uvicorn
- Ollama (llama3.2:3b - 2GB local model)
- Firebase Admin SDK

## 🐛 Troubleshooting

### Ollama not found
```powershell
# Refresh environment variables
$env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")
ollama --version
```

### Backend won't start
- Ensure Ollama is running: `ollama serve`
- Check if port 8000 is available
- Verify `serviceAccountKey.json` exists in `backend-python/`

### Microphone not working
- Grant browser permission to access microphone
- Use Chrome, Edge, or Safari (Web Speech API support)
- Check if another app is using the microphone

### CORS errors
- Ensure backend is running on port 8000
- Frontend should be on port 5173, 5174, or 5175
- Check backend CORS configuration in `main.py`

## 🙏 Acknowledgments

- **Ollama** for local LLM capabilities
- **Meta** for the llama3.2 model
- **Firebase** for backend services
- **FastAPI** & **React** teams

---

Built with ❤️ to make learning accessible for everyone