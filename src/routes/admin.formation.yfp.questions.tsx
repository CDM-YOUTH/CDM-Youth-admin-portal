import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Plus, MoreVertical, Edit2, Trash2, Check } from "lucide-react";
import {
  fetchYouthInquiries,
  updateYouthInquiry,
  deleteYouthInquiry,
  createYouthInquiry,
} from "@/lib/db/ministry/yfp";
import { Topbar } from "@/components/admin/layout/topbar";
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

function YFPQuestionsPage() {
  const qc = useQueryClient();

  const { data: allInquiries = [] } = useQuery({
    queryKey: ["yfp-youth-inquiries"],
    queryFn: () => fetchYouthInquiries(),
  });

  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState<string | undefined>();
  const [selectedInquiry, setSelectedInquiry] = useState<any>(null);
  const [isEditingPanel, setIsEditingPanel] = useState(false);
  const [editingValues, setEditingValues] = useState<Record<string, string>>({});
  const [isCreatingInquiry, setIsCreatingInquiry] = useState(false);
  const [newInquiry, setNewInquiry] = useState<Record<string, string>>({});
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(5);

  const filteredInquiries = useMemo(() => {
    let filtered = allInquiries;

    if (filterStatus) {
      filtered = filtered.filter((i) => i.status === filterStatus);
    }

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter((i) =>
        i.question_text?.toLowerCase().includes(query) ||
        i.inquiry_reference?.toLowerCase().includes(query)
      );
    }

    return filtered.sort((a, b) => new Date(b.submitted_at).getTime() - new Date(a.submitted_at).getTime());
  }, [allInquiries, filterStatus, searchQuery]);

  const totalPages = Math.max(1, Math.ceil(filteredInquiries.length / itemsPerPage));
  const safePage = Math.min(currentPage, totalPages);
  const paginatedInquiries = filteredInquiries.slice(
    (safePage - 1) * itemsPerPage,
    safePage * itemsPerPage
  );

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
      setSelectedInquiry(null);
      setIsEditingPanel(false);
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Failed to update inquiry");
    },
  });

  const deleteMut = useMutation({
    mutationFn: async (id: string) => {
      return deleteYouthInquiry(id);
    },
    onSuccess: () => {
      toast.success("Inquiry deleted successfully");
      qc.invalidateQueries({ queryKey: ["yfp-youth-inquiries"] });
      setConfirmDelete(null);
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Failed to delete inquiry");
    },
  });

  const handleEditStart = () => {
    if (!selectedInquiry) return;
    setEditingValues({
      pastoral_response: selectedInquiry.pastoral_response?.response || "",
      status: selectedInquiry.status || "Needs_Answer",
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

  const totalInquiries = allInquiries.length;
  const needsAnswer = allInquiries.filter((i) => i.status === "Needs_Answer").length;
  const approved = allInquiries.filter((i) => i.status === "Approved_For_Bulletin").length;

  return (
    <>
      <Topbar
        title="Youth Questions Desk"
        description={`${totalInquiries} inquiries · ${needsAnswer} needs answer · ${approved} approved`}
        action={
          <button
            onClick={() => setIsCreatingInquiry(true)}
            className="inline-flex items-center gap-2 rounded-lg bg-danger px-4 py-2 text-sm font-bold text-white hover:opacity-90"
          >
            <Plus className="h-4 w-4" />
            New Question
          </button>
        }
      />

      <div className="flex flex-1 overflow-hidden gap-0">
        {/* Left: Table - 50% */}
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
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs w-56 focus:border-gold-3 focus:text-black outline-none"
              placeholder="Search inquiry or reference..."
            />

            <select
              value={filterStatus || "all"}
              onChange={(e) => {
                setFilterStatus(e.target.value === "all" ? undefined : e.target.value);
                setCurrentPage(1);
              }}
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold focus:border-gold-3 focus:text-black outline-none"
            >
              <option value="all">All</option>
              <option value="Needs_Answer">Needs Answer</option>
              <option value="Drafted">Drafted</option>
              <option value="Approved_For_Bulletin">Approved</option>
              <option value="Confidential_Pastoral">Confidential</option>
            </select>

            <select
              value={itemsPerPage}
              onChange={(e) => {
                setItemsPerPage(parseInt(e.target.value));
                setCurrentPage(1);
              }}
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold ml-auto focus:border-gold-3 focus:text-black outline-none"
            >
              <option value={5}>5 per page</option>
              <option value={10}>10 per page</option>
              <option value={20}>20 per page</option>
              <option value={50}>50 per page</option>
            </select>
          </div>

          {/* Table */}
          <div className="flex-1 overflow-y-auto p-6">
            <div className="rounded-xl border border-slate-200/70 bg-white shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="border-b border-slate-200/70 bg-slate-50">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-bold uppercase tracking-wide text-slate-700">
                        Reference
                      </th>
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
                        <td colSpan={6} className="px-4 py-6 text-center text-sm text-slate-600">
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
                          <td className="px-4 py-3 font-mono text-xs font-bold text-slate-600">
                            {inquiry.inquiry_reference}
                          </td>
                          <td className="px-4 py-3 text-xs text-slate-900 max-w-xs truncate">
                            {inquiry.question_text}
                          </td>
                          <td className="px-4 py-3 text-xs text-slate-600">
                            {new Date(inquiry.submitted_at).toLocaleDateString("en-US", {
                              month: "short",
                              day: "numeric",
                            })}
                          </td>
                          <td className="px-4 py-3 text-center text-xs font-bold text-red-600">
                            {inquiry.upvotes_count || 0}
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className={`inline-block rounded-full px-2 py-1 text-xs font-bold ${
                                inquiry.status === "Approved_For_Bulletin"
                                  ? "bg-green-100 text-green-700"
                                  : inquiry.status === "Confidential_Pastoral"
                                    ? "bg-purple-100 text-purple-700"
                                    : inquiry.status === "Drafted"
                                      ? "bg-blue-100 text-blue-700"
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
                                  className="text-red-600 focus:text-red-600"
                                  onClick={() => setConfirmDelete(inquiry.id)}
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
                  {paginatedInquiries.length > 0 ? (safePage - 1) * itemsPerPage + 1 : 0}-{Math.min(safePage * itemsPerPage, filteredInquiries.length)}
                </span>
                <span> of {filteredInquiries.length} inquiries</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-semibold">
                  Page {safePage} of {totalPages}
                </span>
                <div className="flex gap-2">
                  <button
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={safePage === 1}
                    className="rounded px-3 py-1 text-xs font-bold disabled:opacity-50 border border-slate-200 hover:bg-slate-50"
                  >
                    Previous
                  </button>
                  <button
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    disabled={safePage === totalPages}
                    className="rounded px-3 py-1 text-xs font-bold disabled:opacity-50 border border-slate-200 hover:bg-slate-50"
                  >
                    Next
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right: Detail Panel - 50% */}
        {selectedInquiry && (
          <div className="w-1/2 h-full border-l border-slate-200 bg-slate-50 flex flex-col overflow-hidden">
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

            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {isEditingPanel ? (
                <>
                  <div>
                    <label className="text-xs font-bold uppercase text-slate-600 block mb-2">Question</label>
                    <p className="text-sm text-slate-900 bg-slate-100 rounded p-2">{selectedInquiry.question_text}</p>
                  </div>

                  <div>
                    <label className="text-xs font-bold uppercase text-slate-600 block mb-2">Status</label>
                    <select
                      value={editingValues.status}
                      onChange={(e) => setEditingValues({ ...editingValues, status: e.target.value })}
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs focus:border-gold-3 focus:text-black outline-none"
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
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs resize-both min-h-24 focus:border-gold-3 focus:text-black outline-none"
                      placeholder="Enter pastoral response..."
                    />
                  </div>
                </>
              ) : (
                <>
                  <div className="bg-white rounded p-4">
                    <h3 className="text-xs font-bold uppercase text-slate-700 mb-2">Question</h3>
                    <p className="text-sm text-slate-900">{selectedInquiry.question_text}</p>
                  </div>

                  {selectedInquiry.submitted_by && (
                    <div className="bg-white rounded p-4">
                      <h3 className="text-xs font-bold uppercase text-slate-700 mb-2">Submitted By</h3>
                      <p className="text-sm text-slate-900">{selectedInquiry.submitted_by.name}</p>
                    </div>
                  )}

                  <div className="bg-white rounded p-4">
                    <h3 className="text-xs font-bold uppercase text-slate-700 mb-2">Status</h3>
                    <span
                      className={`inline-block rounded-full px-3 py-1 text-xs font-bold ${
                        selectedInquiry.status === "Approved_For_Bulletin"
                          ? "bg-green-100 text-green-700"
                          : selectedInquiry.status === "Confidential_Pastoral"
                            ? "bg-purple-100 text-purple-700"
                            : selectedInquiry.status === "Drafted"
                              ? "bg-blue-100 text-blue-700"
                              : "bg-red-100 text-red-700"
                      }`}
                    >
                      • {selectedInquiry.status?.replace(/_/g, " ")}
                    </span>
                  </div>

                  {selectedInquiry.pastoral_response?.response && (
                    <div className="bg-blue-50 rounded p-4 border border-blue-200">
                      <h3 className="text-xs font-bold uppercase text-blue-700 mb-2">Pastoral Response</h3>
                      <p className="text-sm text-slate-900">{selectedInquiry.pastoral_response.response}</p>
                      {selectedInquiry.pastoral_response.respondent && (
                        <p className="text-xs text-slate-600 mt-2">By: {selectedInquiry.pastoral_response.respondent}</p>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>

            <div className="h-12 flex-shrink-0" />
          </div>
        )}
      </div>

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
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm resize-none min-h-24 focus:border-gold-3 focus:text-black outline-none"
                placeholder="Write the youth question..."
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => createMut.mutate()}
              disabled={!newInquiry.question_text?.trim()}
              className="bg-danger hover:opacity-90 disabled:opacity-50"
            >
              Create Question
            </AlertDialogAction>
          </div>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!confirmDelete} onOpenChange={(open) => !open && setConfirmDelete(null)}>
        <AlertDialogContent>
          <AlertDialogTitle>Delete Inquiry?</AlertDialogTitle>
          <AlertDialogDescription>
            This inquiry will be permanently deleted. This action cannot be undone.
          </AlertDialogDescription>
          <div className="flex justify-end gap-2">
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => confirmDelete && deleteMut.mutate(confirmDelete)}
              className="bg-danger hover:opacity-90"
            >
              Delete
            </AlertDialogAction>
          </div>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
