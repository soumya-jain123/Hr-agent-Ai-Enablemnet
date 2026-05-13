import { Routes, Route, NavLink } from "react-router-dom";
import UploadPage from "./pages/UploadPage";
import ResultsPage from "./pages/ResultsPage";
import OverridePage from "./pages/OverridePage";
import JobsPage from "./pages/JobsPage";

export default function App() {
  return (
    <div className="min-h-screen flex flex-col">
      {/* Navbar */}
      <nav className="bg-white border-b border-gray-200 px-6 py-3 flex items-center gap-6 shadow-sm">
        <span className="font-semibold text-lg text-indigo-700 mr-4">🤖 HR Agent</span>
        {[
          { to: "/", label: "Jobs" },
          { to: "/upload", label: "New Job" },
        ].map(({ to, label }) => (
          <NavLink
            key={to}
            to={to}
            end={to === "/"}
            className={({ isActive }) =>
              `text-sm font-medium px-3 py-1.5 rounded-md transition ${
                isActive
                  ? "bg-indigo-50 text-indigo-700"
                  : "text-gray-600 hover:text-indigo-600 hover:bg-gray-100"
              }`
            }
          >
            {label}
          </NavLink>
        ))}
      </nav>

      {/* Page content */}
      <main className="flex-1 p-6">
        <Routes>
          <Route path="/" element={<JobsPage />} />
          <Route path="/upload" element={<UploadPage />} />
          <Route path="/jobs/:jobId/results" element={<ResultsPage />} />
          <Route path="/jobs/:jobId/candidates/:candidateId/override" element={<OverridePage />} />
        </Routes>
      </main>
    </div>
  );
}
