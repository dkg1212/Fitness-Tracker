import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth, useUser } from "@clerk/react";
import { toast } from "sonner";
import { ArrowLeft, Save, UserRound, Weight, Ruler, Zap } from "lucide-react";
import PageHeader from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiPut } from "@/lib/api";
import { useMe } from "@/lib/hooks";
import type { ProfileUpdate, Sex, User } from "@/lib/types";

export default function Profile() {
  const { isLoaded, isSignedIn } = useAuth();
  const { user } = useUser();
  const me = useMe();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const onboarding = params.get("onboarding") === "1";

  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [weight, setWeight] = useState("");
  const [height, setHeight] = useState("");
  const [sex, setSex] = useState<Sex | "">("");

  useEffect(() => {
    if (me.data) {
      setName(me.data.name);
      setWeight(me.data.weight_kg?.toString() ?? "");
      setHeight(me.data.height_cm?.toString() ?? "");
      setSex(me.data.sex ?? "");
    }
    if (user) setUsername(user.username ?? "");
  }, [me.data, user]);

  const save = useMutation({
    mutationFn: async () => {
      if (username.trim() && username.trim() !== user?.username) {
        await user?.update({ username: username.trim() });
      }
      return apiPut<User>("/auth/profile", {
        name,
        weight_kg: Number(weight),
        height_cm: Number(height),
        sex: sex as Sex,
      } satisfies ProfileUpdate);
    },
    onSuccess: (saved) => {
      qc.setQueryData(["me"], saved);
      toast.success("Profile saved");
      navigate("/", { replace: true });
    },
    onError: () => toast.error("Check all profile fields, then try again."),
  });

  if (isLoaded && !isSignedIn) return <Navigate to="/login" replace />;

  // BMI hint
  const bmi =
    weight && height
      ? (Number(weight) / Math.pow(Number(height) / 100, 2)).toFixed(1)
      : null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/70 px-4 py-6 backdrop-blur-sm sm:px-6 sm:py-10">
      <main className="mx-auto max-w-lg animate-fade-up">
        <section className="rounded-2xl border border-border bg-popover p-5 shadow-2xl sm:p-7">
          {/* Header */}
          <div className="mb-6 flex items-start justify-between gap-3">
            <div>
              <PageHeader
                eyebrow={onboarding ? "Welcome" : "Account"}
                title={onboarding ? "Finish your profile" : "Edit profile"}
                testid="profile-title"
              />
            </div>
            {!onboarding && (
              <Button variant="outline" onClick={() => navigate("/")} className="mt-1 shrink-0">
                <ArrowLeft className="size-4" /> Back
              </Button>
            )}
          </div>

          {/* Avatar row */}
          <div className="mb-6 flex items-center gap-4 rounded-xl border border-border bg-surface p-4">
            <span className="grid size-12 place-items-center rounded-full bg-volt text-volt-ink shadow-[0_0_20px_rgba(34,197,94,0.3)]">
              <UserRound className="size-6" />
            </span>
            <div>
              <p className="font-bold">
                {onboarding ? "A few details before you start" : "Personal metrics"}
              </p>
              <p className="text-sm text-muted-foreground">
                Used to calculate your training load and 1RM estimates.
              </p>
            </div>
          </div>

          <div className="space-y-5">
            {/* Username */}
            <div>
              <Label htmlFor="profile-username">Username</Label>
              <Input
                id="profile-username"
                required
                minLength={4}
                maxLength={64}
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="mt-1.5 h-12"
                placeholder="e.g. ironmike"
              />
            </div>

            {/* Display name */}
            <div>
              <Label htmlFor="profile-name">Display name</Label>
              <Input
                id="profile-name"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="mt-1.5 h-12"
                placeholder="e.g. Mike Ross"
              />
            </div>

            {/* Weight + Height */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="profile-weight">
                  <Weight className="mr-1 inline size-3.5 text-muted-foreground" />
                  Body weight (kg)
                </Label>
                <Input
                  id="profile-weight"
                  type="number"
                  min="21"
                  max="500"
                  step="0.1"
                  required
                  value={weight}
                  onChange={(e) => setWeight(e.target.value)}
                  className="mt-1.5 h-12"
                  placeholder="80"
                />
              </div>
              <div>
                <Label htmlFor="profile-height">
                  <Ruler className="mr-1 inline size-3.5 text-muted-foreground" />
                  Height (cm)
                </Label>
                <Input
                  id="profile-height"
                  type="number"
                  min="51"
                  max="260"
                  step="0.1"
                  required
                  value={height}
                  onChange={(e) => setHeight(e.target.value)}
                  className="mt-1.5 h-12"
                  placeholder="178"
                />
              </div>
            </div>

            {/* BMI hint */}
            {bmi && (
              <p className="rounded-lg border border-border bg-surface/60 px-3 py-2 text-xs text-muted-foreground">
                BMI:{" "}
                <span className="font-mono font-semibold text-foreground">{bmi}</span>
                {" — "}
                {Number(bmi) < 18.5
                  ? "underweight"
                  : Number(bmi) < 25
                  ? "healthy range"
                  : Number(bmi) < 30
                  ? "overweight"
                  : "obese"}{" "}
                (for reference only)
              </p>
            )}

            {/* Sex */}
            <div>
              <Label htmlFor="profile-sex">Sex</Label>
              <select
                id="profile-sex"
                required
                value={sex}
                onChange={(e) => setSex(e.target.value as Sex)}
                className="mt-1.5 h-12 w-full rounded-md border border-input bg-background px-3 text-sm outline-none transition-colors hover:border-volt focus:border-volt"
              >
                <option value="" disabled>
                  Select sex
                </option>
                <option value="male">Male</option>
                <option value="female">Female</option>
              </select>
            </div>

            <p className="text-xs text-muted-foreground">
              Email:{" "}
              <span className="font-mono">{user?.primaryEmailAddress?.emailAddress ?? me.data?.email}</span>
            </p>

            <Button
              onClick={() => save.mutate()}
              disabled={save.isPending || !sex || !name.trim() || !weight || !height}
              className="h-14 w-full text-base font-bold"
            >
              <Save className="size-4" />
              {save.isPending
                ? "Saving…"
                : onboarding
                ? "Save and start training"
                : "Save changes"}
            </Button>
          </div>
        </section>
      </main>
    </div>
  );
}
