import { useState, useRef, useMemo, useEffect } from "react";

const questions = [
  { id: 1, text: "Do you find it hard to recognize when two words rhyme, like cat and hat?", category: "phonological", hint: "e.g. cat and hat rhyme, dog and log rhyme", categoryLabel: "🔤 Phonological Awareness" },
  { id: 2, text: "Is it hard to sound out a brand new or made-up word you have never seen before?", category: "phonological", hint: "Tests your phonics decoding ability", categoryLabel: "🔤 Phonological Awareness" },
  { id: 3, text: "How often do you confuse letters that look similar, like b and d, or p and q?", category: "phoneme_grapheme", hint: "Letter reversal is very common in dyslexia", categoryLabel: "🔊 Sound-Letter Matching" },
  { id: 4, text: "Do you lose your place while reading a line of text and have to re-read it?", category: "lexical", hint: "This is called tracking difficulty", categoryLabel: "📖 Reading Fluency" },
  { id: 5, text: "Do you make spelling mistakes in words you have seen many times before?", category: "orthographic", hint: "Visual word memory difficulty", categoryLabel: "✏️ Spelling Patterns" },
  { id: 6, text: "Are you confused by word endings like -ing, -ed, -tion, or -ness?", category: "morphological", hint: "This area has the strongest link to dyslexia", categoryLabel: "🧩 Word Structure" },
  { id: 7, text: "Is it hard to recognize that run, running, and runner all come from the same root word?", category: "morphological", hint: "Called morphological awareness", categoryLabel: "🧩 Word Structure" },
  { id: 8, text: "Do you often have to re-read sentences multiple times to understand the meaning?", category: "syntactic", hint: "Sentence comprehension difficulty", categoryLabel: "📝 Grammar Sense" },
  { id: 9, text: "Do you forget a word mid-sentence while you are speaking or reading?", category: "working_memory", hint: "Working memory plays a key role in reading", categoryLabel: "🧠 Working Memory" },
  { id: 10, text: "Do you feel anxious or tend to avoid situations where you have to read aloud?", category: "emotional", hint: "Emotional impact is an important indicator", categoryLabel: "💭 Reading Experience" },
];

const tasks = [
  { index: 0, taskNumber: 2, gameType: "letter_spotter", title: "Letter Spotter", instruction: "Tap every letter B as fast as you can!", description: "Tests letter recognition — an important reading skill" },
  { index: 1, taskNumber: 5, gameType: "sound_match", title: "Sound Match", instruction: "Listen to the sound, then tap the matching letters!", description: "Tests sound-to-letter connection" },
  { index: 2, taskNumber: 8, gameType: "real_or_fake", title: "Real or Fake?", instruction: "Is this a real English word? Tap your answer!", description: "Tests word recognition and reading fluency" },
];

const answerLabels = ["Never", "Rarely", "Sometimes", "Often", "Always"];

const phonemeRounds = [
  { sound: "sh", correct: "SH", options: ["SH", "CH", "TH", "S"] },
  { sound: "th", correct: "TH", options: ["TH", "SH", "PH", "F"] },
  { sound: "ch", correct: "CH", options: ["CH", "SH", "TH", "C"] },
  { sound: "ph", correct: "PH", options: ["PH", "FF", "F", "V"] },
  { sound: "wh", correct: "WH", options: ["WH", "W", "HW", "VW"] },
  { sound: "ck", correct: "CK", options: ["CK", "K", "C", "QK"] },
  { sound: "ng", correct: "NG", options: ["NG", "NK", "GN", "N"] },
  { sound: "wr", correct: "WR", options: ["WR", "R", "RW", "OR"] },
];

const wordList = [
  { word: "kitchen", real: true },
  { word: "blurst", real: false },
  { word: "friend", real: true },
  { word: "spanting", real: false },
  { word: "garden", real: true },
  { word: "woogle", real: false },
  { word: "journey", real: true },
  { word: "frimbel", real: false },
  { word: "whisper", real: true },
  { word: "crumfle", real: false },
  { word: "bridge", real: true },
  { word: "pliven", real: false },
];

