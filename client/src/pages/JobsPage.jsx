import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../services/api";
import { Briefcase, ChevronRight, Clock, CheckCircle, AlertCircle } from "lucide-react";

const statusIcon = {
  ready: <CheckCircle size={14} className="text-green-500" />,
  parsing: <Clock size={14} className="text-yellow-500 animate-pulse" />,
  error: <AlertCircle size={14} className="text-red-500" />,
  pending: <Clock size={14} className="text-gray-400" />,
};

export default function JobsPage() {
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get("/jobs")
      .then((r) => setJobs(r.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p className="text-gray-500">Loading jobs...</p>;

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold">All Jobs</h1>
        <Link to="/upload" className="bg-indigo-600 text-white text-sm px-4 py-2 rounded-lg hover:bg-indigo-700 transition">
          + New Job
        </Link>
      </div>

      {jobs.length === 0 ? (
        <div className="text-center py-20 text-gray-400">
          <Briefcase size={40} className="mx-auto mb-3 opacity-40" />
          <p>No jobs yet. Create one to get started.</p>
        </div>
      ) : (
        <ul className="space-y-3">
          {jobs.map((job) => (
            <li key={job._id}>
              <Link
                to={`/jobs/${job._id}/results`}
                className="flex items-center justify-between p-4 bg-white rounded-xl border border-gray-200 hover:border-indigo-300 hover:shadow-sm transition"
              >
                <div className="flex items-center gap-3">
                  <Briefcase size={18} className="text-indigo-500" />
                  <div>
                    <p className="font-medium text-gray-900">{job.title}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {new Date(job.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="flex items-center gap-1 text-xs text-gray-500 capitalize">
                    {statusIcon[job.status]} {job.status}
                  </span>
                  <ChevronRight size={16} className="text-gray-400" />
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
