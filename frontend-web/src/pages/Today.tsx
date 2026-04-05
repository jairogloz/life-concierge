import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useApi } from '../lib/useApi';
import Spinner from '../components/Spinner';
import type { ScoredTask } from '../types';

export default function Today() {
  const api = useApi();
  const [ranked, setRanked] = useState<ScoredTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [completing, setCompleting] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<{ data: ScoredTask[] }>('/tasks/ranked?limit=20');
      setRanked(res.data.data ?? []);
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => { load(); }, [load]);

  async function complete(taskId: string) {
    setCompleting(taskId);
    try {
      await api.patch(`/tasks/${taskId}/complete`);
      setRanked(prev => prev.filter(s => s.task.id !== taskId));
    } finally {
      setCompleting(null);
    }
  }

  function scoreColor(score: number) {
    if (score >= 70) return 'bg-red-100 text-red-700';
    if (score >= 40) return 'bg-orange-100 text-orange-700';
    return 'bg-green-100 text-green-700';
  }

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Today</h1>
          <p className="text-sm text-gray-500 mt-0.5">Your highest-priority tasks right now</p>
        </div>
        <Link to="/inbox"
          className="inline-flex items-center gap-1.5 px-3 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors">
          ✨ Quick Capture
        </Link>
      </div>

      {loading ? <Spinner /> : ranked.length === 0 ? (
        <div className="text-center py-20 text-gray-400">
          <p className="text-4xl mb-3">🎉</p>
          <p className="font-medium">Nothing left to do!</p>
          <p className="text-sm mt-1">Add tasks or use Quick Capture to get started.</p>
        </div>
      ) : (
        <ol className="space-y-3">
          {ranked.map(({ task, score }, i) => (
            <li key={task.id}
              className="flex items-start gap-3 bg-white rounded-xl border border-gray-200 px-4 py-3 shadow-sm">
              <span className="mt-0.5 text-sm font-bold text-gray-400 w-5 shrink-0">{i + 1}</span>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-gray-900 truncate">{task.title}</p>
                {task.description && (
                  <p className="text-sm text-gray-500 truncate mt-0.5">{task.description}</p>
                )}
                <div className="flex flex-wrap gap-1.5 mt-2">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${scoreColor(score)}`}>
                    score {score.toFixed(1)}
                  </span>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 capitalize">
                    {task.commitment_type}
                  </span>
                  {task.deadline && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-blue-50 text-blue-600">
                      due {new Date(task.deadline).toLocaleDateString()}
                    </span>
                  )}
                  {(task.context_tags ?? []).map(tag => (
                    <span key={tag} className="text-xs px-2 py-0.5 rounded-full bg-purple-50 text-purple-600">
                      #{tag}
                    </span>
                  ))}
                </div>
              </div>
              <button
                onClick={() => complete(task.id)}
                disabled={completing === task.id}
                className="mt-0.5 shrink-0 w-6 h-6 rounded-full border-2 border-gray-300 hover:border-emerald-500 hover:bg-emerald-50 transition-colors disabled:opacity-40 flex items-center justify-center"
                title="Mark complete"
              >
                {completing === task.id && (
                  <div className="w-3 h-3 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
                )}
              </button>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
