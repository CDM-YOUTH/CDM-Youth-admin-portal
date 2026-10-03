import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Plus, MoreVertical, Download, Edit2, Check, X, Trash2, MessageSquare, Zap } from "lucide-react";
import {
  fetchYouthInquiries,
  updateYouthInquiry,
  deleteYouthInquiry,
  createYouthInquiry,
} from "@/lib/db/ministry/yfp";
import { Topbar } from "@/components/admin/layout/topbar";
import {
  DateRangeFilter,
  type DateRange,
} from "@/components/admin/composables/pickers/date-range-filter";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Icon } from "@iconify/react";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/formation/yfp/questions")({
  component: YFPQuestionsPage,
});

const INQUIRY_STATUSES = [
  { value: "all", label: "All Inquiries" },
  { value: "Needs_Answer", label: "Needs Answer" },
  { value: "Drafted", label: "Drafted" },
  { value: "Approved_For_Bulletin", label: "Approved for Bulletin" },
  { value: "Confidential_Pastoral", label: "Confidential Pastoral" },
];

function YFPQuestionsPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();

  const { data: inquiries = [] } = useQuery({
    queryKey: ["yfp-youth-inquiries"],
    queryFn: () => fetchYouthInquiries(),
  });

  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [selectedInquiry, setSelectedInquiry] = useState<any>(null);
  const [isEditingPanel, setIsEditingPanel] = useState(false);
  const [isCreatingInquiry, setIsCreatingInquiry] = useState(false);
  const [editingValues, setEditingValues] = useState<Record<string, string>>({});
  const [newInquiry, setNewInquiry] = useState<Record<string, string>>({});
  const [currentPage, setCurrentPage] = useState(1);
  const [sortBy, setSortBy] = useState<"recent" | "upvotes">("recent");
  const [dateRange, setDateRange] = useState<DateRange>({ from: undefined, to: undefined });
  const [confirmAction, setConfirmAction] = useState<{ type: "approve" | "delete"; inquiryId: string } | null>(null);
  const itemsPerPage = 10;

  const createMut = useMutation({
    mutationFn: async () => {
      return createYouthInquiry({
        inquiry_reference: `#YFP-${new Date().getFullYear()}-${Math.floor(Math.random() * 10000).toString().padStart(4, '0')}`,
        submitted_by: { name: "Admin Generated" },
        submitted_at: new Date().toISOString(),
        question_text: newInquiry.question_text || "",
        status: "Needs_Answer",
        upvotes_count: 0,
      });
    },
    onSuccess: () => {
      toast.success("Question created successfully");
      qc.invalidateQueries({ queryKey: ["yfp-youth-inquiries"] });
      setIsCreatingInquiry(false);
      setNewInquiry({});
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Failed to create question");
    },
  });

  const updateMut = useMutation({
    mutationFn: async (updates: Record<string, any>) => {
      if (!selectedInquiry) return;
      return updateYouthInquiry(selectedInquiry.id, updates);
    },
    onSuccess: () => {
      toast.success("Inquiry updated successfully");
      qc.invalidateQueries({ queryKey: ["yfp-youth-inquiries"] });
      setIsEditingPanel(false);
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Failed to update inquiry");
    },
  });

  const deleteMut = useMutation({
    mutationFn: async () => {
      if (!selectedInquiry) return;
      return deleteYouthInquiry(selectedInquiry.id);
    },
    onSuccess: () => {
      toast.success("Inquiry deleted successfully");
      qc.invalidateQueries({ queryKey: ["yfp-youth-inquiries"] });
      setSelectedInquiry(null);
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Failed to delete inquiry");
    },
  });

  const filteredInquiries = useMemo(() => {
    let filtered = inquiries;

    if (filterStatus !== "all") {
      filtered = filtered.filter((i) => i.status === filterStatus);
    }

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter((i) =>
        i.question_text?.toLowerCase().includes(query) ||
        i.inquiry_reference?.toLowerCase().includes(query)
      );
    }

    if (dateRange.from) {
      filtered = filtered.filter((i) => new Date(i.submitted_at) >= dateRange.from!);
    }
    if (dateRange.to) {
      filtered = filtered.filter((i) => new Date(i.submitted_at) <= dateRange.to!);
    }

    if (sortBy === "upvotes") {
      filtered = [...filtered].sort((a, b) => (b.upvotes_count || 0) - (a.upvotes_count || 0));
    } else {
      filtered = [...filtered].sort((a, b) => new Date(b.submitted_at).getTime() - new Date(a.submitted_at).getTime());
    }

    return filtered;
  }, [inquiries, filterStatus, searchQuery, sortBy, dateRange]);

  const totalPages = Math.ceil(filteredInquiries.length / itemsPerPage);
  const startIdx = (currentPage - 1) * itemsPerPage;
  const paginatedInquiries = filteredInquiries.slice(startIdx, startIdx + itemsPerPage);

  const handleEditStart = () => {
    if (!selectedInquiry) return;
    setEditingValues({
      pastoral_response: selectedInquiry.pastoral_response?.response || "",
      status: selectedInquiry.status || "",
    });
    setIsEditingPanel(true);
  };

  const handleSaveEdit = () => {
    const updates: any = {
      status: editingValues.status || selectedInquiry.status,
    };
    if (editingValues.pastoral_response) {
      updates.pastoral_response = {
        response: editingValues.pastoral_response,
        respondent: selectedInquiry.pastoral_response?.respondent,
      };
    }
    updateMut.mutate(updates);
  };

  // Calculate stats
  const totalInquiries = inquiries.length;
  const needsAnswer = inquiries.filter((i) => i.status === "Needs_Answer").length;
  const approved = inquiries.filter((i) => i.status === "Approved_For_Bulletin").length;
  const confidential = inquiries.filter((i) => i.status === "Confidential_Pastoral").length;

  return (
    <div className="flex h-screen flex-col overflow-hidden">
      <Topbar
        title="Youth Questions Desk"
        description="Formation — Pastoral Questions & Responses"
        action={
          <button className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50">
            <Download className="h-4 w-4" />
            Batch Export
          </button>
        }
      />

      {/* Stat Cards - Compact */}
      <div className="border-b border-slate-200 bg-white px-6 py-2">
        <div className="grid grid-cols-4 gap-2">
          <div className="rounded border-l-4 border-slate-400 bg-slate-50 px-3 py-2">
            <div className="text-xs font-bold text-slate-600 flex items-center gap-1">
              <Icon icon="mdi:help-circle" className="h-3 w-3" />
              Total
            </div>
            <div className="text-lg font-black text-slate-900">{totalInquiries}</div>
          </div>

          <div className="rounded border-l-4 border-red-400 bg-red-50 px-3 py-2">
            <div className="text-xs font-bold text-red-600 flex items-center gap-1">
              <Icon icon="mdi:alert-circle" className="h-3 w-3" />
              Needs
            </div>
            <div className="text-lg font-black text-red-900">{needsAnswer}</div>
          </div>

          <div className="rounded border-l-4 border-green-400 bg-green-50 px-3 py-2">
            <div className="text-xs font-bold text-green-600 flex items-center gap-1">
              <Icon icon="mdi:check-circle" className="h-3 w-3" />
              Approved
            </div>
            <div className="text-lg font-black text-green-900">{approved}</div>
          </div>

          <div className="rounded border-l-4 border-purple-400 bg-purple-50 px-3 py-2">
            <div className="text-xs font-bold text-purple-600 flex items-center gap-1">
              <Icon icon="mdi:lock" className="h-3 w-3" />
              Private
            </div>
            <div className="text-lg font-black text-purple-900">{confidential}</div>
          </div>
        </div>
      </div>

      {/* Split Layout - 50/50 */}
      <div className="flex flex-1 overflow-hidden gap-0">
        {/* Left: Inquiries Table - 50% */}
        <div className="w-1/2 h-full flex flex-col border-r border-slate-200">
          {/* Filters Bar */}
          <div className="border-b border-slate-200 bg-white px-6 py-3 flex items-center gap-3 flex-shrink-0">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs w-56"
              placeholder="Search inquiry or reference..."
            />

            <select
              value={filterStatus}
              onChange={(e) => {
                setFilterStatus(e.target.value);
                setCurrentPage(1);
              }}
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold"
            >
              {INQUIRY_STATUSES.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>

            <DateRangeFilter
              value={dateRange}
              onChange={(range) => {
                setDateRange(range);
                setCurrentPage(1);
              }}
            />

            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as "recent" | "upvotes")}
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold ml-auto"
            >
              <option value="recent">Recent</option>
              <option value="upvotes">Upvotes</option>
            </select>

            <button
              onClick={() => setIsCreatingInquiry(true)}
              className="inline-flex items-center gap-2 rounded-lg bg-danger px-3 py-2 text-xs font-bold text-white hover:opacity-90 flex-shrink-0"
            >
              <Plus className="h-3.5 w-3.5" />
              New Question
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-6">
            <div className="rounded-xl border border-slate-200/70 bg-white shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="border-b border-slate-200/70 bg-slate-50">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-bold uppercase tracking-wide text-slate-700">
                        Question
                      </th>
                      <th className="px-4 py-2 text-left text-xs font-bold uppercase tracking-wide text-slate-700">
                        Submitted
                      </th>
                      <th className="px-4 py-2 text-center text-xs font-bold uppercase tracking-wide text-slate-700">
                        Upvotes
                      </th>
                      <th className="px-4 py-2 text-left text-xs font-bold uppercase tracking-wide text-slate-700">
                        Status
                      </th>
                      <th className="px-4 py-2 text-right text-xs font-bold uppercase tracking-wide text-slate-700">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedInquiries.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-4 py-6 text-center text-sm text-slate-600">
                          No inquiries found.
                        </td>
                      </tr>
                    ) : (
                      paginatedInquiries.map((inquiry) => (
                        <tr
                          key={inquiry.id}
                          className={`border-b border-slate-200/70 cursor-pointer ${
                            selectedInquiry?.id === inquiry.id ? "bg-blue-50" : "hover:bg-slate-50"
                          }`}
                          onClick={() => {
                            setSelectedInquiry(inquiry);
                            setIsEditingPanel(false);
                          }}
                        >
                          <td className="px-4 py-3">
                            <div className="max-w-xs">
                              <p className="text-xs font-semibold text-slate-900 line-clamp-2">
                                {inquiry.question_text}
                              </p>
                              {inquiry.inquiry_reference && (
                                <p className="text-xs text-slate-500 mt-1">Ref: {inquiry.inquiry_reference}</p>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-xs text-slate-600 whitespace-nowrap">
                            {new Date(inquiry.submitted_at).toLocaleDateString("en-US", {
                              month: "short",
                              day: "numeric",
                            })}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <div className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-1">
                              <Icon icon="mdi:heart" className="h-3 w-3 text-red-600" />
                              <span className="text-xs font-bold text-red-600">{inquiry.upvotes_count || 0}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className={`inline-block rounded-full px-2 py-1 text-xs font-bold ${
                                inquiry.status === "Approved_For_Bulletin"
                                  ? "bg-green-100 text-green-700"
                                  : inquiry.status === "Drafted"
                                    ? "bg-blue-100 text-blue-700"
                                    : inquiry.status === "Confidential_Pastoral"
                                      ? "bg-purple-100 text-purple-700"
                                      : "bg-red-100 text-red-700"
                              }`}
                            >
                              • {inquiry.status?.replace(/_/g, " ")}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <button className="text-slate-400 hover:text-slate-600">
                                  <MoreVertical className="h-5 w-5" />
                                </button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-40">
                                <DropdownMenuItem
                                  onClick={() => {
                                    setSelectedInquiry(inquiry);
                                    handleEditStart();
                                  }}
                                >
                                  <Edit2 className="mr-2 h-3.5 w-3.5" /> Edit Response
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  onClick={() => {
                                    setConfirmAction({ type: "delete", inquiryId: inquiry.id });
                                  }}
                                  className="text-red-600 focus:text-red-600"
                                >
                                  <Trash2 className="mr-2 h-3.5 w-3.5" /> Delete
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Pagination */}
            <div className="mt-4 flex items-center justify-between text-xs">
              <div className="text-slate-600">
                <span className="font-semibold">
                  {paginatedInquiries.length > 0 ? startIdx + 1 : 0}-{Math.min(startIdx + itemsPerPage, filteredInquiries.length)}
                </span>
                <span> of {filteredInquiries.length} inquiries</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-semibold">
                  Page {currentPage} of {totalPages}
                </span>
                <div className="flex gap-2">
                  <button
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="rounded px-3 py-1 text-xs font-bold disabled:opacity-50 border border-slate-200 hover:bg-slate-50"
                  >
                    Previous
                  </button>
                  <button
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    className="rounded px-3 py-1 text-xs font-bold disabled:opacity-50 border border-slate-200 hover:bg-slate-50"
                  >
                    Next
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right: Inquiry Detail Panel - 50% */}
        {selectedInquiry && (
          <div className="w-1/2 h-full border-l border-slate-200 bg-slate-50 flex flex-col overflow-hidden">
            {/* Header - Fixed */}
            <div className="border-b border-slate-200 bg-white p-3 flex items-start justify-between flex-shrink-0">
              <div>
                <div className="text-xs font-bold uppercase tracking-wide text-slate-500">
                  {new Date(selectedInquiry.submitted_at).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
                </div>
                <h2 className="text-lg font-black text-slate-900 mt-1">
                  {selectedInquiry.inquiry_reference}
                </h2>
              </div>
              {isEditingPanel ? (
                <div className="flex gap-2">
                  <button
                    onClick={handleSaveEdit}
                    className="flex items-center gap-2 rounded-lg bg-danger px-3 py-2 text-xs font-bold text-white hover:opacity-90"
                  >
                    <Check className="h-4 w-4" />
                    Save
                  </button>
                  <button
                    onClick={() => setIsEditingPanel(false)}
                    className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  onClick={handleEditStart}
                  className="flex items-center gap-2 rounded-lg bg-danger px-3 py-2 text-xs font-bold text-white hover:opacity-90"
                >
                  <Edit2 className="h-3 w-3" />
                  Edit
                </button>
              )}
            </div>

            {/* Content - Scrollable */}
            <div className="flex-1 overflow-y-auto p-4">
              {isEditingPanel ? (
                <div className="space-y-4">
                  {/* Question (Read-only) */}
                  <div className="bg-slate-100 rounded-lg p-3 border border-slate-200">
                    <h3 className="text-xs font-bold uppercase text-slate-700 mb-2">Question</h3>
                    <p className="text-sm text-slate-900">{selectedInquiry.question_text}</p>
                  </div>

                  <div>
                    <label className="text-xs font-bold uppercase text-slate-600 block mb-2">Status</label>
                    <select
                      value={editingValues.status}
                      onChange={(e) => setEditingValues({ ...editingValues, status: e.target.value })}
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs"
                    >
                      <option value="Needs_Answer">Needs Answer</option>
                      <option value="Drafted">Drafted</option>
                      <option value="Approved_For_Bulletin">Approved for Bulletin</option>
                      <option value="Confidential_Pastoral">Confidential Pastoral</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-xs font-bold uppercase text-slate-600 block mb-2">Pastoral Response</label>
                    <textarea
                      value={editingValues.pastoral_response}
                      onChange={(e) =>
                        setEditingValues({ ...editingValues, pastoral_response: e.target.value })
                      }
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs resize-both min-h-32"
                      placeholder="Enter pastoral response..."
                    />
                  </div>

                  <button
                    className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-xs font-bold text-white hover:opacity-90"
                  >
                    <Zap className="h-3.5 w-3.5" />
                    Generate AI Answer
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Question Section */}
                  <div className="bg-white rounded-lg p-4 border border-slate-200">
                    <h3 className="text-xs font-bold uppercase text-slate-700 mb-3">Question</h3>
                    <p className="text-sm text-slate-900 italic">{selectedInquiry.question_text}</p>
                    {selectedInquiry.linked_article_title && (
                      <div className="mt-3 pt-3 border-t text-xs text-slate-600">
                        <strong>Linked Article:</strong> {selectedInquiry.linked_article_title}
                      </div>
                    )}
                  </div>

                  {/* Stats */}
                  <div className="grid grid-cols-3 gap-2">
                    <div className="bg-white rounded-lg p-3 border border-slate-200">
                      <div className="text-xs font-bold text-slate-600">Upvotes</div>
                      <div className="text-2xl font-black text-red-600">{selectedInquiry.upvotes_count || 0}</div>
                    </div>
                    <div className="bg-white rounded-lg p-3 border border-slate-200">
                      <div className="text-xs font-bold text-slate-600">Status</div>
                      <div className="text-xs font-bold text-slate-900 mt-1">
                        {selectedInquiry.status?.replace(/_/g, " ")}
                      </div>
                    </div>
                    <div className="bg-white rounded-lg p-3 border border-slate-200">
                      <div className="text-xs font-bold text-slate-600">Submitted By</div>
                      <div className="text-xs font-bold text-slate-900 mt-1 truncate">
                        {selectedInquiry.submitted_by?.name || "Anonymous"}
                      </div>
                    </div>
                  </div>

                  {/* Pastoral Response */}
                  {selectedInquiry.pastoral_response?.response && (
                    <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                      <h3 className="text-xs font-bold uppercase text-blue-700 mb-2">Pastoral Response</h3>
                      <p className="text-sm text-slate-900">{selectedInquiry.pastoral_response.response}</p>
                      {selectedInquiry.pastoral_response.respondent && (
                        <p className="text-xs text-slate-600 mt-2">
                          By: {selectedInquiry.pastoral_response.respondent}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Footer spacer */}
            <div className="h-12 flex-shrink-0" />
          </div>
        )}
      </div>

      {/* Action Confirmation Dialog */}
      <AlertDialog open={!!confirmAction} onOpenChange={(open) => !open && setConfirmAction(null)}>
        <AlertDialogContent>
          <AlertDialogTitle>Delete Inquiry?</AlertDialogTitle>
          <AlertDialogDescription>
            This inquiry will be permanently deleted. This action cannot be undone.
          </AlertDialogDescription>
          <div className="flex justify-end gap-2">
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (confirmAction?.type === "delete") {
                  setSelectedInquiry(inquiries.find((i: any) => i.id === confirmAction.inquiryId));
                  deleteMut.mutate();
                }
                setConfirmAction(null);
              }}
              className="bg-red-600 hover:bg-red-700"
            >
              Delete
            </AlertDialogAction>
          </div>
        </AlertDialogContent>
      </AlertDialog>

      {/* Create Question Dialog */}
      <AlertDialog open={isCreatingInquiry} onOpenChange={setIsCreatingInquiry}>
        <AlertDialogContent className="max-w-2xl">
          <AlertDialogTitle>Create New Question</AlertDialogTitle>
          <div className="space-y-4 py-4">
            <div>
              <label className="text-xs font-bold uppercase text-slate-600 block mb-2">Question</label>
              <textarea
                value={newInquiry.question_text || ""}
                onChange={(e) => setNewInquiry({ ...newInquiry, question_text: e.target.value })}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm resize-none min-h-24"
                placeholder="Write the youth question..."
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <button
              onClick={() => createMut.mutate()}
              disabled={!newInquiry.question_text?.trim()}
              className="rounded-lg bg-danger px-4 py-2 text-xs font-bold text-white hover:opacity-90 disabled:opacity-50"
            >
              Create Question
            </button>
          </div>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
