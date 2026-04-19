const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, ".env") });
const express = require("express");
const cors = require("cors");
const multer = require("multer");
const mammoth = require("mammoth");
const pdfParse = require("pdf-parse");
const {
  S3Client,
  PutObjectCommand,
  ListObjectsV2Command,
  DeleteObjectCommand,
  GetObjectCommand,
} = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");
const { TranslateClient, TranslateTextCommand } = require("@aws-sdk/client-translate");
const { BedrockRuntimeClient, InvokeModelCommand } = require("@aws-sdk/client-bedrock-runtime");
const { initDb, insertFile, deleteFile, listFiles } = require("./db");

// Set AWS region globally
process.env.AWS_REGION = process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || "us-east-1";

const app = express();
const PORT = process.env.PORT || 4000;

// --- S3 client ---
const s3 = new S3Client(awsConfig);

const BUCKET = process.env.S3_BUCKET_NAME;

console.log("Backend AWS config:", {
  region: process.env.AWS_REGION,
  bucketConfigured: !!BUCKET,
});

if (!BUCKET) {
  console.warn("Warning: S3 bucket name is not configured. Set S3_BUCKET_NAME.");
}

// --- AWS Translate client ---
const translator = new TranslateClient({});

// --- AWS Bedrock client ---
const bedrock = new BedrockRuntimeClient({});

app.use(cors());
app.use(express.json());

// --- Multer: memory storage so we can extract text before uploading ---
const ALLOWED_MIMES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];

const memUpload = multer({
  storage: multer.memoryStorage(),
  fileFilter: (req, file, cb) => {
    if (ALLOWED_MIMES.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Only PDF and DOCX files are allowed"), false);
    }
  },
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
});

// --- Text extraction helper ---
async function extractText(buffer, mimetype) {
  if (mimetype === "application/pdf") {
    const data = await pdfParse(buffer);
    return data.text.trim();
  }
  if (mimetype === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") {
    const result = await mammoth.extractRawText({ buffer });
    return result.value.trim();
  }
  return "";
}

// --- Upload: extract text + store in S3 ---
app.post("/upload", memUpload.single("file"), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No file uploaded" });

  const { buffer, originalname, mimetype, size } = req.file;
  const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
  const key = `uploads/${unique}-${originalname}`;

  // Upload buffer to S3
  await s3.send(
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      Body: buffer,
      ContentType: mimetype,
    })
  );

  // Extract text from buffer
  let extractedText = "";
  let extractError = null;
  try {
    extractedText = await extractText(buffer, mimetype);
  } catch (err) {
    extractError = "Text extraction failed: " + err.message;
  }

  const signedUrl = await getSignedUrl(
    s3,
    new GetObjectCommand({ Bucket: BUCKET, Key: key }),
    { expiresIn: 3600 }
  );

  // Persist metadata to RDS (no-op if DB not configured)
  await insertFile({ key, name: originalname, size, mimeType: mimetype });

  res.json({
    message: "File uploaded successfully",
    file: {
      key,
      name: originalname,
      size,
      url: signedUrl,
      extractedText,
      extractError,
    },
  });
});

// --- Extract-only: no S3 storage ---
app.post("/extract", memUpload.single("file"), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No file provided" });

  try {
    const text = await extractText(req.file.buffer, req.file.mimetype);
    res.json({ name: req.file.originalname, text });
  } catch (err) {
    res.status(500).json({ error: "Extraction failed: " + err.message });
  }
});

// --- Extract text from an already-uploaded S3 file by key ---
app.get("/extract/:key(*)", async (req, res) => {
  const key = req.params.key;
  try {
    const obj = await s3.send(new GetObjectCommand({ Bucket: BUCKET, Key: key }));

    // Stream to buffer
    const chunks = [];
    for await (const chunk of obj.Body) chunks.push(chunk);
    const buffer = Buffer.concat(chunks);

    const mimetype = obj.ContentType;
    const text = await extractText(buffer, mimetype);
    res.json({ key, text });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Extraction failed: " + err.message });
  }
});

