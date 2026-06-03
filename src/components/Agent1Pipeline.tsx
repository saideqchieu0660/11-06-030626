import { useEffect } from "react";
import { collection, query, where, onSnapshot, doc, updateDoc } from "firebase/firestore";
import { db, auth } from "../lib/firebase";
import { store } from "../lib/store";

export default function Agent1Pipeline({ userId }: { userId: string }) {
  useEffect(() => {
    if (!userId) return;

    // Lắng nghe tài liệu có status = pending
    const q = query(
      collection(db, "resources"), 
      where("status", "==", "pending") // NOTE: Nếu xài global collection, query này cần index. Tốt nhất là lắng nghe tất cả rồi filter bằng code nếu chưa có index, hoặc tạo index.
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      snapshot.docChanges().forEach(async (change) => {
        if (change.type === "added" || change.type === "modified") {
          const docData = change.doc.data();
          const docId = change.doc.id;

          // Chống loop: update tạm thành 'processing'
          const ref = doc(db, "resources", docId);
          await updateDoc(ref, { status: "processing" });

          try {
            // Xác định yêu cầu (mặc định trích xuất)
            const taskType = docData.taskType || "summary";
            
            const currentUser = store.getCurrentUser();
            const idToken = await auth.currentUser?.getIdToken() || "";
            const res = await fetch("/api/agent1/process", {
              method: "POST",
              headers: { 
                "Content-Type": "application/json",
                "Authorization": `Bearer ${idToken}`,
                "x-user-id": currentUser?.id || userId || "",
                "x-user-role": currentUser?.role || "student"
              },
              body: JSON.stringify({ 
                text: docData.content, 
                taskType: taskType 
              })
            });

            if (!res.ok) {
              const errData = await res.json();
              throw new Error(errData.error || "API Agent 1 lỗi");
            }

            const data = await res.json();

            // Ghi kết quả về Firestore
            await updateDoc(ref, { 
              status: "processed", 
              processedResult: data.result 
            });

            console.log(`[Agent 1] Xử lý xong tài nguyên: ${docId}`);

          } catch (error: any) {
            console.error(`[Agent 1] Lỗi khi xử lý ${docId}:`, error);
            await updateDoc(ref, { 
              status: "error", 
              errorReason: error.message || "Lỗi xử lý AI" 
            });
          }
        }
      });
    }, (error) => {
      console.error("[Agent 1] Watcher lỗi:", error);
    });

    return () => unsubscribe();
  }, [userId]);

  return null; // Chạy ngầm, không render UI
}
