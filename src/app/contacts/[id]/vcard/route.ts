import { notFound } from "next/navigation";
import { apiFetch } from "@/lib/apiClient";

/**
 * Stream a contact's vCard (.vcf) from the API to the browser.
 *
 * The download goes through this route handler — like every other request —
 * so the API base URL stays private to the server and CORS never applies.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const raw = (await params).id;
  const id = Number.parseInt(raw, 10);
  if (!Number.isInteger(id) || id < 1) notFound();

  const upstream = await apiFetch(`/api/v1/contacts/${id}/vcard`, {
    cache: "no-store",
  });
  if (upstream.status === 404) notFound();
  if (!upstream.ok) {
    return new Response("The contact could not be exported.", { status: 502 });
  }

  return new Response(upstream.body, {
    status: 200,
    headers: {
      "Content-Type": upstream.headers.get("Content-Type") ?? "text/vcard",
      "Content-Disposition":
        upstream.headers.get("Content-Disposition") ?? "attachment",
      "Cache-Control": "no-store",
    },
  });
}
