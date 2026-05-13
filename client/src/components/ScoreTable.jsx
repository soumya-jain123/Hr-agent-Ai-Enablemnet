const DIMENSIONS = [
  { key: "skills_match", label: "Skills Match", weight: 0.30 },
  { key: "experience_relevance", label: "Experience", weight: 0.25 },
  { key: "education", label: "Education", weight: 0.15 },
  { key: "projects", label: "Projects", weight: 0.20 },
  { key: "communication", label: "Communication", weight: 0.10 },
];

const scoreColor = (s) => {
  if (s >= 8) return "bg-green-500";
  if (s >= 5) return "bg-yellow-400";
  return "bg-red-400";
};

export default function ScoreTable({ scores, overrides = [] }) {
  if (!scores) return null;

  const overrideMap = {};
  overrides.forEach((o) => { overrideMap[o.dimension] = o; });

  return (
    <div className="grid grid-cols-5 gap-2">
      {DIMENSIONS.map(({ key, label, weight }) => {
        const dim = scores[key];
        if (!dim) return null;
        const wasOverridden = !!overrideMap[key];

        return (
          <div key={key} className="text-center">
            <div className="text-xs text-gray-400 mb-1 leading-tight">{label}</div>
            <div className={`text-white text-sm font-semibold rounded-lg py-1.5 ${scoreColor(dim.score)} ${wasOverridden ? "ring-2 ring-orange-400" : ""}`}>
              {dim.score}/10
            </div>
            <div className="text-xs text-gray-400 mt-0.5">{Math.round(weight * 100)}%</div>
            {wasOverridden && (
              <div className="text-xs text-orange-500 mt-0.5">overridden</div>
            )}
            <div className="text-xs text-gray-500 mt-1 leading-tight hidden group-hover:block">
              {dim.justification}
            </div>
          </div>
        );
      })}
    </div>
  );
}
