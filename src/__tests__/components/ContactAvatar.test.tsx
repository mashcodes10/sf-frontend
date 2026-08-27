import React from "react";
import { render } from "@testing-library/react";
import ContactAvatar from "@/components/contacts/ContactAvatar";
import { makeContact } from "../mocks/handlers";

const PHOTO =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

describe("ContactAvatar", () => {
  it("falls back to initials when there is no photo", () => {
    const { container } = render(<ContactAvatar contact={makeContact()} />);

    expect(container.textContent).toBe("AL");
    expect(container.querySelector("img")).toBeNull();
  });

  it("renders the photo as a circular image when one is set", () => {
    const { container } = render(
      <ContactAvatar contact={makeContact({ photo: PHOTO })} />,
    );

    const img = container.querySelector("img");
    expect(img).toHaveAttribute("src", PHOTO);
    expect(img?.className).toContain("rounded-full");
    expect(img?.className).toContain("object-cover");
    expect(container.textContent).toBe(""); // no initials next to the photo
  });
});
