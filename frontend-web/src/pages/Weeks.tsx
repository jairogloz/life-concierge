import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useApi } from "../lib/useApi";
import Spinner from "../components/Spinner";
import type { Week } from "../types";

function groupLabel(status: Week["status"]) {
  if (status === "planning") return "Planning";
  if (status === "active") return "Active";
  if (status === "review") return "Review";
  return "Closed";
}

export default function Weeks() {
  const api = useApi();
  const [weeks, setWeeks] = useState<Week[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await api.get<{ data: Week[] }>("/weeks");
      setWeeks(res.data.data ?? []);
    } catch {
      setError("Failed to load weeks.");
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => {
    load();
  }, [load]);

  async function createNext() {
    const latest = weeks.length ? new Date(weeks[0].starts_on) : new Date();
    const startsOn = new Date(latest);
    startsOn.setDate(startsOn.getDate() + 7);
    const y = startsOn.getUTCFullYear();
    const m = String(startsOn.getUTCMonth() + 1).padStart(2, "0");
    const d = String(startsOn.getUTCDate()).padStart(2, "0");
    await api.post("/weeks", { starts_on: `${y}-${m}-${d}` });
    await load();
  }

  const grouped = useMemo(() => {
    const map: Record<string, Week[]> = {
      planning: [],
      active: [],
      review: [],
      closed: [],
    };
    weeks.forEach((week) => map[week.status].push(week));
    return map;
  }, [weeks]);

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">📚 Weeks</h1>
          <p className="text-sm text-gray-500">
            Past and upcoming sprint weeks.
          </p>
        </div>
        <button
          onClick={createNext}
          className="px-3 py-2 rounded-lg bg-indigo-600 text-white text-sm"
        >
          Create next week
        </button>
      </div>

      {loading ? (
        <Spinner />
      ) : error ? (
        <p className="text-red-600 text-sm">{error}</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {(["planning", "active", "review", "closed"] as const).map(
            (status) => (
              <section
                key={status}
                className="bg-white rounded-xl border border-gray-200 p-4"
              >
                <h2 className="font-semibold text-gray-800 mb-3">
                  {groupLabel(status)}
                </h2>
                <div className="space-y-2">
                  {grouped[status].length === 0 && (
                    <p className="text-sm text-gray-400">No weeks</p>
                  )}
                  {grouped[status].map((week) => (
                    <Link
                      key={week.id}
                      to={`/?week=${week.id}`}
                      className="block rounded-lg border border-gray-200 px-3 py-2 hover:bg-gray-50"
                    >
                      <p className="text-sm font-medium text-gray-800">
                        {week.starts_on.slice(0, 10)} →{" "}
                        {week.ends_on.slice(0, 10)}
                      </p>
                      <p className="text-xs text-gray-500">
                        Status: {week.status}
                      </p>
                    </Link>
                  ))}
                </div>
              </section>
            ),
          )}
        </div>
      )}
    </div>
  );
}
