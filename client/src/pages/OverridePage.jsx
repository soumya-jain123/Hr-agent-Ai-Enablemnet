import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import api from "../services/api";
import toast from "react-hot-toast";
import { ArrowLeft, Save } from "lucide-react";

const DIMENSIONS = [
  { key: "skills_match", label: "Skills Match", weight: "30%" },
  { key: "experience_relevance", label: "Experience Relevance", weight: "25%" },
  { key: "education", label: "Education & Certifications", weight: "15%" },
  { key: "projects", label: "Project / Portfolio", weight: "20%" },
  { key: "communication", label: "Communication Quality", weight: "10%" },
];

export default function OverridePage() {
  const { jobId, candidateId } = useParams();
  const navigate = useNavigate();
  const [candidate, setCandidate] = useState(null);
  const [dimension, setDimension] = useState("skills_match");
  const [newScore, setNewScore] = useState(5);
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api.get(`/candidates/${candidateId}`)
      .then((r) => {
        setCandidate(r.data);
        const currentScore = r.data.scores?.skills_match?.score ?? 5;
        setNewScore(currentScore);
      })
      .catch(console.error);
  }, [candidateId]);

  const handleDimensionChange = (dim) => {
    setDimension(dim);
    const current = candidate?.scores?.[dim]?.score ?? 5;
    setNewScore(current);
  };

  const handleSubmit = async () => {
    if (!reason.trim() || reason.trim().length < 5) {
      return toast.error("Please enter a reason (min 5 characters)");
    }
    setLoading(true);
    try {
      const res = await api.patch(`/candidates/${candidateId}/override`, {
        dimension,
        new_score: Number(newScore),
        reason: reason.trim(),
      });
      toast.success(`Score updated! New total: ${res.data.new_total_score}/10`);
      navigate(`/jobs/${jobId}/results`);
    } catch (err) {
      toast.error(err.response?.data?.error || "Override failed");
    } finally {
      setLoading(false);
    }
  };

  if (!candidate) return <p className="text-gray-500">Loading candidate...</p>;

  const selectedDim = DIMENSIONS.find((d) => d.key === dimension);
  const originalScore = candidate.scores?.[dimension]?.score ?? "—";
  const justification = candidate.scores?.[dimension]?.justification ?? "";

  return (
    <div className="max-w-lg mx-auto">
      <button
        onClick={() => navigate(`/jobs/${jobId}/results`)}
        className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-5"
      >
        <ArrowLeft size={14} /> Back to results
      </button>

      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h1 className="font-semibold text-gray-900 mb-1">Override Score</h1>
        <p className="text-sm text-gray-500 mb-5">
          Candidate: <strong>{candidate.parsed_profile?.name || candidate.original_filename}</strong>
        </p>

        {/* Dimension selector */}
        <label className="block text-sm font-medium text-gray-700 mb-1">Dimension</label>
        <select
          value={dimension}
          onChange={(e) => handleDimensionChange(e.target.value)}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-indigo-300"
        >
          {DIMENSIONS.map((d) => (
            <option key={d.key} value={d.key}>
              {d.label} ({d.weight})
            </option>
          ))}
        </select>

        {/* Current AI score */}
        <div className="bg-gray-50 rounded-lg p-3 mb-4 text-sm">
          <p className="text-gray-500">AI score for <strong>{selectedDim?.label}</strong></p>
          <p className="text-2xl font-bold text-indigo-600 mt-0.5">{originalScore}<span className="text-sm text-gray-400 font-normal">/10</span></p>
          {justification && <p className="text-gray-500 text-xs mt-1 italic">"{justification}"</p>}
        </div>

        {/* New score slider */}
        <label className="block text-sm font-medium text-gray-700 mb-1">
          New Score: <span className="text-indigo-600 font-bold">{newScore}</span>
        </label>
        <input
          type="range"
          min={0}
          max={10}
          step={1}
          value={newScore}
          onChange={(e) => setNewScore(Number(e.target.value))}
          className="w-full accent-indigo-600 mb-4"
        />
        <div className="flex justify-between text-xs text-gray-400 -mt-3 mb-4">
          <span>0 – Poor</span><span>5 – Average</span><span>10 – Excellent</span>
        </div>

        {/* Reason */}
        <label className="block text-sm font-medium text-gray-700 mb-1">Reason for Override *</label>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="e.g. Candidate has additional unpublished work directly relevant to this role."
          rows={3}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-indigo-300 mb-5"
        />

        <button
          onClick={handleSubmit}
          disabled={loading}
          className="w-full bg-indigo-600 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 flex items-center justify-center gap-2 transition"
        >
          <Save size={14} />
          {loading ? "Saving..." : "Save Override"}
        </button>
      </div>
    </div>
  );
}
