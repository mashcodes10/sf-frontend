import { notFound } from "next/navigation";
import { ApiUnreachableError, apiFetch } from "@/lib/apiClient";

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
  // The whole segment must be digits — parseInt would accept "1abc" and
  // quietly export contact 1 for a path that should 404.
  if (!/^\d+$/.test(raw)) notFound();
  const id = Number(raw);
  if (!Number.isSafeInteger(id) || id < 1) notFound();

  let upstream: Response;
  try {
    upstream = await apiFetch(`/api/v1/contacts/${id}/vcard`, {
      cache: "no-store",
    });
  } catch (error) {
    // Transport failure (DNS, refused connection, timeout): same sanitized
    // 502 as an upstream HTTP error, not an internal server error.
    if (error instanceof ApiUnreachableError) {
      return new Response("The contact could not be exported.", { status: 502 });
    }
    throw error;
  }
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
