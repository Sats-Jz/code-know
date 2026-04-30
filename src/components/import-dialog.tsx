"use client";

import { useState } from "react";
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
            <TabsTrigger value="upload" disabled className="gap-1"><Upload className="h-3 w-3" /> 上传</TabsTrigger>
          </TabsList>
          <TabsContent value="local">
            <ImportForm type="local" label="本地路径" placeholder="/path/to/project" loading={loading} onSubmit={importRepo} />
          </TabsContent>
          <TabsContent value="git">
            <ImportForm type="git" label="Git URL" placeholder="https://github.com/user/repo.git" loading={loading} onSubmit={importRepo} />
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
