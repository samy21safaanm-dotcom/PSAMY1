import React, { useState, useEffect, useRef } from "react";
import LessonPage from "./LessonPage";

// ── Helpers ────────────────────────────────────────────────────────────────
function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
function formatDate(d) {
  if (!d) return "";
  return new Date(d).toLocaleDateString("ar-SA", { year: "numeric", month: "short", day: "numeric" });
}

// ── Spinner ────────────────────────────────────────────────────────────────
function Spinner({ small }) {
  const size = small ? "14px" : "24px";
  return (
    <div style={{ width: size, height: size, border: "2px solid rgba(255,255,255,0.3)", borderTop: "2px solid #fff", borderRadius: "50%", animation: "spin 0.8s linear infinite", display: "inline-block", flexShrink: 0 }} />
  );
}

// ── SCORM Export ───────────────────────────────────────────────────────────
function generateSCORM(lessonData) {
  const { lesson, summary, quiz } = lessonData;

  const questionsHTML = quiz.map((q, i) => `
    <div class="question" id="q${i}">
      <p class="q-text"><strong>س${i + 1}:</strong> ${q.question}</p>
      <div class="options">
        ${q.options.map((opt, j) => `
          <label class="option">
            <input type="radio" name="q${i}" value="${j}" onchange="checkAnswer(${i}, ${j}, '${q.answer.replace(/'/g, "\\'")}')">
            <span>${opt}</span>
          </label>
        `).join("")}
      </div>
      <div class="feedback" id="fb${i}" style="display:none"></div>
    </div>
  `).join("");

  const sectionsHTML = lesson.sections?.map(sec => `
    <div class="section">
      <h3>${sec.heading}</h3>
      <p>${sec.content}</p>
    </div>
  `).join("") || "";

  const objectivesHTML = lesson.objectives?.map(o => `<li>${o}</li>`).join("") || "";
  const keyTermsHTML = lesson.keyTerms?.map(t => `
    <div class="term-row"><strong>${t.term}:</strong> ${t.definition}</div>
  `).join("") || "";

  const indexHTML = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
