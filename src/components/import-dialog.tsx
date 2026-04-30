"use client";

import { useState, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Folder, Globe, Upload } from "lucide-react";

export function ImportDialog({ onImport }: { onImport: () => void }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  async function importRepo(type: string, value: string) {
    setLoading(true);
    const body = type === "local" ? { type: "local", localPath: value } : { type: "git", gitUrl: value };
    await fetch("/api/repos", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    setLoading(false);
    setOpen(false);
    onImport();
  }

  async function uploadFile(file: File) {
    setLoading(true);
    const form = new FormData();
    form.append("file", file);
    await fetch("/api/repos", { method: "POST", body: form });
    setLoading(false);
    setOpen(false);
    onImport();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2"><Plus className="h-4 w-4" /> 导入仓库</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md bg-zinc-900 border-zinc-800">
        <DialogHeader><DialogTitle>导入代码仓库</DialogTitle></DialogHeader>
        <Tabs defaultValue="local" className="mt-4">
          <TabsList className="grid grid-cols-3 bg-zinc-800">
            <TabsTrigger value="local" className="gap-1"><Folder className="h-3 w-3" /> 本地</TabsTrigger>
            <TabsTrigger value="git" className="gap-1"><Globe className="h-3 w-3" /> Git</TabsTrigger>
            <TabsTrigger value="upload" className="gap-1"><Upload className="h-3 w-3" /> 上传</TabsTrigger>
          </TabsList>
          <TabsContent value="local">
            <ImportForm type="local" label="本地路径" placeholder="/path/to/project" loading={loading} onSubmit={importRepo} />
          </TabsContent>
          <TabsContent value="git">
            <ImportForm type="git" label="Git URL" placeholder="https://github.com/user/repo.git" loading={loading} onSubmit={importRepo} />
          </TabsContent>
          <TabsContent value="upload">
            <UploadForm loading={loading} onUpload={uploadFile} />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

function ImportForm({ type, label, placeholder, loading, onSubmit }: {
  type: string; label: string; placeholder: string; loading: boolean;
  onSubmit: (type: string, value: string) => void;
}) {
  const [value, setValue] = useState("");
  return (
    <div className="space-y-3 mt-2">
      <Input placeholder={placeholder} value={value} onChange={(e) => setValue(e.target.value)} className="bg-zinc-800 border-zinc-700" />
      <Button onClick={() => onSubmit(type, value)} disabled={!value || loading} className="w-full">
        {loading ? "导入中..." : "导入"}
      </Button>
    </div>
  );
}

function UploadForm({ loading, onUpload }: { loading: boolean; onUpload: (file: File) => void }) {
  const [file, setFile] = useState<File | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="space-y-3 mt-2">
      <div
        className="border-2 border-dashed border-zinc-700 rounded-lg p-8 text-center cursor-pointer hover:border-zinc-500 transition-colors"
        onClick={() => inputRef.current?.click()}
      >
        {file ? (
          <div>
            <p className="text-sm text-zinc-300">{file.name}</p>
            <p className="text-xs text-zinc-500 mt-1">{(file.size / 1024 / 1024).toFixed(1)} MB</p>
          </div>
        ) : (
          <div>
            <Upload className="h-6 w-6 mx-auto text-zinc-500 mb-2" />
            <p className="text-sm text-zinc-500">点击选择 .zip / .tar.gz / .tgz 文件</p>
          </div>
        )}
        <input ref={inputRef} type="file" accept=".zip,.tar.gz,.tgz,.tar" className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) setFile(f); }} />
      </div>
      <Button onClick={() => file && onUpload(file)} disabled={!file || loading} className="w-full">
        {loading ? "导入中..." : "导入"}
      </Button>
    </div>
  );
}
