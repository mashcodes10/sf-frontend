import { z } from "zod";
import {
  ADDRESS_TYPES,
  type AddressFormValues,
  type AddressInput,
  type ContactInput,
} from "./types";

/**
 * Client/server-shared validation for the contact form.
 *
 * The rules mirror the API's Pydantic models (`ContactCreate` / `ContactReplace`)
 * so the user sees a mistake before a round trip — the API stays the authority,
 * and anything it rejects anyway is surfaced by `toFieldErrors` in `./api.ts`.
 */

/** Optional text: trimmed, and blank becomes `null` (the API clears the field). */
function optionalText(max: number, label: string) {
  return z
    .string()
    .trim()
    .max(max, `${label} must be ${max} characters or fewer`)
    .transform((value) => value || null)
    .nullable()
    .default(null);
}

/**
 * Photo rules, mirroring the API: an inline base64 `data:image/...` URL of one
 * of the types we render, decoding to at most 1 MiB. The regex enforces real
 * base64 shape (four-character quanta, padding only at the end), so the byte
 * arithmetic below is exact.
 */
const PHOTO_DATA_URL_RE =
  /^data:image\/(png|jpeg|gif|webp);base64,(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=|[A-Za-z0-9+/]{4})$/;
/** 1 MiB decoded — the API's cap. */
export const PHOTO_MAX_BYTES = 1_048_576;
/** Coarse fast-fail bound on the whole data URL before any parsing. */
export const PHOTO_MAX_ENCODED_LENGTH = 1_400_000;

/** Exact decoded size of a data URL's base64 payload (regex-validated). */
function photoDecodedBytes(value: string): number {
  const data = value.slice(value.indexOf(",") + 1);
  const padding = data.endsWith("==") ? 2 : data.endsWith("=") ? 1 : 0;
  return (data.length / 4) * 3 - padding;
}

function requiredText(max: number, label: string) {
  return z
    .string()
    .trim()
    .min(1, `${label} is required`)
    .max(max, `${label} must be ${max} characters or fewer`);
}

/** Mirrors the API's cap on how many addresses one contact can carry. */
export const MAX_ADDRESSES = 20;

export const addressInputSchema = z.object({
  type: z.enum(ADDRESS_TYPES, "Pick Home, Work, or Other"),
  address: optionalText(300, "Street address"),
  city: optionalText(120, "City"),
  state: optionalText(120, "State"),
  postal_code: optionalText(20, "Postal code"),
  country: optionalText(120, "Country"),
}) satisfies z.ZodType<AddressInput, unknown>;

/** True when the user typed something beyond just picking a type. */
function hasContent(row: AddressInput): boolean {
  return Boolean(
    row.address ?? row.city ?? row.state ?? row.postal_code ?? row.country,
  );
}

export const contactInputSchema = z.object({
  first_name: requiredText(100, "First name"),
  last_name: requiredText(100, "Last name"),
  email: z
    .string()
    .trim()
    .min(1, "Email is required")
    .max(320, "Email must be 320 characters or fewer")
    .pipe(z.email("Enter a valid email address"))
    .transform((value) => value.toLowerCase()),
  phone: optionalText(40, "Phone"),
  company: optionalText(200, "Company"),
  job_title: optionalText(200, "Job title"),
  notes: z
    .string()
    .trim()
    .transform((value) => value || null)
    .nullable()
    .default(null),
  addresses: z
    .array(addressInputSchema)
    .max(MAX_ADDRESSES, `A contact can have at most ${MAX_ADDRESSES} addresses`)
    // An added-then-untouched row is noise, not an address — drop it quietly.
    .transform((rows) => rows.filter(hasContent))
    .default([]),
  photo: z
    .string()
    .trim()
    .max(PHOTO_MAX_ENCODED_LENGTH, "Photo must be 1 MB or smaller")
    .refine(
      (value) => value === "" || PHOTO_DATA_URL_RE.test(value),
      "Photo must be a PNG, JPEG, GIF, or WebP image",
    )
    .refine(
      (value) =>
        value === "" ||
        !PHOTO_DATA_URL_RE.test(value) || // already rejected above
        photoDecodedBytes(value) <= PHOTO_MAX_BYTES,
      "Photo must be 1 MB or smaller",
    )
    .transform((value) => value || null)
    .nullable()
    .default(null),
}) satisfies z.ZodType<ContactInput, unknown>;

/** Collapse a ZodError into one message per field, keyed by input name. */
export function zodFieldErrors(
  error: z.ZodError,
): Partial<Record<keyof ContactInput, string>> {
  const fieldErrors: Partial<Record<keyof ContactInput, string>> = {};
  for (const issue of error.issues) {
    const key = issue.path[0];
    if (typeof key === "string" && !(key in fieldErrors)) {
      fieldErrors[key as keyof ContactInput] = issue.message;
    }
  }
  return fieldErrors;
}