export default function Onboarding() {
  const [step, setStep] = useState(1);
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [answers, setAnswers] = useState({});
  const [currentTaskIndex, setCurrentTaskIndex] = useState(0);
  const [taskResults, setTaskResults] = useState([]);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Task sub-state
  const [taskPhase, setTaskPhase] = useState("intro");
  const [taskData, setTaskData] = useState({ clicks: 0, hits: 0, misses: 0 });
  const [timeLeft, setTimeLeft] = useState(15);
  const timerRef = useRef(null);

  // Letter Spotter state
  const [tappedCells, setTappedCells] = useState({});

  // Sound Match state
  const [roundIndex, setRoundIndex] = useState(0);
  const [lastResult, setLastResult] = useState(null);

  // Real or Fake state
  const [wordIndex, setWordIndex] = useState(0);
  const [flash, setFlash] = useState(null);

  // Timer effect
  useEffect(() => {
    if (taskPhase === "playing") {
      timerRef.current = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            clearInterval(timerRef.current);
            setTaskPhase("done");
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [taskPhase]);

  // Speak phoneme when Sound Match starts or round changes
  useEffect(() => {
    if (taskPhase === "playing" && currentTaskIndex === 1) {
      const utterance = new SpeechSynthesisUtterance(phonemeRounds[roundIndex].sound);
      utterance.rate = 0.8;
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(utterance);
    }
  }, [taskPhase, currentTaskIndex, roundIndex]);

  // Save task result when task completes
  useEffect(() => {
    if (taskPhase === "done") {
      const currentTask = tasks[currentTaskIndex];
      const res = {
        task_number: currentTask.taskNumber,
        game_type: currentTask.gameType,
        clicks: taskData.clicks,
        hits: taskData.hits,
        misses: taskData.misses,
        score: taskData.hits,
        accuracy: taskData.clicks > 0 ? taskData.hits / taskData.clicks : 0,
        missrate: taskData.clicks > 0 ? taskData.misses / taskData.clicks : 0,
      };
      setTaskResults((prev) => [...prev, res]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taskPhase]);

  // Letter grid for Task A
  const letterGrid = useMemo(() => {
    const grid = [];
    const distractors = ["D", "P", "Q", "d", "p", "q"];
    const bPositions = new Set();
    while (bPositions.size < 6) {
      bPositions.add(Math.floor(Math.random() * 20));
    }
    for (let i = 0; i < 20; i++) {
      if (bPositions.has(i)) {
        grid.push(Math.random() > 0.5 ? "B" : "b");
      } else {
        grid.push(distractors[Math.floor(Math.random() * distractors.length)]);
      }
    }
    return grid;
  }, [currentTaskIndex, taskPhase]);

  const startTask = () => {
    setTaskData({ clicks: 0, hits: 0, misses: 0 });
    setTimeLeft(15);
    setTappedCells({});
    setRoundIndex(0);
    setLastResult(null);
    setWordIndex(0);
    setFlash(null);
    setTaskPhase("playing");
  };

  const submitAssessment = async (finalTaskResults) => {
    setLoading(true);
    setError(null);
    try {
      const questionnaire_answers = questions.map((q) => ({
        question_id: q.id,
        question_text: q.text,
        answer: answers[q.id] || 3,
        category: q.category,
      }));
      const body = {
        user_id: localStorage.getItem("dyslexia_user_id") || "anonymous_user",
        questionnaire_answers,
        task_results: finalTaskResults,
        age: 10,
        gender: "prefer_not_to_say",
        native_english: true,
      };
      const response = await fetch("http://localhost:8000/assessment/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!response.ok) throw new Error("Assessment submission failed");
      const data = await response.json();
      setResult(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const resetAll = () => {
    setStep(1);
    setCurrentQuestion(0);
    setAnswers({});
    setCurrentTaskIndex(0);
    setTaskResults([]);
    setResult(null);
    setLoading(false);
    setError(null);
    setTaskPhase("intro");
    setTaskData({ clicks: 0, hits: 0, misses: 0 });
    setTimeLeft(15);
    setTappedCells({});
    setRoundIndex(0);
    setLastResult(null);
    setWordIndex(0);
    setFlash(null);
  };

  // ═══════════ STEP 1 — WELCOME ═══════════
  if (step === 1) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-950 to-purple-950 flex flex-col items-center justify-center p-8">
        <div className="max-w-lg text-center">
          <div className="text-8xl mb-6 animate-bounce">🧠</div>
          <h1 className="text-4xl font-bold text-white text-center mb-4">
            Let&apos;s understand how you learn
          </h1>
          <p className="text-lg text-indigo-300 text-center mb-8">
            A quick 8-minute assessment to personalize your learning journey
          </p>
          <div className="flex gap-3 justify-center mb-10 flex-wrap">
            {["🔒 Completely private", "🔬 Science-backed", "🎯 Personalized result"].map((chip) => (
              <span key={chip} className="bg-indigo-900 text-indigo-300 px-4 py-2 rounded-full text-sm">
                {chip}
              </span>
            ))}
          </div>
          <button
            onClick={() => setStep(2)}
            className="bg-indigo-500 hover:bg-indigo-400 text-white text-xl font-semibold px-12 py-4 rounded-2xl transition-all duration-200 hover:scale-105"
          >
            Begin Assessment →
          </button>
        </div>
      </div>
    );
  }

  // ═══════════ STEP 2 — QUESTIONNAIRE ═══════════
  if (step === 2) {
    const q = questions[currentQuestion];
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-950 to-purple-950 flex flex-col p-6">
        {/* Top bar */}
        <div className="flex items-center gap-4 mb-6">
          <button
            onClick={() => (currentQuestion > 0 ? setCurrentQuestion(currentQuestion - 1) : setStep(1))}
            className="text-indigo-400 text-2xl hover:text-indigo-300 transition-colors"
          >
            ←
          </button>
          <div className="flex-1">
            <p className="text-indigo-400 text-sm mb-1">Question {currentQuestion + 1} of 10</p>
            <div className="w-full bg-indigo-900 rounded-full h-2">
              <div
                className="bg-indigo-400 h-2 rounded-full transition-all duration-300"
                style={{ width: `${((currentQuestion + 1) / 10) * 100}%` }}
              />
            </div>
          </div>
        </div>

        {/* Question card */}
        <div className="flex-1 flex flex-col items-center justify-center">
          <span className="text-indigo-400 text-sm uppercase tracking-wider mb-4">{q.categoryLabel}</span>
          <h2 className="text-2xl font-medium text-white text-center mb-3 max-w-2xl leading-relaxed">
            {q.text}
          </h2>
          <p className="text-sm italic text-indigo-400 text-center mb-10 max-w-lg">{q.hint}</p>

          <div className="flex flex-wrap gap-3 justify-center">
            {answerLabels.map((label, idx) => {
              const value = idx + 1;
              const selected = answers[q.id] === value;
              return (
                <button
                  key={value}
                  onClick={() => setAnswers({ ...answers, [q.id]: value })}
                  className={
                    selected
                      ? "bg-indigo-500 text-white px-6 py-3 rounded-full text-base cursor-pointer transition-all duration-150 scale-105 shadow-lg shadow-indigo-500/30"
                      : "border border-indigo-700 text-indigo-300 bg-transparent px-6 py-3 rounded-full text-base cursor-pointer transition-all duration-150 hover:border-indigo-400"
                  }
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Next button */}
        {answers[q.id] && (
          <div className="flex justify-center mt-8">
            <button
              onClick={() => (currentQuestion < 9 ? setCurrentQuestion(currentQuestion + 1) : setStep(3))}
              className="bg-indigo-500 hover:bg-indigo-400 text-white px-10 py-3 rounded-xl font-semibold text-lg transition-all"
            >
              {currentQuestion < 9 ? "Next →" : "Start Tasks →"}
            </button>
          </div>
        )}
      </div>
    );
  }

  // ═══════════ STEP 3 — INTERACTIVE TASKS ═══════════
  if (step === 3) {
    const currentTask = tasks[currentTaskIndex];

    // TASK INTRO
    if (taskPhase === "intro") {
      return (
        <div className="min-h-screen bg-gradient-to-br from-indigo-950 to-purple-950 flex items-center justify-center p-6">
          <div className="bg-indigo-900/50 rounded-2xl p-8 max-w-md mx-auto text-center border border-indigo-700">
            <span className="bg-indigo-800 text-indigo-300 px-3 py-1 rounded-full text-xs uppercase tracking-wider">
              Task {currentTaskIndex + 1} of 3
            </span>
            <h2 className="text-3xl font-bold text-white mb-3 mt-4">{currentTask.title}</h2>
            <p className="text-indigo-300 mb-2">{currentTask.description}</p>
            <p className="text-lg text-white mb-8 font-medium">{currentTask.instruction}</p>
            <p className="text-indigo-400 mb-6">⏱ 15 seconds</p>
            <button
              onClick={startTask}
              className="bg-indigo-500 hover:bg-indigo-400 text-white text-lg font-semibold px-10 py-3 rounded-xl transition-all hover:scale-105"
            >
              Start Task →
            </button>
          </div>
        </div>
      );
    }

    // TIMER DISPLAY HELPER
    const timerColor = timeLeft > 10 ? "text-white" : timeLeft > 5 ? "text-yellow-400" : "text-red-400 animate-pulse";

    // TASK A — LETTER SPOTTER
    if (taskPhase === "playing" && currentTaskIndex === 0) {
      return (
        <div className="min-h-screen bg-gradient-to-br from-indigo-950 to-purple-950 flex flex-col items-center justify-center p-6">
          <div className={`text-6xl font-bold text-center mb-6 ${timerColor}`}>{timeLeft}</div>
          <div className="grid grid-cols-5 gap-3 max-w-sm mx-auto mb-6">
            {letterGrid.map((letter, i) => {
              const tapped = tappedCells[i];
              let cellClass = "w-14 h-14 rounded-xl bg-indigo-900 border border-indigo-700 text-3xl font-bold text-indigo-200 flex items-center justify-center cursor-pointer transition-all";
              if (tapped === "correct") cellClass = "w-14 h-14 rounded-xl bg-green-500 border-green-400 text-white text-3xl font-bold flex items-center justify-center cursor-default";
              if (tapped === "wrong") cellClass = "w-14 h-14 rounded-xl bg-red-500 border-red-400 text-white text-3xl font-bold flex items-center justify-center cursor-default";

              return (
                <button
                  key={i}
                  disabled={!!tapped}
                  onClick={() => {
                    if (tapped) return;
                    const isTarget = letter === "B" || letter === "b";
                    setTappedCells((prev) => ({ ...prev, [i]: isTarget ? "correct" : "wrong" }));
                    setTaskData((prev) => ({
                      clicks: prev.clicks + 1,
                      hits: prev.hits + (isTarget ? 1 : 0),
                      misses: prev.misses + (isTarget ? 0 : 1),
                    }));
                  }}
                  className={cellClass}
                >
                  {letter}
                </button>
              );
            })}
          </div>
          <p className="text-indigo-300 text-center">
            Hits: {taskData.hits} &nbsp; Misses: {taskData.misses}
          </p>
        </div>
      );
    }

    // TASK B — SOUND MATCH
    if (taskPhase === "playing" && currentTaskIndex === 1) {
      const round = phonemeRounds[roundIndex];
      return (
        <div className="min-h-screen bg-gradient-to-br from-indigo-950 to-purple-950 flex flex-col items-center justify-center p-6">
          <div className={`text-6xl font-bold text-center mb-6 ${timerColor}`}>{timeLeft}</div>
          <p className="text-indigo-400 text-center mb-2">🔊 Listen carefully...</p>
          <div className="flex items-center justify-center gap-3 mb-6">
            <span className="text-6xl text-white font-bold">{round.sound}</span>
            <button
              onClick={() => {
                const u = new SpeechSynthesisUtterance(round.sound);
                u.rate = 0.8;
                window.speechSynthesis.cancel();
                window.speechSynthesis.speak(u);
              }}
              className="text-indigo-400 hover:text-indigo-300 text-2xl"
            >
              🔊
            </button>
          </div>
          {lastResult && (
            <div className={`text-3xl mb-4 ${lastResult === "correct" ? "text-green-400" : "text-red-400"}`}>
              {lastResult === "correct" ? "✓" : "✗"}
            </div>
          )}
          <div className="grid grid-cols-2 gap-4 max-w-xs mx-auto mb-4">
            {round.options.map((opt) => (
              <button
                key={opt}
                onClick={() => {
                  const isCorrect = opt === round.correct;
                  setTaskData((prev) => ({
                    clicks: prev.clicks + 1,
                    hits: prev.hits + (isCorrect ? 1 : 0),
                    misses: prev.misses + (isCorrect ? 0 : 1),
                  }));
                  setLastResult(isCorrect ? "correct" : "wrong");
                  setTimeout(() => {
                    setLastResult(null);
                    if (roundIndex < 7) {
                      setRoundIndex((prev) => prev + 1);
                    }
                  }, 600);
                }}
                className="text-2xl font-bold bg-indigo-800 hover:bg-indigo-700 border border-indigo-600 text-white py-4 px-6 rounded-xl cursor-pointer transition-all"
              >
                {opt}
              </button>
            ))}
          </div>
          <p className="text-indigo-400 text-sm">{roundIndex + 1} / 8</p>
        </div>
      );
    }

    // TASK C — REAL OR FAKE
    if (taskPhase === "playing" && currentTaskIndex === 2) {
      const currentWord = wordList[wordIndex];
      return (
        <div className="min-h-screen bg-gradient-to-br from-indigo-950 to-purple-950 flex flex-col items-center justify-center p-6">
          <div className={`text-6xl font-bold text-center mb-6 ${timerColor}`}>{timeLeft}</div>
          <p className="text-indigo-400 text-sm text-center mb-4">{wordIndex + 1} of {wordList.length}</p>
          <div className="relative my-10">
            {flash && (
              <div
                className={`absolute inset-0 rounded-2xl ${flash === "correct" ? "bg-green-500/20" : "bg-red-500/20"} transition-all`}
              />
            )}
            <span className="text-6xl font-bold text-white text-center block px-8">{currentWord.word}</span>
          </div>
          <div className="flex gap-6 justify-center">
            <button
              onClick={() => {
                const isCorrect = currentWord.real === true;
                setTaskData((prev) => ({
                  clicks: prev.clicks + 1,
                  hits: prev.hits + (isCorrect ? 1 : 0),
                  misses: prev.misses + (isCorrect ? 0 : 1),
                }));
                setFlash(isCorrect ? "correct" : "wrong");
                setTimeout(() => {
                  setFlash(null);
                  if (wordIndex < wordList.length - 1) setWordIndex((prev) => prev + 1);
                }, 500);
              }}
              className="bg-green-700 hover:bg-green-600 text-white text-xl font-bold px-8 py-5 rounded-2xl transition-all"
            >
              ✓ REAL WORD
            </button>
            <button
              onClick={() => {
                const isCorrect = currentWord.real === false;
                setTaskData((prev) => ({
                  clicks: prev.clicks + 1,
                  hits: prev.hits + (isCorrect ? 1 : 0),
                  misses: prev.misses + (isCorrect ? 0 : 1),
                }));
                setFlash(isCorrect ? "correct" : "wrong");
                setTimeout(() => {
                  setFlash(null);
                  if (wordIndex < wordList.length - 1) setWordIndex((prev) => prev + 1);
                }, 500);
              }}
              className="bg-red-700 hover:bg-red-600 text-white text-xl font-bold px-8 py-5 rounded-2xl transition-all"
            >
              ✗ NOT A WORD
            </button>
          </div>
        </div>
      );
    }

    // TASK DONE
    if (taskPhase === "done") {
      const accuracy = taskData.clicks > 0 ? taskData.hits / taskData.clicks : 0;
      const pct = Math.round(accuracy * 100);
      const accColor = pct >= 80 ? "text-green-400" : pct >= 60 ? "text-yellow-400" : "text-red-400";
      const emoji = pct >= 80 ? "🌟 Excellent!" : pct >= 60 ? "👍 Good job!" : "💪 Keep going!";

      return (
        <div className="min-h-screen bg-gradient-to-br from-indigo-950 to-purple-950 flex items-center justify-center p-6">
          <div className="bg-indigo-900/50 rounded-2xl p-8 max-w-md mx-auto text-center border border-indigo-700">
            <div className={`text-6xl font-bold ${accColor} mb-2`}>{pct}%</div>
            <p className="text-2xl text-white mb-4">{emoji}</p>
            <div className="flex justify-center gap-8 text-indigo-300 mb-8">
              <span>Correct: {taskData.hits}</span>
              <span>Missed: {taskData.misses}</span>
            </div>
            <button
              onClick={() => {
                if (currentTaskIndex < 2) {
                  setCurrentTaskIndex((prev) => prev + 1);
                  setTaskPhase("intro");
                  setTaskData({ clicks: 0, hits: 0, misses: 0 });
                  setTimeLeft(15);
                  setTappedCells({});
                  setRoundIndex(0);
                  setLastResult(null);
                  setWordIndex(0);
                  setFlash(null);
                } else {
                  // Build final task results including this last one
                  const lastResult = {
                    task_number: tasks[currentTaskIndex].taskNumber,
                    game_type: tasks[currentTaskIndex].gameType,
                    clicks: taskData.clicks,
                    hits: taskData.hits,
                    misses: taskData.misses,
                    score: taskData.hits,
                    accuracy: taskData.clicks > 0 ? taskData.hits / taskData.clicks : 0,
                    missrate: taskData.clicks > 0 ? taskData.misses / taskData.clicks : 0,
                  };
                  const allResults = [...taskResults, lastResult];
                  setStep(4);
                  submitAssessment(allResults);
                }
              }}
              className="bg-indigo-500 hover:bg-indigo-400 text-white text-lg font-semibold px-10 py-3 rounded-xl transition-all hover:scale-105"
            >
              {currentTaskIndex < 2 ? "Next Task →" : "See My Results →"}
            </button>
          </div>
        </div>
      );
    }
  }

  // ═══════════ STEP 4 — RESULTS ═══════════
  if (step === 4) {
    // Loading
    if (loading) {
      return (
        <div className="min-h-screen bg-gradient-to-br from-indigo-950 to-purple-950 flex flex-col items-center justify-center p-8">
          <div className="text-8xl animate-pulse">🧠</div>
          <p className="text-2xl text-white mt-6">Analyzing your responses...</p>
          <p className="text-indigo-400 mt-2">This takes just a moment</p>
        </div>
      );
    }

    // Error
    if (error) {
      return (
        <div className="min-h-screen bg-gradient-to-br from-indigo-950 to-purple-950 flex flex-col items-center justify-center p-8">
          <div className="bg-indigo-900/50 rounded-2xl p-8 max-w-md text-center border border-red-700">
            <div className="text-5xl mb-4">⚠️</div>
            <h2 className="text-2xl font-bold text-white mb-2">Something went wrong</h2>
            <p className="text-red-400 mb-6">{error}</p>
            <button
              onClick={resetAll}
              className="bg-indigo-500 hover:bg-indigo-400 text-white px-8 py-3 rounded-xl font-semibold transition-all"
            >
              Try Again
            </button>
          </div>
        </div>
      );
    }

    // Results
    if (result) {
      const sev = result.severity;
      const borderColors = { none: "border-green-500", mild: "border-yellow-500", moderate: "border-orange-500", severe: "border-red-500" };
      const bgColors = { none: "bg-green-500/10", mild: "bg-yellow-500/10", moderate: "bg-orange-500/10", severe: "bg-red-500/10" };
      const textColors = { none: "text-green-400", mild: "text-yellow-400", moderate: "text-orange-400", severe: "text-red-400" };

      return (
        <div className="min-h-screen bg-gradient-to-br from-indigo-950 to-purple-950 flex flex-col items-center p-8">
          <h1 className="text-3xl font-bold text-white text-center mb-8">Your Learning Profile</h1>

          {/* Severity circle */}
          <div
            className={`w-48 h-48 rounded-full border-4 ${borderColors[sev.label]} ${bgColors[sev.label]} flex flex-col items-center justify-center mx-auto mb-8`}
          >
            <span className="text-2xl font-bold text-white">{sev.display}</span>
            <span className={`text-4xl font-black ${textColors[sev.label]}`}>{sev.score}%</span>
          </div>

          {/* Message */}
          <p className="text-lg italic text-indigo-300 text-center max-w-lg mb-8">{result.message}</p>

          {/* Weakest areas */}
          <div className="mb-8 text-center">
            <h3 className="text-indigo-400 uppercase text-sm tracking-wider mb-3">Areas to Focus On</h3>
            <div className="flex gap-2 flex-wrap justify-center">
              {sev.weakest_areas.map((area) => (
                <span key={area} className="border border-indigo-500 text-indigo-300 px-4 py-2 rounded-full text-sm">
                  {area.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
                </span>
              ))}
            </div>
          </div>

          {/* Recommendations */}
          <div className="mb-10 w-full max-w-lg mx-auto">
            <h3 className="text-indigo-400 uppercase text-sm tracking-wider mb-3 text-center">Your Recommendations</h3>
            <div className="space-y-3">
              {sev.recommendations.slice(0, 3).map((rec, i) => (
                <div key={i} className="bg-indigo-900/60 rounded-xl p-4 border-l-4 border-indigo-500 flex items-start gap-3">
                  <span>💡</span>
                  <span className="text-white text-sm">{rec}</span>
                </div>
              ))}
            </div>
          </div>

          {/* CTA */}
          <button
            onClick={() => { window.location.href = "/dashboard"; }}
            className="bg-indigo-500 hover:bg-indigo-400 text-white text-xl font-semibold px-12 py-4 rounded-2xl transition-all hover:scale-105 mb-4"
          >
            Start Your Learning Journey →
          </button>
          <button onClick={resetAll} className="text-indigo-500 underline cursor-pointer text-sm">
            Retake Assessment
          </button>
        </div>
      );
    }
  }

  return null;
}
