import { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useDropzone } from "react-dropzone";
import toast from "react-hot-toast";
import api from "../services/api";
import { UploadCloud, FileText, X, Loader } from "lucide-react";

export default function UploadPage() {
  const navigate = useNavigate();
  const [title, setTitle] = useState("");
  const [jdText, setJdText] = useState("");
  const [files, setFiles] = useState([]);
  const [step, setStep] = useState("jd"); // "jd" | "resumes" | "processing"
  const [jobId, setJobId] = useState(null);
  const [loading, setLoading] = useState(false);

  const onDrop = useCallback((accepted, rejected) => {
    if (rejected.length > 0) {
      toast.error("Only PDF and DOCX files are accepted (max 5MB each)");
    }
    setFiles((prev) => [...prev, ...accepted].slice(0, 20));
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "application/pdf": [".pdf"],
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [".docx"],
    },
    maxSize: 5 * 1024 * 1024,
    multiple: true,
  });

  const handleSubmitJD = async () => {
    if (!title.trim()) return toast.error("Enter a job title");
    if (jdText.trim().length < 50) return toast.error("Job description must be at least 50 characters");

    setLoading(true);
    try {
      const res = await api.post("/jobs", { title: title.trim(), jd_text: jdText.trim() });
      setJobId(res.data.job._id);
      setStep("resumes");
      toast.success("Job created & JD parsed!");
    } catch (err) {
      toast.error(err.response?.data?.error || "Failed to create job");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitResumes = async () => {
    if (files.length === 0) return toast.error("Upload at least one resume");

    const formData = new FormData();
    files.forEach((f) => formData.append("resumes", f));

    setLoading(true);
    setStep("processing");
    try {
      await api.post(`/jobs/${jobId}/resumes`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      toast.success("Resumes uploaded! Processing in background...");
      navigate(`/jobs/${jobId}/results`);
    } catch (err) {
      toast.error(err.response?.data?.error || "Upload failed");
      setStep("resumes");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-xl font-semibold mb-6">Create New Job</h1>

      {/* Step 1 – Job Description */}
      <div className={`bg-white rounded-xl border p-6 mb-4 ${step !== "jd" ? "opacity-60 pointer-events-none" : "border-indigo-200"}`}>
        <h2 className="font-medium mb-4 text-gray-800">Step 1 — Job Description</h2>
        <input
          type="text"
          placeholder="Job title (e.g. Senior React Developer)"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-indigo-300"
        />
        <textarea
          placeholder="Paste the full job description here..."
          value={jdText}
          onChange={(e) => setJdText(e.target.value)}
          rows={8}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-indigo-300"
        />
        <button
          onClick={handleSubmitJD}
          disabled={loading}
          className="mt-4 w-full bg-indigo-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 flex items-center justify-center gap-2 transition"
        >
          {loading && step === "jd" ? <><Loader size={14} className="animate-spin" /> Parsing JD...</> : "Parse JD & Continue"}
        </button>
      </div>

      {/* Step 2 – Resume Upload */}
      <div className={`bg-white rounded-xl border p-6 ${step === "jd" ? "opacity-40 pointer-events-none" : step === "resumes" ? "border-indigo-200" : "opacity-60"}`}>
        <h2 className="font-medium mb-4 text-gray-800">Step 2 — Upload Resumes</h2>
        <div
          {...getRootProps()}
          className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition ${
            isDragActive ? "border-indigo-400 bg-indigo-50" : "border-gray-300 hover:border-indigo-300"
          }`}
        >
          <input {...getInputProps()} />
          <UploadCloud size={32} className="mx-auto text-gray-400 mb-2" />
          <p className="text-sm text-gray-600">Drag & drop PDF or DOCX resumes here</p>
          <p className="text-xs text-gray-400 mt-1">Max 20 files · 5MB each</p>
        </div>

        {files.length > 0 && (
          <ul className="mt-4 space-y-2">
            {files.map((file, i) => (
              <li key={i} className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2 text-sm">
                <span className="flex items-center gap-2 text-gray-700">
                  <FileText size={14} className="text-indigo-400" />
                  {file.name}
                </span>
                <button onClick={() => setFiles((f) => f.filter((_, idx) => idx !== i))}>
                  <X size={14} className="text-gray-400 hover:text-red-400" />
                </button>
              </li>
            ))}
          </ul>
        )}

        <button
          onClick={handleSubmitResumes}
          disabled={loading || files.length === 0}
          className="mt-4 w-full bg-green-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50 flex items-center justify-center gap-2 transition"
        >
          {loading && step === "processing" ? <><Loader size={14} className="animate-spin" /> Uploading...</> : `Run Agent on ${files.length} Resume${files.length !== 1 ? "s" : ""}`}
        </button>
      </div>
    </div>
  );
}
