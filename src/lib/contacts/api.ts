import "server-only";

import { cache } from "react";
import { ApiError, apiFetch, apiJson } from "@/lib/apiClient";
import type {
  Contact,
  ContactInput,
  ContactPage,
  HealthResponse,
  SortField,
  SortOrder,
} from "./types";

/**
 * Server-side data access for the Contacts API.
 *
 * Everything here runs on the Next server (RSC render or server action), so the
 * backend URL stays private and the browser never makes a cross-origin request.
 */

const CONTACTS_PATH = "/api/v1/contacts";

export interface ListContactsParams {
  search?: string;
  limit?: number;
  offset?: number;
  sortBy?: SortField;
  order?: SortOrder;
}

export async function listContacts(
  params: ListContactsParams = {},
): Promise<ContactPage> {
  const query = new URLSearchParams();
  if (params.search) query.set("search", params.search);
  if (params.limit != null) query.set("limit", String(params.limit));
  if (params.offset) query.set("offset", String(params.offset));
  if (params.sortBy) query.set("sort_by", params.sortBy);
  if (params.order) query.set("order", params.order);

  return apiJson<ContactPage>(`${CONTACTS_PATH}?${query}`, {
    cache: "no-store",
  });
}

/**
 * Fetch one contact, or `null` when the API reports 404.
 *
 * Wrapped in React's `cache()` so `generateMetadata` and the page body share
 * one request per render instead of firing two identical concurrent calls.
 */
export const getContact = cache(async (id: number): Promise<Contact | null> => {
  try {
    return await apiJson<Contact>(`${CONTACTS_PATH}/${id}`, {
      cache: "no-store",
    });
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return null;
    throw error;
  }
});

export async function createContact(input: ContactInput): Promise<Contact> {
  return apiJson<Contact>(CONTACTS_PATH, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

/**
 * Full replacement (`PUT`). The edit form submits every field, so omitted values
 * really should be cleared — which is exactly `PUT`'s contract here.
 */
export async function replaceContact(
  id: number,
  input: ContactInput,
): Promise<Contact> {
  return apiJson<Contact>(`${CONTACTS_PATH}/${id}`, {
    method: "PUT",
    body: JSON.stringify(input),
  });
}

/** Partial update (`PATCH`) — only the keys present are written. */
export async function updateContact(
  id: number,
  patch: Partial<ContactInput>,
): Promise<Contact> {
  return apiJson<Contact>(`${CONTACTS_PATH}/${id}`, {
    method: "PATCH",
    body: JSON.stringify(patch),
  });
}

export async function deleteContact(id: number): Promise<void> {
  const res = await apiFetch(`${CONTACTS_PATH}/${id}`, { method: "DELETE" });
  if (!res.ok) {
    throw new ApiError(res.status, await res.text().catch(() => ""));
  }
}

export async function getHealth(): Promise<HealthResponse | null> {
  try {
    // The badge is decoration; never let it hold the page open for long.
    return await apiJson<HealthResponse>("/health", {
      cache: "no-store",
      signal: AbortSignal.timeout(2000),
    });
  } catch {
    return null;
  }
}

/* ------------------------------------------------------------------ */
/* Error translation                                                   */
/* ------------------------------------------------------------------ */

interface ValidationIssue {
  loc: (string | number)[];
  msg: string;
}

/** `{"detail": "..."}` from the API, or a sensible fallback. */
export function apiErrorMessage(error: ApiError, fallback: string): string {
  const detail = error.json<{ detail?: unknown }>()?.detail;
  return typeof detail === "string" && detail ? detail : fallback;
}

/**
 * Turn a 422 `HTTPValidationError` into per-field messages. FastAPI reports the
 * location as `["body", "<field>", ...]`; a nested address failure looks like
 * `["body", "addresses", 0, "city"]` and is folded onto the `addresses` key —
 * the only error slot the address widget renders — with the row spelled out.
 */
export function toFieldErrors(
  error: ApiError,
): Partial<Record<keyof ContactInput, string>> {
  const detail = error.json<{ detail?: ValidationIssue[] }>()?.detail;
  if (!Array.isArray(detail)) return {};

  const fieldErrors: Partial<Record<keyof ContactInput, string>> = {};
  for (const issue of detail) {
    const loc = issue.loc ?? [];
    const path = loc[0] === "body" ? loc.slice(1) : loc;
    const [field, index, member] = path;
    if (typeof field !== "string") continue;

    if (field === "addresses") {
      const where =
        typeof index === "number" ? `Address ${index + 1}` : "Addresses";
      const label =
        typeof member === "string" ? ` ${member.replace(/_/g, " ")}` : "";
      fieldErrors.addresses ??= `${where}${label}: ${issue.msg}`;
    } else {
      fieldErrors[field as keyof ContactInput] ??= issue.msg;
    }
  }
  return fieldErrors;
}