// --- List files (RDS when available, S3 fallback) ---
app.get("/files", async (req, res) => {
  try {
    if (!BUCKET) {
      throw new Error("S3 bucket name is not configured (S3_BUCKET_NAME missing)");
    }

    // Try RDS first
    const dbRows = await listFiles();
    if (dbRows) {
      const files = await Promise.all(
        dbRows.map(async (row) => {
          const signedUrl = await getSignedUrl(
            s3,
            new GetObjectCommand({ Bucket: BUCKET, Key: row.key }),
            { expiresIn: 3600 }
          );
          return { ...row, url: signedUrl };
        })
      );
      return res.json(files);
    }

    // Fallback: list directly from S3
    const data = await s3.send(new ListObjectsV2Command({ Bucket: BUCKET, Prefix: "uploads/" }));
    const objects = data.Contents || [];
    const files = await Promise.all(
      objects.map(async (obj) => {
        const signedUrl = await getSignedUrl(
          s3,
          new GetObjectCommand({ Bucket: BUCKET, Key: obj.Key }),
          { expiresIn: 3600 }
        );
        const rawName = obj.Key.replace("uploads/", "");
        const name = rawName.replace(/^\d+-\d+-/, "");
        return { key: obj.Key, name, size: obj.Size, uploadedAt: obj.LastModified, url: signedUrl };
      })
    );
    res.json(files);
  } catch (err) {
    console.error("/files error:", err);
    res.status(500).json({ error: "Failed to list files: " + err.message });
  }
});

// --- Delete file ---
app.delete("/files/:key(*)", async (req, res) => {
  const key = req.params.key;
  try {
    await s3.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }));
    await deleteFile(key);
    res.json({ message: "File deleted" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to delete file" });
  }
});

// --- Translate text to Arabic ---
// POST /translate  { text: "...", sourceLang: "en" (optional) }
app.post("/translate", async (req, res) => {
  const { text, sourceLang = "auto" } = req.body;
  if (!text || !text.trim()) return res.status(400).json({ error: "No text provided" });

  // AWS Translate max 10,000 bytes per request — chunk if needed
  const MAX_BYTES = 9000;
  const encoder = new TextEncoder();

  const chunks = [];
  let current = "";
  for (const sentence of text.split(/(?<=[.!?؟\n])\s+/)) {
    const candidate = current ? current + " " + sentence : sentence;
    if (encoder.encode(candidate).length > MAX_BYTES) {
      if (current) chunks.push(current);
      current = sentence;
    } else {
      current = candidate;
    }
  }
  if (current) chunks.push(current);

  try {
    const translated = await Promise.all(
      chunks.map((chunk) =>
        translator.send(
          new TranslateTextCommand({
            Text: chunk,
            SourceLanguageCode: sourceLang === "auto" ? "auto" : sourceLang,
            TargetLanguageCode: "ar",
          })
        ).then((r) => r.TranslatedText)
      )
    );
    res.json({ translatedText: translated.join(" "), detectedLanguage: sourceLang });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Translation failed: " + err.message });
  }
});

