import { getDocuments, getStudies } from "@/lib/queries";
import { formatDate, humanizeEnum, isWithinDays } from "@/lib/format";
import { getDocumentDisplayStatus } from "@/lib/document-status";
import { Badge } from "@/components/badge";
import { UploadDocumentForm } from "./upload-form";
import { SignButton } from "./sign-button";
import { EditDocumentDetails } from "./edit-document-details";
import { AttachDocumentFile } from "./attach-document-file";

export default async function DocumentsPage({
  searchParams,
}: {
  searchParams: Promise<{ studyId?: string }>;
}) {
  const params = await searchParams;
  const [documents, studies] = await Promise.all([
    getDocuments({ studyId: params.studyId }),
    getStudies(),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">eISF / Regulatory Documents</h1>
        <p className="mt-1 text-sm text-neutral-500">
          {documents.length} document{documents.length === 1 ? "" : "s"}. &quot;Signed by / date&quot;
          here is an audit-trail placeholder, not a real 21 CFR Part 11 e-signature (Phase 5).
        </p>
      </div>

      <UploadDocumentForm studies={studies} />

      <form className="flex flex-wrap gap-3" method="get">
        <select
          name="studyId"
          defaultValue={params.studyId ?? ""}
          className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm dark:border-neutral-700 dark:bg-neutral-950"
        >
          <option value="">All studies</option>
          {studies.map((s) => (
            <option key={s.id} value={s.id}>
              {s.protocolId} — {s.title}
            </option>
          ))}
        </select>
        <button
          type="submit"
          className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-800"
        >
          Filter
        </button>
      </form>

      <div className="overflow-x-auto rounded-lg border border-neutral-200 dark:border-neutral-800">
        <table className="min-w-full divide-y divide-neutral-200 text-sm dark:divide-neutral-800">
          <thead className="bg-neutral-50 dark:bg-neutral-900">
            <tr>
              <th className="px-4 py-2 text-left font-medium text-neutral-500">Title</th>
              <th className="px-4 py-2 text-left font-medium text-neutral-500">Type</th>
              <th className="px-4 py-2 text-left font-medium text-neutral-500">Study</th>
              <th className="px-4 py-2 text-left font-medium text-neutral-500">Version</th>
              <th className="px-4 py-2 text-left font-medium text-neutral-500">Released</th>
              <th className="px-4 py-2 text-left font-medium text-neutral-500">Expiry</th>
              <th className="px-4 py-2 text-left font-medium text-neutral-500">Status</th>
              <th className="px-4 py-2 text-left font-medium text-neutral-500">Signed</th>
              <th className="px-4 py-2 text-left font-medium text-neutral-500"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
            {documents.map((doc) => {
              const expiringSoon = isWithinDays(doc.expiryDate, 60);
              const displayStatus = getDocumentDisplayStatus(doc);
              const downloadHref = !doc.fileUrl
                ? null
                : doc.fileUrl.startsWith("http")
                  ? doc.fileUrl
                  : `/api/documents/${doc.id}/file`;
              return (
                <tr key={doc.id}>
                  <td className="whitespace-nowrap px-4 py-2">
                    {downloadHref ? (
                      <a href={downloadHref} className="hover:underline" target="_blank" rel="noreferrer">
                        {doc.title}
                      </a>
                    ) : (
                      <>
                        {doc.title} <span className="ml-1 text-xs text-neutral-400">(no file attached)</span>
                      </>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-4 py-2 text-neutral-500">
                    {humanizeEnum(doc.type)}
                  </td>
                  <td className="whitespace-nowrap px-4 py-2">{doc.study.protocolId}</td>
                  <td className="whitespace-nowrap px-4 py-2">{doc.version}</td>
                  <td className="whitespace-nowrap px-4 py-2 text-neutral-500">{formatDate(doc.releaseDate)}</td>
                  <td
                    className={`whitespace-nowrap px-4 py-2 ${
                      expiringSoon ? "font-medium text-amber-600 dark:text-amber-400" : "text-neutral-500"
                    }`}
                  >
                    {formatDate(doc.expiryDate)}
                  </td>
                  <td className="whitespace-nowrap px-4 py-2">
                    <Badge value={displayStatus} />
                  </td>
                  <td className="whitespace-nowrap px-4 py-2 text-neutral-500">
                    {doc.signedBy ? `${doc.signedBy.name} · ${formatDate(doc.signedAt)}` : "—"}
                  </td>
                  <td className="px-4 py-2">
                    <div className="flex items-center gap-3">
                      {displayStatus === "PENDING" && <SignButton documentId={doc.id} />}
                      {!doc.fileUrl && displayStatus !== "SUPERSEDED" && <AttachDocumentFile documentId={doc.id} />}
                      {displayStatus !== "SUPERSEDED" && (
                        <EditDocumentDetails
                          documentId={doc.id}
                          version={doc.version}
                          releaseDateInput={doc.releaseDate ? doc.releaseDate.toISOString().slice(0, 10) : ""}
                        />
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
