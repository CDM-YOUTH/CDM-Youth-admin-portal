import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, FileText, Clock, User, FileWarning } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/formation/$itemId")({
  head: () => ({ meta: [{ title: "Formation — CDM Youth Portal" }] }),
  component: FormationViewerPage,
});

function FormationViewerPage() {
  const { itemId } = Route.useParams();

  const { data: item } = useQuery({
    queryKey: ["formation-item", itemId],
    queryFn: async () => {
      const { data, error } = await supabase.from("formation_items").select("*").eq("id", itemId).single();
      if (error) throw error;
      return data;
    },
  });

  if (!item) return null;

  return (
    <div className="mx-auto min-h-screen max-w-md bg-background pb-8">
      <div className="flex items-center justify-between px-5 pt-6">
        <Link to="/formation" className="inline-flex items-center gap-1 text-[12px] font-semibold text-text-3">
          <ArrowLeft className="h-4 w-4" /> Back
        </Link>
        <span className="rounded-full bg-info-soft px-2.5 py-0.5 text-[10px] font-bold uppercase text-info">{item.kind}</span>
      </div>

      <div className="px-5 pt-4">
        <h1 className="text-display text-xl font-black text-foreground">{item.title}</h1>
        <div className="mt-1.5 flex items-center gap-3 text-[11px] text-text-3">
          {item.duration && (
            <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" /> {item.duration}</span>
          )}
          {item.author && (
            <span className="flex items-center gap-1"><User className="h-3.5 w-3.5" /> {item.author}</span>
          )}
        </div>

        <div className="mt-4">
          <FormationContent kind={item.kind} fileUrl={item.file_url} title={item.title} />
        </div>

        {item.description && <p className="mt-4 text-[13px] leading-relaxed text-text-2">{item.description}</p>}

        {item.tags.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-1.5">
            {item.tags.map((tag) => (
              <span key={tag} className="rounded-full bg-muted px-2.5 py-0.5 text-[10px] font-bold text-text-2">{tag}</span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function FormationContent({ kind, fileUrl, title }: { kind: string; fileUrl: string | null; title: string }) {
  if (!fileUrl) {
    return (
      <div className="flex flex-col items-center rounded-2xl border border-dashed border-border bg-card py-12 text-center">
        <FileWarning className="mb-3 h-8 w-8 text-text-4" />
        <p className="text-[12px] text-text-3">No file has been uploaded for this resource yet.</p>
      </div>
    );
  }

  if (kind === "Video") {
    return (
      <video controls className="w-full rounded-2xl bg-black" src={fileUrl}>
        Your browser doesn't support video playback.
      </video>
    );
  }

  if (kind === "Audio") {
    return (
      <div className="rounded-2xl border border-border bg-card p-4">
        <audio controls className="w-full" src={fileUrl}>
          Your browser doesn't support audio playback.
        </audio>
      </div>
    );
  }

  if (kind === "Image") {
    return <img src={fileUrl} alt={title} className="w-full rounded-2xl border border-border object-cover" />;
  }

  if (kind === "PDF") {
    return (
      <div className="overflow-hidden rounded-2xl border border-border">
        <iframe src={fileUrl} title={title} className="h-[65vh] w-full bg-white" />
        <a
          href={fileUrl}
          target="_blank"
          rel="noreferrer"
          className="flex items-center justify-center gap-1.5 border-t border-border bg-card py-2.5 text-[11px] font-bold text-danger"
        >
          <FileText className="h-3.5 w-3.5" /> Open in new tab
        </a>
      </div>
    );
  }

  return (
    <a
      href={fileUrl}
      target="_blank"
      rel="noreferrer"
      className="flex items-center justify-center gap-1.5 rounded-2xl border border-border bg-card py-4 text-[12px] font-bold text-danger"
    >
      <FileText className="h-4 w-4" /> Open file
    </a>
  );
}
