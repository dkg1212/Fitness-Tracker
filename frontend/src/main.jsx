import React from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter } from "react-router-dom";
import { ClerkProvider, useAuth } from "@clerk/react";
import App from "./App.jsx";
import { setApiTokenGetter } from "./lib/api";
import "./index.css";

const queryClient = new QueryClient({ defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } } });
const clerkKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;
if (!clerkKey) throw new Error("VITE_CLERK_PUBLISHABLE_KEY is missing from frontend/.env.local");
function ApiTokenBridge({ children }) { const { getToken } = useAuth(); setApiTokenGetter(() => getToken()); return children; }
createRoot(document.getElementById("root")).render(
  <React.StrictMode><ClerkProvider publishableKey={clerkKey} signInUrl="/login" signUpUrl="/sign-up" signInFallbackRedirectUrl="/" signUpFallbackRedirectUrl="/"><ApiTokenBridge><QueryClientProvider client={queryClient}><BrowserRouter><App /></BrowserRouter></QueryClientProvider></ApiTokenBridge></ClerkProvider></React.StrictMode>,
);