// --- Generate lesson + optional enrichment in one call ---
app.post("/generate-lesson", async (req, res) => {
  const { text, enrich = {} } = req.body;
  if (!text || !text.trim()) return res.status(400).json({ error: "No text provided" });

  const input = text.slice(0, 6000);

  // Helper to call Claude
  const callClaude = async (prompt, maxTokens = 4096) => {
    const response = await bedrock.send(new InvokeModelCommand({
      modelId: process.env.BEDROCK_MODEL_ID || "us.anthropic.claude-haiku-4-5-20251001-v1:0",
      contentType: "application/json",
      accept: "application/json",
      body: JSON.stringify({
        anthropic_version: "bedrock-2023-05-31",
        max_tokens: maxTokens,
        messages: [{ role: "user", content: prompt }],
      }),
    }));
    const raw = JSON.parse(Buffer.from(response.body).toString("utf-8"));
    return raw.content?.[0]?.text || "";
  };

  try {
    // 1. Generate lesson
    const lessonPrompt = `أنت مساعد تعليمي متخصص. بناءً على النص العربي التالي، قم بإنشاء مخرجات تعليمية منظمة باللغة العربية.

النص:
"""
${input}
"""

أعد الرد بصيغة JSON فقط بالهيكل التالي:
{
  "lesson": {
    "title": "عنوان الدرس",
    "objectives": ["هدف 1", "هدف 2", "هدف 3"],
    "sections": [
      { "heading": "عنوان القسم", "content": "محتوى القسم..." }
    ],
    "keyTerms": [
      { "term": "المصطلح", "definition": "التعريف" }
    ]
  },
  "summary": "ملخص شامل للنص في فقرة واحدة أو اثنتين",
  "quiz": [
    {
      "question": "نص السؤال؟",
      "options": ["أ) الخيار الأول", "ب) الخيار الثاني", "ج) الخيار الثالث", "د) الخيار الرابع"],
      "answer": "أ) الخيار الأول",
      "explanation": "شرح سبب صحة هذه الإجابة"
    }
  ]
}
تأكد من وجود 5 أسئلة وأن JSON صالح تماماً`;

    const lessonText = await callClaude(lessonPrompt, 6000);
    const lessonMatch = lessonText.match(/\{[\s\S]*\}/);
    if (!lessonMatch) throw new Error("Model did not return valid JSON");

    let result;
    try {
      result = JSON.parse(lessonMatch[0]);
    } catch (parseErr) {
      // JSON truncated - retry with shorter input
      const shortInput = input.slice(0, 3000);
      const retryPrompt = lessonPrompt.replace(input, shortInput);
      const retryText = await callClaude(retryPrompt, 6000);
      const retryMatch = retryText.match(/\{[\s\S]*\}/);
      if (!retryMatch) throw new Error("Model did not return valid JSON");
      result = JSON.parse(retryMatch[0]);
    }

    // 2. Generate visual diagrams if requested - as structured data not SVG
    if (enrich.images) {
      try {
        const title = result.lesson?.title || "";
        const terms = result.lesson?.keyTerms?.slice(0,5).map(t => `${t.term}: ${t.definition}`).join("\n") || "";
        const sections = result.lesson?.sections?.slice(0,4).map(s => `${s.heading}: ${s.content?.slice(0,100)}`).join("\n") || "";

        const diagPrompt = `Based on this Arabic lesson, create 3 educational visual cards as JSON.

Title: ${title}
Key terms: ${terms}
Sections: ${sections}

Return ONLY this JSON array (no markdown):
[
  {
    "title": "عنوان البطاقة الأولى",
    "type": "diagram",
    "color": "#7c3aed",
    "items": ["عنصر 1", "عنصر 2", "عنصر 3", "عنصر 4"],
    "description": "وصف قصير للمفهوم"
  },
  {
    "title": "عنوان البطاقة الثانية", 
    "type": "comparison",
    "color": "#059669",
    "left": {"label": "الجانب الأول", "items": ["نقطة 1", "نقطة 2", "نقطة 3"]},
    "right": {"label": "الجانب الثاني", "items": ["نقطة 1", "نقطة 2", "نقطة 3"]}
  },
  {
    "title": "عنوان البطاقة الثالثة",
    "type": "steps",
    "color": "#0ea5e9",
    "steps": [
      {"num": "1", "text": "الخطوة الأولى"},
      {"num": "2", "text": "الخطوة الثانية"},
      {"num": "3", "text": "الخطوة الثالثة"},
      {"num": "4", "text": "الخطوة الرابعة"}
    ]
  }
]

All content must be in Arabic and directly related to the lesson.`;

        const diagText = await callClaude(diagPrompt, 3000);
        const arrMatch = diagText.match(/\[[\s\S]*\]/);
        if (arrMatch) {
          const cards = JSON.parse(arrMatch[0]);
          if (Array.isArray(cards)) result.imageCards = cards;
        }
      } catch (e) {
        console.error("Diagram generation failed:", e.message);
      }
    }

    // 3. Generate simulation ALWAYS (not optional)
    try {
        const simPrompt = `أنت مصمم تعليمي. أنشئ محاكاة تفاعلية للدرس التالي باللغة العربية.

عنوان الدرس: ${result.lesson?.title}
الملخص: ${result.summary || ""}

أعد JSON فقط بهذا الهيكل:
{
  "scenario": "موقف واقعي يضع الطالب في سياق تطبيقي (جملتان)",
  "role": "دور الطالب",
  "steps": [
    {
      "step": 1, "title": "عنوان", "description": "وصف الموقف",
      "type": "choice", "question": "السؤال",
      "choices": [
        {"id":"a","text":"الخيار أ","correct":true,"feedback":"تغذية راجعة"},
        {"id":"b","text":"الخيار ب","correct":false,"feedback":"تغذية راجعة"},
        {"id":"c","text":"الخيار ج","correct":false,"feedback":"تغذية راجعة"}
      ],
      "hint": "تلميح"
    },
    {
      "step": 2, "title": "عنوان", "description": "وصف",
      "type": "input", "question": "سؤال مفتوح",
      "expectedKeywords": ["كلمة1","كلمة2","كلمة3"],
      "hint": "تلميح"
    },
    {
      "step": 3, "title": "عنوان", "description": "وصف",
      "type": "choice", "question": "السؤال",
      "choices": [
        {"id":"a","text":"الخيار أ","correct":false,"feedback":"تغذية راجعة"},
        {"id":"b","text":"الخيار ب","correct":true,"feedback":"تغذية راجعة"},
        {"id":"c","text":"الخيار ج","correct":false,"feedback":"تغذية راجعة"}
      ],
      "hint": "تلميح"
    }
  ],
  "outcome": "ما تعلمه الطالب"
}`;

        const simText = await callClaude(simPrompt, 3000);
        const simMatch = simText.match(/\{[\s\S]*\}/);
        if (simMatch) {
          result.simulation = JSON.parse(simMatch[0]);
        }
      } catch (e) {
        console.error("Simulation generation failed:", e.message);
      }

    // 4. Add video link if requested
    if (enrich.video) {
      const q = encodeURIComponent(result.lesson?.title || "education");
      result.video = {
        url: `https://www.youtube.com/results?search_query=${q}`,
        searchQuery: result.lesson?.title,
      };
    }

    // 5. Always generate concept map
    try {
      const title = result.lesson?.title || "";
      const keyTerms = result.lesson?.keyTerms?.slice(0, 8) || [];
      const sections = result.lesson?.sections?.slice(0, 4) || [];

      const cmPrompt = `You are an educational SVG concept map creator. Create a concept map SVG for this Arabic lesson.

Title: ${title}
Key concepts: ${keyTerms.map(t => t.term).join(", ")}
Sections: ${sections.map(s => s.heading).join(", ")}

Create ONE SVG concept map with:
- viewBox="0 0 700 420" (no fixed width/height)
- White background
- Central node with lesson title (large, navy #1a237e, rounded rect)
- Branch nodes for each section heading (purple #7c3aed)
- Leaf nodes for key terms (green #059669 or amber #f59e0b)
- Lines/arrows connecting nodes showing relationships
- Arabic text in all nodes
- Clean, readable layout with good spacing

Return ONLY the raw SVG string, no JSON, no markdown:
<svg viewBox="0 0 700 420" ...>...</svg>`;

      const cmText = await callClaude(cmPrompt, 6000);
      const svgMatch = cmText.match(/<svg[\s\S]*<\/svg>/);
      if (svgMatch) result.conceptMap = svgMatch[0];
    } catch (e) {
      console.error("Concept map failed:", e.message);
    }

    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Lesson generation failed: " + err.message });
  }
});

