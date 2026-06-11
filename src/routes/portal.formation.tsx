import { createFileRoute } from "@tanstack/react-router";
import { BookOpen, Headphones, Video, FileText } from "lucide-react";

export const Route = createFileRoute("/portal/formation")({
  component: FormationPage,
});

const categories = [
  { icon: BookOpen, label: "Catechesis", desc: "Foundational teachings of the Church" },
  { icon: Video, label: "Video reflections", desc: "Weekly homilies and talks" },
  { icon: Headphones, label: "Audio library", desc: "Podcasts and prayer guides" },
  { icon: FileText, label: "Resources", desc: "Documents, prayers and study guides" },
];

function FormationPage() {
  return (
    <div className="px-5 pt-6">
      <h1 className="text-display text-xl font-extrabold text-danger">Formation</h1>
      <p className="mt-1 text-[12px] text-text-3">
        Grow in your spiritual journey with curated diocesan resources.
      </p>

      <div className="mt-5 grid grid-cols-1 gap-3">
        {categories.map(({ icon: Icon, label, desc }) => (
          <div
            key={label}
            className="flex items-center gap-3 rounded-2xl border border-border bg-white p-4"
          >
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-success-soft text-success">
              <Icon className="h-5 w-5" />
            </div>
            <div className="flex-1">
              <div className="text-[13px] font-bold text-foreground">{label}</div>
              <div className="text-[11px] text-text-3">{desc}</div>
            </div>
            <span className="rounded-full bg-warn-soft px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-gold-3">
              Soon
            </span>
          </div>
        ))}
      </div>

      <div className="mt-6 rounded-2xl bg-bg-2 p-4 text-center text-[12px] text-text-2">
        Formation content is being curated by the Diocesan Youth Office. Check back soon.
      </div>
    </div>
  );
}