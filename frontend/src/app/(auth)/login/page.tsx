"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

const schema = z.object({
  email: z.string().email("Enter a valid email"),
  password: z.string().min(1, "Password is required"),
});

type FormData = z.infer<typeof schema>;

export default function LoginPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const searchParams = typeof window !== "undefined"
    ? new URLSearchParams(window.location.search)
    : null;
  const redirectTo = searchParams?.get("redirect") ?? "/dashboard";
  const sessionExpired = searchParams?.get("reason") === "session_expired";

  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  async function onSubmit(data: FormData) {
    setLoading(true);
    const result = await signIn("credentials", { ...data, redirect: false });

    if (result?.error) {
      setLoading(false);
      toast.error("Invalid email or password");
    } else {
      // refresh() re-fetches server components with the new session cookie,
      // then push() navigates so the dashboard loads with fresh session data.
      router.refresh();
      await new Promise((r) => setTimeout(r, 300));
      router.push(redirectTo);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 px-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-primary text-primary-foreground text-xl font-bold">B</div>
          <h1 className="text-2xl font-bold">Welcome back</h1>
          <p className="text-muted-foreground text-sm">Sign in to your Bankiko account</p>
          {sessionExpired && (
            <p className="text-amber-600 text-sm bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
              Your session expired. Please sign in again.
            </p>
          )}
        </div>

        <div className="bg-card border rounded-xl p-6 shadow-sm space-y-4">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Email</label>
              <input
                {...register("email")}
                type="email"
                placeholder="you@example.com"
                className="w-full px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring bg-background"
              />
              {errors.email && <p className="text-destructive text-xs">{errors.email.message}</p>}
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium">Password</label>
              <input
                {...register("password")}
                type="password"
                placeholder="••••••••"
                className="w-full px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring bg-background"
              />
              {errors.password && <p className="text-destructive text-xs">{errors.password.message}</p>}
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground py-2 rounded-md text-sm font-medium hover:bg-primary/90 disabled:opacity-60"
            >
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              Sign in
            </button>
          </form>
        </div>

        <p className="text-center text-sm text-muted-foreground">
          No account?{" "}
          <Link href="/register" className="text-primary font-medium hover:underline">
            Create one
          </Link>
        </p>
      </div>
    </div>
  );
}