// --- Generate SVG diagrams related to lesson content ---
app.post("/generate-images", async (req, res) => {
  const { title, sections, keyTerms } = req.body;

  const prompt = `You are an educational SVG diagram creator. Based on this Arabic lesson, create 3 simple but informative SVG diagrams that visually explain the lesson content.

Lesson title: ${title}
Key terms: ${keyTerms?.slice(0,5).map(t => t.term).join(", ") || ""}
Sections: ${sections?.slice(0,3).map(s => s.heading).join(", ") || ""}

Create 3 SVG diagrams. Each SVG must:
- Be exactly 500x300 pixels
- Have a white or light background
- Use Arabic text labels where appropriate
- Be visually clear and educational
- Directly illustrate a concept from the lesson
- Use colors: #1a237e (navy), #7c3aed (purple), #059669 (green), #f59e0b (amber)

Return ONLY a JSON array with 3 SVG strings:
["<svg>...</svg>", "<svg>...</svg>", "<svg>...</svg>"]

Make each SVG a complete standalone diagram with shapes, arrows, labels that explain the lesson visually.`;

  try {
    const response = await bedrock.send(new InvokeModelCommand({
      modelId: process.env.BEDROCK_MODEL_ID || "us.anthropic.claude-haiku-4-5-20251001-v1:0",
      contentType: "application/json",
      accept: "application/json",
      body: JSON.stringify({
        anthropic_version: "bedrock-2023-05-31",
        max_tokens: 8000,
        messages: [{ role: "user", content: prompt }],
      }),
    }));

    const raw = JSON.parse(Buffer.from(response.body).toString("utf-8"));
    const content = raw.content?.[0]?.text || "";

    // Extract JSON array of SVGs
    const arrMatch = content.match(/\[[\s\S]*\]/);
    if (!arrMatch) throw new Error("No SVG array found");

    const svgs = JSON.parse(arrMatch[0]);
    // Convert SVGs to data URLs
    // Return SVGs as raw strings for direct rendering
    res.json({ images: svgs, type: "svg" });
  } catch (err) {
    console.error("generate-images error:", err.message);
    res.status(500).json({ error: "Image generation failed: " + err.message });
  }
});

