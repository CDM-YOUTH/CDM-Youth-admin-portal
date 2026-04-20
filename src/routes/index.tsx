import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "CDM Youth Management System" },
      {
        name: "description",
        content:
          "The Catholic Diocese of Murang'a Youth Office digital platform — admin portal for diocese, deanery, and parish leaders, plus a youth self-service portal.",
      },
      { property: "og:title", content: "CDM Youth Management System" },
      {
        property: "og:description",
        content:
          "One platform for enrollment, events, mission week, formation, welfare, and uniforms across 8 deaneries and 56 parishes.",
      },
    ],
  }),
  component: Landing,
});

function Landing() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <header className="flex items-center justify-between border-b border-border px-6 py-4">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-gold text-[11px] font-black text-gold-foreground">
            CDM
          </div>
          <div className="leading-tight">
            <div className="text-[12px] font-bold text-foreground">Youth Office</div>
            <div className="text-[9px] text-text-3">Diocese of Murang'a</div>
          </div>
        </div>
        <span className="rounded-full border border-success/30 bg-success-soft px-3 py-1 text-[10px] font-bold text-success">
          v1.0 · Phase 1 Preview
        </span>
      </header>

      {/* Hero */}
      <section className="mx-auto max-w-5xl px-6 py-16 text-center">
        <span className="label-eyebrow">Catholic Diocese of Murang'a</span>
        <h1 className="text-display mt-3 text-4xl font-black tracking-tight text-foreground sm:text-5xl md:text-6xl">
          Youth Management <span className="text-gold">System</span>
        </h1>
        <p className="mx-auto mt-5 max-w-2xl text-[14px] leading-relaxed text-text-2">
          One platform for enrollment, events, mission week, CUSA, formation, welfare and uniforms —
          across 8 deaneries and 56 parishes. Every youth known by name, from Local Church to Diocese.
        </p>

        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Link
            to="/admin"
            className="rounded-lg bg-gold px-5 py-3 text-[13px] font-bold text-gold-foreground transition-opacity hover:opacity-90"
          >
            Open Admin Portal →
          </Link>
          <button
            disabled
            className="cursor-not-allowed rounded-lg border border-border bg-bg-3 px-5 py-3 text-[13px] font-semibold text-text-3 opacity-60"
          >
            Youth Portal (coming soon)
          </button>
        </div>

        {/* Stat strip */}
        <div className="mx-auto mt-14 grid max-w-3xl grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            ["1", "Diocese"],
            ["8", "Deaneries"],
            ["56+", "Parishes"],
            ["10,950", "Youths"],
          ].map(([v, l]) => (
            <div key={l} className="rounded-xl border border-border bg-card px-4 py-5">
              <div className="text-display text-[24px] font-black text-gold">{v}</div>
              <div className="mt-1 text-[10px] uppercase tracking-wider text-text-3">{l}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Modules grid */}
      <section className="mx-auto max-w-6xl px-6 pb-20">
        <div className="mb-6 text-center">
          <span className="label-eyebrow">What's inside</span>
          <h2 className="text-display mt-2 text-2xl font-extrabold text-foreground">Nine integrated modules</h2>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-3">
          {[
            ["Enrollment", "Annual registration with online payment tracking"],
            ["Youth Records", "Searchable directory across all parishes"],
            ["Events", "Schedule, RSVP, attendance, SMS reminders"],
            ["Mission Week", "Automated cross-parish reshuffle algorithm"],
            ["CUSA", "University chapters and tertiary youth body"],
            ["Formation", "Catechesis library — audio, video, PDFs"],
            ["Welfare", "Confidential pastoral case management"],
            ["Uniforms", "Procurement, stock, and distribution"],
            ["Reports", "Diocese, Deanery, and Parish-level analytics"],
          ].map(([title, desc]) => (
            <div key={title} className="rounded-xl border border-border bg-card p-4">
              <div className="text-[13px] font-bold text-foreground">{title}</div>
              <div className="mt-1 text-[11px] leading-relaxed text-text-3">{desc}</div>
            </div>
          ))}
        </div>
      </section>

      <footer className="border-t border-border px-6 py-6 text-center text-[10px] text-text-3">
        Catholic Diocese of Murang'a · Youth Office · Compliant with Kenya Data Protection Act 2019
      </footer>
    </main>
  );
}
