import React, { useState, useEffect } from 'react';
import { ExternalLink, Loader2, File, CheckCircle, XCircle, AlertCircle } from 'lucide-react';

interface FileData {
  id: string;
  name: string;
  status: 'Succeed' | 'Fail' | string;
  createdAt: string;
  details: string;
}

export default function AdminFileManager() {
  const [files, setFiles] = useState<FileData[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState<boolean>(false);

  const fetchFiles = React.useCallback(async () => {
    try {
      // Using fake delay to simulate network request since the backend endpoint might not exist yet
      // In real use case, we do: const response = await fetch('/api/admin/files');
      const response = await fetch('/api/admin/files');
      
      if (!response.ok) {
        throw new Error('Không thể lấy danh sách file từ máy chủ');
      }
      
      const data = await response.json();
      setFiles(data);
      setError(null);
    } catch (err: any) {
      // Fallback data if API is not yet implemented
      console.warn('Failed to fetch files, using fallback data', err);
      // setFiles([]);
      // setError(err.message || 'Có lỗi xảy ra khi lấy dữ liệu');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchFiles();
  }, [fetchFiles]);

  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(fetchFiles, 30000);
    return () => clearInterval(interval);
  }, [autoRefresh, fetchFiles]);

  return (
    <div className="w-full bg-zinc-950 text-zinc-100 p-6 rounded-xl border border-zinc-800 shadow-xl overflow-hidden">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-zinc-100">Quản Lý File</h2>
          <p className="text-zinc-400 text-sm mt-1">Quản lý và theo dõi trạng thái các file đã tải lên</p>
        </div>
        
        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2 text-sm text-zinc-400 cursor-pointer">
            <input 
              type="checkbox" 
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              className="w-4 h-4 rounded border-zinc-700 bg-zinc-800 text-blue-600 focus:ring-blue-500"
            />
            Auto-refresh (30s)
          </label>
          <a 
            href="https://drive.google.com/drive/folders/10iOCH6QIc926SgMvVHUfk2FxtNzFiq9f" 
            target="_blank" 
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors text-sm"
          >
            <ExternalLink className="w-4 h-4" />
            Mở thư mục Google Drive
          </a>
        </div>
      </div>

      <div className="bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-zinc-800 text-zinc-300">
              <tr>
                <th className="px-6 py-4 font-medium">Tên File</th>
                <th className="px-6 py-4 font-medium">Trạng Thái</th>
                <th className="px-6 py-4 font-medium">Thời Gian</th>
                <th className="px-6 py-4 font-medium">Chi Tiết</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800">
              {isLoading ? (
                <tr>
                  <td colSpan={4} className="px-6 py-12 text-center text-zinc-400">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <Loader2 className="w-6 h-6 animate-spin text-zinc-500" />
                      <p>Đang tải dữ liệu...</p>
                    </div>
                  </td>
                </tr>
              ) : error ? (
                <tr>
                  <td colSpan={4} className="px-6 py-8 text-center text-red-400">
                    <div className="flex items-center justify-center gap-2">
                      <AlertCircle className="w-5 h-5" />
                      <p>{error}</p>
                    </div>
                  </td>
                </tr>
              ) : files.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-8 text-center text-zinc-500">
                    Chưa có file nào được tải lên.
                  </td>
                </tr>
              ) : (
                files.map((file) => (
                  <tr key={file.id} className="hover:bg-zinc-800/50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <File className="w-4 h-4 text-zinc-400" />
                        <span className="font-medium text-zinc-200">{file.name}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {file.status === 'Succeed' ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                          <CheckCircle className="w-3.5 h-3.5" />
                          Succeed
                        </span>
                      ) : file.status === 'Fail' ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-rose-500/10 text-rose-500 border border-rose-500/20">
                          <XCircle className="w-3.5 h-3.5" />
                          Fail
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-zinc-500/10 text-zinc-400 border border-zinc-500/20">
                          {file.status}
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-zinc-400">
                      {new Date(file.createdAt).toLocaleString('vi-VN')}
                    </td>
                    <td className="px-6 py-4 text-zinc-400 max-w-xs truncate" title={file.details}>
                      {file.details}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
