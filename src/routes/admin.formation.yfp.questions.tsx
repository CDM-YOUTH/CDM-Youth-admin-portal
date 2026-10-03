import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Plus, MoreVertical, Edit2, Trash2 } from "lucide-react";
import {
  fetchYouthInquiries,
  updateYouthInquiry,
  deleteYouthInquiry,
  createYouthInquiry,
} from "@/lib/db/ministry/yfp";
import { Topbar } from "@/components/admin/layout/topbar";
import {
  ColumnFilter,
  ColumnHeader,
  TableToolbar,
  type ColumnFilterValue,
} from "@/components/admin/composables/tables/table-filters";
import {
  TablePagination,
  useServerPagination,
} from "@/components/admin/composables/tables/table-pagination";
import { Card, CardBody, Pill } from "@/components/admin/composables/ui-bits";
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
  const pagination = useServerPagination(5);

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

  // Filter inquiries
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

  const totalPages = Math.max(1, Math.ceil(filteredInquiries.length / pagination.pageSize));
  const safePage = Math.min(pagination.page, totalPages);
  const paginatedInquiries = filteredInquiries.slice(
    (safePage - 1) * pagination.pageSize,
    safePage * pagination.pageSize
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
  const confidential = allInquiries.filter((i) => i.status === "Confidential_Pastoral").length;

  return (
    <>
      <Topbar
        title="Youth Questions Desk"
        description={`${totalInquiries} inquiries · ${needsAnswer} needs answer · ${approved} approved`}
        action={
          <button
            onClick={() => setIsCreatingInquiry(true)}
            className="inline-flex h-8 items-center gap-1.5 rounded-md bg-danger px-3 text-[11px] font-bold text-white transition hover:opacity-90"
          >
            <Icon icon="mdi:plus" className="h-3.5 w-3.5" /> New Question
          </button>
        }
      />

      <div className="flex-1 overflow-y-auto px-5 py-4">
        <Card>
          <TableToolbar
            searchValue={searchQuery}
            onSearchChange={(value) => {
              setSearchQuery(value);
              pagination.reset();
            }}
            searchPlaceholder="Search question or reference…"
          />

          <CardBody className="p-0">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="label-eyebrow px-3.5 py-2.5 text-left">
                    <ColumnHeader
                      label="Reference"
                      filter={
                        <ColumnFilter
                          label="Status"
                          mode="select"
                          options={[
                            { value: "Needs_Answer", label: "Needs Answer" },
                            { value: "Drafted", label: "Drafted" },
                            { value: "Approved_For_Bulletin", label: "Approved" },
                            { value: "Confidential_Pastoral", label: "Confidential" },
                          ]}
                          value={
                            filterStatus ? { operator: "equals", value: filterStatus } : undefined
                          }
                          onChange={(v) => {
                            setFilterStatus(v?.value);
                            pagination.reset();
                          }}
                        />
                      }
                    />
                  </th>
                  <th className="label-eyebrow px-3.5 py-2.5 text-left">
                    <ColumnHeader label="Question" />
                  </th>
                  <th className="label-eyebrow px-3.5 py-2.5 text-left">
                    <ColumnHeader label="Submitted" />
                  </th>
                  <th className="label-eyebrow px-3.5 py-2.5 text-center">
                    <ColumnHeader label="Upvotes" />
                  </th>
                  <th className="label-eyebrow px-3.5 py-2.5 text-left">
                    <ColumnHeader label="Status" />
                  </th>
                  <th className="label-eyebrow px-3.5 py-2.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {paginatedInquiries.map((inquiry) => (
                  <tr key={inquiry.id} className="border-b border-border/30 last:border-0 hover:bg-bg-3">
                    <td className="px-3.5 py-2.5 font-mono text-[10px] font-bold text-gold">
                      {inquiry.inquiry_reference}
                    </td>
                    <td className="px-3.5 py-2.5 text-[11px] text-text-1 max-w-sm truncate">
                      {inquiry.question_text}
                    </td>
                    <td className="px-3.5 py-2.5 text-[11px] text-text-2">
                      {new Date(inquiry.submitted_at).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                      })}
                    </td>
                    <td className="px-3.5 py-2.5 text-center text-[11px] font-bold text-red-600">
                      {inquiry.upvotes_count || 0}
                    </td>
                    <td className="px-3.5 py-2.5">
                      <Pill
                        tone={
                          inquiry.status === "Approved_For_Bulletin"
                            ? "success"
                            : inquiry.status === "Confidential_Pastoral"
                              ? "neutral"
                              : inquiry.status === "Drafted"
                                ? "warning"
                                : "danger"
                        }
                      >
                        {inquiry.status?.replace(/_/g, " ")}
                      </Pill>
                    </td>
                    <td className="px-3.5 py-2.5 text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button
                            type="button"
                            className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-border bg-bg-2 text-text-2 hover:border-gold-3 hover:text-gold"
                          >
                            <MoreVertical className="h-3.5 w-3.5" />
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
                            className="text-danger focus:text-danger"
                            onClick={() => setConfirmDelete(inquiry.id)}
                          >
                            <Trash2 className="mr-2 h-3.5 w-3.5" /> Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                ))}
                {paginatedInquiries.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-3.5 py-6 text-center text-[12px] text-text-2">
                      No inquiries found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </CardBody>

          <TablePagination
            page={safePage}
            pageSize={pagination.pageSize}
            total={filteredInquiries.length}
            totalPages={totalPages}
            onPageChange={pagination.setPage}
            onPageSizeChange={pagination.setPageSize}
          />
        </Card>
      </div>

      {/* Edit Inquiry Dialog */}
      <AlertDialog open={isEditingPanel} onOpenChange={setIsEditingPanel}>
        <AlertDialogContent className="max-w-2xl">
          <AlertDialogTitle>Edit Inquiry Response</AlertDialogTitle>
          <div className="space-y-4 py-4">
            <div>
              <label className="text-xs font-bold uppercase text-text-2 block mb-2">Question</label>
              <p className="text-sm text-text-1 bg-bg-2 rounded p-3">{selectedInquiry?.question_text}</p>
            </div>

            <div>
              <label className="text-xs font-bold uppercase text-text-2 block mb-2">Status</label>
              <select
                value={editingValues.status}
                onChange={(e) => setEditingValues({ ...editingValues, status: e.target.value })}
                className="w-full rounded border border-border bg-bg-3 px-2 py-1.5 text-[11px]"
              >
                <option value="Needs_Answer">Needs Answer</option>
                <option value="Drafted">Drafted</option>
                <option value="Approved_For_Bulletin">Approved for Bulletin</option>
                <option value="Confidential_Pastoral">Confidential Pastoral</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-bold uppercase text-text-2 block mb-2">Pastoral Response</label>
              <textarea
                value={editingValues.pastoral_response}
                onChange={(e) =>
                  setEditingValues({ ...editingValues, pastoral_response: e.target.value })
                }
                className="w-full rounded border border-border bg-bg-3 px-2 py-1.5 text-[11px] resize-none min-h-24"
                placeholder="Enter pastoral response…"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleSaveEdit}
              className="bg-primary hover:opacity-90"
            >
              Save Response
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
              <label className="text-xs font-bold uppercase text-text-2 block mb-2">Question</label>
              <textarea
                value={newInquiry.question_text || ""}
                onChange={(e) => setNewInquiry({ ...newInquiry, question_text: e.target.value })}
                className="w-full rounded border border-border bg-bg-3 px-2 py-1.5 text-sm resize-none min-h-24"
                placeholder="Write the youth question…"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => createMut.mutate()}
              disabled={!newInquiry.question_text?.trim()}
              className="bg-primary hover:opacity-90 disabled:opacity-50"
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
