import React, { useState, useEffect, useRef } from "react";

// ── Colors ─────────────────────────────────────────────────────────────────
const C = {
  purple: "#7c3aed",
  purpleLight: "#ede9fe",
  purpleBorder: "#c4b5fd",
  navy: "#1a237e",
  navyLight: "#e8eaf6",
  green: "#059669",
  greenLight: "#d1fae5",
  greenBorder: "#6ee7b7",
  red: "#dc2626",
  redLight: "#fee2e2",
  redBorder: "#fca5a5",
  gold: "#d97706",
  goldLight: "#fef3c7",
  gray: "#6b7280",
  grayLight: "#f3f4f6",
  grayBorder: "#e5e7eb",
  white: "#ffffff",
};

// ── Count-up animation ─────────────────────────────────────────────────────
function useCountUp(target, duration = 1000) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    let start = null;
    const step = (ts) => {
      if (!start) start = ts;
      const p = Math.min((ts - start) / duration, 1);
      setVal(Math.floor(p * target));
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }, [target, duration]);
  return val;
}

// ── Progress Bar ───────────────────────────────────────────────────────────
function ProgressBar({ current, total, streak }) {
  const pct = Math.round((current / total) * 100);
  return (
    <div style={s.progressWrap}>
      <div style={s.progressMeta}>
        <span style={s.progressLabel}>السؤال {current} من {total}</span>
        {streak >= 2 && <span style={s.streakBadge}>🔥 {streak} متتالية</span>}
        <span style={s.progressPct}>{pct}%</span>
      </div>
      <div style={s.progressTrack}>
        <div style={{ ...s.progressFill, width: `${pct}%` }} />
      </div>
    </div>
  );
}

// ── Question Card ──────────────────────────────────────────────────────────
function QuestionCard({ question, index, total, onAnswer, streak }) {
  const [chosen, setChosen] = useState(null);
  const [revealed, setRevealed] = useState(false);
  const [animIn, setAnimIn] = useState(false);
  const timerRef = useRef(null);

  useEffect(() => {
    requestAnimationFrame(() => setAnimIn(true));
    return () => clearTimeout(timerRef.current);
  }, []);

  const pick = (opt) => {
    if (revealed) return;
    setChosen(opt);
    setRevealed(true);
    const correct = opt === question.answer;
    timerRef.current = setTimeout(() => onAnswer(correct), 2000);
  };

  const isCorrect = chosen === question.answer;

  return (
    <div style={{ ...s.qCard, opacity: animIn ? 1 : 0, transform: animIn ? "translateY(0)" : "translateY(20px)", transition: "opacity 0.4s, transform 0.4s" }}>
      <ProgressBar current={index + 1} total={total} streak={streak} />

      {/* Question bubble */}
      <div style={s.qBubble}>
        <div style={s.qNumBadge}>س{index + 1}</div>
        <p style={s.qText}>{question.question}</p>
      </div>

      {/* Options */}
      <div style={s.optionsGrid}>
        {question.options.map((opt) => {
          const isChosen = chosen === opt;
          const isAnswer = opt === question.answer;
          let style = { ...s.optBtn };

          if (revealed) {
            if (isAnswer) style = { ...style, background: C.greenLight, border: `2px solid ${C.greenBorder}`, color: C.green, transform: "scale(1.01)" };
            else if (isChosen) style = { ...style, background: C.redLight, border: `2px solid ${C.redBorder}`, color: C.red };
            else style = { ...style, opacity: 0.5 };
          } else if (isChosen) {
            style = { ...style, background: C.purpleLight, border: `2px solid ${C.purpleBorder}`, color: C.purple };
          }

          return (
            <button key={opt} onClick={() => pick(opt)} disabled={revealed} style={{ ...style, cursor: revealed ? "default" : "pointer" }}>
              <span style={s.optLetter}>{revealed && isAnswer ? "✓" : revealed && isChosen ? "✗" : ""}</span>
              <span style={{ flex: 1 }}>{opt}</span>
            </button>
          );
        })}
      </div>

      {/* Feedback */}
      {revealed && (
        <div style={{ ...s.feedback, background: isCorrect ? C.greenLight : C.redLight, border: `1px solid ${isCorrect ? C.greenBorder : C.redBorder}`, color: isCorrect ? C.green : C.red }}>
          <span style={{ fontSize: "22px" }}>{isCorrect ? "🎉" : "💡"}</span>
          <div>
            <p style={{ margin: "0 0 4px", fontWeight: 700, fontSize: "14px" }}>{isCorrect ? "إجابة صحيحة!" : "إجابة خاطئة"}</p>
            <p style={{ margin: 0, fontSize: "13px", lineHeight: 1.6 }}>{question.explanation}</p>
          </div>
        </div>
      )}

      {revealed && (
        <button style={s.nextBtn} onClick={() => { clearTimeout(timerRef.current); onAnswer(isCorrect); }}>
          {index + 1 < total ? "السؤال التالي ←" : "عرض النتائج ←"}
        </button>
      )}
    </div>
  );
}

