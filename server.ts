import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import { google } from "googleapis";
import dotenv from "dotenv";

dotenv.config();

// Rate Limit Defense: 3 API Keys
const API_KEYS = [
  process.env.GEMINI_API_KEY_1 || process.env.GEMINI_API_KEY || "",
  process.env.GEMINI_API_KEY_2 || process.env.GEMINI_API_KEY || "",
  process.env.GEMINI_API_KEY_3 || process.env.GEMINI_API_KEY || ""
].filter(Boolean);

let currentKeyIndex = 0;

function getGeminiClient() {
  if (API_KEYS.length === 0) {
    throw new Error("No Gemini API keys configured.");
  }
  const apiKey = API_KEYS[currentKeyIndex];
  currentKeyIndex = (currentKeyIndex + 1) % API_KEYS.length;
  return new GoogleGenAI({ apiKey });
}

const app = express();
const PORT = 3000;

app.use(express.json({ limit: "50mb" }));

// JWT Helper for Firebase ID Tokens
  const decodeFirebaseToken = (token: string) => {
    try {
      const parts = token.split(".");
      if (parts.length !== 3) return null;
      const payload = Buffer.from(parts[1], "base64").toString("utf8");
      return JSON.parse(payload);
    } catch (e) {
      return null;
    }
  };

  // Safe Firestore REST API fetch for securing user roles
  const getUserRoleFromFirestore = async (userId: string, idToken: string): Promise<string | null> => {
    const projectId = process.env.VITE_FIREBASE_PROJECT_ID;
    if (!projectId) {
      return null;
    }
    const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/users/${userId}`;
    try {
      const res = await fetch(url, {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${idToken}`
        }
      });
      if (!res.ok) {
        console.error(`Firestore API check failed for user ${userId}:`, res.status);
        return null;
      }
      const docData = await res.json();
      return docData?.fields?.role?.stringValue || null;
    } catch (error) {
      console.error(`Error fetching user role from Firestore REST API:`, error);
      return null;
    }
  };

  // Rate Limit Defense: In-memory store for student AI cooldown tracking (15 seconds)
  const studentAICooldowns = new Map<string, number>();

  // Simple periodic cleanup to prevent memory growth (removes expired keys older than 1 minute)
  setInterval(() => {
    const now = Date.now();
    for (const [key, timestamp] of studentAICooldowns.entries()) {
      if (now - timestamp > 60000) {
        studentAICooldowns.delete(key);
      }
    }
  }, 60000);

  // Authenticated Robust Cooldown Filter
  const aiCooldownMiddleware = async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    let userId = req.headers["x-user-id"] as string;
    let userRole = req.headers["x-user-role"] as string;

    const authHeader = req.headers["authorization"];
    if (authHeader && authHeader.startsWith("Bearer ")) {
      const idToken = authHeader.substring(7);
      const decoded = decodeFirebaseToken(idToken);
      if (decoded && decoded.user_id) {
        userId = decoded.user_id;
        // Authenticate token to fetch exact role from Firestore DB
        const dbRole = await getUserRoleFromFirestore(userId, idToken);
        if (dbRole) {
          userRole = dbRole;
        }
      }
    }

    if (userRole === "student" && userId) {
      const lastRequest = studentAICooldowns.get(userId);
      const now = Date.now();
      if (lastRequest && now - lastRequest < 15000) {
        const timeLeft = Math.ceil((15000 - (now - lastRequest)) / 1000);
        return res.status(429).json({
          error: `Bạn đang trong trạng thái đóng băng thời gian gọi AI (Cooldown 15 giây). Hãy đợi thêm ${timeLeft} giây nữa.`
        });
      }
      studentAICooldowns.set(userId, now);
    }
    next();
  };

  // In-memory pending queue for decks imported from Google Drive
  let pendingDecks: Array<{
    id: string;
    title: string;
    fileName: string;
    subject: string;
    cards: Array<{
      id: string;
      front: string;
      back: string;
      subject: string;
      mastery: number;
      nextReview: number;
      isHard: boolean;
    }>;
    timestamp: number;
  }> = [];

  // Agent 1: Manual Extractor endpoint (called by manual upload pipeline)
  app.post("/api/agent1/extract", aiCooldownMiddleware, async (req, res) => {
    try {
      const { text } = req.body;
      if (!text) {
        return res.status(400).json({ error: "Missing text payload for extraction." });
      }
      const ai = getGeminiClient();
      const prompt = `Trích xuất nội dung sau thành Flashcard học tập. Trả về ĐÚNG MỘT MẢNG JSON duy nhất chứa danh sách các phần tử theo dạng: {"front": "...", "back": "...", "subject": "..."}. Không bọc trong phong cách markdown code blocks (\`\`\`json).\n\nVăn bản nguồn:\n${text}`;
      
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          temperature: 0.2
        }
      });
      
      res.json({ result: response.text });
    } catch (error: any) {
      console.error("Agent 1 Manual Extract Error:", error);
      res.status(500).json({ error: error.message || "Failed to extract flashcards" });
    }
  });

  // Agent 1: Data Pipeline Extractor
  app.post("/api/agent1/process", aiCooldownMiddleware, async (req, res) => {
    try {
      const { text, taskType } = req.body;
      const ai = getGeminiClient();
      
      let prompt = "";
      if (taskType === "flashcard") {
        prompt = `Trích xuất nội dung sau thành Flashcard. Trả về ĐÚNG MỘT MẢNG JSON duy nhất chứa: {"front": "...", "back": "...", "subject": "..."}. Không markdown block.\n\nVăn bản: ${text}`;
      } else if (taskType === "summary") {
        prompt = `Tóm tắt ngắn gọn, đi thẳng vào ý chính của nội dung sau. Phục vụ cho học tập. Không dùng bảng biểu phức tạp.\n\nVăn bản: ${text}`;
      } else {
        prompt = `Phân tích và trích xuất thông tin quan trọng từ tài liệu sau:\n\nVăn bản: ${text}`;
      }
      
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
        config: taskType === "flashcard" ? { responseMimeType: "application/json", temperature: 0.2 } : { temperature: 0.3 }
      });
      
      res.json({ result: response.text });
    } catch (error) {
      console.error("Agent 1 Pipeline Error:", error);
      res.status(500).json({ error: "Failed to process data" });
    }
  });

  // Agent 1: Route to receive file chunks from Google Apps Script and process with Gemini
  app.post("/api/agent1/apps-script-push", async (req, res) => {
    try {
      const { fileName, fileId, mimeType, subject } = req.body;
      if (!fileId) {
        return res.status(400).json({ error: "No fileId received from Google Apps Script." });
      }

      console.log(`[Apps Script Push] Received file payload: "${fileName}" (ID: ${fileId}, Type: ${mimeType})`);

      if (!process.env.GOOGLE_SERVICE_ACCOUNT_KEY) {
        console.error("GOOGLE_SERVICE_ACCOUNT_KEY is not defined in environment variables.");
        return res.status(500).json({ error: "Service account is not configured." });
      }

      const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY);
      const auth = new google.auth.GoogleAuth({
        credentials,
        scopes: ['https://www.googleapis.com/auth/drive.readonly']
      });
      const drive = google.drive({ version: 'v3', auth });

      let buffer: Buffer;
      let passMimeType = mimeType || 'text/plain';

      console.log(`[Apps Script Push] Fetching file from Google Drive...`);
      if (passMimeType.startsWith('application/vnd.google-apps.document') || passMimeType.startsWith('application/vnd.google-apps.presentation')) {
        // Export Google Docs/Slides as PDF
        const response = await drive.files.export({
          fileId,
          mimeType: 'application/pdf'
        }, { responseType: 'arraybuffer' });
        buffer = Buffer.from(response.data as ArrayBuffer);
        passMimeType = 'application/pdf';
      } else if (passMimeType.startsWith('application/vnd.google-apps.spreadsheet')) {
        // Export Google Sheets as CSV
        const response = await drive.files.export({
          fileId,
          mimeType: 'text/csv'
        }, { responseType: 'arraybuffer' });
        buffer = Buffer.from(response.data as ArrayBuffer);
        passMimeType = 'text/plain';
      } else {
        // Get generic file (PDF, TXT, image, etc.)
        const response = await drive.files.get({
          fileId,
          alt: 'media'
        }, { responseType: 'arraybuffer' });
        buffer = Buffer.from(response.data as ArrayBuffer);
      }
      
      console.log(`[Apps Script Push] File fetched successfully, size: ${buffer.length} bytes. Passing to Gemini...`);

      const ai = getGeminiClient();
      const prompt = `Trích xuất văn bản/hình ảnh học tập sau để tạo thành bộ thẻ Flashcard. Bắt buộc phản hồi bằng ĐÚNG MỘT MẢNG JSON duy nhất chứa danh sách các thẻ có định dạng cấu trúc: {"front": "...", "back": "...", "subject": "..."}. Không dùng khối markdown codeblock.`;

      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: {
           parts: [
             { text: prompt },
             { inlineData: { data: buffer.toString('base64'), mimeType: passMimeType } }
           ]
        },
        config: {
          responseMimeType: "application/json",
          temperature: 0.25
        }
      });

      let cards: any[] = [];
      try {
        const jsonStr = response.text.replace(/```json/g, "").replace(/```/g, "").trim();
        const parsed = JSON.parse(jsonStr);
        if (Array.isArray(parsed)) {
          cards = parsed.map((c, i) => ({
            id: `drive_card_${Date.now()}_${i}`,
            front: c.front || "Concept",
            back: c.back || "Detail",
            subject: c.subject || subject || "general",
            mastery: 0,
            nextReview: Date.now(),
            isHard: false
          }));
        }
      } catch (parseError) {
        console.error("Failed to parse Gemini JSON results:", parseError);
        return res.status(422).json({ error: "Gemini response was not a valid study JSON structured format." });
      }

      // ... (Rest of existing apps script logic)


      // Add to our pending decks queue
      const rawTitle = fileName ? fileName.replace(/\.[^/.]+$/, "") : `Set Drive ${new Date().toLocaleDateString()}`;
      const newImportedDeck = {
        id: `pending_deck_${Date.now()}`,
        title: rawTitle,
        fileName: fileName || "Untitled Document",
        subject: subject || "general",
        cards,
        timestamp: Date.now()
      };

      pendingDecks.push(newImportedDeck);
      console.log(`[Queue Added] Inserted pending deck "${rawTitle}" with ${cards.length} cards.`);

      res.json({
        success: true,
        message: "File text parsed and buffered to developer's review inbox successfully!",
        cardCount: cards.length
      });
    } catch (e: any) {
      console.error("Agent 1 Apps Script Push Error:", e);
      res.status(500).json({ error: e.message || "Failed to process Google Drive text payload" });
    }
  });

  // Fetch all pending decks processed from Google Drive
  app.get("/api/agent1/pending-decks", (req, res) => {
    res.json({ pendingDecks });
  });

  // Approve or discard processed decks
  app.post("/api/agent1/approve-deck", (req, res) => {
    try {
      const { id } = req.body;
      pendingDecks = pendingDecks.filter(d => d.id !== id);
      res.json({ success: true, remaining: pendingDecks.length });
    } catch (error) {
      res.status(500).json({ error: "Failed to dismiss pending deck item" });
    }
  });



  // Agent 2: Dynamic Router Agent (Deep Extract)
  app.post("/api/agent2/explain", aiCooldownMiddleware, async (req, res) => {
    try {
      const { term, definition, subject } = req.body;
      const ai = getGeminiClient();
      
      let prompt = "";
      if (subject === "english") {
        prompt = `Mày là Chuyên gia Ngôn ngữ học. Phân tích từ vựng tiếng Anh "${term}" (Định nghĩa: ${definition}). 
YÊU CẦU QUAN TRỌNG: Hãy viết lời giải thích súc tích, đầy đủ ý nghĩa với độ dài tổng cộng khoảng 100 đến 200 từ. Tránh quá ngắn cụt lủn cũng không dài dòng.
Trình bày kết quả theo cấu trúc markdown chuẩn, BẮT BUỘC dùng nhiều emoji/icon sinh động phù hợp ngữ cảnh, chia thành các danh mục sau:
1. Từ loại & Phiên âm IPA 🔤 (Có phiên âm chuẩn và phân loại từ cụ thể)
2. Nghĩa tiếng Việt & Giải nghĩa chi tiết 🇻🇳 (Dịch rõ nghĩa cảnh dùng thông dụng nhất)
3. Etymology (Nguồn gốc lịch sử hình thành từ) 🏛️ (Kể câu chuyện lịch sử ngắn gọn, dễ hiểu về từ này)
4. 2 câu ví dụ thực tế phong phú kèm dịch nghĩa 📝 (Sử dụng ngữ cảnh giao tiếp tự nhiên)
Chỉ trả ra nội dung phân tích (markdown).`;
      } else {
        prompt = `Mày là Giáo sư Khoa học/Xã hội. Phân tích khái niệm/định luật "${term}" (Định nghĩa: ${definition}).
YÊU CẦU QUAN TRỌNG: Hãy giải thích ý nghĩa mang tính giáo dục sâu sắc, có độ dài tổng cộng khoảng 100 đến 200 từ để vừa đủ tiếp thu nhanh vừa giàu chiều sâu.
Trình bày kết quả bằng markdown, BẮT BUỘC dùng nhiều emoji/icon sinh động, chia thành các danh mục sau:
1. Định nghĩa chính thức & Bản chất cốt lõi 📖 (1-2 câu định nghĩa súc tích)
2. Công thức hoặc Bối cảnh ra đời 🧪 (Giải thích cụ thể biểu thức hoặc bối cảnh lịch sử tìm ra, bọc tất cả công thức/biểu thức toán/lý/hóa trong dấu $ cho inline và $$ cho block để thư viện MathJax/KaTeX render)
3. 2 ứng dụng thực tiễn nổi bật 🚀 (Mỗi ứng dụng giải thích ngắn gọn lợi ích thực tế)
4. Một mẹo ghi nhớ tinh tế 🧠
BẮT BUỘC ép hiển thị LaTeX chuẩn: Mọi công thức toán/lý/hóa phải bọc trong dấu $ cho inline và $$ cho block toán học. Chỉ trả ra nội dung phân tích (markdown).`;
      }

      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt
        // removed responseMimeType since it's HTML/markdown
      });
      
      res.json({ result: response.text });
    } catch (error) {
      console.error("Agent 2 Error:", error);
      res.status(500).json({ error: "Failed to explain" });
    }
  });

  // Mock Exam Generator
  app.post("/api/exam/generate", aiCooldownMiddleware, async (req, res) => {
    try {
      const { decks, examType, count } = req.body;
      const ai = getGeminiClient();

      const contextData = JSON.stringify(decks.map((d: any) => ({
        deckId: d.id,
        deckTitle: d.title,
        cards: d.cards.map((c: any) => ({ cardId: c.id, front: c.front, back: c.back }))
      })));

      let prompt = `Bạn là một AI được thiết kế để tạo bài kiểm tra tự động từ các thẻ (flashcards) được cung cấp.
Dữ liệu Flashcards:
${contextData}

Yêu cầu: Hãy tạo một đề thi gồm ${count || 10} câu hỏi trắc nghiệm (Multiple Choice) từ các flashcards này. Mỗi thẻ có thể dùng để tạo câu hỏi về nội dung "front" hỏi "back" hoặc ngược lại, hoặc suy luận từ nội dung. Các lựa chọn sai (distractors) phải hợp lý và không quá dễ đoán. Đảo lộn vị trí đáp án đúng. Nghĩa là correctAnswerIndex có thể từ 0 đến 3 ngẫu nhiên.
BẮT BUỘC ĐỊNH DẠNG: Chỉ trả về ĐÚNG MỘT MẢNG JSON duy nhất, không markdown code block, không text thừa.
Định dạng JSON:
[
  {
    "cardId": "string - ID của thẻ đang được kiểm tra",
    "deckId": "string - ID của deck chứa thẻ này",
    "question": "string - Câu hỏi trắc nghiệm",
    "options": ["string", "string", "string", "string"],
    "correctAnswerIndex": number - Chỉ số của đáp án đúng (từ 0 đến 3),
    "explanation": "string - Giải thích ngắn vì sao lại chọn đáp án này"
  }
]`;

      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          temperature: 0.3
        }
      });

      res.json({ result: response.text });
    } catch (error) {
      console.error("Exam Generation Error:", error);
      res.status(500).json({ error: "Failed to generate exam" });
    }
  });

  // AI Quick Lesson Plan Generator (Tạo Giáo Án Nhanh)
  app.post("/api/agent/lesson-plan", aiCooldownMiddleware, async (req, res) => {
    try {
      const { topic } = req.body;
      if (!topic) return res.status(400).json({ error: "No topic provided." });
      
      const ai = getGeminiClient();
      let prompt = `Bạn là một chuyên gia thiết kế chương trình giảng dạy (Instructional Designer).
Hãy tạo một giáo án học tập tối ưu cho chủ đề: "${topic}".
Giáo án cần đảm bảo đủ kiến thức sâu sắc, logic và dễ hiểu.
KHÔNG sử dụng Markdown code block. TRẢ VỀ ĐÚNG MỘT OBJECT JSON DUY NHẤT.

Định dạng JSON:
{
  "roadmap": [
    { "step": 1, "title": "Tên bài học", "description": "Mô tả ngắn gọn" }
  ],
  "concepts": [
    { "term": "Khái niệm", "definition": "Định nghĩa hoặc giải thích dễ hiểu" }
  ],
  "flashcards": [
    { "front": "Câu hỏi/Từ khóa", "back": "Câu trả lời/Định nghĩa", "subject": "${topic}" }
  ]
}`;

      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          temperature: 0.3
        }
      });
      
      res.json({ result: response.text });
    } catch (error: any) {
      console.error("Lesson Plan Error:", error);
      res.status(500).json({ error: error.message || "Failed to generate lesson plan" });
    }
  });

  // Agent 3: Socratic & Context-Aware Assistant
  app.post("/api/agent3/chat", aiCooldownMiddleware, async (req, res) => {
    try {
      const { message, context, mode, mcqData, difficulty } = req.body;
      const ai = getGeminiClient();
      
      let systemPrompt = `Mày là Agent 3 - 'Socrates AI Coach', gia sư học tập chủ động. QUY TẮC BẮT BUỘC:
1. SOCRATIC METHOD: KHÔNG BAO GIỜ giải bài tập hộ hay cho đáp án trực tiếp. Khi học sinh hỏi, hãy gợi ý từng bước, đưa manh mối và kết thúc bằng một câu hỏi ngược để học sinh tự suy luận.
2. CONTEXT-AWARE: Mày sẽ nhận được Context ẩn (thẻ học sinh đang xem). Nếu học sinh dùng từ 'Cái này', 'Từ này', hãy tự động liên kết với Context đó để trả lời.
3. FORMATTING: Ngắn gọn, thân thiện, dùng LaTeX ($$, $) cho mọi công thức Toán/Lý/Hóa.`;

      if (mode === "quiz") {
          const diffLevel = difficulty || "medium";
          systemPrompt += `\n\nNhiệm vụ: Tạo một trò chơi trắc nghiệm 3 câu hỏi liên tiếp dựa trên context thẻ yếu được cung cấp. Cấp độ khó: ${diffLevel}. Đầu vào là yêu cầu người dùng: ${message}`;
          if (mcqData) {
            let difficultyGuidance = "Cấp độ trung bình.";
            if (diffLevel === "easy") difficultyGuidance = "Cấp độ dễ: Hỏi trực tiếp định nghĩa cơ bản, nhận biết trực tiếp.";
            if (diffLevel === "medium") difficultyGuidance = "Cấp độ trung bình: Yêu cầu hiểu sâu hơn, áp dụng cơ bản.";
            if (diffLevel === "hard") difficultyGuidance = "Cấp độ khó: Đánh đố, vận dụng cao, suy luận logic tổng hợp.";
            
            const mcqPrompt = `Tạo một bài Test 15 câu trắc nghiệm MCQ dựa trên danh sách các thẻ yếu sau đây. \nĐộ khó: ${difficultyGuidance}\nTrả về đúng 1 mảng JSON chứa các object: {"question": "...", "options": ["A...","B...","C...","D..."], "correctIndex": 0..3, "explanation": "..."}. KHÔNG trả về gì khác ngoài JSON.\nDữ liệu hổng kiến thức: ${JSON.stringify(mcqData)}`;
            const response = await ai.models.generateContent({
                model: "gemini-2.5-flash",
                contents: mcqPrompt,
                config: { responseMimeType: "application/json" }
            });
            return res.json({ result: response.text });
          }
      }
      
      const fullPrompt = `Ngữ cảnh ẩn (Hidden Context): ${context}\n\nHọc sinh: ${message}`;

      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: [
            { role: "user", parts: [{ text: systemPrompt }] },
            { role: "model", parts: [{ text: "Đã hiểu." }] },
            { role: "user", parts: [{ text: fullPrompt }] }
        ]
      });
      
      res.json({ result: response.text });
    } catch (error) {
      console.error("Agent 3 Error:", error);
      res.status(500).json({ error: "Failed to generate context" });
    }
  });

// Vite middleware for development
async function setupViteAndStart() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on port ${PORT}`);
  });
}

if (!process.env.VERCEL) {
  setupViteAndStart();
}

export default app;
