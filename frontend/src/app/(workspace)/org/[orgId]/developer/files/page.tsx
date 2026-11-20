"use client";

import React, { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { PanelLayout } from "@/components/layouts/panel-layout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import {
  FileText,
  Upload,
  Download,
  ExternalLink,
  Plus,
  Search,
  FileCode,
  FileSpreadsheet,
  Clock,
} from "lucide-react";
import { developerApi, DeveloperFile } from "@/lib/developer-api";
import { toast } from "sonner";

export default function DeveloperFilesPage() {
  const params = useParams();
  const orgId = (params?.orgId as string) || "org-acme";

  const [files, setFiles] = useState<DeveloperFile[]>([]);
  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [fileName, setFileName] = useState("");
  const [fileUrl, setFileUrl] = useState("");
  const [fileType, setFileType] = useState("application/pdf");
  const [loading, setLoading] = useState(true);

  const loadFiles = async () => {
    setLoading(true);
    const res = await developerApi.getFiles();
    if (res && res.length > 0) {
      setFiles(res);
    } else {
      // Mock fallback
      const mock: DeveloperFile[] = [
        {
          id: "fil-1",
          projectId: "proj-structured-cds",
          workItemId: "wi-101",
          fileName: "Clinical_Decision_Support_OpenAPI_v3.yaml",
          fileSize: 48200,
          fileType: "application/yaml",
          storagePath: "https://storage.prowise.io/specs/cds-openapi-v3.yaml",
          uploadedBy: "usr-developer",
          createdAt: "2026-11-16T10:00:00Z",
        },
        {
          id: "fil-2",
          projectId: "proj-individual-solo",
          fileName: "FHIR_Patient_Ingestion_Architecture_v1.pdf",
          fileSize: 245000,
          fileType: "application/pdf",
          storagePath: "https://storage.prowise.io/docs/fhir-patient-v1.pdf",
          uploadedBy: "usr-developer",
          createdAt: "2026-11-12T14:30:00Z",
        },
        {
          id: "fil-3",
          projectId: "proj-structured-cds",
          workItemId: "wi-102",
          fileName: "Performance_Benchmark_10k_facts.json",
          fileSize: 84000,
          fileType: "application/json",
          storagePath: "https://storage.prowise.io/benchmarks/jmh-10k.json",
          uploadedBy: "usr-developer",
          createdAt: "2026-11-17T16:00:00Z",
        },
      ];
      setFiles(mock);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadFiles();
  }, []);

  const handleUploadRecord = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fileName.trim()) return;

    const payload = {
      projectId: "proj-structured-cds",
      fileName,
      fileUrl: fileUrl || "https://storage.prowise.io/uploads/" + encodeURIComponent(fileName),
      fileSize: 1024 * 50,
      contentType: fileType,
    };

    const res = await developerApi.saveFileRecord(payload);
    const added: DeveloperFile = res || {
      id: `fil-${Date.now()}`,
      projectId: payload.projectId,
      fileName: payload.fileName,
      fileSize: payload.fileSize,
      fileType: payload.contentType,
      storagePath: payload.fileUrl,
      uploadedBy: "usr-developer",
      createdAt: new Date().toISOString(),
    };

    setFiles((prev) => [added, ...prev]);
    setShowModal(false);
    setFileName("");
    setFileUrl("");
    toast.success("Document metadata recorded");
  };

  const filteredFiles = files.filter((f) =>
    f.fileName.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <PanelLayout
      title="Files & Documents"
      breadcrumb={[{ label: "Developer", href: `/org/${orgId}/developer` }, { label: "Files & Documents" }]}
    >
      <div className="space-y-6">
        {/* Header & Controls */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-app-text-primary">Project Files &amp; Artifacts</h2>
            <p className="text-xs text-app-text-secondary mt-0.5">
              API specifications, architecture diagrams, JMH benchmark results, and evidence documents.
            </p>
          </div>
          <div className="flex items-center gap-2.5">
            <div className="relative w-56">
              <Search className="w-3.5 h-3.5 absolute left-3 top-3 text-app-text-muted" />
              <Input
                placeholder="Search documents..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8 text-xs h-9"
              />
            </div>
            <Button
              size="sm"
              onClick={() => setShowModal(true)}
              className="gap-1.5 text-xs bg-blue-600 hover:bg-blue-700 text-white"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Record File</span>
            </Button>
          </div>
        </div>

        {/* File Table */}
        <Card className="p-0 overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>File Name</TableHead>
                <TableHead>Project</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Size</TableHead>
                <TableHead>Uploaded By</TableHead>
                <TableHead>Uploaded Date</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredFiles.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-10 text-xs text-app-text-muted">
                    No files found matching criteria.
                  </TableCell>
                </TableRow>
              ) : (
                filteredFiles.map((file) => (
                  <TableRow key={file.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <FileCode className="w-4 h-4 text-blue-600 shrink-0" />
                        <span className="font-semibold text-xs text-app-text-primary">{file.fileName}</span>
                      </div>
                    </TableCell>
                    <TableCell className="font-mono text-xs text-app-text-secondary">
                      {file.projectId || "General"}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-[10px] font-mono">
                        {file.fileType || "doc"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-app-text-muted">
                      {(file.fileSize / 1024).toFixed(1)} KB
                    </TableCell>
                    <TableCell className="text-xs text-app-text-secondary">{file.uploadedBy}</TableCell>
                    <TableCell className="text-xs text-app-text-muted">
                      {new Date(file.createdAt).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-xs h-7 gap-1"
                        onClick={() => window.open(file.storagePath || file.fileUrl || "#", "_blank")}
                      >
                        <Download className="w-3 h-3" />
                        <span>Download</span>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </Card>

        {/* Upload Modal */}
        {showModal && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-app-surface border border-app-border rounded-xl p-6 w-full max-w-md shadow-2xl space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FileText className="w-5 h-5 text-blue-600" />
                  <h3 className="font-bold text-sm text-app-text-primary">Record Document File</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="text-app-text-muted hover:text-app-text-primary"
                >
                  &times;
                </button>
              </div>

              <form onSubmit={handleUploadRecord} className="space-y-3.5 text-xs">
                <div>
                  <label className="font-medium text-app-text-primary block mb-1">File Name</label>
                  <Input
                    required
                    placeholder="e.g. Architecture_Decision_Record_001.pdf"
                    value={fileName}
                    onChange={(e) => setFileName(e.target.value)}
                    className="text-xs"
                  />
                </div>

                <div>
                  <label className="font-medium text-app-text-primary block mb-1">Storage / External URL</label>
                  <Input
                    placeholder="https://storage.prowise.io/..."
                    value={fileUrl}
                    onChange={(e) => setFileUrl(e.target.value)}
                    className="text-xs"
                  />
                </div>

                <div>
                  <label className="font-medium text-app-text-primary block mb-1">Content Type</label>
                  <select
                    value={fileType}
                    onChange={(e) => setFileType(e.target.value)}
                    className="w-full rounded-md border border-app-border bg-app-bg p-2 text-xs text-app-text-primary"
                  >
                    <option value="application/pdf">PDF Document</option>
                    <option value="application/yaml">YAML Spec / OpenAPI</option>
                    <option value="application/json">JSON Data</option>
                    <option value="text/markdown">Markdown Documentation</option>
                  </select>
                </div>

                <div className="flex justify-end gap-2 pt-2 border-t border-app-border">
                  <Button variant="outline" size="sm" type="button" onClick={() => setShowModal(false)}>
                    Cancel
                  </Button>
                  <Button size="sm" type="submit">
                    Save Record
                  </Button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </PanelLayout>
  );
}