// ── Results ────────────────────────────────────────────────────────────────
function Results({ questions, answers, onRetry, onClose }) {
  const score = answers.filter(Boolean).length;
  const total = questions.length;
  const pct = Math.round((score / total) * 100);
  const animPct = useCountUp(pct);

  const grade =
    pct === 100 ? { emoji: "🏆", label: "ممتاز!", color: C.gold, bg: C.goldLight }
    : pct >= 80  ? { emoji: "🌟", label: "جيد جداً", color: C.green, bg: C.greenLight }
    : pct >= 60  ? { emoji: "👍", label: "جيد", color: "#2563eb", bg: "#dbeafe" }
    :              { emoji: "📚", label: "راجع الدرس", color: C.red, bg: C.redLight };

  return (
    <div style={s.resultsWrap}>
      {/* Score circle */}
      <div style={s.scoreCircleWrap}>
        <svg width="160" height="160" style={{ transform: "rotate(-90deg)" }}>
          <circle cx="80" cy="80" r="68" fill="none" stroke={C.navyLight} strokeWidth="10" />
          <circle cx="80" cy="80" r="68" fill="none" stroke={grade.color} strokeWidth="10"
            strokeDasharray={`${2 * Math.PI * 68}`}
            strokeDashoffset={`${2 * Math.PI * 68 * (1 - pct / 100)}`}
            strokeLinecap="round" style={{ transition: "stroke-dashoffset 1s ease" }} />
        </svg>
        <div style={s.scoreCircleInner}>
          <span style={{ fontSize: "28px" }}>{grade.emoji}</span>
          <span style={{ fontSize: "32px", fontWeight: 800, color: grade.color, lineHeight: 1 }}>{animPct}%</span>
          <span style={{ fontSize: "12px", color: C.gray }}>{score}/{total} صحيح</span>
        </div>
      </div>

      <div style={{ ...s.gradeBadge, background: grade.bg, color: grade.color }}>{grade.label}</div>

      {/* Review */}
      <div style={s.reviewWrap}>
        <p style={s.reviewTitle}>📋 مراجعة الإجابات</p>
        {questions.map((q, i) => (
          <div key={i} style={{ ...s.reviewItem, borderRight: `4px solid ${answers[i] ? C.green : C.red}` }}>
            <div style={{ display: "flex", gap: "10px", alignItems: "flex-start" }}>
              <span style={{ ...s.reviewBadge, background: answers[i] ? C.greenLight : C.redLight, color: answers[i] ? C.green : C.red }}>
                {answers[i] ? "✓ صحيح" : "✗ خطأ"}
              </span>
              <p style={s.reviewQ}>{q.question}</p>
            </div>
            {!answers[i] && <p style={s.reviewAnswer}>الإجابة الصحيحة: <strong>{q.answer}</strong></p>}
          </div>
        ))}
      </div>

      <div style={s.resultActions}>
        <button style={s.retryBtn} onClick={onRetry}>🔄 إعادة الاختبار</button>
        {onClose && <button style={s.closeResultBtn} onClick={onClose}>✕ إغلاق</button>}
      </div>
    </div>
  );
}