// --- Generate rich interactive simulation ---
app.post("/generate-simulation", async (req, res) => {
  const { title, summary, sections } = req.body;
  if (!title) return res.status(400).json({ error: "No title provided" });

  const prompt = `أنت مصمم تعليمي خبير. بناءً على الدرس التالي، أنشئ محاكاة تفاعلية تعليمية غنية باللغة العربية تتطلب من الطالب اتخاذ قرارات حقيقية.

عنوان الدرس: ${title}
الملخص: ${summary || ""}
الأقسام: ${sections?.map(s => s.heading).join("، ") || ""}

أعد الرد بصيغة JSON فقط:
{
  "scenario": "وصف موقف واقعي يضع الطالب في سياق تطبيقي مباشر (2-3 جمل)",
  "role": "دور الطالب في هذه المحاكاة",
  "steps": [
    {
      "step": 1,
      "title": "عنوان الخطوة",
      "description": "شرح الموقف التفاعلي",
      "type": "choice",
      "question": "سؤال يطرحه على الطالب",
      "choices": [
        { "id": "a", "text": "الخيار الأول", "correct": true, "feedback": "تغذية راجعة لهذا الخيار" },
        { "id": "b", "text": "الخيار الثاني", "correct": false, "feedback": "تغذية راجعة لهذا الخيار" },
        { "id": "c", "text": "الخيار الثالث", "correct": false, "feedback": "تغذية راجعة لهذا الخيار" }
      ],
      "hint": "تلميح للطالب"
    },
    {
      "step": 2,
      "title": "عنوان الخطوة",
      "description": "شرح الموقف",
      "type": "input",
      "question": "سؤال يتطلب إجابة مكتوبة من الطالب",
      "expectedKeywords": ["كلمة1", "كلمة2", "كلمة3"],
      "hint": "تلميح"
    },
    {
      "step": 3,
      "title": "عنوان الخطوة",
      "description": "شرح الموقف",
      "type": "choice",
      "question": "سؤال قرار",
      "choices": [
        { "id": "a", "text": "الخيار الأول", "correct": false, "feedback": "تغذية راجعة" },
        { "id": "b", "text": "الخيار الثاني", "correct": true, "feedback": "تغذية راجعة" },
        { "id": "c", "text": "الخيار الثالث", "correct": false, "feedback": "تغذية راجعة" }
      ],
      "hint": "تلميح"
    },
    {
      "step": 4,
      "title": "التطبيق النهائي",
      "description": "الموقف الختامي",
      "type": "choice",
      "question": "السؤال الختامي",
      "choices": [
        { "id": "a", "text": "الخيار الأول", "correct": true, "feedback": "تغذية راجعة" },
        { "id": "b", "text": "الخيار الثاني", "correct": false, "feedback": "تغذية راجعة" },
        { "id": "c", "text": "الخيار الثالث", "correct": false, "feedback": "تغذية راجعة" }
      ],
      "hint": "تلميح"
    }
  ],
  "outcome": "ما تعلمه الطالب من هذه المحاكاة"
}`;

  try {
    const response = await bedrock.send(new InvokeModelCommand({
      modelId: process.env.BEDROCK_MODEL_ID || "us.anthropic.claude-haiku-4-5-20251001-v1:0",
      contentType: "application/json",
      accept: "application/json",
      body: JSON.stringify({
        anthropic_version: "bedrock-2023-05-31",
        max_tokens: 3000,
        messages: [{ role: "user", content: prompt }],
      }),
    }));
    const raw = JSON.parse(Buffer.from(response.body).toString("utf-8"));
    const content = raw.content?.[0]?.text || "";
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("Invalid response");
    res.json(JSON.parse(jsonMatch[0]));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Simulation generation failed: " + err.message });
  }
});

// --- Error handler ---
app.use((err, req, res, next) => {
  res.status(400).json({ error: err.message });
});

app.listen(PORT, "0.0.0.0", async () => {
  await initDb();
  console.log(`Backend running on port ${PORT}`);
});
