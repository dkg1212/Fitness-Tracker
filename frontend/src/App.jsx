import { Navigate, Route, Routes } from "react-router-dom";
import { Toaster } from "@/components/ui/sonner";
import AppShell from "@/components/AppShell";
import Analytics from "@/pages/Analytics";
import Dashboard from "@/pages/Dashboard";
import Exercises from "@/pages/Exercises";
import History from "@/pages/History";
import Logger from "@/pages/Logger";
import Login from "@/pages/Login";
import Profile from "@/pages/Profile";
import SplitPlanner from "@/pages/SplitPlanner";
import Templates from "@/pages/Templates";

// One <Route> per page in src/pages; BrowserRouter already wraps this in main.tsx.
export default function App() {
  return (
    <>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/sign-up/*" element={<Login />} />
        <Route element={<AppShell />}>
          <Route path="/profile" element={<Profile />} />
          <Route path="/" element={<Dashboard />} />
          <Route path="/workout/active" element={<Logger />} />
          <Route path="/workout/:id" element={<Logger />} />
          <Route path="/history" element={<History />} />
          <Route path="/templates" element={<Templates />} />
          <Route path="/split" element={<SplitPlanner />} />
          <Route path="/exercises" element={<Exercises />} />
          <Route path="/analytics" element={<Analytics />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <Toaster richColors position="bottom-right" />
    </>
  );
}
