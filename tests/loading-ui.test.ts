import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { Button } from "@/components/ui/button";
import Loading from "@/app/(app)/loading";

describe("loading feedback", () => {
  it("renders an accessible circular route loading indicator", () => {
    const markup = renderToStaticMarkup(createElement(Loading));

    expect(markup).toContain('role="status"');
    expect(markup).toContain('aria-label="Loading page"');
    expect(markup).toContain("animate-spin");
  });

  it("shows an accessible spinner and disables a button while loading", () => {
    const markup = renderToStaticMarkup(
      createElement(Button, { loading: true }, "Save")
    );

    expect(markup).toContain('aria-busy="true"');
    expect(markup).toContain("animate-spin");
    expect(markup).toContain('disabled=""');
  });

  it("leaves a regular button without loading feedback", () => {
    const markup = renderToStaticMarkup(
      createElement(Button, null, "Open menu")
    );

    expect(markup).not.toContain("aria-busy");
    expect(markup).not.toContain("animate-spin");
    expect(markup).not.toContain('disabled=""');
  });
});
