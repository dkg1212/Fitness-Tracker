import { SignIn, SignUp } from "@clerk/react";
import { useLocation } from "react-router-dom";

export default function Login() {
  const signup = useLocation().pathname.startsWith("/sign-up");
  return <div className="grid min-h-dvh place-items-center bg-background p-5"><div className="w-full max-w-md"><div className="mb-6 text-center"><p className="font-heading text-3xl font-extrabold uppercase">Iron<span className="text-volt">Core</span></p><p className="mt-1 text-sm text-muted-foreground">Your personal training log</p></div>{signup ? <SignUp routing="path" path="/sign-up" signInUrl="/login" fallbackRedirectUrl="/" /> : <SignIn routing="path" path="/login" signUpUrl="/sign-up" fallbackRedirectUrl="/" withSignUp transferable />}</div></div>;
}
