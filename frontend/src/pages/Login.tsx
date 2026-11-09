import { SignIn, SignUp } from "@clerk/react";
import { useLocation } from "react-router-dom";
import { Zap } from "lucide-react";

export default function Login() {
  const signup = useLocation().pathname.startsWith("/sign-up");

  return (
    <div className="relative flex min-h-dvh flex-col items-center justify-center overflow-hidden bg-background p-5">
      {/* Background glow */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -left-32 -top-32 size-96 rounded-full bg-volt/8 blur-3xl" />
        <div className="absolute -bottom-32 -right-32 size-96 rounded-full bg-cyan-focus/5 blur-3xl" />
      </div>

      <div className="relative w-full max-w-md">
        {/* Brand */}
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 grid size-14 place-items-center rounded-2xl bg-volt shadow-[0_0_32px_rgba(34,197,94,0.3)]">
            <Zap className="size-7 text-volt-ink" strokeWidth={2.6} />
          </div>
          <p className="font-heading text-3xl font-extrabold uppercase tracking-tight">
            Iron<span className="text-volt">Core</span>
          </p>
          <p className="mt-1.5 text-sm text-muted-foreground">
            {signup ? "Create your training account" : "Sign in to your training log"}
          </p>
        </div>

        {/* Clerk component */}
        <div className="clerk-auth-wrapper">
          {signup ? (
            <SignUp
              routing="path"
              path="/sign-up"
              signInUrl="/login"
              fallbackRedirectUrl="/profile?onboarding=1"
            />
          ) : (
            <SignIn
              routing="path"
              path="/login"
              signUpUrl="/sign-up"
              fallbackRedirectUrl="/"
              withSignUp
              transferable
            />
          )}
        </div>
      </div>
    </div>
  );
}