// ── Simulation Block ───────────────────────────────────────────────────────
function SimulationBlock({ simulation }) {
  const [step, setStep] = useState(0);
  const [done, setDone] = useState(false);
  const [showHint, setShowHint] = useState(false);
  const [selected, setSelected] = useState(null);
  const [inputVal, setInputVal] = useState("");
  const [feedback, setFeedback] = useState(null);
  const [score, setScore] = useState(0);

  if (!simulation || !simulation.steps?.length) return null;

  const steps = simulation.steps;
  const current = steps[step];

  const handleChoice = (choice) => {
    if (feedback) return;
    setSelected(choice.id);
    setFeedback({ correct: choice.correct, text: choice.feedback });
    if (choice.correct) setScore(s => s + 1);
  };

  const handleInput = () => {
    if (!inputVal.trim() || feedback) return;
    const keywords = current.expectedKeywords || [];
    const lower = inputVal.toLowerCase();
    const matched = keywords.filter(k => lower.includes(k.toLowerCase()));
    const correct = matched.length >= Math.ceil(keywords.length / 2);
    setFeedback({
      correct,
      text: correct
        ? `✓ إجابة جيدة! ذكرت ${matched.length} من المفاهيم الأساسية.`
        : `يمكن تحسين إجابتك. المفاهيم المهمة: ${keywords.join("، ")}`,
    });
    if (correct) setScore(s => s + 1);
  };

  const nextStep = () => {
    if (step < steps.length - 1) {
      setStep(step + 1);
      setSelected(null);
      setInputVal("");
      setFeedback(null);
      setShowHint(false);
    } else {
      setDone(true);
    }
  };

  const reset = () => {
    setStep(0); setDone(false); setSelected(null);
    setInputVal(""); setFeedback(null); setShowHint(false); setScore(0);
  };

  const pct = Math.round((score / steps.length) * 100);

  return (
    <div style={{ background: "linear-gradient(135deg, #f0fdf4, #dcfce7)", border: "2px solid #6ee7b7", borderRadius: "18px", overflow: "visible" }}>

      {/* Header */}
      <div style={{ background: "linear-gradient(135deg, #059669, #34d399)", padding: "16px 20px", display: "flex", alignItems: "center", gap: "12px" }}>
        <div style={{ width: "42px", height: "42px", background: "rgba(255,255,255,0.2)", borderRadius: "12px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "22px" }}>🧪</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 800, fontSize: "16px", color: "#fff" }}>محاكاة تفاعلية</div>
          <div style={{ fontSize: "12px", color: "rgba(255,255,255,0.8)" }}>{simulation.role || "طالب"} · {steps.length} خطوات</div>
        </div>
        {!done && <div style={{ background: "rgba(255,255,255,0.2)", borderRadius: "20px", padding: "4px 14px", fontSize: "13px", color: "#fff", fontWeight: 700 }}>{step + 1}/{steps.length}</div>}
      </div>

      <div style={{ padding: "20px" }}>
        {/* Scenario */}
        <div style={{ background: "#fff", borderRadius: "12px", padding: "14px 16px", marginBottom: "16px", border: "1px solid #a7f3d0", display: "flex", gap: "10px" }}>
          <span style={{ fontSize: "18px", flexShrink: 0 }}>📋</span>
          <p style={{ margin: 0, fontSize: "14px", color: "#065f46", lineHeight: 1.7 }}>{simulation.scenario}</p>
        </div>

        {!done ? (
          <>
            {/* Progress bar */}
            <div style={{ display: "flex", gap: "4px", marginBottom: "18px" }}>
              {steps.map((_, i) => (
                <div key={i} style={{ flex: 1, height: "5px", borderRadius: "3px", background: i < step ? "#059669" : i === step ? "#34d399" : "#d1fae5", transition: "all 0.3s" }} />
              ))}
            </div>

            {/* Step card */}
            <div style={{ background: "#fff", borderRadius: "14px", padding: "20px", border: "1px solid #a7f3d0", marginBottom: "14px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "14px" }}>
                <div style={{ width: "30px", height: "30px", background: "linear-gradient(135deg, #059669, #34d399)", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "14px", fontWeight: 800, color: "#fff", flexShrink: 0 }}>{step + 1}</div>
                <div style={{ fontWeight: 700, fontSize: "16px", color: "#065f46" }}>{current?.title}</div>
              </div>

              <p style={{ margin: "0 0 16px", fontSize: "14px", color: "#374151", lineHeight: 1.8, background: "#f0fdf4", borderRadius: "10px", padding: "12px" }}>{current?.description}</p>

              <div style={{ fontWeight: 600, fontSize: "15px", color: "#065f46", marginBottom: "14px" }}>❓ {current?.question}</div>

              {/* CHOICE type */}
              {current?.type === "choice" && (
                <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                  {current.choices?.map((choice) => {
                    let bg = "#f9fafb", border = "2px solid #e5e7eb", color = "#374151";
                    if (feedback && selected === choice.id) {
                      bg = choice.correct ? "#d1fae5" : "#fee2e2";
                      border = `2px solid ${choice.correct ? "#6ee7b7" : "#fca5a5"}`;
                      color = choice.correct ? "#065f46" : "#991b1b";
                    } else if (feedback && choice.correct) {
                      bg = "#d1fae5"; border = "2px solid #6ee7b7"; color = "#065f46";
                    }
                    return (
                      <button key={choice.id} onClick={() => handleChoice(choice)} disabled={!!feedback}
                        style={{ display: "flex", alignItems: "center", gap: "12px", padding: "13px 16px", background: bg, border, borderRadius: "12px", cursor: feedback ? "default" : "pointer", textAlign: "right", transition: "all 0.2s", width: "100%" }}>
                        <div style={{ width: "28px", height: "28px", borderRadius: "50%", background: feedback && choice.correct ? "#059669" : feedback && selected === choice.id ? "#dc2626" : "#e5e7eb", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "13px", fontWeight: 700, color: feedback ? "#fff" : "#6b7280", flexShrink: 0 }}>
                          {feedback && choice.correct ? "✓" : feedback && selected === choice.id ? "✗" : choice.id.toUpperCase()}
                        </div>
                        <span style={{ fontSize: "14px", fontWeight: 500, color, flex: 1 }}>{choice.text}</span>
                      </button>
                    );
                  })}
                </div>
              )}

              {/* INPUT type */}
              {current?.type === "input" && (
                <div style={{ position: "relative", zIndex: 1 }}>
                  <textarea
                    value={inputVal}
                    onChange={(e) => { if (!feedback) setInputVal(e.target.value); }}
                    placeholder="اكتب إجابتك هنا..."
                    rows={4}
                    style={{ width: "100%", padding: "12px 14px", border: `2px solid ${feedback ? "#d1fae5" : "#a7f3d0"}`, borderRadius: "12px", fontSize: "14px", lineHeight: 1.7, resize: "none", fontFamily: "inherit", direction: "rtl", outline: "none", background: feedback ? "#f9fafb" : "#fff", color: "#1f2937", boxSizing: "border-box", display: "block" }}
                  />
                  {!feedback && (
                    <button onClick={handleInput} disabled={!inputVal.trim()}
                      style={{ marginTop: "10px", background: inputVal.trim() ? "linear-gradient(135deg, #059669, #34d399)" : "#e5e7eb", color: inputVal.trim() ? "#fff" : "#9ca3af", border: "none", borderRadius: "10px", padding: "10px 24px", fontWeight: 700, cursor: inputVal.trim() ? "pointer" : "default", fontSize: "14px" }}>
                      تحقق من الإجابة ✓
                    </button>
                  )}
                </div>
              )}

              {/* Feedback */}
              {feedback && (
                <div style={{ marginTop: "14px", background: feedback.correct ? "#d1fae5" : "#fee2e2", border: `1px solid ${feedback.correct ? "#6ee7b7" : "#fca5a5"}`, borderRadius: "12px", padding: "14px 16px", display: "flex", gap: "10px", alignItems: "flex-start" }}>
                  <span style={{ fontSize: "20px", flexShrink: 0 }}>{feedback.correct ? "🎉" : "💡"}</span>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: "14px", color: feedback.correct ? "#065f46" : "#991b1b", marginBottom: "4px" }}>{feedback.correct ? "إجابة صحيحة!" : "ليست الإجابة المثلى"}</div>
                    <div style={{ fontSize: "13px", color: feedback.correct ? "#047857" : "#b91c1c", lineHeight: 1.6 }}>{feedback.text}</div>
                  </div>
                </div>
              )}
            </div>

            {/* Hint */}
            {current?.hint && (
              <div style={{ marginBottom: "14px" }}>
                <button onClick={() => setShowHint(!showHint)}
                  style={{ background: "none", border: "1px dashed #6ee7b7", borderRadius: "8px", padding: "6px 14px", fontSize: "12px", color: "#059669", cursor: "pointer", fontWeight: 600 }}>
                  {showHint ? "🙈 إخفاء التلميح" : "💡 أحتاج تلميحاً"}
                </button>
                {showHint && (
                  <div style={{ marginTop: "8px", background: "#fef3c7", borderRadius: "10px", padding: "10px 14px", fontSize: "13px", color: "#92400e", border: "1px solid #fde68a" }}>
                    {current.hint}
                  </div>
                )}
              </div>
            )}

            {/* Next button - only shows after answering */}
            {feedback && (
              <button onClick={nextStep}
                style={{ width: "100%", background: "linear-gradient(135deg, #059669, #34d399)", color: "#fff", border: "none", borderRadius: "12px", padding: "13px", fontWeight: 700, cursor: "pointer", fontSize: "15px" }}>
                {step < steps.length - 1 ? `الخطوة التالية ← (${step + 2}/${steps.length})` : "عرض النتيجة النهائية 🏆"}
              </button>
            )}
          </>
        ) : (
          /* Results screen */
          <div style={{ background: "#fff", borderRadius: "16px", padding: "28px", textAlign: "center", border: "1px solid #6ee7b7" }}>
            <div style={{ fontSize: "56px", marginBottom: "12px" }}>{pct === 100 ? "🏆" : pct >= 75 ? "🌟" : pct >= 50 ? "👍" : "📚"}</div>
            <div style={{ fontWeight: 800, fontSize: "28px", color: "#059669", marginBottom: "4px" }}>{pct}%</div>
            <div style={{ fontSize: "14px", color: "#6b7280", marginBottom: "16px" }}>{score} من {steps.length} خطوات صحيحة</div>
            {simulation.outcome && (
              <div style={{ background: "#f0fdf4", borderRadius: "12px", padding: "14px", marginBottom: "20px", fontSize: "14px", color: "#065f46", lineHeight: 1.7, border: "1px solid #a7f3d0" }}>
                <strong>ما تعلمته:</strong> {simulation.outcome}
              </div>
            )}
            <button onClick={reset}
              style={{ background: "linear-gradient(135deg, #059669, #34d399)", color: "#fff", border: "none", borderRadius: "12px", padding: "12px 28px", fontWeight: 700, cursor: "pointer", fontSize: "15px" }}>
              🔄 إعادة المحاكاة
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Visual Card Component ──────────────────────────────────────────────────
function VisualCard({ card }) {
  const c = card.color || "#7c3aed";
  const light = c + "18";

  if (card.type === "comparison") {
    return (
      <div style={{ background: "#fff", borderRadius: "14px", border: `1px solid ${c}33`, overflow: "hidden", boxShadow: "0 2px 12px rgba(0,0,0,0.06)" }}>
        <div style={{ background: `linear-gradient(135deg, ${c}, ${c}cc)`, padding: "14px 20px", display: "flex", alignItems: "center", gap: "10px" }}>
          <span style={{ fontSize: "18px" }}>⚖️</span>
          <span style={{ fontWeight: 700, fontSize: "16px", color: "#fff" }}>{card.title}</span>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0" }}>
          <div style={{ padding: "16px 20px", borderLeft: `2px solid ${c}33` }}>
            <div style={{ fontWeight: 700, fontSize: "14px", color: c, marginBottom: "10px", textAlign: "center", background: light, borderRadius: "8px", padding: "6px" }}>{card.left?.label}</div>
            {card.left?.items?.map((item, i) => (
              <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: "8px", marginBottom: "8px", fontSize: "13px", color: "#374151" }}>
                <span style={{ color: c, fontWeight: 700, flexShrink: 0 }}>•</span>{item}
              </div>
            ))}
          </div>
          <div style={{ padding: "16px 20px" }}>
            <div style={{ fontWeight: 700, fontSize: "14px", color: c, marginBottom: "10px", textAlign: "center", background: light, borderRadius: "8px", padding: "6px" }}>{card.right?.label}</div>
            {card.right?.items?.map((item, i) => (
              <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: "8px", marginBottom: "8px", fontSize: "13px", color: "#374151" }}>
                <span style={{ color: c, fontWeight: 700, flexShrink: 0 }}>•</span>{item}
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (card.type === "steps") {
    return (
      <div style={{ background: "#fff", borderRadius: "14px", border: `1px solid ${c}33`, overflow: "hidden", boxShadow: "0 2px 12px rgba(0,0,0,0.06)" }}>
        <div style={{ background: `linear-gradient(135deg, ${c}, ${c}cc)`, padding: "14px 20px", display: "flex", alignItems: "center", gap: "10px" }}>
          <span style={{ fontSize: "18px" }}>📋</span>
          <span style={{ fontWeight: 700, fontSize: "16px", color: "#fff" }}>{card.title}</span>
        </div>
        <div style={{ padding: "16px 20px", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "12px" }}>
          {card.steps?.map((step, i) => (
            <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: "12px", background: light, borderRadius: "10px", padding: "12px" }}>
              <div style={{ width: "28px", height: "28px", background: c, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "13px", fontWeight: 800, color: "#fff", flexShrink: 0 }}>{step.num}</div>
              <span style={{ fontSize: "13px", color: "#374151", lineHeight: 1.6, flex: 1 }}>{step.text}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Default: diagram (list)
  return (
    <div style={{ background: "#fff", borderRadius: "14px", border: `1px solid ${c}33`, overflow: "hidden", boxShadow: "0 2px 12px rgba(0,0,0,0.06)" }}>
      <div style={{ background: `linear-gradient(135deg, ${c}, ${c}cc)`, padding: "14px 20px", display: "flex", alignItems: "center", gap: "10px" }}>
        <span style={{ fontSize: "18px" }}>🔷</span>
        <span style={{ fontWeight: 700, fontSize: "16px", color: "#fff" }}>{card.title}</span>
      </div>
      <div style={{ padding: "16px 20px" }}>
        {card.description && <p style={{ margin: "0 0 14px", fontSize: "14px", color: "#555", lineHeight: 1.7, background: light, borderRadius: "8px", padding: "10px 14px" }}>{card.description}</p>}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "10px" }}>
          {card.items?.map((item, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: "10px", background: light, borderRadius: "10px", padding: "10px 14px" }}>
              <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: c, flexShrink: 0 }} />
              <span style={{ fontSize: "13px", color: "#374151", fontWeight: 500 }}>{item}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Lesson Intro ───────────────────────────────────────────────────────────
function LessonIntro({ lesson, summary, questionsCount, onStart, images, imageCards, video, simulation }) {
  if (simulation) console.log("✅ Simulation received:", simulation.steps?.length, "steps");
  return (
    <div style={s.introWrap}>
      {/* ── العمود الرئيسي ── */}
      <div style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
        {lesson.objectives?.length > 0 && (
          <div style={s.block}>
            <div style={s.blockHeader}>
              <span style={s.blockHeaderIcon}>🎯</span>
              <span style={s.blockHeaderTitle}>أهداف الدرس</span>
            </div>
            <ul style={s.objList}>
              {lesson.objectives.map((o, i) => (
                <li key={i} style={s.objItem}>
                  <span style={s.objDot} />
                  {o}
                </li>
              ))}
            </ul>
          </div>
        )}

        {lesson.sections?.map((sec, i) => (
          <div key={i} style={s.sectionBlock}>
            <div style={s.sectionHeadingWrap}>
              <div style={s.sectionLine} />
              <h3 style={s.sectionHeading}>{sec.heading}</h3>
            </div>
            <p style={s.sectionContent}>{sec.content}</p>
          </div>
        ))}

        {/* ── بطاقات توضيحية ── */}
        {imageCards?.length > 0 && (
          <div style={s.block}>
            <div style={s.blockHeader}>
              <span style={s.blockHeaderIcon}>🖼️</span>
              <span style={s.blockHeaderTitle}>بطاقات توضيحية تفاعلية</span>
              <span style={{ marginRight: "auto", fontSize: "11px", color: "#9ca3af", background: "#f3f4f6", borderRadius: "6px", padding: "2px 8px" }}>Claude AI</span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              {imageCards.map((card, i) => (
                <VisualCard key={i} card={card} />
              ))}
            </div>
          </div>
        )}

        {/* ── صور SVG قديمة (fallback) ── */}
        {!imageCards && images?.length > 0 && (
          <div style={s.block}>
            <div style={s.blockHeader}>
              <span style={s.blockHeaderIcon}>🖼️</span>
              <span style={s.blockHeaderTitle}>رسوم توضيحية</span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              {images.map((src, i) => {
                if (typeof src !== "string" || !src.includes("<svg")) return null;
                const responsive = src.replace(/<svg([^>]*)>/, (match, attrs) => {
                  const cleaned = attrs.replace(/\s*width=["'][^"']*["']/g,"").replace(/\s*height=["'][^"']*["']/g,"");
                  return `<svg${cleaned} width="100%" height="100%" style="display:block">`;
                });
                return (
                  <div key={i} style={{ borderRadius: "14px", border: "1px solid #e8eaf6", background: "#fff", overflow: "hidden", aspectRatio: "7/4" }}
                    dangerouslySetInnerHTML={{ __html: responsive }} />
                );
              })}
            </div>
          </div>
        )}

        {/* ── فيديو تعليمي ── */}
        {video && (
          <div style={s.block}>
            <div style={s.blockHeader}>
              <span style={s.blockHeaderIcon}>🎬</span>
              <span style={s.blockHeaderTitle}>فيديو تعليمي مقترح</span>
            </div>
            <a href={video.url} target="_blank" rel="noreferrer"
              style={{ display: "flex", alignItems: "center", gap: "14px", padding: "16px", background: "#fee2e2", borderRadius: "12px", textDecoration: "none", border: "1px solid #fca5a5" }}>
              <div style={{ width: "52px", height: "52px", background: "#dc2626", borderRadius: "12px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "24px", flexShrink: 0 }}>▶️</div>
              <div>
                <div style={{ fontWeight: 700, fontSize: "14px", color: "#dc2626", marginBottom: "4px" }}>ابحث على YouTube</div>
                <div style={{ fontSize: "13px", color: "#555" }}>{video.searchQuery}</div>
              </div>
              <div style={{ marginRight: "auto", fontSize: "20px", color: "#dc2626" }}>←</div>
            </a>
          </div>
        )}

        {/* ── محاكاة تفاعلية ── */}
        {simulation && <SimulationBlock simulation={simulation} />}
      </div>

      {/* ── الـ Sidebar ── */}
      <div style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
        {/* CTA */}
        <div style={s.ctaBlock}>
          <p style={s.ctaTitle}>هل أنت مستعد؟</p>
          <p style={s.ctaSub}>{questionsCount} أسئلة · تغذية راجعة فورية</p>
          <button style={{ ...s.startBtn, width: "100%", marginTop: "16px" }} onClick={onStart}>ابدأ الاختبار 🚀</button>
        </div>

        {/* Summary */}
        <div style={s.summaryBlock}>
          <div style={s.blockHeader}>
            <span style={s.blockHeaderIcon}>📋</span>
            <span style={s.blockHeaderTitle}>الملخص</span>
          </div>
          <p style={s.summaryText}>{summary}</p>
        </div>

        {/* Key Terms */}
        {lesson.keyTerms?.length > 0 && (
          <div style={s.block}>
            <div style={s.blockHeader}>
              <span style={s.blockHeaderIcon}>📚</span>
              <span style={s.blockHeaderTitle}>المصطلحات</span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {lesson.keyTerms.map((t, i) => (
                <div key={i} style={s.termCard}>
                  <span style={s.termWord}>{t.term}</span>
                  <span style={s.termDef}>{t.definition}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main Export ────────────────────────────────────────────────────────────
// ── Audio Reader Hook ──────────────────────────────────────────────────────
function useAudioReader(lesson, summary) {
  const [speaking, setSpeaking] = useState(false);
  const [supported] = useState(() => "speechSynthesis" in window);

  const buildText = () => {
    const parts = [];
    parts.push(`درس: ${lesson.title}.`);
    if (lesson.objectives?.length) {
      parts.push("أهداف الدرس:");
      lesson.objectives.forEach((o, i) => parts.push(`${i + 1}. ${o}`));
    }
    lesson.sections?.forEach(sec => {
      parts.push(`${sec.heading}.`);
      parts.push(sec.content);
    });
    if (summary) parts.push(`الملخص: ${summary}`);
    return parts.join(" ");
  };

  const toggle = () => {
    if (!supported) return;
    if (speaking) {
      window.speechSynthesis.cancel();
      setSpeaking(false);
      return;
    }
    const text = buildText();
    const utt = new SpeechSynthesisUtterance(text);
    utt.lang = "ar-SA";
    utt.rate = 0.9;
    utt.pitch = 1;
    // Try to pick an Arabic voice
    const voices = window.speechSynthesis.getVoices();
    const arVoice = voices.find(v => v.lang.startsWith("ar"));
    if (arVoice) utt.voice = arVoice;
    utt.onend = () => setSpeaking(false);
    utt.onerror = () => setSpeaking(false);
    window.speechSynthesis.speak(utt);
    setSpeaking(true);
  };

  // Stop on unmount
  useEffect(() => () => { window.speechSynthesis?.cancel(); }, []);

  return { speaking, toggle, supported };
}

export default function LessonPage({ lessonData, onClose }) {
  const { lesson, summary, quiz: questions, images, imageCards, video, simulation, conceptMap } = lessonData;
  
  console.log("LessonPage:", { hasSimulation: !!simulation, simSteps: simulation?.steps?.length, hasImageCards: !!imageCards });
  const [phase, setPhase] = useState("intro");
  const [current, setCurrent] = useState(0);
  const [answers, setAnswers] = useState([]);
  const [streak, setStreak] = useState(0);
  const { speaking, toggle, supported } = useAudioReader(lesson, summary);

  const handleAnswer = (correct) => {
    const next = [...answers, correct];
    setAnswers(next);
    setStreak(correct ? streak + 1 : 0);
    if (current + 1 < questions.length) setCurrent(current + 1);
    else setPhase("results");
  };

  const handleRetry = () => {
    window.speechSynthesis?.cancel();
    setCurrent(0); setAnswers([]); setStreak(0); setPhase("intro");
  };

  return (
    <div style={s.page}>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes fadeSlide { from { opacity:0; transform:translateY(16px); } to { opacity:1; transform:translateY(0); } }
        @keyframes soundWave { 0%,100%{transform:scaleY(1)} 50%{transform:scaleY(1.6)} }
        @media (max-width: 768px) { .lesson-intro-grid { grid-template-columns: 1fr !important; } }
      `}</style>

      {/* Header */}
      <div style={s.header}>
        <div style={s.headerInner}>
          <div style={s.headerIconWrap}>🎓</div>
          <div style={{ minWidth: 0 }}>
            <h1 style={s.headerTitle}>{lesson.title}</h1>
            <p style={s.headerSub}>
              {phase === "intro" && `درس تفاعلي · ${questions.length} أسئلة`}
              {phase === "quiz" && `السؤال ${current + 1} من ${questions.length}`}
              {phase === "results" && `النتائج النهائية`}
            </p>
          </div>
        </div>
        <div style={s.headerRight}>
          {/* Audio button - only on intro phase */}
          {phase === "intro" && supported && (
            <button
              onClick={toggle}
              title={speaking ? "إيقاف القراءة" : "قراءة الدرس صوتياً"}
              style={{
                display: "flex", alignItems: "center", gap: "7px",
                background: speaking ? "rgba(239,68,68,0.25)" : "rgba(255,255,255,0.15)",
                border: `1px solid ${speaking ? "rgba(239,68,68,0.6)" : "rgba(255,255,255,0.3)"}`,
                color: "#fff", borderRadius: "10px", padding: "7px 14px",
                fontSize: "13px", fontWeight: 700, cursor: "pointer", transition: "all 0.2s",
              }}>
              {speaking ? (
                <>
                  <span style={{ display: "flex", gap: "2px", alignItems: "center" }}>
                    {[1,1.6,1,1.8,1].map((h, i) => (
                      <span key={i} style={{ display: "inline-block", width: "3px", height: "14px", background: "#fff", borderRadius: "2px", animation: `soundWave 0.8s ease-in-out ${i * 0.1}s infinite`, transformOrigin: "center" }} />
                    ))}
                  </span>
                  إيقاف
                </>
              ) : (
                <> 🔊 استمع للدرس </>
              )}
            </button>
          )}
          {phase !== "intro" && (
            <button style={s.headerPhaseBtn} onClick={handleRetry}>↩ البداية</button>
          )}
          {onClose && <button style={s.headerClose} onClick={onClose} aria-label="إغلاق">✕</button>}
        </div>
      </div>

      {/* Phase tabs */}
      <div style={s.phaseTabs}>
        {[
          { key: "intro", label: "📖 الدرس" },
          { key: "map", label: "🗺️ خريطة المفاهيم" },
          { key: "quiz", label: "✏️ الاختبار" },
          { key: "results", label: "🏆 النتائج" },
        ].map(({ key, label }) => (
          <div key={key} onClick={() => { if (key !== "results" || phase === "results") setPhase(key); }}
            style={{ ...s.phaseTab, ...(phase === key ? s.phaseTabActive : {}), cursor: key === "results" && phase !== "results" ? "default" : "pointer", opacity: key === "results" && phase !== "results" ? 0.4 : 1 }}>
            {label}
          </div>
        ))}
      </div>

      {/* Content */}
      <div style={s.content}>
        {phase === "intro" && (
          <LessonIntro key={JSON.stringify({hasImages: !!images, hasCards: !!imageCards, hasSim: !!simulation})} lesson={lesson} summary={summary} questionsCount={questions.length} onStart={() => setPhase("quiz")} images={images} imageCards={imageCards} video={video} simulation={simulation} />
        )}
        {phase === "map" && (
          <div style={{ maxWidth: "900px", margin: "0 auto", animation: "fadeSlide 0.4s ease" }}>
            <div style={{ background: "#fff", borderRadius: "16px", padding: "24px", boxShadow: "0 2px 12px rgba(0,0,0,0.06)", border: "1px solid #e8eaf6" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "20px" }}>
                <div style={{ width: "40px", height: "40px", background: "linear-gradient(135deg, #1a237e, #7c3aed)", borderRadius: "12px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "20px" }}>🗺️</div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: "17px", color: "#1a237e" }}>خريطة المفاهيم</div>
                  <div style={{ fontSize: "12px", color: "#9ca3af" }}>العلاقات بين مفاهيم الدرس</div>
                </div>
              </div>
              {conceptMap ? (
                <div style={{ width: "100%", borderRadius: "12px", overflow: "hidden", border: "1px solid #e8eaf6", background: "#f8f9ff" }}
                  dangerouslySetInnerHTML={{
                    __html: conceptMap.replace(/<svg([^>]*)>/, (m, attrs) => {
                      const cleaned = attrs
                        .replace(/\s*width=["'][^"']*["']/g, "")
                        .replace(/\s*height=["'][^"']*["']/g, "");
                      return `<svg${cleaned} width="100%" style="display:block;max-width:100%">`;
                    })
                  }} />
              ) : (
                <div style={{ textAlign: "center", padding: "48px", color: "#9ca3af" }}>
                  <div style={{ fontSize: "48px", marginBottom: "12px" }}>🗺️</div>
                  <p>لم يتم توليد خريطة المفاهيم</p>
                </div>
              )}
            </div>
          </div>
        )}
        {phase === "quiz" && (
          <div style={s.quizWrap}>
            <QuestionCard key={current} question={questions[current]} index={current} total={questions.length} onAnswer={handleAnswer} streak={streak} />
          </div>
        )}
        {phase === "results" && (
          <Results questions={questions} answers={answers} onRetry={handleRetry} onClose={onClose} />
        )}
      </div>
    </div>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────
const s = {
  page: { display: "flex", flexDirection: "column", height: "100%", fontFamily: "'Segoe UI', Tahoma, Arial, sans-serif", direction: "rtl", background: "#f0f4ff", overflow: "hidden" },

  // Header
  header: { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 32px", background: "linear-gradient(135deg, #0d1b6e, #1a237e, #7c3aed)", color: "#fff", flexShrink: 0 },
  headerInner: { display: "flex", alignItems: "center", gap: "16px", minWidth: 0, flex: 1 },
  headerIconWrap: { fontSize: "28px", flexShrink: 0, background: "rgba(255,255,255,0.15)", borderRadius: "12px", width: "52px", height: "52px", display: "flex", alignItems: "center", justifyContent: "center" },
  headerTitle: { margin: 0, fontSize: "18px", fontWeight: 700, color: "#fff", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  headerSub: { margin: "3px 0 0", fontSize: "13px", color: "rgba(255,255,255,0.7)" },
  headerRight: { display: "flex", gap: "8px", alignItems: "center", flexShrink: 0 },
  headerPhaseBtn: { background: "rgba(255,255,255,0.15)", border: "1px solid rgba(255,255,255,0.3)", color: "#fff", borderRadius: "8px", padding: "7px 14px", fontSize: "13px", cursor: "pointer", fontWeight: 600 },
  headerClose: { background: "rgba(255,255,255,0.15)", border: "none", color: "#fff", borderRadius: "8px", padding: "7px 12px", cursor: "pointer", fontSize: "14px" },

  // Phase tabs
  phaseTabs: { display: "flex", background: "#fff", borderBottom: "2px solid #e8eaf6", flexShrink: 0, padding: "0 32px" },
  phaseTab: { flex: "0 0 auto", textAlign: "center", padding: "14px 28px", fontSize: "14px", fontWeight: 500, color: C.gray, borderBottom: "3px solid transparent", marginBottom: "-2px", transition: "all 0.2s" },
  phaseTabActive: { color: C.purple, borderBottom: `3px solid ${C.purple}`, fontWeight: 700 },

  content: { flex: 1, overflowY: "auto", padding: "28px 32px" },

  // Intro - two column layout
  introWrap: { display: "grid", gridTemplateColumns: "minmax(0,1fr) 320px", gap: "24px", maxWidth: "1300px", margin: "0 auto", animation: "fadeSlide 0.4s ease", alignItems: "start" },

  block: { background: "#fff", border: "1px solid #e8eaf6", borderRadius: "14px", padding: "22px", boxShadow: "0 2px 8px rgba(0,0,0,0.04)" },
  blockHeader: { display: "flex", alignItems: "center", gap: "8px", marginBottom: "16px" },
  blockHeaderIcon: { fontSize: "20px" },
  blockHeaderTitle: { fontWeight: 700, fontSize: "16px", color: C.navy },

  objList: { listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: "10px" },
  objItem: { display: "flex", alignItems: "flex-start", gap: "12px", fontSize: "15px", lineHeight: 1.7, color: "#444" },
  objDot: { width: "9px", height: "9px", borderRadius: "50%", background: C.purple, flexShrink: 0, marginTop: "8px" },

  sectionBlock: { background: "#fff", border: "1px solid #e8eaf6", borderRadius: "14px", padding: "22px", boxShadow: "0 2px 8px rgba(0,0,0,0.04)" },
  sectionHeadingWrap: { display: "flex", alignItems: "center", gap: "12px", marginBottom: "12px" },
  sectionLine: { width: "5px", height: "24px", background: `linear-gradient(180deg, ${C.navy}, ${C.purple})`, borderRadius: "4px", flexShrink: 0 },
  sectionHeading: { margin: 0, fontSize: "16px", fontWeight: 700, color: C.navy },
  sectionContent: { margin: 0, fontSize: "14px", lineHeight: 2, color: "#444" },

  termsGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: "10px" },
  termCard: { background: C.purpleLight, border: `1px solid ${C.purpleBorder}`, borderRadius: "10px", padding: "14px 16px", display: "flex", flexDirection: "column", gap: "6px" },
  termWord: { fontWeight: 700, fontSize: "14px", color: C.purple },
  termDef: { fontSize: "13px", color: "#555", lineHeight: 1.6 },

  summaryBlock: { background: "linear-gradient(135deg, #faf5ff, #ede9fe)", border: `1px solid ${C.purpleBorder}`, borderRadius: "14px", padding: "22px" },
  summaryText: { margin: "8px 0 0", fontSize: "14px", lineHeight: 2, color: "#333" },

  ctaBlock: { background: "linear-gradient(135deg, #0d1b6e, #7c3aed)", borderRadius: "14px", padding: "28px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "20px", flexWrap: "wrap" },
  ctaLeft: {},
  ctaTitle: { margin: "0 0 8px", fontSize: "18px", fontWeight: 700, color: "#fff" },
  ctaSub: { margin: 0, fontSize: "14px", color: "rgba(255,255,255,0.75)" },
  startBtn: { background: "#fff", color: C.purple, border: "none", borderRadius: "12px", padding: "14px 32px", fontSize: "16px", fontWeight: 700, cursor: "pointer", flexShrink: 0, boxShadow: "0 4px 14px rgba(0,0,0,0.15)" },

  // Quiz
  quizWrap: { maxWidth: "720px", margin: "0 auto", animation: "fadeSlide 0.4s ease" },
  progressWrap: { marginBottom: "24px" },
  progressMeta: { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "10px" },
  progressLabel: { fontSize: "14px", color: C.gray, fontWeight: 500 },
  progressPct: { fontSize: "14px", color: C.purple, fontWeight: 700 },
  streakBadge: { background: C.goldLight, color: "#92400e", borderRadius: "20px", padding: "3px 12px", fontSize: "13px", fontWeight: 700 },
  progressTrack: { height: "10px", background: C.grayBorder, borderRadius: "99px", overflow: "hidden" },
  progressFill: { height: "100%", background: `linear-gradient(90deg, ${C.navy}, ${C.purple})`, borderRadius: "99px", transition: "width 0.5s ease" },

  qCard: { background: "#fff", border: "1px solid #e8eaf6", borderRadius: "18px", padding: "28px", boxShadow: "0 8px 32px rgba(0,0,0,0.08)" },
  qBubble: { background: C.navyLight, borderRadius: "14px", padding: "18px 22px", marginBottom: "22px", display: "flex", gap: "14px", alignItems: "flex-start" },
  qNumBadge: { background: C.navy, color: "#fff", borderRadius: "8px", padding: "4px 12px", fontSize: "13px", fontWeight: 700, flexShrink: 0, marginTop: "2px" },
  qText: { margin: 0, fontSize: "17px", fontWeight: 600, color: C.navy, lineHeight: 1.7, flex: 1 },

  optionsGrid: { display: "flex", flexDirection: "column", gap: "12px", marginBottom: "18px" },
  optBtn: { display: "flex", alignItems: "center", gap: "14px", width: "100%", textAlign: "right", padding: "15px 18px", borderRadius: "12px", fontSize: "15px", fontWeight: 500, background: "#f8f9ff", border: `2px solid ${C.grayBorder}`, color: "#1f2937", transition: "all 0.2s" },
  optLetter: { fontSize: "18px", fontWeight: 700, flexShrink: 0, width: "22px", textAlign: "center" },

  feedback: { display: "flex", gap: "14px", alignItems: "flex-start", borderRadius: "14px", padding: "16px 18px", marginBottom: "16px" },
  nextBtn: { display: "block", width: "100%", padding: "15px", background: `linear-gradient(135deg, ${C.navy}, ${C.purple})`, color: "#fff", border: "none", borderRadius: "14px", fontSize: "16px", fontWeight: 700, cursor: "pointer" },

  // Results
  resultsWrap: { maxWidth: "700px", margin: "0 auto", display: "flex", flexDirection: "column", gap: "24px", alignItems: "center", animation: "fadeSlide 0.4s ease" },
  scoreCircleWrap: { position: "relative", width: "180px", height: "180px" },
  scoreCircleInner: { position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "4px" },
  gradeBadge: { borderRadius: "24px", padding: "10px 28px", fontSize: "18px", fontWeight: 700 },
  reviewWrap: { width: "100%", display: "flex", flexDirection: "column", gap: "12px" },
  reviewTitle: { margin: "0 0 8px", fontWeight: 700, fontSize: "16px", color: C.navy, width: "100%" },
  reviewItem: { background: "#fff", border: "1px solid #e8eaf6", borderRadius: "12px", padding: "16px 18px", paddingRight: "20px" },
  reviewBadge: { borderRadius: "6px", padding: "3px 10px", fontSize: "12px", fontWeight: 700, flexShrink: 0, marginTop: "2px" },
  reviewQ: { margin: 0, fontSize: "14px", color: "#333", flex: 1, lineHeight: 1.6 },
  reviewAnswer: { margin: "10px 0 0", fontSize: "13px", color: C.gray },
  resultActions: { display: "flex", gap: "12px", width: "100%" },
  retryBtn: { flex: 1, padding: "15px", background: `linear-gradient(135deg, ${C.navy}, ${C.purple})`, color: "#fff", border: "none", borderRadius: "14px", fontSize: "16px", fontWeight: 700, cursor: "pointer" },
  closeResultBtn: { padding: "15px 24px", background: C.grayLight, color: C.gray, border: "none", borderRadius: "14px", fontSize: "15px", fontWeight: 600, cursor: "pointer" },
};
