import {
  CONTACT_FIELDS,
  contactInputSchema,
  formDataToValues,
  zodFieldErrors,
} from "@/lib/contacts/schema";

function values(overrides: Record<string, unknown> = {}) {
  return {
    first_name: "Ada",
    last_name: "Lovelace",
    email: "Ada@Example.com",
    phone: "",
    company: "",
    job_title: "",
    notes: "",
    photo: "",
    addresses: [] as Record<string, string>[],
    ...overrides,
  };
}

const PHOTO =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

describe("contactInputSchema", () => {
  it("lowercases the email and nulls out the blanks", () => {
    const parsed = contactInputSchema.parse(values());

    expect(parsed.email).toBe("ada@example.com");
    expect(parsed.phone).toBeNull();
    expect(parsed.notes).toBeNull();
  });

  it("trims what the user typed", () => {
    expect(contactInputSchema.parse(values({ company: "  Acme  " })).company).toBe(
      "Acme",
    );
  });

  it("requires the three fields the API requires", () => {
    const result = contactInputSchema.safeParse(
      values({ first_name: " ", last_name: "", email: "" }),
    );

    expect(result.success).toBe(false);
    expect(zodFieldErrors(result.error!)).toEqual({
      first_name: "First name is required",
      last_name: "Last name is required",
      email: "Email is required",
    });
  });

  it("accepts an image data URL as the photo and nulls out a blank one", () => {
    expect(contactInputSchema.parse(values({ photo: PHOTO })).photo).toBe(PHOTO);
    expect(contactInputSchema.parse(values()).photo).toBeNull();
  });

  it("enforces the API's 1 MiB decoded cap exactly", () => {
    // 1,048,576 bytes = 349,525 full quanta + one "AA==" terminal quantum.
    const atLimit = `data:image/png;base64,${"A".repeat(1_398_100)}AA==`;
    // One byte more changes the terminal quantum to "AAA=".
    const overLimit = `data:image/png;base64,${"A".repeat(1_398_100)}AAA=`;

    expect(contactInputSchema.parse(values({ photo: atLimit })).photo).toBe(
      atLimit,
    );
    const result = contactInputSchema.safeParse(values({ photo: overLimit }));
    expect(zodFieldErrors(result.error!).photo).toBe(
      "Photo must be 1 MB or smaller",
    );
  });

  it("rejects a photo that is not an inline image", () => {
    for (const bad of [
      "https://example.com/ada.png",
      "data:text/html;base64,PGI+aGk8L2I+",
      "data:image/svg+xml;base64,PHN2Zy8+",
      "data:image/png;base64,A", // impossible base64 quantum
      "data:image/png;base64,abcd=", // invalid padding placement
    ]) {
      const result = contactInputSchema.safeParse(values({ photo: bad }));
      expect(zodFieldErrors(result.error!).photo).toBe(
        "Photo must be a PNG, JPEG, GIF, or WebP image",
      );
    }
  });

  it("rejects a malformed email", () => {
    const result = contactInputSchema.safeParse(values({ email: "not-an-email" }));
    expect(zodFieldErrors(result.error!).email).toBe("Enter a valid email address");
  });

  it("enforces the API's length limits", () => {
    const result = contactInputSchema.safeParse(
      values({ first_name: "a".repeat(101), company: "c".repeat(201) }),
    );

    expect(zodFieldErrors(result.error!)).toEqual({
      first_name: "First name must be 100 characters or fewer",
      company: "Company must be 200 characters or fewer",
    });
  });

  it("keeps filled address rows, typed and trimmed", () => {
    const parsed = contactInputSchema.parse(
      values({
        addresses: [
          { type: "Work", address: " 500 Howard St ", city: "SF", state: "", postal_code: "", country: "" },
        ],
      }),
    );

    expect(parsed.addresses).toEqual([
      {
        type: "Work",
        address: "500 Howard St",
        city: "SF",
        state: null,
        postal_code: null,
        country: null,
      },
    ]);
  });

  it("drops address rows the user added but never filled in", () => {
    const parsed = contactInputSchema.parse(
      values({
        addresses: [
          { type: "Home", address: "", city: "", state: "", postal_code: "", country: "" },
        ],
      }),
    );

    expect(parsed.addresses).toEqual([]);
  });

  it("rejects an unknown address type", () => {
    const result = contactInputSchema.safeParse(
      values({
        addresses: [
          { type: "Vacation", address: "1 Beach Rd", city: "", state: "", postal_code: "", country: "" },
        ],
      }),
    );

    expect(result.success).toBe(false);
    expect(zodFieldErrors(result.error!).addresses).toBe(
      "Pick Home, Work, or Other",
    );
  });
});

describe("formDataToValues", () => {
  it("pulls every known field out, defaulting to an empty string", () => {
    const formData = new FormData();
    formData.set("first_name", "Grace");
    formData.set("email", "grace@example.com");
    formData.set("ignored", "nope");

    const extracted = formDataToValues(formData);

    expect(extracted.first_name).toBe("Grace");
    expect(extracted.last_name).toBe("");
    expect(Object.keys(extracted).sort()).toEqual(
      [...CONTACT_FIELDS.map((field) => field.name), "photo", "addresses"].sort(),
    );
  });

  it("collects indexed address rows, skipping gaps left by removed rows", () => {
    const formData = new FormData();
    formData.set("first_name", "Grace");
    formData.set("addresses.0.type", "Home");
    formData.set("addresses.0.city", "Arlington");
    // Row 1 was removed in the UI; row 2 remains.
    formData.set("addresses.2.type", "Work");
    formData.set("addresses.2.city", "DC");

    const extracted = formDataToValues(formData);

    expect(extracted.addresses).toEqual([
      { type: "Home", address: "", city: "Arlington", state: "", postal_code: "", country: "" },
      { type: "Work", address: "", city: "DC", state: "", postal_code: "", country: "" },
    ]);
  });
});
