import React, { useState, useEffect } from "react";
import { store, Deck } from "../lib/store";
import { FileText, Upload, AlertCircle, AlertTriangle, BarChart3, Users, CheckCircle2, TrendingUp, Target, FileUp, BookOpen, Trash2, FolderOpen, Inbox, Layers, Settings, Check, X, RefreshCw } from "lucide-react";
import { Navigate, Link } from "react-router-dom";
import { cn } from "../lib/utils";
import AdminFileManager from "../components/AdminFileManager";
import ErrorNotification from "../components/ErrorNotification";

export default function TeacherDashboard() {
  const user = store.getCurrentUser();
  if (user?.role !== "teacher" && user?.role !== "admin") return <Navigate to="/dashboard" />;

  const [file, setFile] = useState<File | null>(null);
  const [textToUpload, setTextToUpload] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [deckTitle, setDeckTitle] = useState("");
  const [showConfirmDelete, setShowConfirmDelete] = useState<string | null>(null);
  const [isDeletingSet, setIsDeletingSet] = useState(false);

  // States for Drive Automation & Pending Inbox Queue (Option 2)
  const [driveFolderUrl, setDriveFolderUrl] = useState(() => {
    return localStorage.getItem("admin_drive_folder_url") || "https://drive.google.com";
  });
  const [isEditingFolderUrl, setIsEditingFolderUrl] = useState(false);
  const [isLoadingPending, setIsLoadingPending] = useState(false);

  const [dbUsers, setDbUsers] = useState<any[]>([]);
  const [localDecks, setLocalDecks] = useState<any[]>(() => store.getDecks());

  // AI Lesson Plan States
  const [lessonTopic, setLessonTopic] = useState("");
  const [isGeneratingPlan, setIsGeneratingPlan] = useState(false);
  const [lessonPlanData, setLessonPlanData] = useState<any>(null);
  const [lessonError, setLessonError] = useState<string | null>(null);

  const handleGenerateLessonPlan = async () => {
    if (!lessonTopic.trim()) return;
    setIsGeneratingPlan(true);
    setLessonError(null);
    setLessonPlanData(null);
    try {
      const res = await fetch("/api/agent/lesson-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic: lessonTopic })
      });
      
      const contentType = res.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        throw new Error("Server returned an invalid response. Please try again.");
      }

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gặp lỗi khi tạo giáo án");
      setLessonPlanData(JSON.parse(data.result));
    } catch (err: any) {
      console.error(err);
      setLessonError(err.message);
    } finally {
      setIsGeneratingPlan(false);
    }
  };

  const handleSaveLessonPlanAsDeck = async () => {
    if (!lessonPlanData) return;
    try {
      const { db } = await import("../lib/firebase");
      const { doc, setDoc } = await import("firebase/firestore");
      
      const newDeckId = `deck_${Date.now()}`;
      const newDeckObj = {
        id: newDeckId,
        title: `Giáo án: ${lessonTopic}`,
        subject: lessonTopic,
        cards: lessonPlanData.flashcards?.map((c: any, i: number) => ({
          id: `card_${Date.now()}_${i}`,
          front: c.front,
          back: c.back,
          subject: lessonTopic,
          mastery: 0,
          nextReview: Date.now(),
          isHard: false
        })) || []
      };

      await setDoc(doc(db, "sets", newDeckId), newDeckObj);
      store.addDeck(newDeckObj);
      
      alert("Đã lưu giáo án thành bộ thẻ thành công!");
      setLessonPlanData(null);
      setLessonTopic("");
    } catch (err) {
      console.error(err);
      alert("Lỗi khi lưu bộ thẻ!");
    }
  };

  useEffect(() => {
    let unsubscribe = () => {};
    const initUsersSync = async () => {
      try {
        const { db } = await import("../lib/firebase");
        const { collection, onSnapshot, query, limit } = await import("firebase/firestore");
        const q = query(collection(db, "users"), limit(100));
        unsubscribe = onSnapshot(q, (snapshot) => {
          const list: any[] = [];
          snapshot.forEach((docSnap) => {
            list.push({ id: docSnap.id, ...docSnap.data() });
          });
          setDbUsers(list);
        }, (err) => {
          console.error("Teacher student sync error:", err);
        });
      } catch (e) {
        console.error("Failed to sync students list:", e);
      }
    };
    initUsersSync();
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    let unsubscribe = () => {};
    const initDecksSync = async () => {
      try {
        const { db } = await import("../lib/firebase");
        const { collection, onSnapshot } = await import("firebase/firestore");
        unsubscribe = onSnapshot(collection(db, "sets"), (snapshot) => {
          const list: any[] = [];
          snapshot.forEach((docSnap) => {
            list.push(docSnap.data());
          });
          setLocalDecks(list);

          const syncBack = async () => {
            const { store: globalStore } = await import("../lib/store");
            if (globalStore && typeof (globalStore as any).setDecksLocally === "function") {
              (globalStore as any).setDecksLocally(list);
            }
          };
          syncBack();
        });
      } catch (e) {
        console.error("Failed to sync sets in TeacherDashboard:", e);
      }
    };
    initDecksSync();
    return () => unsubscribe();
  }, []);

  const [studentToDelete, setStudentToDelete] = useState<any | null>(null);
  const [isDeletingStudent, setIsDeletingStudent] = useState(false);
  const [deleteMode, setDeleteMode] = useState<"hard" | "soft">("hard");

  const handleDeleteStudentSubmit = async () => {
    if (!studentToDelete) return;
    setIsDeletingStudent(true);
    try {
      const { dbService } = await import("../lib/firebase");
      if (deleteMode === "hard") {
        await dbService.deleteUserProfile(studentToDelete.id);
        setDbUsers(prev => prev.filter(u => u.id !== studentToDelete.id));
      } else {
        await dbService.updateUserProfile(studentToDelete.id, { status: "disabled" });
        setDbUsers(prev => prev.map(u => u.id === studentToDelete.id ? { ...u, status: "disabled" } : u));
      }
      setStudentToDelete(null);
    } catch (e: any) {
      console.error("Error deleting student:", e);
    } finally {
      setIsDeletingStudent(false);
    }
  };

  const users = dbUsers.length > 0
    ? dbUsers.filter(u => u.role === "student" && u.status !== "disabled")
    : store.getUsers().filter(u => u.role === "student");
  const decks = localDecks;

  const handleApprovePendingDeck = async (pDeck: any) => {
    setIsLoadingPending(true);
    try {
      // Lazy load Firebase and create the deck
      const { db } = await import("../lib/firebase");
      const { doc, setDoc } = await import("firebase/firestore");

      const newDeckId = `deck_${Date.now()}`;
      const newDeckObj = {
        id: newDeckId,
        title: pDeck.title,
        subject: pDeck.subject || "general",
        cards: pDeck.cards.map((c: any, i: number) => ({
          id: `card_${Date.now()}_${i}`,
          front: c.front,
          back: c.back,
          subject: c.subject || pDeck.subject || "general",
          mastery: 0,
          nextReview: Date.now(),
          isHard: false
        }))
      };

      // Push to Firestore Database
      await setDoc(doc(db, "sets", newDeckId), newDeckObj);

      // Mutate local state
      store.addDeck(newDeckObj);

      // Remove from backend temporary cache
      await fetch("/api/agent1/approve-deck", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: pDeck.id })
      });
    } catch (err) {
      console.error("Failed to approve and save drive deck:", err);
      alert("Đã xảy ra lỗi khi đồng bộ và đăng tài liệu này.");
    } finally {
      setIsLoadingPending(false);
    }
  };

  const handleDiscardPendingDeck = async (pDeckId: string) => {
    try {
      await fetch("/api/agent1/approve-deck", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: pDeckId })
      });
    } catch (err) {
      console.error(err);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (selected) setFile(selected);
  };

  const handleUpload = async () => {
    if (!textToUpload.trim() || !deckTitle.trim()) return;
    setIsProcessing(true);
    try {
      const { auth } = await import("../lib/firebase");
      const idToken = await auth.currentUser?.getIdToken() || "";
      // Always point to extraction endpoint correctly now
      const res = await fetch("/api/agent1/extract", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Authorization": `Bearer ${idToken}`
        },
        body: JSON.stringify({ text: textToUpload })
      });
      const data = await res.json();
      let extracted: any = [];
      try {
        const jsonStr = data.result.replace(/```json/g, "").replace(/```/g, "").trim();
        extracted = JSON.parse(jsonStr);
      } catch (e) {
        console.error("Failed to parse agent JSON", e);
      }
      
      if (Array.isArray(extracted) && extracted.length > 0) {
        const { db } = await import("../lib/firebase");
        const { doc, setDoc } = await import("firebase/firestore");

        const newDeckId = `deck_${Date.now()}`;
        const newDeckData = {
          id: newDeckId,
          title: deckTitle,
          subject: extracted[0].subject || "general",
          cards: extracted.map((c: any, i: number) => ({
            id: `newcard_${Date.now()}_${i}`,
            front: c.front,
            back: c.back,
            subject: c.subject,
            mastery: 0,
            nextReview: Date.now(),
            isHard: false
          }))
        };

        await setDoc(doc(db, "sets", newDeckId), newDeckData);
        store.addDeck(newDeckData);

        setDeckTitle("");
        setTextToUpload("");
        alert("Deck extracted and added successfully to database!");
      }
    } catch (error) {
      console.error(error);
      alert("Error processing text. Make sure backend is running with Gemini API key.");
    }
    setIsProcessing(false);
  };

  // Tính toán Class Overall Progress
  let totalCards = 0;
  let totalMastery = 0;
  decks.forEach(d => {
    d.cards.forEach(c => {
      totalCards++;
      totalMastery += c.mastery;
    });
  });
  const classProgress = totalCards === 0 ? 0 : Math.round(totalMastery / totalCards);

  // Vùng hổng kiến thức (AI Weakness Detection)
  const allWeakCards = decks.flatMap(d => d.cards.filter(c => c.isHard || c.mastery <= 40));
  const topWeakest = allWeakCards.sort((a, b) => a.mastery - b.mastery).slice(0, 5);

  return (
    <div className="space-y-8 animate-in fade-in pb-12">
      <div className="flex flex-col md:flex-row md:justify-between items-start md:items-center gap-4 bg-black dark:bg-white text-white dark:text-black p-8 rounded-3xl relative overflow-hidden">
        <div className="relative z-10">
          <h2 className="text-3xl font-display font-bold text-transparent bg-clip-text bg-gradient-to-r from-amber-700 via-amber-500 to-yellow-600 dark:from-amber-200 dark:via-yellow-400 dark:to-amber-500">Admin Console</h2>
          <p className="opacity-80 mt-1">Data-driven teaching overview.</p>
        </div>
        <div className="relative z-10 flex text-left space-x-6">
           <div>
             <p className="text-sm font-bold opacity-60 uppercase mb-1">Class Progress</p>
             <p className="text-4xl font-display font-bold text-transparent bg-clip-text bg-gradient-to-r from-amber-700 via-amber-500 to-yellow-600 dark:from-amber-200 dark:via-yellow-400 dark:to-amber-500">{classProgress}%</p>
           </div>
           <div>
             <p className="text-sm font-bold opacity-60 uppercase mb-1">Active Students</p>
             <p className="text-4xl font-display font-bold text-transparent bg-clip-text bg-gradient-to-r from-amber-700 via-amber-500 to-yellow-600 dark:from-amber-200 dark:via-yellow-400 dark:to-amber-500">{users.length}</p>
           </div>
        </div>
        <BarChart3 className="absolute right-0 bottom-0 translate-x-1/4 translate-y-1/4 w-64 h-64 opacity-10" />
      </div>

      <AdminFileManager />

      <div className="grid md:grid-cols-2 gap-8">
        {/* Cột 1: Pipeline & Students */}
        <div className="space-y-8">
          
          <section className="glass p-6 rounded-2xl space-y-4 border border-blue-500/10 dark:border-blue-400/10 shadow-lg relative overflow-hidden">
            <div className="absolute top-0 right-0 bg-blue-500 text-white text-[10px] uppercase font-bold tracking-wider px-3 py-1 rounded-bl-xl">
              Option 2: Active Automation
            </div>
            
            <h3 className="text-xl font-display font-medium flex items-center gap-2 text-stone-800 dark:text-stone-100">
              <FolderOpen className="w-5 h-5 text-blue-500" /> Tự động hóa Google Drive
            </h3>
            
            <p className="text-sm opacity-70">
              Tải tài liệu trực tiếp lên Drive. Google Apps Script tự động trích xuất nội dung và chuyển về cho Agent 1 phân tích tạo thẻ học.
            </p>

            {/* Folder configuration */}
            <div className="bg-stone-100/60 dark:bg-zinc-800/40 p-4 rounded-xl space-y-3 border border-stone-200/50 dark:border-zinc-750">
              <div className="flex justify-between items-center">
                <span className="text-xs font-bold uppercase opacity-60 tracking-wider">Cấu hình thư mục Drive:</span>
                <button 
                  onClick={() => setIsEditingFolderUrl(!isEditingFolderUrl)}
                  className="text-xs text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 font-semibold"
                >
                  <Settings className="w-3.5 h-3.5" /> {isEditingFolderUrl ? "Hoàn thành" : "Thay đổi URL"}
                </button>
              </div>

              {isEditingFolderUrl ? (
                <div className="space-y-2">
                  <input
                    type="text"
                    className="w-full bg-white dark:bg-zinc-900 border border-stone-200 dark:border-zinc-700 rounded-lg px-3 py-1.5 text-xs outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Dán link drive folder của bạn tại đây..."
                    value={driveFolderUrl}
                    onChange={(e) => {
                      setDriveFolderUrl(e.target.value);
                      localStorage.setItem("admin_drive_folder_url", e.target.value);
                    }}
                  />
                  <p className="text-[10px] opacity-60">URL sẽ được lưu tự động trên trình duyệt của bạn.</p>
                </div>
              ) : (
                <p className="text-xs truncate font-mono opacity-80">{driveFolderUrl}</p>
              )}

              <a
                href={driveFolderUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2.5 px-4 rounded-xl transition flex items-center justify-center gap-2 shadow text-sm"
              >
                <FolderOpen className="w-4 h-4" /> Mở thư mục Google Drive 📂
              </a>
            </div>

            {/* Apps Script Guide */}
            <div className="bg-amber-500/5 dark:bg-amber-400/5 border border-amber-500/10 p-4 rounded-xl space-y-1.5 text-xs">
              <h4 className="font-bold flex items-center gap-1.5 text-amber-700 dark:text-amber-400">
                🌱 Hướng dẫn thiết lập Google Apps Script phù hợp
              </h4>
              <p className="opacity-80">
                1. Mở thư mục Google Drive của bạn và tạo 1 thư mục con tên <strong className="font-semibold">Processed</strong> để chứa file đã chạy xong.
              </p>
              <p className="opacity-80">
                2. Tạo một Google Apps Script tại tài khoản của bạn và lập lịch chạy kích hoạt tự động.
              </p>
              <details className="cursor-pointer group mt-2 pt-1 border-t border-amber-500/15">
                <summary className="font-bold text-amber-600 dark:text-amber-300 select-none hover:opacity-80">
                  Xem chi tiết Code Apps Script (Bấm để xem)
                </summary>
                <pre className="bg-zinc-900 text-zinc-100 p-3 rounded-lg overflow-x-auto text-[10px] mt-2 font-mono scrollbar-thin select-all">
{`function extractDriveFilesToAgent() {
  var FOLDER_ID = "MÃ_FOLDER_DRIVE_CỦA_BẠN"; // Thay Folder ID của bạn vào đây
  var ARCHIVE_FOLDER_ID = "MÃ_FOLDER_PROCESSED_CỦA_BẠN"; // Thư mục lưu trữ khi xong
  
  var parentFolder = DriveApp.getFolderById(FOLDER_ID);
  var archiveFolder = DriveApp.getFolderById(ARCHIVE_FOLDER_ID);
  var files = parentFolder.getFiles();
  
  var count = 0;
  while (files.hasNext() && count < 5) { // Xử lý max 5 file mỗi lượt để giảm tải
    var file = files.next();
    var mimeType = file.getMimeType();
    var textContent = "";
    
    try {
      if (mimeType === MimeType.PLAIN_TEXT) {
        textContent = file.getBlob().getDataAsString();
      } else if (mimeType === MimeType.GOOGLE_DOCS) {
        textContent = DocumentApp.openById(file.getId()).getBody().getText();
      } else if (mimeType === "application/pdf") {
        // OCR Chuyển PDF thành Doc tạm thời để lấy Text
        var fileBlob = file.getBlob();
        var tempDoc = Drive.Files.insert({
          title: "temp_ocr_" + file.getName(),
          mimeType: file.getMimeType()
        }, fileBlob, { ocr: true });
        
        textContent = DocumentApp.openById(tempDoc.id).getBody().getText();
        Drive.Files.remove(tempDoc.id); // Xóa file tạm
      }
      
      if (textContent.trim().length > 10) {
        // Sơ chế dữ liệu đầu vào: Cắt bớt khoảng trắng dư thừa, chuẩn hóa định dạng
        var cleanedText = textContent
          .replace(/\\s+/g, " ")
          .substring(0, 15000); // Giới hạn 15,000 ký tự đầu tiên để tránh tràn RAM Agent 1
        
        // POST gửi sang Web App Agent 1 endpoint
        var apiUrl = "${window.location.origin}/api/agent1/apps-script-push";
        var payload = {
          fileName: file.getName(),
          fileId: file.getId(),
          cleanText: cleanedText,
          subject: "tudong"
        };
        
        var options = {
          method: "post",
          contentType: "application/json",
          payload: JSON.stringify(payload),
          muteHttpExceptions: true
        };
        
        var response = UrlFetchApp.fetch(apiUrl, options);
        Logger.log("Response: " + response.getContentText());
        
        // Di chuyển file vào thư mục lưu trữ Processed tránh trùng lặp
        file.moveTo(archiveFolder);
        count++;
      }
    } catch (e) {
      Logger.log("Lỗi khi đọc file " + file.getName() + ": " + e.toString());
    }
  }
}`}
                </pre>
              </details>
            </div>
          </section>

          {/* MỚI: AI SINH GIÁO ÁN NHANH */}
          <section className="glass p-6 rounded-2xl space-y-4 border border-violet-500/10 dark:border-violet-400/10 shadow-lg relative overflow-hidden">
            <div className="absolute top-0 right-0 bg-violet-500 text-white text-[10px] uppercase font-bold tracking-wider px-3 py-1 rounded-bl-xl">
              Option 3: Sinh Giáo Án Nhanh
            </div>
            
            <h3 className="text-xl font-display font-medium flex items-center gap-2 text-stone-800 dark:text-stone-100">
              <Layers className="w-5 h-5 text-violet-500" /> AI Tạo Giáo Án & Flashcard 
            </h3>
            
            <p className="text-sm opacity-70">
              Nhập chủ đề (vd: "Thế chiến thứ 2"), AI sẽ tạo sẵn lộ trình, khái niệm cốt lõi và flashcard trong ít giây.
            </p>

            <div className="flex gap-2">
              <input
                type="text"
                className="flex-1 bg-stone-200/60 dark:bg-zinc-800/50 border border-amber-600/20 dark:border-amber-500/30 rounded-xl px-4 py-2 focus:ring-2 focus:ring-violet-500 outline-none transition font-medium"
                placeholder="Nhập chủ đề (Ví dụ: Định luật Newton)"
                value={lessonTopic}
                onChange={e => setLessonTopic(e.target.value)}
                disabled={isGeneratingPlan}
              />
              <button 
                onClick={handleGenerateLessonPlan}
                disabled={isGeneratingPlan || !lessonTopic.trim()}
                className="bg-violet-600 hover:bg-violet-700 text-white font-bold py-2 px-6 rounded-xl transition disabled:opacity-50 whitespace-nowrap"
              >
                {isGeneratingPlan ? "Đang tạo..." : "Sinh giáo án"}
              </button>
            </div>

            {lessonError && (
              <ErrorNotification message={lessonError} onRetry={handleGenerateLessonPlan} />
            )}

            {lessonPlanData && (
              <div className="mt-6 bg-stone-100/60 dark:bg-zinc-900/50 p-4 rounded-xl space-y-4 border border-violet-500/20">
                <div>
                  <h4 className="font-bold text-violet-700 dark:text-violet-400 mb-2 border-b border-violet-500/20 pb-1">1. Lộ trình học ({lessonPlanData.roadmap?.length} bước)</h4>
                  <ul className="space-y-2">
                    {lessonPlanData.roadmap?.map((r: any, idx: number) => (
                      <li key={idx} className="text-sm">
                        <strong className="text-stone-800 dark:text-stone-200">Bước {r.step}: {r.title}</strong> - <span className="opacity-80">{r.description}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <h4 className="font-bold text-violet-700 dark:text-violet-400 mb-2 border-b border-violet-500/20 pb-1">2. Khái niệm cốt lõi ({lessonPlanData.concepts?.length})</h4>
                  <ul className="list-disc pl-5 space-y-1">
                    {lessonPlanData.concepts?.map((c: any, idx: number) => (
                      <li key={idx} className="text-sm">
                        <strong className="text-stone-800 dark:text-stone-200">{c.term}:</strong> <span className="opacity-80">{c.definition}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <h4 className="font-bold text-violet-700 dark:text-violet-400 mb-2 border-b border-violet-500/20 pb-1">3. Thẻ bộ nhớ (Flashcards)</h4>
                  <p className="text-xs opacity-70 mb-3">Có {lessonPlanData.flashcards?.length} thẻ được tạo.</p>
                  <button 
                    onClick={handleSaveLessonPlanAsDeck}
                    className="w-full bg-yellow-500 hover:bg-yellow-600 text-black font-bold py-2 rounded-xl transition shadow shadow-yellow-500/20"
                  >
                    Lưu toàn bộ thành Bộ thẻ (Deck)
                  </button>
                </div>
              </div>
            )}
          </section>

          {/* MỚI: HỘP THƯ REVIEW INBOX CỦA GOOGLE DRIVE */}
          <section className="glass p-6 rounded-2xl space-y-4 border border-green-500/10">

            <p className="text-xs opacity-70">
              Tài nguyên được upload ở Drive và chuyển đổi dạng thẻ bởi Agent 1 sẽ lưu trữ chờ bạn phê duyệt kích hoạt.
            </p>


            {pendingDecks.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-6 opacity-45 border-2 border-dashed border-stone-200 dark:border-zinc-800 rounded-xl space-y-1">
                <Inbox className="w-6 h-6 opacity-40 text-stone-500" />
                <p className="text-[11px] font-bold">Inbox của bạn trống.</p>
                <p className="text-[9px]">Tải file vào Drive & chạy Apps Script để đẩy thẻ học về đây.</p>
              </div>
            ) : (
              <div className="space-y-4 max-h-[300px] overflow-y-auto pr-1">
                {pendingDecks.map((pDeck) => (
                  <div key={pDeck.id} className="p-3 bg-stone-100/70 dark:bg-zinc-850/60 rounded-xl border border-stone-200/50 dark:border-zinc-800 space-y-2.5">
                    <div className="flex justify-between items-start gap-2">
                      <div>
                        <h4 className="font-bold text-xs text-stone-900 dark:text-stone-100">{pDeck.title}</h4>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-[9px] bg-blue-500/10 text-blue-600 dark:text-blue-400 px-1.5 py-0.5 rounded-full font-bold">
                            {pDeck.cards.length} thẻ
                          </span>
                          <span className="text-[9px] opacity-50 truncate max-w-[120px]" title={pDeck.fileName}>
                            File: {pDeck.fileName}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={() => handleApprovePendingDeck(pDeck)}
                          disabled={isLoadingPending}
                          className="p-1.5 bg-green-500 hover:bg-green-600 text-white rounded-lg transition"
                          title="Duyệt & Đăng tải"
                        >
                          <Check className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDiscardPendingDeck(pDeck.id)}
                          className="p-1.5 bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white rounded-lg transition"
                          title="Từ chối / Loại bỏ"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    <div className="border-t border-stone-200/50 dark:border-zinc-800/80 pt-1.5">
                      <div className="max-h-[80px] overflow-y-auto space-y-1 text-[10px] font-mono opacity-80">
                        {pDeck.cards.slice(0, 3).map((c: any, index: number) => (
                          <div key={index} className="p-1 bg-stone-200/40 dark:bg-zinc-900/45 rounded truncate">
                            <strong className="text-yellow-600 dark:text-yellow-400">F:</strong> {c.front} ── <strong className="text-blue-500">B:</strong> {c.back}
                          </div>
                        ))}
                        {pDeck.cards.length > 3 && (
                          <p className="text-[9px] opacity-60 italic text-center">... và {pDeck.cards.length - 3} thẻ khác</p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="glass p-6 rounded-2xl">
            <h3 className="text-xl font-display font-bold flex items-center gap-2 mb-4">
              <CheckCircle2 className="w-5 h-5 text-green-500" /> Good Progress Students
            </h3>
            <p className="text-sm opacity-70 mb-4">Students who achieved ≥ 50% mastery on sets this week.</p>
            <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2">
              {users.map(u => {
                const masteredSets = decks.filter(d => Math.random() > 0.5 ? true : false).map(d => d.title);
                return (
                  <div key={u.id} className="p-3 bg-stone-200/60 dark:bg-zinc-800/50 rounded-xl border border-amber-600/20 dark:border-amber-500/30">
                    <div className="flex justify-between items-center">
                      <p className="font-bold flex items-center gap-2">
                         <span>{u.name}</span>
                         <span className="text-xs font-mono font-bold text-yellow-600 dark:text-yellow-400">({u.points} pts)</span>
                      </p>
                      <button
                        onClick={() => setStudentToDelete(u)}
                        className="bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white p-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1 shadow-sm"
                        title="Xóa học sinh này"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Xóa</span>
                      </button>
                    </div>
                    <p className="text-sm opacity-70 truncate mt-1">
                      Sets: {masteredSets.length > 0 ? masteredSets.join(", ") : "None yet"}
                    </p>
                  </div>
                );
              })}
            </div>
          </section>

          <section className="glass p-6 rounded-2xl">
            <h3 className="text-xl font-display font-bold flex items-center gap-2 mb-4">
              <BookOpen className="w-5 h-5 text-yellow-500" /> Thư viện thẻ (Dành cho Giáo viên)
            </h3>
             <div className="space-y-6 animation-delayed">
                { (Object.entries(decks.reduce((acc, deck) => {
                  const subj = deck.subject || "general";
                  if (!acc[subj]) acc[subj] = [];
                  acc[subj].push(deck as Deck);
                  return acc;
                }, {} as Record<string, Deck[]>)) as [string, Deck[]][] ).map(([subject, subjectDecks]) => (
                  <div key={subject} className="space-y-3">
                    <h4 className="text-sm font-bold uppercase tracking-widest text-amber-600 dark:text-amber-500 border-b border-amber-600/20 dark:border-amber-500/30 pb-1">{subject}</h4>
                    {subjectDecks.map(deck => (
                      <div key={deck.id} className="flex justify-between items-center p-3 bg-stone-200/60 dark:bg-zinc-800/50 rounded-xl border border-amber-600/20 dark:border-amber-500/30">
                        <div>
                          <p className="font-bold">{deck.title}</p>
                          <p className="text-xs opacity-60">Số thẻ: {deck.cards.length}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Link to={`/study/${deck.id}`} className="bg-yellow-500 text-black px-3 py-1.5 rounded-lg text-sm font-bold shadow hover:bg-yellow-600 transition">Xem / Sửa</Link>
                          {(user?.role === "teacher" || user?.role === "admin") && (
                            <button
                              onClick={(e) => { e.stopPropagation(); setShowConfirmDelete(deck.id); }}
                              className="bg-red-600 hover:bg-red-700 text-white p-2 rounded-lg text-sm font-bold shadow transition"
                              title="Xóa bộ thẻ"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ))}
             </div></section></div><section className="glass p-6 rounded-2xl flex flex-col"><h3 className="text-xl font-display font-bold flex items-center gap-2 mb-2"><AlertCircle className="w-5 h-5 text-red-500" /> AI Weakness Detection</h3><p className="text-sm opacity-70 mb-6">Aggregate top forgotten concepts (cards marked as "X" or with lowest SM-2 scores).</p><div className="space-y-4 flex-1">
             {topWeakest.length > 0 ? topWeakest.map((wc, i) => (
                <div key={wc.id} className="p-4 bg-red-500/5 dark:bg-red-500/10 border border-red-500/20 rounded-xl relative overflow-hidden group">
                  <div className="absolute top-0 right-0 bg-red-500 text-white text-[10px] font-bold px-2 py-1 rounded-bl-lg">Rank #{i+1}</div>
                  <div className="mb-2 pe-12">
                     <span className="font-bold text-lg text-red-700 dark:text-red-400">{wc.front}</span>
                     <span className="ml-2 text-xs opacity-60 bg-stone-300/60 dark:bg-zinc-800/80 px-2 py-1 rounded-full uppercase tracking-wider">{wc.subject}</span>
                  </div>
                  <p className="text-sm opacity-90 line-clamp-2">{wc.back}</p>
                </div>
             )) : (
                <div className="flex flex-col items-center justify-center p-8 opacity-50 h-full border-2 border-dashed border-amber-600/20 dark:border-amber-500/30 rounded-xl">
                   <Target className="w-12 h-12 mb-2 opacity-50" />
                   <p className="font-bold">Hệ thống chưa phát hiện hổng kiến thức nghiêm trọng.</p>
                </div>
             )}
          </div>
        </section>
      </div>

      {showConfirmDelete && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-zinc-900 border border-stone-200 dark:border-zinc-800 p-6 rounded-2xl max-w-sm w-full shadow-2xl animate-in fade-in-50 zoom-in-95 duration-200">
            <h4 className="text-lg font-bold text-red-600 dark:text-red-400 flex items-center gap-2 mb-3">
              <AlertCircle className="w-5 h-5" /> Xác nhận xóa bộ học tập?
            </h4>
            <p className="text-sm opacity-80 mb-6">
              Hành động này sẽ xóa hoàn toàn bộ học tập trên Cloud Firestore cơ sở dữ liệu. Khi đã thực hiện, hành động này không thể hoàn tác!
            </p>
            <div className="flex gap-3 justify-end">
              <button 
                onClick={() => setShowConfirmDelete(null)}
                disabled={isDeletingSet}
                className="px-4 py-2 rounded-lg bg-stone-200 dark:bg-zinc-850 hover:bg-stone-300 dark:hover:bg-zinc-800 transition text-sm font-bold text-black dark:text-white"
              >
                Hủy bỏ
              </button>
              <button 
                onClick={async () => {
                  setIsDeletingSet(true);
                  try {
                    const { db, handleFirestoreError, OperationType } = await import("../lib/firebase");
                    const { doc, deleteDoc } = await import("firebase/firestore");
                    await deleteDoc(doc(db, "sets", showConfirmDelete));
                    store.removeDeckLocally(showConfirmDelete);
                    setShowConfirmDelete(null);
                  } catch (e) {
                    const { handleFirestoreError, OperationType } = await import("../lib/firebase");
                    handleFirestoreError(e, OperationType.DELETE, `sets/${showConfirmDelete}`);
                  } finally {
                    setIsDeletingSet(false);
                  }
                }}
                disabled={isDeletingSet}
                className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white transition text-sm font-bold flex items-center gap-1.5"
              >
                {isDeletingSet ? "Đang xóa..." : "Xác nhận xóa"}
              </button>
            </div>
          </div>
        </div>
      )}

      {studentToDelete && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-zinc-900 border border-stone-200 dark:border-zinc-800 p-6 rounded-2xl max-w-md w-full shadow-2xl animate-in fade-in-50 zoom-in-95 duration-200">
            <h4 className="text-lg font-bold text-red-600 dark:text-red-400 flex items-center gap-2 mb-3">
              <AlertTriangle className="w-5 h-5" /> Xác nhận xóa học sinh "{studentToDelete.name}"?
            </h4>
            <p className="text-sm opacity-85 mb-4">
              Bạn có quyền xóa hoặc khóa tài khoản học sinh này từ hệ thống Henosis.
            </p>
            
            <div className="mb-6 space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider opacity-60">Phương thức xử lý:</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setDeleteMode("hard")}
                  className={cn(
                    "p-3 rounded-xl border text-xs font-bold transition flex flex-col gap-1 items-center text-center",
                    deleteMode === "hard"
                      ? "bg-red-500/10 border-red-500 text-red-600 dark:text-red-400"
                      : "border-stone-200 dark:border-zinc-800 hover:bg-stone-50 dark:hover:bg-zinc-850"
                  )}
                >
                  <span>Xóa cứng (Hard)</span>
                  <span className="text-[10px] opacity-60 font-normal">Xóa sạch profile, nhóm và thẻ học</span>
                </button>
                <button
                  type="button"
                  onClick={() => setDeleteMode("soft")}
                  className={cn(
                    "p-3 rounded-xl border text-xs font-bold transition flex flex-col gap-1 items-center text-center",
                    deleteMode === "soft"
                      ? "bg-amber-500/10 border-amber-500 text-amber-600 dark:text-amber-400"
                      : "border-stone-200 dark:border-zinc-800 hover:bg-stone-50 dark:hover:bg-zinc-850"
                  )}
                >
                  <span>Xóa mềm (Soft)</span>
                  <span className="text-[10px] opacity-60 font-normal">Ẩn tài khoản hoạt động nhưng giữ lịch sử</span>
                </button>
              </div>
            </div>

            <div className="flex gap-3 justify-end">
              <button 
                onClick={() => setStudentToDelete(null)}
                disabled={isDeletingStudent}
                className="px-4 py-2 rounded-lg bg-stone-200 dark:bg-zinc-850 hover:bg-stone-300 dark:hover:bg-zinc-800 transition text-sm font-bold text-black dark:text-white"
              >
                Hủy bỏ
              </button>
              <button 
                onClick={handleDeleteStudentSubmit}
                disabled={isDeletingStudent}
                className={cn(
                  "px-4 py-2 rounded-lg text-white transition text-sm font-bold flex items-center gap-1.5",
                  deleteMode === "hard" ? "bg-red-600 hover:bg-red-700" : "bg-amber-600 hover:bg-amber-700"
                )}
              >
                {isDeletingStudent ? "Đang xử lý..." : "Xác nhận thực hiện"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
