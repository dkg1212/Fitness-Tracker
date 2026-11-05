import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Save, UserRound } from "lucide-react";
import PageHeader from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiPut } from "@/lib/api";
import { useMe } from "@/lib/hooks";
import type { ProfileUpdate, User } from "@/lib/types";

export default function Profile() {
  const me = useMe(); const qc = useQueryClient();
  const [name, setName] = useState(""); const [weight, setWeight] = useState(""); const [height, setHeight] = useState("");
  useEffect(() => { if (me.data) { setName(me.data.name); setWeight(me.data.weight_kg?.toString() ?? ""); setHeight(me.data.height_cm?.toString() ?? ""); } }, [me.data]);
  const save = useMutation({ mutationFn: (body: ProfileUpdate) => apiPut<User>("/auth/profile", body), onSuccess: (user) => { qc.setQueryData(["me"], user); toast.success("Profile saved"); }, onError: () => toast.error("Please enter a valid name, weight, and height") });
  return <div><PageHeader eyebrow="Account" title="Your profile" testid="profile-title" /><section className="max-w-xl rounded-xl border border-border bg-surface-card/60 p-5 sm:p-6"><div className="mb-6 flex items-center gap-3"><span className="grid size-10 place-items-center rounded-full bg-volt text-volt-ink"><UserRound className="size-5" /></span><div><p className="font-bold">Personal metrics</p><p className="text-sm text-muted-foreground">Used only for your training profile.</p></div></div><div className="space-y-4"><div><Label htmlFor="profile-name">Name</Label><Input id="profile-name" value={name} onChange={(e) => setName(e.target.value)} className="mt-1.5" /></div><div className="grid grid-cols-2 gap-4"><div><Label htmlFor="profile-weight">Weight (kg)</Label><Input id="profile-weight" type="number" min="21" max="500" step="0.1" value={weight} onChange={(e) => setWeight(e.target.value)} className="mt-1.5" /></div><div><Label htmlFor="profile-height">Height (cm)</Label><Input id="profile-height" type="number" min="51" max="260" step="0.1" value={height} onChange={(e) => setHeight(e.target.value)} className="mt-1.5" /></div></div><p className="text-sm text-muted-foreground">Email: {me.data?.email}</p><Button onClick={() => save.mutate({ name, weight_kg: Number(weight), height_cm: Number(height) })} disabled={save.isPending} className="w-full"><Save className="size-4" /> {save.isPending ? "Saving…" : "Save changes"}</Button></div></section></div>;
}
