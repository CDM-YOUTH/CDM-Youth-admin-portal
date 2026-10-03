import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { Topbar } from "@/components/admin/layout/topbar";

export const Route = createFileRoute("/admin/formation/yfp/analytics")({
  component: YFPAnalyticsPage,
});

function YFPAnalyticsPage() {
  const navigate = useNavigate();

  return (
    <div className="flex min-h-screen flex-col">
      <Topbar
        title="YFP Analytics & Rollout"
        description="Diocese-wide formation program metrics and deanery progress"
      />

      <div className="flex-1 overflow-y-auto space-y-6 px-6 py-6">
        <button
          onClick={() => navigate({ to: "/admin/formation/yfp" })}
          className="flex items-center gap-2 text-sm font-bold text-text-2 hover:text-text-1"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Formation Pillars
        </button>

        {/* Key Metrics Cards */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="rounded-xl border border-border bg-card p-6">
            <div className="text-xs font-bold uppercase tracking-wide text-text-3 mb-2">
              Active Youth
            </div>
            <div className="text-4xl font-black text-primary">14,280</div>
            <div className="mt-1 text-xs text-text-3">Diocese-wide enrollment</div>
          </div>

          <div className="rounded-xl border border-border bg-card p-6">
            <div className="text-xs font-bold uppercase tracking-wide text-text-3 mb-2">
              Parish Coverage
            </div>
            <div className="text-4xl font-black text-primary">48 / 52</div>
            <div className="mt-1 text-xs text-text-3">92% of registered parishes</div>
          </div>

          <div className="rounded-xl border border-border bg-card p-6">
            <div className="text-xs font-bold uppercase tracking-wide text-text-3 mb-2">
              Completion Rate
            </div>
            <div className="text-4xl font-black text-primary">84%</div>
            <div className="mt-1 text-xs text-text-3">Weekly content engagement</div>
          </div>
        </div>

        {/* Deanery Progress */}
        <div className="rounded-xl border border-border bg-card p-6">
          <h3 className="mb-6 text-base font-bold text-text-1">Deanery Progress Tracking</h3>

          <div className="space-y-6">
            {[
              {
                name: "Murang'a Central",
                percent: 94,
                participants: "3,240",
                parishes: "12 / 12",
              },
              {
                name: "Kangema/Mathioya",
                percent: 88,
                participants: "2,890",
                parishes: "18 / 20",
              },
              {
                name: "Kigumo/Kandara",
                percent: 79,
                participants: "2,150",
                parishes: "18 / 20",
              },
            ].map((deanery) => (
              <div key={deanery.name}>
                <div className="mb-3 flex items-center justify-between">
                  <div>
                    <div className="font-bold text-text-1">{deanery.name}</div>
                    <div className="mt-0.5 text-xs text-text-3">
                      {deanery.participants} youth • {deanery.parishes} parishes
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-black text-primary">{deanery.percent}%</div>
                    <div className="text-xs text-text-3">Completion</div>
                  </div>
                </div>
                <div className="h-3 rounded-full bg-bg-3">
                  <div
                    className="h-3 rounded-full bg-primary"
                    style={{ width: `${deanery.percent}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Program Status */}
        <div className="rounded-xl border border-border bg-card p-6">
          <h3 className="mb-4 text-base font-bold text-text-1">Program Status Summary</h3>

          <div className="space-y-3 text-sm">
            <div className="flex items-center justify-between py-2 border-b border-border">
              <span className="text-text-2">Core Pillars Active</span>
              <span className="font-bold text-text-1">5 / 5</span>
            </div>
            <div className="flex items-center justify-between py-2 border-b border-border">
              <span className="text-text-2">Sub-Pillars Deployed</span>
              <span className="font-bold text-text-1">18 / 18</span>
            </div>
            <div className="flex items-center justify-between py-2 border-b border-border">
              <span className="text-text-2">Weekly Content Published</span>
              <span className="font-bold text-text-1">64 / 52</span>
            </div>
            <div className="flex items-center justify-between py-2">
              <span className="text-text-2">Formator Team Engagement</span>
              <span className="font-bold text-text-1">87%</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