/* ------------------------------------------------------------------ */
/* Form metadata — one source of truth for the fields and their limits */
/* ------------------------------------------------------------------ */

export interface FieldSpec {
  name: string;
  label: string;
  type?: "text" | "email" | "tel" | "textarea";
  required?: boolean;
  maxLength: number;
  placeholder?: string;
  autoComplete?: string;
  /** Column span inside the section grid. */
  wide?: boolean;
}

export interface ContactFieldSpec extends FieldSpec {
  name: Exclude<keyof ContactInput, "addresses" | "photo">;
}

/** The inputs of one address row; `AddressesField` prefixes the names. */
export interface AddressFieldSpec extends FieldSpec {
  name: keyof Omit<AddressInput, "type">;
}

export interface ContactFieldGroup {
  title: string;
  description: string;
  fields: ContactFieldSpec[];
}

export const CONTACT_FIELD_GROUPS: ContactFieldGroup[] = [
  {
    title: "Identity",
    description: "First name, last name, and email are required.",
    fields: [
      {
        name: "first_name",
        label: "First name",
        required: true,
        maxLength: 100,
        placeholder: "Ada",
        autoComplete: "given-name",
      },
      {
        name: "last_name",
        label: "Last name",
        required: true,
        maxLength: 100,
        placeholder: "Lovelace",
        autoComplete: "family-name",
      },
      {
        name: "email",
        label: "Email",
        type: "email",
        required: true,
        maxLength: 320,
        placeholder: "ada@example.com",
        autoComplete: "email",
      },
      {
        name: "phone",
        label: "Phone",
        type: "tel",
        maxLength: 40,
        placeholder: "+1-415-555-0101",
        autoComplete: "tel",
      },
    ],
  },
  {
    title: "Work",
    description: "Where they work and what they do.",
    fields: [
      {
        name: "company",
        label: "Company",
        maxLength: 200,
        placeholder: "Analytical Engines",
        autoComplete: "organization",
      },
      {
        name: "job_title",
        label: "Job title",
        maxLength: 200,
        placeholder: "Mathematician",
        autoComplete: "organization-title",
      },
    ],
  },
  {
    title: "Notes",
    description: "Anything worth remembering. No length limit.",
    fields: [
      {
        name: "notes",
        label: "Notes",
        type: "textarea",
        maxLength: 10_000,
        placeholder: "Met at the SF hackathon.",
        wide: true,
      },
    ],
  },
];

export const CONTACT_FIELDS: ContactFieldSpec[] = CONTACT_FIELD_GROUPS.flatMap(
  (group) => group.fields,
);

/** The inputs of one address row, rendered per row by `AddressesField`. */
export const ADDRESS_FIELDS: AddressFieldSpec[] = [
  {
    name: "address",
    label: "Street address",
    maxLength: 300,
    placeholder: "1 Market St, Suite 400",
    autoComplete: "street-address",
    wide: true,
  },
  {
    name: "city",
    label: "City",
    maxLength: 120,
    placeholder: "San Francisco",
    autoComplete: "address-level2",
  },
  {
    name: "state",
    label: "State / region",
    maxLength: 120,
    placeholder: "CA",
    autoComplete: "address-level1",
  },
  {
    name: "postal_code",
    label: "Postal code",
    maxLength: 20,
    placeholder: "94105",
    autoComplete: "postal-code",
  },
  {
    name: "country",
    label: "Country",
    maxLength: 120,
    placeholder: "USA",
    autoComplete: "country-name",
  },
];

/** `addresses.<row>.<field>` — the input name of one address field. */
export function addressInputName(
  index: number,
  field: keyof AddressInput,
): string {
  return `addresses.${index}.${field}`;
}

/** The values the form submits: raw strings, plus the address rows. */
export type ContactFormValues = Partial<
  Record<Exclude<keyof ContactInput, "addresses">, string>
> & { addresses: AddressFormValues[] };

/**
 * Pull the contact fields out of a submitted form, as raw strings. Address
 * rows are indexed (`addresses.0.city`, …); rows removed in the UI leave
 * gaps, so collect by scanning the indexes that actually submitted a type.
 */
export function formDataToValues(formData: FormData): ContactFormValues {
  const flat = Object.fromEntries(
    [...CONTACT_FIELDS.map((field) => field.name), "photo" as const].map(
      (name) => [name, String(formData.get(name) ?? "")],
    ),
  );

  const addresses: AddressFormValues[] = [];
  for (let index = 0; index < MAX_ADDRESSES; index += 1) {
    if (!formData.has(addressInputName(index, "type"))) continue;
    addresses.push(
      Object.fromEntries(
        (["type", ...ADDRESS_FIELDS.map((field) => field.name)] as const).map(
          (field) => [
            field,
            String(formData.get(addressInputName(index, field)) ?? ""),
          ],
        ),
      ) as AddressFormValues,
    );
  }

  return { ...flat, addresses } as ContactFormValues;
}
