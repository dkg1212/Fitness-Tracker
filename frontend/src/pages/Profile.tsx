import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth, useUser } from "@clerk/react";
import { toast } from "sonner";
import { ArrowLeft, Save, UserRound } from "lucide-react";
import PageHeader from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiPut } from "@/lib/api";
import { useMe } from "@/lib/hooks";
import type { ProfileUpdate, Sex, User } from "@/lib/types";

export default function Profile() {
  const { isLoaded, isSignedIn } = useAuth(); const { user } = useUser(); const me = useMe(); const qc = useQueryClient(); const navigate = useNavigate(); const [params] = useSearchParams();
  const onboarding = params.get("onboarding") === "1";
  const [name, setName] = useState(""); const [username, setUsername] = useState(""); const [weight, setWeight] = useState(""); const [height, setHeight] = useState(""); const [sex, setSex] = useState<Sex | "">("");
  useEffect(() => { if (me.data) { setName(me.data.name); setWeight(me.data.weight_kg?.toString() ?? ""); setHeight(me.data.height_cm?.toString() ?? ""); setSex(me.data.sex ?? ""); } if (user) setUsername(user.username ?? ""); }, [me.data, user]);
  const save = useMutation({ mutationFn: async () => { if (username.trim() && username.trim() !== user?.username) await user?.update({ username: username.trim() }); return apiPut<User>("/auth/profile", { name, weight_kg: Number(weight), height_cm: Number(height), sex: sex as Sex } satisfies ProfileUpdate); }, onSuccess: (saved) => { qc.setQueryData(["me"], saved); toast.success("Profile saved"); navigate("/", { replace: true }); }, onError: () => toast.error("Check all profile fields, then try again.") });
  if (isLoaded && !isSignedIn) return <Navigate to="/login" replace />;
  return <main className="min-h-dvh bg-background px-4 py-7 sm:px-8"><div className="mx-auto max-w-xl"><div className="mb-4 flex items-center justify-between gap-3"><PageHeader eyebrow={onboarding ? "Welcome" : "Account"} title={onboarding ? "Finish your profile" : "Your profile"} testid="profile-title" /><Button variant="outline" onClick={() => navigate("/")} className="shrink-0"><ArrowLeft className="size-4" /> Back</Button></div><section className="rounded-xl border border-border bg-surface-card/60 p-5 sm:p-6"><div className="mb-6 flex items-center gap-3"><span className="grid size-10 place-items-center rounded-full bg-volt text-volt-ink"><UserRound className="size-5" /></span><div><p className="font-bold">{onboarding ? "A few details before you start" : "Personal metrics"}</p><p className="text-sm text-muted-foreground">Set your username, sex, weight, and height for your training profile.</p></div></div><div className="space-y-4"><div><Label htmlFor="profile-username">Username</Label><Input id="profile-username" required minLength={4} maxLength={64} value={username} onChange={(e) => setUsername(e.target.value)} className="mt-1.5" /></div><div><Label htmlFor="profile-name">Display name</Label><Input id="profile-name" required value={name} onChange={(e) => setName(e.target.value)} className="mt-1.5" /></div><div className="grid grid-cols-2 gap-4"><div><Label htmlFor="profile-weight">Weight (kg)</Label><Input id="profile-weight" type="number" min="21" max="500" step="0.1" required value={weight} onChange={(e) => setWeight(e.target.value)} className="mt-1.5" /></div><div><Label htmlFor="profile-height">Height (cm)</Label><Input id="profile-height" type="number" min="51" max="260" step="0.1" required value={height} onChange={(e) => setHeight(e.target.value)} className="mt-1.5" /></div></div><div><Label htmlFor="profile-sex">Sex</Label><select id="profile-sex" required value={sex} onChange={(e) => setSex(e.target.value as Sex)} className="mt-1.5 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"><option value="" disabled>Select sex</option><option value="male">Male</option><option value="female">Female</option></select></div><p className="text-sm text-muted-foreground">Email: {user?.primaryEmailAddress?.emailAddress ?? me.data?.email}</p><Button onClick={() => save.mutate()} disabled={save.isPending || !sex} className="w-full"><Save className="size-4" /> {save.isPending ? "Saving…" : onboarding ? "Save and continue" : "Save changes"}</Button></div></section></div></main>;
}
