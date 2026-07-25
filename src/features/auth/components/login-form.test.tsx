import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it, vi } from "vitest";

import { LoginForm } from "@/features/auth/components/login-form";
import ar from "../../../../messages/ar.json";

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    replace: vi.fn(),
    refresh: vi.fn(),
  }),
}));

describe("LoginForm", () => {
  it("shows validation error for invalid employee number", async () => {
    const user = userEvent.setup();

    render(
      <NextIntlClientProvider locale="ar" messages={ar}>
        <LoginForm />
      </NextIntlClientProvider>,
    );

    await user.type(screen.getByLabelText("رقم الموظف"), "12");
    await user.type(screen.getByLabelText("كلمة المرور"), "secret");
    await user.click(screen.getByRole("button", { name: "دخول" }));

    expect(
      await screen.findByText("رقم الموظف يجب أن يكون 4 أرقام"),
    ).toBeInTheDocument();
  });
});
