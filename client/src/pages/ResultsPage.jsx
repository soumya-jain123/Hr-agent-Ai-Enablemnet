import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import api from "../services/api";
import ScoreTable from "../components/ScoreTable";
import { RefreshCw, Download, Edit2, CheckCircle, XCircle, Clock } from "lucide-react";

const POLL_INTERVAL = 4000;

export default function ResultsPage() {
  const { jobId } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [polling, setPolling] = useState(false);

  const fetchShortlist = async () => {
    try {
      const res = await api.get(`/jobs/${jobId}/shortlist`);
      setData(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Poll while any candidate is still processing
  useEffect(() => {
    fetchShortlist();
  }, [jobId]);

  useEffect(() => {
    const checkProcessing = async () => {
      try {
        const allRes = await api.get(`/jobs/${jobId}/shortlist`);
        const allCandidates = await api.get(`/candidates?job_id=${jobId}`);
        setData(allRes.data);

        // If all are done, stop polling
        const stillProcessing = allRes.data?.candidates?.some(
          (c) => c.status === "parsing" || c.status === "scoring"
        );
        setPolling(stillProcessing);
      } catch {}
    };

    const interval = setInterval(checkProcessing, POLL_INTERVAL);
    return () => clearInterval(interval);
  }, [jobId]);

  const handleDownloadPDF = async () => {
    const res = await api.get(`/reports/${jobId}/pdf`, { responseType: "blob" });
    const url = URL.createObjectURL(new Blob([res.data], { type: "application/pdf" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `shortlist_${jobId}.pdf`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) return <p className="text-gray-500">Loading shortlist...</p>;
  if (!data) return <p className="text-red-500">Failed to load results.</p>;

  const { job, candidates } = data;

  return (
    <div className="max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">{job.title}</h1>
          <p className="text-sm text-gray-500 mt-1">{candidates.length} candidates evaluated</p>
        </div>
        <div className="flex gap-2">
          {polling && (
            <span className="flex items-center gap-1 text-xs text-yellow-600 bg-yellow-50 px-3 py-1.5 rounded-full border border-yellow-200">
              <RefreshCw size={12} className="animate-spin" /> Processing...
            </span>
          )}
          <button
            onClick={fetchShortlist}
            className="text-sm px-3 py-1.5 border border-gray-200 rounded-lg hover:bg-gray-50 flex items-center gap-1"
          >
            <RefreshCw size={13} /> Refresh
          </button>
          <button
            onClick={handleDownloadPDF}
            className="text-sm px-3 py-1.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 flex items-center gap-1"
          >
            <Download size={13} /> Export PDF
          </button>
        </div>
      </div>

      {/* Candidates */}
      {candidates.length === 0 ? (
        <div className="text-center py-20 text-gray-400">
          <Clock size={36} className="mx-auto mb-2 opacity-40" />
          <p>Resumes are being processed. Check back shortly.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {candidates.map((candidate, index) => (
            <div key={candidate._id} className="bg-white rounded-xl border border-gray-200 p-5">
              {/* Candidate header */}
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <span className="w-7 h-7 rounded-full bg-indigo-100 text-indigo-700 text-sm font-semibold flex items-center justify-center">
                    {index + 1}
                  </span>
                  <div>
                    <p className="font-medium text-gray-900">
                      {candidate.parsed_profile?.name || candidate.original_filename}
                    </p>
                    <p className="text-xs text-gray-400">
                      {candidate.parsed_profile?.experience_years || 0} yrs exp ·{" "}
                      {candidate.parsed_profile?.education || "Education N/A"}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <span className={`flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full ${
                    candidate.recommendation === "hire"
                      ? "bg-green-100 text-green-700"
                      : "bg-red-100 text-red-600"
                  }`}>
                    {candidate.recommendation === "hire"
                      ? <><CheckCircle size={11} /> Hire</>
                      : <><XCircle size={11} /> No-hire</>}
                  </span>
                  <span className="text-lg font-bold text-indigo-700">{candidate.total_score}<span className="text-xs text-gray-400 font-normal">/10</span></span>
                  <Link
                    to={`/jobs/${jobId}/candidates/${candidate._id}/override`}
                    className="text-xs px-2.5 py-1 border border-gray-200 rounded-lg hover:bg-gray-50 flex items-center gap-1 text-gray-600"
                  >
                    <Edit2 size={11} /> Override
                  </Link>
                </div>
              </div>

              <ScoreTable scores={candidate.scores} overrides={candidate.overrides} />

              {/* Skills */}
              {candidate.parsed_profile?.skills?.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {candidate.parsed_profile.skills.slice(0, 12).map((skill) => (
                    <span key={skill} className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">
                      {skill}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