<meta charset="UTF-8"/>
<title>${lesson.title}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Segoe UI', Tahoma, Arial, sans-serif; direction: rtl; background: #f0f4ff; color: #1a1a2e; }
  .header { background: linear-gradient(135deg, #1a237e, #7c3aed); color: white; padding: 24px 32px; text-align: center; }
  .header h1 { font-size: 22px; margin-bottom: 6px; }
  .header p { font-size: 13px; opacity: 0.8; }
  .container { max-width: 860px; margin: 24px auto; padding: 0 16px; }
  .card { background: white; border-radius: 14px; padding: 24px; margin-bottom: 20px; box-shadow: 0 2px 12px rgba(0,0,0,0.07); }
  .card h2 { color: #1a237e; font-size: 16px; margin-bottom: 14px; border-bottom: 2px solid #e8eaf6; padding-bottom: 8px; }
  .objectives ul { padding-right: 20px; }
  .objectives li { line-height: 2; font-size: 14px; color: #444; }
  .section { border-right: 3px solid #7c3aed; padding-right: 14px; margin-bottom: 16px; }
  .section h3 { color: #1a237e; font-size: 15px; margin-bottom: 6px; }
  .section p { font-size: 14px; line-height: 1.8; color: #444; }
  .term-row { padding: 8px 12px; background: #f8f9ff; border-radius: 8px; margin-bottom: 8px; font-size: 14px; }
  .summary-text { font-size: 14px; line-height: 1.9; color: #333; }
  .question { background: #f8f9ff; border-radius: 12px; padding: 18px; margin-bottom: 16px; border: 1px solid #e8eaf6; }
  .q-text { font-size: 15px; font-weight: 600; color: #1a237e; margin-bottom: 14px; }
  .options { display: flex; flex-direction: column; gap: 10px; }
  .option { display: flex; align-items: center; gap: 10px; padding: 10px 14px; background: white; border: 2px solid #e8eaf6; border-radius: 10px; cursor: pointer; font-size: 14px; transition: all 0.2s; }
  .option:hover { border-color: #7c3aed; background: #f5f3ff; }
  .feedback { margin-top: 12px; padding: 12px; border-radius: 8px; font-size: 13px; font-weight: 600; }
  .correct { background: #d1fae5; color: #059669; border: 1px solid #6ee7b7; }
  .wrong { background: #fee2e2; color: #dc2626; border: 1px solid #fca5a5; }
  #score-section { text-align: center; padding: 30px; }
  #score-section h2 { font-size: 28px; color: #7c3aed; }
  #score-section p { font-size: 16px; color: #555; margin-top: 8px; }
  .submit-btn { display: block; width: 100%; padding: 14px; background: linear-gradient(135deg, #1a237e, #7c3aed); color: white; border: none; border-radius: 12px; font-size: 16px; font-weight: 700; cursor: pointer; margin-top: 10px; }
</style>
</head>
<body>
<div class="header">
  <h1>🎓 ${lesson.title}</h1>
  <p>درس تفاعلي - جامعة القصيم | الكلية التطبيقية</p>
</div>
<div class="container">
  ${objectivesHTML ? `<div class="card objectives"><h2>🎯 أهداف الدرس</h2><ul>${objectivesHTML}</ul></div>` : ""}
  ${sectionsHTML ? `<div class="card"><h2>📖 محتوى الدرس</h2>${sectionsHTML}</div>` : ""}
  ${keyTermsHTML ? `<div class="card"><h2>📚 المصطلحات الرئيسية</h2>${keyTermsHTML}</div>` : ""}
  <div class="card"><h2>📋 الملخص</h2><p class="summary-text">${summary}</p></div>
  <div class="card">
    <h2>✏️ اختبر نفسك</h2>
    <div id="quiz">${questionsHTML}</div>
    <button class="submit-btn" onclick="submitQuiz()">إرسال الإجابات 🚀</button>
    <div id="score-section" style="display:none"></div>
  </div>
</div>
<script>
var answers = {};
var total = ${quiz.length};
function checkAnswer(qIndex, optIndex, correct) {
  answers[qIndex] = { selected: optIndex, correct: correct };
}
function submitQuiz() {
  var score = 0;
  for (var i = 0; i < total; i++) {
    var fb = document.getElementById('fb' + i);
    fb.style.display = 'block';
    if (answers[i]) {
      var opts = document.querySelectorAll('#q' + i + ' .option');
      var selectedOpt = opts[answers[i].selected];
      var selectedText = selectedOpt ? selectedOpt.querySelector('span').textContent : '';
      if (selectedText === answers[i].correct) {
        score++;
        fb.className = 'feedback correct';
        fb.textContent = '✓ إجابة صحيحة!';
      } else {
        fb.className = 'feedback wrong';
        fb.textContent = '✗ الإجابة الصحيحة: ' + answers[i].correct;
      }
    } else {
      fb.className = 'feedback wrong';
      fb.textContent = '✗ لم تجب على هذا السؤال';
    }
  }
  var pct = Math.round((score / total) * 100);
  document.getElementById('score-section').style.display = 'block';
  document.getElementById('score-section').innerHTML = '<h2>' + pct + '%</h2><p>' + score + ' من ' + total + ' إجابة صحيحة</p>';
  document.querySelector('.submit-btn').style.display = 'none';
  if (typeof API !== 'undefined' && API) {
    try { API.LMSSetValue('cmi.core.score.raw', pct); API.LMSSetValue('cmi.core.lesson_status', pct >= 60 ? 'passed' : 'failed'); API.LMSCommit(''); } catch(e) {}
  }
}
</script>
</body>
</html>`;

  const manifest = `<?xml version="1.0" encoding="UTF-8"?>
<manifest identifier="ai-lesson" version="1.0"
  xmlns="http://www.imsproject.org/xsd/imscp_rootv1p1p2"
  xmlns:adlcp="http://www.adlnet.org/xsd/adlcp_rootv1p2">
  <metadata><schema>ADL SCORM</schema><schemaversion>1.2</schemaversion></metadata>
  <organizations default="org1">
    <organization identifier="org1">
      <title>${lesson.title}</title>
      <item identifier="item1" identifierref="res1">
        <title>${lesson.title}</title>
      </item>
    </organization>
  </organizations>
  <resources>
    <resource identifier="res1" type="webcontent" adlcp:scormtype="sco" href="index.html">
      <file href="index.html"/>
    </resource>
  </resources>
</manifest>`;

  return { indexHTML, manifest };
}

async function downloadSCORM(lessonData) {
  const { default: JSZip } = await import("https://cdn.jsdelivr.net/npm/jszip@3.10.1/+esm");
  const { indexHTML, manifest } = generateSCORM(lessonData);
  const zip = new JSZip();
  zip.file("imsmanifest.xml", manifest);
  zip.file("index.html", indexHTML);
  const blob = await zip.generateAsync({ type: "blob" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${lessonData.lesson.title || "lesson"}-scorm.zip`;
  a.click();
  URL.revokeObjectURL(url);
}

// ── Enrich Options Panel ───────────────────────────────────────────────────
function EnrichPanel({ options, onChange }) {
  const items = [
    {
      key: "images",
      icon: "🖼️",
      title: "صور توضيحية",
      desc: "صور مرتبطة بمحتوى الدرس تلقائياً",
      color: "#7c3aed",
      gradient: "linear-gradient(135deg, #7c3aed, #a78bfa)",
      bg: "#faf5ff",
    },
    {
      key: "video",
      icon: "🎬",
      title: "فيديو تعليمي",
      desc: "بحث YouTube بعنوان الدرس",
      color: "#dc2626",
      gradient: "linear-gradient(135deg, #dc2626, #f87171)",
      bg: "#fff5f5",
    },
    {
      key: "simulation",
      icon: "🧪",
      title: "محاكاة تفاعلية",
      desc: "سيناريو تطبيقي بالذكاء الاصطناعي",
      color: "#059669",
      gradient: "linear-gradient(135deg, #059669, #34d399)",
      bg: "#f0fdf4",
    },
  ];

  const selectedCount = Object.values(options).filter(Boolean).length;

  return (
    <div style={ep.wrap}>
      {/* Header */}
      <div style={ep.header}>
        <div style={ep.headerIcon}>✨</div>
        <div style={{ flex: 1 }}>
          <div style={ep.title}>إثراء محتوى الدرس</div>
          <div style={ep.sub}>اختر عناصر إضافية لتعزيز التجربة التعليمية</div>
        </div>
        {selectedCount > 0 && (
          <div style={ep.selectedBadge}>{selectedCount} مختار</div>
        )}
      </div>

      {/* Cards grid */}
      <div style={ep.grid}>
        {items.map(({ key, icon, title, desc, color, gradient, bg }) => {
          const checked = options[key];
          return (
            <label key={key} style={{ ...ep.card, ...(checked ? { background: bg, borderColor: color, boxShadow: `0 4px 16px ${color}22` } : {}) }}>
              <input type="checkbox" checked={checked} onChange={() => onChange({ ...options, [key]: !checked })} style={{ display: "none" }} />

              {/* Icon */}
              <div style={{ ...ep.iconWrap, background: checked ? gradient : "#f3f4f6" }}>
                <span style={{ fontSize: "22px" }}>{icon}</span>
              </div>

              {/* Text */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: "14px", color: checked ? color : "#374151", marginBottom: "3px" }}>{title}</div>
                <div style={{ fontSize: "12px", color: "#9ca3af", lineHeight: 1.5 }}>{desc}</div>
              </div>

              {/* Toggle */}
              <div style={{ ...ep.toggle, background: checked ? gradient : "#e5e7eb" }}>
                <div style={{ ...ep.toggleDot, transform: checked ? "translateX(-20px)" : "translateX(0)" }} />
              </div>
            </label>
          );
        })}
      </div>

      {selectedCount > 0 && (
        <div style={ep.hint}>
          <span style={{ fontSize: "14px" }}>💡</span>
          سيتم إضافة {[options.images && "الصور", options.video && "الفيديو", options.simulation && "المحاكاة"].filter(Boolean).join(" و ")} تلقائياً داخل الدرس
        </div>
      )}
    </div>
  );
}

const ep = {
  wrap: { background: "#fff", border: "1px solid #e8eaf6", borderRadius: "20px", padding: "22px", marginBottom: "20px", boxShadow: "0 2px 12px rgba(0,0,0,0.05)" },
  header: { display: "flex", alignItems: "center", gap: "12px", marginBottom: "18px" },
  headerIcon: { width: "40px", height: "40px", background: "linear-gradient(135deg, #1a237e, #7c3aed)", borderRadius: "12px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "18px", flexShrink: 0 },
  title: { fontWeight: 700, fontSize: "15px", color: "#1a237e" },
  sub: { fontSize: "12px", color: "#9ca3af", marginTop: "2px" },
  selectedBadge: { background: "linear-gradient(135deg, #1a237e, #7c3aed)", color: "#fff", borderRadius: "20px", padding: "4px 12px", fontSize: "12px", fontWeight: 700, flexShrink: 0 },
  grid: { display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "12px" },
  card: { display: "flex", flexDirection: "column", alignItems: "flex-start", gap: "12px", padding: "16px", background: "#f9fafb", border: "2px solid #e5e7eb", borderRadius: "14px", cursor: "pointer", transition: "all 0.2s", userSelect: "none" },
  iconWrap: { width: "48px", height: "48px", borderRadius: "12px", display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.2s" },
  toggle: { width: "44px", height: "24px", borderRadius: "12px", position: "relative", transition: "all 0.3s", alignSelf: "flex-end", flexShrink: 0 },
  toggleDot: { position: "absolute", top: "3px", right: "3px", width: "18px", height: "18px", background: "#fff", borderRadius: "50%", transition: "transform 0.3s", boxShadow: "0 1px 4px rgba(0,0,0,0.2)" },
  hint: { display: "flex", alignItems: "center", gap: "8px", marginTop: "14px", background: "#f0f4ff", borderRadius: "10px", padding: "10px 14px", fontSize: "13px", color: "#1a237e", fontWeight: 500 },
};

// ── Modal ──────────────────────────────────────────────────────────────────
function TextModal({ file, onClose }) {
  const [tab, setTab] = useState("original");
  const [extractedText, setExtractedText] = useState(null);
  const [translatedText, setTranslatedText] = useState(null);
  const [lessonData, setLessonData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [translating, setTranslating] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState("");
  const [enrichOpts, setEnrichOpts] = useState({ images: false, video: false, simulation: false });
  const [genStatus, setGenStatus] = useState("");

  useEffect(() => {
    setLoading(true);
    fetch(`/extract/${encodeURIComponent(file.key)}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.error) throw new Error(d.error);
        setExtractedText(d.text || "(No text found)");
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [file.key]);

  const handleTranslate = async () => {
    setTranslating(true); setError("");
    try {
      const res = await fetch("/translate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: extractedText }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Translation failed");
      setTranslatedText(data.translatedText);
      setTab("arabic");
    } catch (e) { setError(e.message); }
    finally { setTranslating(false); }
  };

  const handleGenerateLesson = async () => {
    setGenerating(true); setError("");
    setGenStatus(enrichOpts.images && enrichOpts.simulation ? "🤖 جارٍ توليد الدرس والصور والمحاكاة..." :
                 enrichOpts.images ? "🤖 جارٍ توليد الدرس والصور..." :
                 enrichOpts.simulation ? "🤖 جارٍ توليد الدرس والمحاكاة..." :
                 "🤖 جارٍ توليد الدرس...");
    try {
      const res = await fetch("/generate-lesson", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: translatedText, enrich: enrichOpts }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Generation failed");
      setLessonData(data);
      setTab("lesson");
    } catch (e) { setError(e.message); }
    finally { setGenerating(false); setGenStatus(""); }
  };
  const handleDownloadSCORM = async () => {
    setDownloading(true);
    try { await downloadSCORM(lessonData); }
    catch (e) { setError("فشل تحميل SCORM: " + e.message); }
    finally { setDownloading(false); }
  };

  const anyEnrich = enrichOpts.images || enrichOpts.video || enrichOpts.simulation;

  const tabs = [
    { key: "original", label: "النص الأصلي" },
    { key: "arabic", label: `الترجمة ${translatedText ? "✓" : ""}`, disabled: !translatedText },
    { key: "lesson", label: `الدرس ${lessonData ? "✓" : ""}`, disabled: !lessonData },
  ];

  return (
    <div style={modal.overlay}>
      <div style={modal.box}>
        <div style={modal.header}>
          <div style={modal.headerLeft}>
            <span style={{ fontSize: "22px" }}>{file.name.endsWith(".pdf") ? "📄" : "📝"}</span>
            <div>
              <div style={modal.headerTitle}>{file.name}</div>
              <div style={{ fontSize: "11px", color: "rgba(255,255,255,0.6)", marginTop: "2px" }}>
                {extractedText ? `${extractedText.length.toLocaleString()} حرف` : ""}
                {translatedText ? " · تمت الترجمة ✓" : ""}
                {lessonData ? " · تم إنشاء الدرس ✓" : ""}
              </div>
            </div>
          </div>
          <button style={modal.closeBtn} onClick={onClose}>✕ إغلاق</button>
        </div>
        <div style={modal.tabs}>
          {tabs.map(({ key, label, disabled }) => (
            <button key={key} style={{ ...modal.tab, ...(tab === key ? modal.tabActive : {}), ...(disabled ? { opacity: 0.4, cursor: "default" } : {}) }}
              onClick={() => !disabled && setTab(key)} disabled={disabled}>{label}</button>
          ))}
        </div>
        <div style={{ ...modal.body, padding: tab === "lesson" ? 0 : "28px 32px" }}>
          {error && <div style={{ ...modal.error, marginBottom: "16px" }}>{error}</div>}

          {tab === "original" && (loading
            ? <div style={modal.centered}><Spinner /><p style={{ color: "#aaa", fontSize: "13px" }}>جارٍ استخراج النص...</p></div>
            : <pre style={modal.textBox}>{extractedText}</pre>)}

          {tab === "arabic" && translatedText && (
            <div>
              {!lessonData && <EnrichPanel options={enrichOpts} onChange={setEnrichOpts} />}
              <pre style={{ ...modal.textBox, direction: "rtl", textAlign: "right" }}>{translatedText}</pre>
            </div>
          )}

          {tab === "lesson" && lessonData && <LessonPage lessonData={lessonData} />}
        </div>
        <div style={modal.footer}>
          {tab === "original" && !translatedText && (
            <button style={{ ...modal.actionBtn, ...(translating || loading ? modal.btnDisabled : {}) }}
              onClick={handleTranslate} disabled={translating || loading || !extractedText}>
              {translating ? <><Spinner small /> جارٍ الترجمة...</> : "🌐 ترجمة إلى العربية"}
            </button>
          )}
          {tab === "original" && translatedText && (
            <button style={{ ...modal.actionBtn, background: "#059669" }} onClick={() => setTab("arabic")}>عرض الترجمة ←</button>
          )}
          {tab === "arabic" && translatedText && !lessonData && (
            <button style={{ ...modal.actionBtn, background: "#7c3aed", ...(generating ? modal.btnDisabled : {}) }}
              onClick={handleGenerateLesson} disabled={generating}>
              {generating
                ? <><Spinner small /> {genStatus || "جارٍ الإنشاء..."}</>
                : anyEnrich
                  ? `🎓 إنشاء درس مُثرى (${[enrichOpts.images && "صور", enrichOpts.video && "فيديو", enrichOpts.simulation && "محاكاة"].filter(Boolean).join(" + ")})`
                  : "🎓 إنشاء درس + اختبار"}
            </button>
          )}
          {tab === "lesson" && lessonData && (
            <>
              <button style={{ ...modal.actionBtn, background: "#7c3aed" }} onClick={handleGenerateLesson} disabled={generating}>
                {generating ? <><Spinner small /> {genStatus}</> : "🔄 إعادة الإنشاء"}
              </button>
              <button style={{ ...modal.actionBtn, background: "#0f766e", ...(downloading ? modal.btnDisabled : {}) }}
                onClick={handleDownloadSCORM} disabled={downloading}>
                {downloading ? <><Spinner small /> جارٍ التحميل...</> : "📦 تحميل SCORM"}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Stats Card ─────────────────────────────────────────────────────────────
function StatCard({ icon, value, label, color }) {
  return (
    <div style={{ background: "#fff", borderRadius: "16px", padding: "20px 24px", display: "flex", alignItems: "center", gap: "16px", boxShadow: "0 2px 12px rgba(0,0,0,0.06)", border: `1px solid ${color}22` }}>
      <div style={{ width: "52px", height: "52px", borderRadius: "14px", background: `${color}18`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "26px", flexShrink: 0 }}>{icon}</div>
      <div>
        <div style={{ fontSize: "28px", fontWeight: 800, color, lineHeight: 1 }}>{value}</div>
        <div style={{ fontSize: "13px", color: "#888", marginTop: "4px" }}>{label}</div>
      </div>
    </div>
  );
}

// ── Feature Card ───────────────────────────────────────────────────────────
function FeatureCard({ icon, title, desc, color, badge }) {
  return (
    <div style={{ background: "#fff", borderRadius: "16px", padding: "24px", boxShadow: "0 2px 12px rgba(0,0,0,0.06)", border: "1px solid #e8eaf6", position: "relative", overflow: "hidden" }}>
      {badge && <div style={{ position: "absolute", top: "14px", left: "14px", background: "#fef3c7", color: "#92400e", borderRadius: "8px", padding: "2px 10px", fontSize: "11px", fontWeight: 700 }}>{badge}</div>}
      <div style={{ width: "48px", height: "48px", borderRadius: "14px", background: `${color}18`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "24px", marginBottom: "14px" }}>{icon}</div>
      <div style={{ fontWeight: 700, fontSize: "15px", color: "#1a237e", marginBottom: "8px" }}>{title}</div>
      <div style={{ fontSize: "13px", color: "#666", lineHeight: 1.7 }}>{desc}</div>
    </div>
  );
}

// ── Main App ───────────────────────────────────────────────────────────────
export default function App() {
  const [files, setFiles] = useState([]);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [activeFile, setActiveFile] = useState(null);
  const inputRef = useRef();

  const fetchFiles = async () => {
    try {
      const res = await fetch("/files");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load files");
      setFiles(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.message || "تعذّر تحميل الملفات");
    }
  };

  useEffect(() => { fetchFiles(); }, []);

  const uploadFile = async (file) => {
    setError(""); setSuccess("");
    const allowed = ["application/pdf", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"];
    if (!allowed.includes(file.type)) { setError("يُقبل فقط ملفات PDF و DOCX."); return; }
    const formData = new FormData();
    formData.append("file", file);
    setUploading(true);
    try {
      const res = await fetch("/upload", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Upload failed");
      setSuccess(`تم رفع "${data.file.name}" بنجاح.`);
      fetchFiles();
    } catch (err) { setError(err.message); }
    finally { setUploading(false); }
  };

  const handleDrop = (e) => {
    e.preventDefault(); setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) uploadFile(file);
  };

  const handleDelete = async (key) => {
    setError("");
    try {
      const res = await fetch(`/files/${encodeURIComponent(key)}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Delete failed");
      setFiles((prev) => prev.filter((f) => f.key !== key));
    } catch (err) { setError(err.message); }
  };

  return (
    <div style={styles.page}>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes fadeUp { from { opacity:0; transform:translateY(24px); } to { opacity:1; transform:translateY(0); } }
        @keyframes pulse { 0%,100%{transform:scale(1);} 50%{transform:scale(1.04);} }
        @keyframes float { 0%,100%{transform:translateY(0);} 50%{transform:translateY(-8px);} }
        * { box-sizing: border-box; }
        body { margin: 0; }
        .file-card:hover { transform: translateY(-2px); box-shadow: 0 8px 24px rgba(26,35,126,0.12) !important; }
        .open-btn:hover { transform: scale(1.04); }
        .step-item:hover { background: rgba(255,255,255,0.18) !important; transform: translateY(-3px); }
        .feature-card:hover { transform: translateY(-4px); box-shadow: 0 8px 28px rgba(0,0,0,0.1) !important; }
      `}</style>

      {/* ══ NAVBAR ══ */}
      <nav style={st.nav}>
        <div style={st.navInner}>
          <div style={st.navLogo}>
            <div style={st.navLogoIcon}>🎓</div>
            <div>
              <div style={st.navLogoTitle}>الكلية التطبيقية · جامعة القصيم</div>
              <div style={st.navLogoSub}>EduAI · منصة الدروس التفاعلية</div>
            </div>
          </div>
          <div style={st.navBadge}>🏆 هاكاثون 2026</div>
        </div>
      </nav>

      {/* ══ HERO ══ */}
      <div style={st.hero}>
        {/* animated blobs */}
        <div style={{ ...st.blob, top: "-80px", right: "-80px", width: "400px", height: "400px", background: "rgba(124,58,237,0.25)" }} />
        <div style={{ ...st.blob, bottom: "-60px", left: "-60px", width: "300px", height: "300px", background: "rgba(59,130,246,0.2)" }} />
        <div style={{ ...st.blob, top: "40%", left: "40%", width: "200px", height: "200px", background: "rgba(16,185,129,0.15)" }} />

        <div style={st.heroInner}>
          {/* Left: text */}
          <div style={st.heroText}>
            <div style={st.heroPill}>🤖 مدعوم بـ AWS Bedrock · Claude AI</div>
            <h1 style={st.heroH1}>
              تحويل المحتوى التعليمي<br />
              <span style={st.heroAccent}>إلى دروس تفاعلية متميزة</span>
            </h1>
            <p style={st.heroDesc}>
              ارفع أي ملف PDF أو DOCX، يترجمه النظام فوراً ويحوّله إلى درس تفاعلي متكامل مع اختبارات وتصدير SCORM للبلاك بورد ألترا
            </p>
            <div style={st.heroBadges}>
              {["🌐 ترجمة فورية","📚 دروس ذكية","✏️ اختبارات تفاعلية","📦 SCORM","🧠 خريطة مفاهيم"].map(b => (
                <span key={b} style={st.heroBadge}>{b}</span>
              ))}
            </div>
          </div>

          {/* Right: upload box */}
          <div style={st.heroUpload}>
            <div style={st.uploadCard}>
              <div style={st.uploadCardHeader}>
                <span style={{ fontSize: "20px" }}>☁️</span>
                <span style={{ fontWeight: 700, fontSize: "15px", color: "#1a237e" }}>رفع المحتوى التعليمي</span>
              </div>
              <div
                style={{ ...st.dropzone, ...(dragging ? st.dropzoneActive : {}) }}
                onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
                onDragLeave={() => setDragging(false)}
                onDrop={handleDrop}
                onClick={() => inputRef.current.click()}
                role="button" tabIndex={0}
                onKeyDown={(e) => e.key === "Enter" && inputRef.current.click()}
                aria-label="منطقة رفع الملفات">
                <input ref={inputRef} type="file" accept=".pdf,.docx" style={{ display: "none" }}
                  onChange={(e) => e.target.files[0] && uploadFile(e.target.files[0])} />
                {uploading
                  ? <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "12px" }}>
                      <div style={{ width: "44px", height: "44px", border: "3px solid #ede9fe", borderTop: "3px solid #7c3aed", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
                      <p style={{ color: "#7c3aed", fontWeight: 600, margin: 0 }}>جارٍ الرفع...</p>
                    </div>
                  : <>
                      <div style={{ fontSize: "52px", marginBottom: "10px", animation: "float 3s ease-in-out infinite" }}>📂</div>
                      <p style={{ color: "#444", fontSize: "15px", margin: "0 0 6px", fontWeight: 500 }}>اسحب الملف هنا أو <span style={{ color: "#7c3aed", fontWeight: 700, textDecoration: "underline" }}>تصفّح</span></p>
                      <p style={{ color: "#aaa", fontSize: "12px", margin: 0 }}>PDF أو DOCX · حتى 10 ميجابايت</p>
                    </>}
              </div>
              {error && <div style={st.alertErr}>{error}</div>}
              {success && <div style={st.alertOk}>{success}</div>}
            </div>
          </div>
        </div>
      </div>

      {/* ══ STATS ══ */}
      <div style={st.statsBar}>
        <StatCard icon="📁" value={files.length} label="ملف مرفوع" color="#7c3aed" />
        <StatCard icon="🌐" value="AWS" label="Translate + Bedrock" color="#0ea5e9" />
        <StatCard icon="🎓" value="SCORM" label="متوافق مع Blackboard" color="#059669" />
        <StatCard icon="🤖" value="Claude" label="Haiku 4.5 AI" color="#d97706" />
      </div>

      {/* ══ MAIN CONTENT ══ */}
      <div style={st.main}>

        {/* Files */}
        <div style={st.section}>
          <div style={st.sectionHeader}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <div style={st.sectionIcon}>📁</div>
              <div>
                <h2 style={st.sectionTitle}>المحتوى التعليمي المرفوع</h2>
                <p style={st.sectionSub}>اضغط "فتح وتحليل" لبدء معالجة أي ملف</p>
              </div>
            </div>
            <span style={st.countBadge}>{files.length} ملف</span>
          </div>

          {files.length === 0
            ? <div style={st.empty}>
                <div style={{ fontSize: "64px", marginBottom: "16px", animation: "float 3s ease-in-out infinite" }}>🗂️</div>
                <p style={{ color: "#555", fontSize: "17px", fontWeight: 600, margin: "0 0 8px" }}>لا توجد ملفات بعد</p>
                <p style={{ color: "#aaa", fontSize: "14px", margin: 0 }}>ارفع ملفاً من الأعلى للبدء</p>
              </div>
            : <div style={st.fileGrid}>
                {files.map((f) => (
                  <div key={f.key} className="file-card" style={st.fileCard}>
                    <div style={{ display: "flex", alignItems: "center", gap: "14px", flex: 1, minWidth: 0 }}>
                      <div style={st.fileIconWrap}>{f.name.endsWith(".pdf") ? "📄" : "📝"}</div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <a href={f.url} target="_blank" rel="noreferrer" style={st.fileName}>{f.name}</a>
                        <div style={st.fileMeta}>{formatSize(f.size)}{f.uploadedAt ? ` · ${formatDate(f.uploadedAt)}` : ""}</div>
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: "8px", flexShrink: 0 }}>
                      <button className="open-btn" style={st.openBtn} onClick={() => setActiveFile(f)}>🎓 فتح وتحليل</button>
                      <button style={st.delBtn} onClick={() => handleDelete(f.key)}>🗑️</button>
                    </div>
                  </div>
                ))}
              </div>}
        </div>

        {/* How it works */}
        <div style={st.howCard}>
          <div style={st.howHeader}>
            <h3 style={st.howTitle}>⚡ كيف يعمل النظام؟</h3>
            <p style={st.howSub}>أربع خطوات تحوّل أي محتوى إلى تجربة تعليمية متكاملة</p>
          </div>
          <div style={st.stepsGrid}>
            {[
              { icon: "📤", n: "1", title: "رفع الملف", desc: "PDF أو DOCX من جهازك أو بالسحب والإفلات", color: "#7c3aed" },
              { icon: "🌐", n: "2", title: "الترجمة الذكية", desc: "AWS Translate يترجم المحتوى للعربية فورياً", color: "#0ea5e9" },
              { icon: "🤖", n: "3", title: "توليد الدرس", desc: "Claude AI يبني درساً كاملاً مع أهداف وأقسام واختبار", color: "#059669" },
              { icon: "📦", n: "4", title: "تصدير SCORM", desc: "حزمة جاهزة للرفع على Blackboard Ultra", color: "#d97706" },
            ].map((s) => (
              <div key={s.n} className="step-item" style={{ ...st.stepItem, transition: "all 0.2s" }}>
                <div style={{ ...st.stepNum, background: s.color }}>{s.n}</div>
                <div style={{ fontSize: "36px", margin: "12px 0 10px" }}>{s.icon}</div>
                <div style={{ fontWeight: 700, fontSize: "15px", color: "#fff", marginBottom: "8px" }}>{s.title}</div>
                <div style={{ fontSize: "12px", color: "rgba(255,255,255,0.7)", lineHeight: 1.6 }}>{s.desc}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Features - Educational Value */}
        <div style={st.section}>
          <div style={st.sectionHeader}>
            <div>
              <h2 style={st.sectionTitle}>🏆 المزايا التعليمية</h2>
            </div>
          </div>
          <div style={st.featGrid}>
            {[
              { icon: "🧠", title: "خريطة المفاهيم", desc: "يستخرج الذكاء الاصطناعي العلاقات بين المفاهيم ويعرضها بصرياً لتعزيز الفهم العميق", color: "#7c3aed", badge: "جديد" },
              { icon: "🎯", title: "أهداف تعليمية ذكية", desc: "يولّد أهدافاً وفق تصنيف بلوم التعليمي تلقائياً من محتوى الملف", color: "#0ea5e9" },
              { icon: "✏️", title: "اختبارات تكيّفية", desc: "أسئلة متعددة المستويات مع تغذية راجعة فورية وشرح لكل إجابة", color: "#059669" },
              { icon: "📦", title: "SCORM للبلاك بورد", desc: "تصدير مباشر بمعيار SCORM 1.2 متوافق مع Blackboard Ultra وجميع LMS", color: "#d97706" },
              { icon: "🌐", title: "ترجمة متعددة اللغات", desc: "دعم أكثر من 75 لغة عبر AWS Translate مع الحفاظ على السياق التعليمي", color: "#dc2626" },
              { icon: "☁️", title: "بنية سحابية متكاملة", desc: "AWS S3 للتخزين + Bedrock للذكاء الاصطناعي + Translate للترجمة في منظومة واحدة", color: "#6366f1" },
            ].map((f) => (
              <div key={f.title} className="feature-card" style={{ ...st.featCard, transition: "all 0.2s" }}>
                {f.badge && <div style={st.featBadge}>{f.badge}</div>}
                <div style={{ ...st.featIcon, background: `${f.color}18` }}>{f.icon}</div>
                <div style={st.featTitle}>{f.title}</div>
                <div style={st.featDesc}>{f.desc}</div>
              </div>
            ))}
          </div>
        </div>

      </div>

      {/* ══ FOOTER ══ */}
      <footer style={st.footer}>
        <div style={st.footerInner}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <span style={{ fontSize: "24px" }}>🎓</span>
            <div>
              <div style={{ fontWeight: 700, color: "#fff", fontSize: "14px" }}>جامعة القصيم · الكلية التطبيقية</div>
              <div style={{ color: "rgba(255,255,255,0.5)", fontSize: "12px" }}>توظيف الذكاء الاصطناعي في التعليم</div>
            </div>
          </div>
          <div style={{ color: "rgba(255,255,255,0.4)", fontSize: "12px" }}>هاكاثون 2026 · مدعوم بـ AWS</div>
        </div>
      </footer>

      {activeFile && <TextModal file={activeFile} onClose={() => setActiveFile(null)} />}
    </div>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────
const styles = { page: {} }; // legacy - kept for modal

const st = {
  // Navbar
  nav: { background: "rgba(13,27,110,0.97)", backdropFilter: "blur(12px)", borderBottom: "1px solid rgba(255,255,255,0.08)", position: "sticky", top: 0, zIndex: 50 },
  navInner: { maxWidth: "1200px", margin: "0 auto", padding: "12px 24px", display: "flex", alignItems: "center", justifyContent: "space-between" },
  navLogo: { display: "flex", alignItems: "center", gap: "12px" },
  navLogoIcon: { width: "38px", height: "38px", background: "linear-gradient(135deg, #7c3aed, #3b82f6)", borderRadius: "10px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "20px" },
  navLogoTitle: { fontWeight: 800, fontSize: "19px", color: "#fff", fontFamily: "'Segoe UI', sans-serif" },
  navLogoSub: { fontSize: "12px", color: "rgba(255,255,255,0.6)", fontWeight: 400 },
  navBadge: { background: "linear-gradient(135deg, #d97706, #f59e0b)", color: "#fff", borderRadius: "20px", padding: "5px 14px", fontSize: "12px", fontWeight: 700 },

  // Hero
  hero: { position: "relative", background: "linear-gradient(135deg, #0a0f3d 0%, #0d1b6e 35%, #1e1065 65%, #2d1b69 100%)", padding: "72px 24px 80px", overflow: "hidden", direction: "rtl", fontFamily: "'Segoe UI', Tahoma, Arial, sans-serif" },
  blob: { position: "absolute", borderRadius: "50%", filter: "blur(60px)", pointerEvents: "none", animation: "float 6s ease-in-out infinite" },
  heroInner: { position: "relative", maxWidth: "1200px", margin: "0 auto", display: "grid", gridTemplateColumns: "1fr 420px", gap: "48px", alignItems: "center" },
  heroText: { color: "#fff" },
  heroPill: { display: "inline-flex", alignItems: "center", gap: "6px", background: "rgba(124,58,237,0.3)", border: "1px solid rgba(124,58,237,0.5)", borderRadius: "20px", padding: "6px 16px", fontSize: "13px", color: "rgba(255,255,255,0.9)", marginBottom: "20px", backdropFilter: "blur(8px)" },
  heroH1: { fontSize: "clamp(24px, 3.5vw, 40px)", fontWeight: 900, lineHeight: 1.4, margin: "0 0 16px", color: "#fff" },
  heroAccent: { background: "linear-gradient(90deg, #a78bfa, #60a5fa)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" },
  heroDesc: { fontSize: "16px", lineHeight: 1.8, color: "rgba(255,255,255,0.7)", margin: "0 0 24px", maxWidth: "520px" },
  heroBadges: { display: "flex", gap: "8px", flexWrap: "wrap" },
  heroBadge: { background: "rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.85)", borderRadius: "20px", padding: "5px 14px", fontSize: "12px", fontWeight: 600, border: "1px solid rgba(255,255,255,0.15)", backdropFilter: "blur(4px)" },

  // Upload card in hero
  heroUpload: {},
  uploadCard: { background: "rgba(255,255,255,0.97)", borderRadius: "20px", padding: "24px", boxShadow: "0 20px 60px rgba(0,0,0,0.3)", backdropFilter: "blur(20px)" },
  uploadCardHeader: { display: "flex", alignItems: "center", gap: "10px", marginBottom: "16px" },
  dropzone: { border: "2px dashed #c4b5fd", borderRadius: "14px", padding: "36px 20px", textAlign: "center", cursor: "pointer", transition: "all 0.2s", background: "#faf5ff" },
  dropzoneActive: { borderColor: "#7c3aed", background: "#ede9fe", transform: "scale(1.01)" },
  alertErr: { background: "#fff5f5", border: "1px solid #fed7d7", color: "#c53030", borderRadius: "10px", padding: "10px 14px", fontSize: "13px", marginTop: "12px" },
  alertOk: { background: "#f0fff4", border: "1px solid #c6f6d5", color: "#276749", borderRadius: "10px", padding: "10px 14px", fontSize: "13px", marginTop: "12px" },

  // Stats
  statsBar: { maxWidth: "1200px", margin: "-32px auto 0", padding: "0 24px", display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "16px", position: "relative", zIndex: 10, direction: "rtl", fontFamily: "'Segoe UI', Tahoma, Arial, sans-serif" },

  // Main
  page: { minHeight: "100vh", background: "#f0f4ff", fontFamily: "'Segoe UI', Tahoma, Arial, sans-serif", direction: "rtl" },
  main: { maxWidth: "1200px", margin: "0 auto", padding: "40px 24px", display: "flex", flexDirection: "column", gap: "32px", direction: "rtl", fontFamily: "'Segoe UI', Tahoma, Arial, sans-serif" },

  // Section
  section: { background: "#fff", borderRadius: "20px", padding: "28px 32px", boxShadow: "0 2px 16px rgba(0,0,0,0.06)" },
  sectionHeader: { display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "24px" },
  sectionIcon: { width: "44px", height: "44px", background: "#ede9fe", borderRadius: "12px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "22px", flexShrink: 0 },
  sectionTitle: { margin: "0 0 4px", fontSize: "18px", fontWeight: 700, color: "#1a237e" },
  sectionSub: { margin: 0, fontSize: "13px", color: "#888" },
  countBadge: { background: "#ede9fe", color: "#7c3aed", borderRadius: "20px", padding: "5px 16px", fontSize: "13px", fontWeight: 700, flexShrink: 0 },

  // Files
  empty: { textAlign: "center", padding: "48px 0" },
  fileGrid: { display: "flex", flexDirection: "column", gap: "12px" },
  fileCard: { background: "#f8f9ff", border: "1px solid #e8eaf6", borderRadius: "14px", padding: "16px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "14px", flexWrap: "wrap", boxShadow: "0 1px 4px rgba(0,0,0,0.04)", transition: "all 0.2s" },
  fileIconWrap: { width: "44px", height: "44px", background: "#e8eaf6", borderRadius: "12px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "24px", flexShrink: 0 },
  fileName: { display: "block", fontWeight: 600, fontSize: "14px", color: "#1a237e", textDecoration: "none", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginBottom: "3px" },
  fileMeta: { fontSize: "12px", color: "#999" },
  openBtn: { background: "linear-gradient(135deg, #1a237e, #7c3aed)", color: "#fff", border: "none", borderRadius: "10px", padding: "9px 18px", fontSize: "13px", fontWeight: 700, cursor: "pointer", transition: "transform 0.15s" },
  delBtn: { background: "#fee2e2", border: "none", cursor: "pointer", fontSize: "16px", padding: "9px 12px", borderRadius: "10px", color: "#dc2626" },

  // How it works
  howCard: { background: "linear-gradient(135deg, #0a0f3d, #0d1b6e, #1e1065)", borderRadius: "20px", padding: "36px 32px", color: "#fff" },
  howHeader: { textAlign: "center", marginBottom: "32px" },
  howTitle: { margin: "0 0 8px", fontSize: "22px", fontWeight: 800 },
  howSub: { margin: 0, color: "rgba(255,255,255,0.6)", fontSize: "14px" },
  stepsGrid: { display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "16px" },
  stepItem: { background: "rgba(255,255,255,0.08)", borderRadius: "16px", padding: "24px 18px", textAlign: "center", border: "1px solid rgba(255,255,255,0.12)", backdropFilter: "blur(8px)" },
  stepNum: { width: "32px", height: "32px", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "14px", fontWeight: 800, color: "#fff", margin: "0 auto" },

  // Features
  featGrid: { display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "16px" },
  featCard: { background: "#fff", borderRadius: "16px", padding: "24px", boxShadow: "0 2px 12px rgba(0,0,0,0.06)", border: "1px solid #e8eaf6", position: "relative", overflow: "hidden" },
  featBadge: { position: "absolute", top: "14px", left: "14px", background: "#fef3c7", color: "#92400e", borderRadius: "8px", padding: "2px 10px", fontSize: "11px", fontWeight: 700 },
  featIcon: { width: "48px", height: "48px", borderRadius: "14px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "24px", marginBottom: "14px" },
  featTitle: { fontWeight: 700, fontSize: "15px", color: "#1a237e", marginBottom: "8px" },
  featDesc: { fontSize: "13px", color: "#666", lineHeight: 1.7 },

  // Footer
  footer: { background: "#0a0f3d", borderTop: "1px solid rgba(255,255,255,0.06)" },
  footerInner: { maxWidth: "1200px", margin: "0 auto", padding: "20px 24px", display: "flex", alignItems: "center", justifyContent: "space-between", direction: "rtl", fontFamily: "'Segoe UI', Tahoma, Arial, sans-serif" },
};

const modal = {
  overlay: { position: "fixed", inset: 0, background: "rgba(10,10,30,0.75)", display: "flex", alignItems: "stretch", justifyContent: "stretch", zIndex: 100, padding: 0 },
  box: { background: "#f0f4ff", width: "100%", height: "100%", display: "flex", flexDirection: "column" },
  header: { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 28px", background: "linear-gradient(135deg, #0d1b6e, #1a237e, #7c3aed)", flexShrink: 0 },
  headerLeft: { display: "flex", alignItems: "center", gap: "12px", minWidth: 0 },
  headerTitle: { fontWeight: 700, fontSize: "16px", color: "#fff", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  closeBtn: { background: "rgba(255,255,255,0.15)", border: "1px solid rgba(255,255,255,0.3)", fontSize: "16px", cursor: "pointer", color: "#fff", borderRadius: "8px", padding: "6px 14px", flexShrink: 0, fontWeight: 600 },
  tabs: { display: "flex", gap: "0", padding: "0 28px", borderBottom: "2px solid #e8eaf6", background: "#fff", flexShrink: 0 },
  tab: { background: "none", border: "none", padding: "14px 22px", fontSize: "14px", fontWeight: 500, color: "#888", cursor: "pointer", borderBottom: "3px solid transparent", marginBottom: "-2px" },
  tabActive: { color: "#7c3aed", borderBottom: "3px solid #7c3aed", fontWeight: 700 },
  body: { flex: 1, overflow: "auto", padding: "28px 32px" },
  textBox: { margin: "0 auto", whiteSpace: "pre-wrap", wordBreak: "break-word", fontSize: "14px", lineHeight: 1.8, color: "#333", background: "#fff", border: "1px solid #e8eaf6", borderRadius: "12px", padding: "24px", fontFamily: "inherit", maxWidth: "900px" },
  centered: { display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "16px", minHeight: "200px" },
  error: { background: "#fff5f5", border: "1px solid #fed7d7", color: "#c53030", borderRadius: "10px", padding: "12px 16px", fontSize: "13px", maxWidth: "900px", margin: "0 auto 16px" },
  footer: { padding: "16px 28px", borderTop: "2px solid #e8eaf6", display: "flex", justifyContent: "flex-end", gap: "10px", flexWrap: "wrap", background: "#fff", flexShrink: 0 },
  actionBtn: { background: "#1a237e", color: "#fff", border: "none", borderRadius: "10px", padding: "11px 22px", fontSize: "14px", fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: "8px" },
  btnDisabled: { opacity: 0.6, cursor: "not-allowed" },
};
