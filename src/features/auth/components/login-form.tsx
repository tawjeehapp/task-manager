"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";

import {
  loginSchema,
  type LoginInput,
} from "@/features/auth/schemas/auth.schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";

export function LoginForm() {
  const t = useTranslations("auth");
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);

  const form = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      employeeNumber: "",
      password: "",
    },
  });

  async function onSubmit(values: LoginInput) {
    setServerError(null);

    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });

    const payload = (await response.json()) as {
      data?: { user: { mustChangePassword: boolean } };
      error?: { message: string };
    };

    if (!response.ok) {
      setServerError(payload.error?.message ?? t("loginFailed"));
      return;
    }

    if (payload.data?.user.mustChangePassword) {
      router.replace("/change-password");
      router.refresh();
      return;
    }

    router.replace("/");
    router.refresh();
  }

  return (
    <Card className="w-full border-0 bg-card shadow-sm ring-1 ring-primary/10">
      <CardHeader>
        <CardTitle className="text-primary">{t("loginTitle")}</CardTitle>
        <CardDescription>{t("loginDescription")}</CardDescription>
      </CardHeader>
      <CardContent>
        <form
          method="post"
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            void form.handleSubmit(onSubmit)(event);
          }}
          noValidate
        >
          <div className="space-y-2">
            <Label htmlFor="employeeNumber">{t("employeeNumber")}</Label>
            <Input
              id="employeeNumber"
              inputMode="numeric"
              autoComplete="username"
              maxLength={4}
              aria-invalid={Boolean(form.formState.errors.employeeNumber)}
              {...form.register("employeeNumber")}
            />
            {form.formState.errors.employeeNumber ? (
              <p className="text-sm text-destructive">
                {form.formState.errors.employeeNumber.message}
              </p>
            ) : null}
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">{t("password")}</Label>
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              aria-invalid={Boolean(form.formState.errors.password)}
              {...form.register("password")}
            />
            {form.formState.errors.password ? (
              <p className="text-sm text-destructive">
                {form.formState.errors.password.message}
              </p>
            ) : null}
          </div>

          {serverError ? (
            <Alert variant="destructive">
              <AlertDescription>{serverError}</AlertDescription>
            </Alert>
          ) : null}

          <Button
            type="submit"
            className="w-full bg-primary text-primary-foreground hover:bg-primary-hover"
            disabled={form.formState.isSubmitting}
          >
            {form.formState.isSubmitting ? t("loggingIn") : t("login")}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
