import { createFileRoute, Link } from "@tanstack/react-router";
import cdmLogo from "@/assets/cdm-logo.jpeg";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "CDM Youth — Catholic Diocese of Murang'a" },
      {
        name: "description",
        content:
          "One platform for enrollment, events, mission week, formation, welfare, and uniforms across 8 deaneries and 56 parishes.",
      },
    ],
  }),
  component: Landing,
});

function Landing() {
  return (
    <main className="min-h-screen overflow-hidden bg-white text-foreground">
      {/* Top accent stripe */}
      <div className="h-1.5 w-full bg-gradient-to-r from-danger via-gold to-danger" />

      {/* Header */}
      <header className="flex items-center justify-between border-b border-border bg-white px-6 py-4">
        <div className="flex items-center gap-3">
          <img
            src={cdmLogo}
            alt="CDM Logo"
            className="h-10 w-10 rounded-full object-cover ring-2 ring-gold/40"
          />
          <div className="leading-tight">
            <div className="text-[12px] font-bold text-foreground">Youth Office</div>
            <div className="text-[9px] text-text-3">Catholic Diocese of Murang'a</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="hidden rounded-full border border-success/30 bg-success-soft px-3 py-1 text-[9px] font-bold text-success sm:inline">
            v1.0 · Phase 1 Preview
          </span>
          <Link
            to="/login"
            className="rounded-lg bg-danger px-4 py-2 text-[12px] font-bold text-white shadow-sm transition-opacity hover:opacity-90"
          >
            Login →
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-b from-danger-soft via-white to-white px-6 py-16 text-center">
        {/* Background decoration circles */}
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -right-40 -top-40 h-[500px] w-[500px] rounded-full bg-gold/5" />
          <div className="absolute -bottom-20 -left-40 h-[400px] w-[400px] rounded-full bg-danger/5" />
        </div>

        {/* Logo */}
        <div className="relative mb-8 inline-block">
          <div className="absolute inset-0 scale-[1.6] rounded-full bg-gold/15 blur-3xl" />
          <div className="relative rounded-full bg-white p-3 shadow-2xl ring-4 ring-gold/30">
            <img
              src={cdmLogo}
              alt="Catholic Diocese of Murang'a Youth"
              className="h-52 w-52 object-contain"
            />
          </div>
        </div>

        <div className="label-eyebrow mb-2 text-danger">Catholic Diocese of Murang'a</div>
        <h1 className="text-display text-4xl font-black tracking-tight sm:text-5xl">
          <span className="text-gold">Youth Office</span>{" "}
          <span className="text-foreground">Management</span>
          <br />
          <span className="text-danger">System</span>
        </h1>
        <p className="mx-auto mt-5 max-w-xl text-[14px] leading-relaxed text-text-2">
          One platform for enrollment, events, mission week, CUSA, formation, welfare and uniforms —
          across 8 deaneries and 56 parishes.
        </p>
        <p className="mt-3 text-[13px] font-bold italic text-gold-3">
          "Youth — The hope of the church"
        </p>

        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Link
            to="/login"
            className="rounded-xl bg-danger px-8 py-3.5 text-[14px] font-bold text-white shadow-lg transition-all hover:opacity-90 hover:shadow-xl"
          >
            Admin Login →
          </Link>
          <button
            disabled
            className="cursor-not-allowed rounded-xl border-2 border-gold-3/50 px-8 py-3.5 text-[14px] font-semibold text-gold-3 opacity-60"
          >
            Youth Portal (coming soon)
          </button>
        </div>

        {/* Stats */}
        <div className="mx-auto mt-14 grid max-w-3xl grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            ["1", "Diocese"],
            ["8", "Deaneries"],
            ["56+", "Parishes"],
            ["10,950", "Youths"],
          ].map(([v, l]) => (
            <div
              key={l}
              className="rounded-xl border-2 border-gold/30 bg-white px-4 py-5 text-center shadow-sm"
            >
              <div className="text-display text-[28px] font-black text-danger">{v}</div>
              <div className="mt-1 text-[10px] font-bold uppercase tracking-wider text-gold-3">
                {l}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Modules */}
      <section className="bg-gradient-to-b from-white to-bg-2 px-6 pb-20 pt-10">
        <div className="mx-auto max-w-5xl">
          <div className="mb-6 text-center">
            <div className="label-eyebrow mb-1">What's inside</div>
            <h2 className="text-display text-2xl font-extrabold text-gold">
              Nine integrated modules
            </h2>
            <p className="mt-1 text-[11px] text-text-3">
              Everything the Diocese needs in one place
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {[
              ["Enrollment", "Annual registration with online payment tracking"],
              ["Youth Records", "Searchable directory across all parishes"],
              ["Events", "Schedule, RSVP, attendance & SMS reminders"],
              ["Mission Week", "Automated cross-parish reshuffle algorithm"],
              ["CUSA", "University chapters and tertiary youth body"],
              ["Formation", "Catechesis library — audio, video, PDFs"],
              ["Welfare", "Confidential pastoral case management"],
              ["Uniforms", "Procurement, stock, and distribution"],
              ["Reports", "Diocese, Deanery and Parish analytics"],
            ].map(([title, desc]) => (
              <div
                key={title}
                className="rounded-xl border border-gold/20 bg-white p-4 shadow-sm transition-colors hover:border-gold/50"
              >
                <div className="text-[12px] font-bold text-danger">{title}</div>
                <div className="mt-1 text-[10px] leading-relaxed text-text-3">{desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Bottom accent stripe */}
      <div className="h-1.5 w-full bg-gradient-to-r from-danger via-gold to-danger" />

      <footer className="bg-white px-6 py-5 text-center text-[10px] text-text-3">
        Catholic Diocese of Murang'a · Youth Office · Compliant with Kenya Data Protection Act 2019
      </footer>
    </main>
  );
}
