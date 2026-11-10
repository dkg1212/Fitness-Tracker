import { SignIn, SignUp } from "@clerk/react";
import { useLocation } from "react-router-dom";
import { Zap } from "lucide-react";

const appearance = {
  variables: {
    // These are the variables Clerk actually respects
    colorBackground: "#0E131A",
    colorInputBackground: "#0A0D12",
    colorInputText: "#F8FAFC",
    colorText: "#F8FAFC",
    colorTextSecondary: "#94A3B8",
    colorTextOnPrimaryBackground: "#052E16",
    colorPrimary: "#22C55E",
    colorDanger: "#FF3B30",
    colorNeutral: "#334155",
    borderRadius: "0.6rem",
    fontFamily: "'DM Sans Variable', sans-serif",
    fontFamilyButtons: "'DM Sans Variable', sans-serif",
    fontSize: "15px",
    spacingUnit: "1rem",
  },
  elements: {
    rootBox: "w-full",
    // Hide Clerk's own card container completely — we provide our own wrapper
    cardBox: "clerk-card-box",
    card: "clerk-card",
    // Hide Clerk's logo/header — we have our own brand above
    header: "clerk-header",
    headerTitle: "clerk-header-title",
    headerSubtitle: "clerk-header-subtitle",
    // Form
    formFieldInput: "clerk-input",
    formFieldLabel: "clerk-label",
    formFieldAction: "clerk-field-action",
    formButtonPrimary: "clerk-btn-primary",
    // Social
    socialButtonsBlockButton: "clerk-social-btn",
    socialButtonsBlockButtonText: "clerk-social-btn-text",
    // Divider
    dividerLine: "clerk-divider-line",
    dividerText: "clerk-divider-text",
    // Footer
    footer: "clerk-footer",
    footerActionLink: "clerk-footer-link",
    footerActionText: "clerk-footer-text",
    // Errors
    formFieldErrorText: "clerk-error-text",
    alert: "clerk-alert",
  },
};

export default function Login() {
  const signup = useLocation().pathname.startsWith("/sign-up");

  return (
    <div className="relative flex min-h-dvh flex-col items-center justify-center overflow-hidden bg-background p-4">
      {/* Ambient glows */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -left-40 -top-40 size-[500px] rounded-full bg-volt/6 blur-[120px]" />
        <div className="absolute -bottom-40 -right-40 size-[400px] rounded-full bg-cyan-focus/4 blur-[100px]" />
      </div>

      <div className="relative z-10 w-full max-w-[400px]">
        {/* Brand */}
        <div className="mb-7 text-center">
          <div className="mx-auto mb-4 grid size-16 place-items-center rounded-2xl bg-volt shadow-[0_0_40px_rgba(34,197,94,0.35)]">
            <Zap className="size-8 text-volt-ink" strokeWidth={2.5} />
          </div>
          <h1 className="font-heading text-3xl font-extrabold uppercase tracking-tight">
            Iron<span className="text-volt">Core</span>
          </h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            {signup ? "Create your training account" : "Sign in to your training log"}
          </p>
        </div>

        {/* Clerk widget — rendered inside a styled container */}
        <div className="clerk-wrapper">
          {signup ? (
            <SignUp
              routing="path"
              path="/sign-up"
              signInUrl="/login"
              fallbackRedirectUrl="/profile?onboarding=1"
              appearance={appearance}
            />
          ) : (
            <SignIn
              routing="path"
              path="/login"
              signUpUrl="/sign-up"
              fallbackRedirectUrl="/"
              withSignUp
              transferable
              appearance={appearance}
            />
          )}
        </div>
      </div>
    </div>
  );
}
