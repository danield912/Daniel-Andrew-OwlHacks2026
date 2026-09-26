"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "motion/react";
import { LogOut, Mail, Navigation, Save, UserRound } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { AppShell, PageHeader } from "@/components/gp/app-shell";
import { Button, ButtonLink } from "@/components/gp/button";
import { ChoiceGroup } from "@/components/gp/choice";
import { InlineAlert, Skeleton } from "@/components/gp/states";
import { useToast } from "@/components/gp/toast";
import { useUser, type GameDayDefaults } from "@/components/gp/user";
import { Field } from "@/components/auth/fields";

type Travel = NonNullable<GameDayDefaults["travelMode"]>;
const BUDGETS = ["$ — Budget-friendly", "$$ — Mid-range", "$$$ — Treat ourselves"];
const PREGAMES = ["Food", "Bar / hangout", "Straight to the stadium"];

export function AccountPage() {
  const user = useUser();
  const toast = useToast();
  const router = useRouter();
  const [name, setName] = useState("");
  const [travel, setTravel] = useState<Travel>("Transit");
  const [budget, setBudget] = useState("$$ — Mid-range");
  const [pregame, setPregame] = useState("Bar / hangout");
  const [origin, setOrigin] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingDefaults, setSavingDefaults] = useState(false);
  const [error, setError] = useState("");

  // Fill the forms once the signed-in user loads.
  useEffect(() => {
    if (user.status !== "signed-in") return;
    setName(user.name);
    setTravel(user.defaults.travelMode === "Driving" ? "Driving" : "Transit");
    if (user.defaults.budget && BUDGETS.includes(user.defaults.budget)) setBudget(user.defaults.budget);
    if (user.defaults.pregame && PREGAMES.includes(user.defaults.pregame)) setPregame(user.defaults.pregame);
    setOrigin(user.defaults.origin ?? "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user.status, user.user?.id]);

  async function saveProfile(event: React.FormEvent) {
    event.preventDefault();
    setSavingProfile(true);
    setError("");
    const { error } = await createClient().auth.updateUser({ data: { full_name: name.trim() } });
    setSavingProfile(false);
    if (error) { setError(error.message); return; }
    await user.refresh();
    toast.success({ title: "Name saved ✓", body: "Friends will see it in shared plans." });
  }

  async function saveDefaults(event: React.FormEvent) {
    event.preventDefault();
    setSavingDefaults(true);
    setError("");
    const defaults: GameDayDefaults = { travelMode: travel, budget, pregame, origin: origin.trim() };
    const { error } = await createClient().auth.updateUser({ data: { gp_defaults: defaults } });
    setSavingDefaults(false);
    if (error) { setError(error.message); return; }
    await user.refresh();
    toast.success({ title: "Defaults saved ✓", body: "New plans start with these choices." });
  }

  return <AppShell>
    <PageHeader eyebrow="Profile & settings" title="Account" subtitle="How your crew sees you, and the choices every new plan starts with." />

    {user.status === "loading" ? <div className="grid gap-6 lg:grid-cols-[360px_1fr]"><Skeleton className="h-72 rounded-3xl" /><Skeleton className="h-96 rounded-3xl" /></div>
    : user.status === "signed-out" ? <div className="gp-panel p-8 text-center">
      <p className="text-4xl" aria-hidden="true">🔐</p>
      <h2 className="mt-3 font-display text-2xl font-bold text-white">Sign in to see your account</h2>
      <ButtonLink href="/auth/login?next=/account" className="mt-6">Sign in</ButtonLink>
    </div>
    : <div className="grid items-start gap-6 lg:grid-cols-[360px_1fr]">
      <div className="space-y-6">
        <motion.form initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} onSubmit={saveProfile} className="gp-panel p-6" aria-labelledby="profile-heading">
          <div className="flex items-center gap-4">
            <motion.span
              whileHover={{ rotate: -8, scale: 1.05 }}
              className="grid h-20 w-20 place-items-center rounded-3xl bg-gradient-to-br from-indigo-400 via-glow-cyan to-mint-300 font-display text-3xl font-extrabold text-night-950 shadow-glow"
              aria-hidden="true"
            >{user.initials}</motion.span>
            <div className="min-w-0">
              <h2 id="profile-heading" className="truncate font-display text-xl font-bold text-white">{user.name}</h2>
              <p className="flex items-center gap-1.5 truncate text-sm text-slate-400"><Mail size={14} aria-hidden="true" />{user.email}</p>
            </div>
          </div>
          <div className="mt-6">
            <Field id="display-name" label="Display name" required maxLength={60} value={name} onChange={event => setName(event.target.value)} icon={<UserRound size={17} aria-hidden="true" />} hint="Shown to friends in your crew list and invites." />
          </div>
          <Button type="submit" className="mt-5 w-full" loading={savingProfile} loadingText="Saving…" disabled={!name.trim() || name.trim() === user.name} icon={<Save size={17} aria-hidden="true" />}>Save name</Button>
        </motion.form>

        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }} className="gp-panel p-6">
          <h2 className="font-display text-lg font-bold text-white">Signed in</h2>
          <p className="mt-1 text-sm text-slate-400">Sign out on shared or public devices.</p>
          <Button
            variant="outline-danger"
            className="mt-4"
            icon={<LogOut size={17} aria-hidden="true" />}
            onClick={async () => { await user.signOut(); toast.info("Signed out. See you on game day 👋"); router.push("/"); }}
          >Sign out</Button>
        </motion.div>
      </div>

      <motion.form initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.12 }} onSubmit={saveDefaults} className="gp-panel space-y-6 p-6 sm:p-8" aria-labelledby="defaults-heading">
        <div>
          <p className="gp-eyebrow">Game-day defaults</p>
          <h2 id="defaults-heading" className="mt-1 font-display text-2xl font-bold text-white">Start every plan your way</h2>
          <p className="mt-1 text-sm text-slate-400">These fill in automatically when you plan a game. You can still change them each time.</p>
        </div>
        <Field id="default-origin" label="Usual starting point" placeholder="e.g. Temple University or your neighborhood" maxLength={200} value={origin} onChange={event => setOrigin(event.target.value)} icon={<Navigation size={17} aria-hidden="true" />} />
        <ChoiceGroup<Travel>
          label="Usually get there by"
          value={travel}
          onChange={setTravel}
          columns={2}
          options={[
            { value: "Transit", label: "SEPTA", hint: "Train or bus", icon: "🚇" },
            { value: "Driving", label: "Driving", hint: "Car or rideshare", icon: "🚗" },
          ]}
        />
        <ChoiceGroup
          label="Before the game"
          value={pregame}
          onChange={setPregame}
          options={[
            { value: "Food", label: "Grab food", icon: "🍔" },
            { value: "Bar / hangout", label: "Bar or tailgate", icon: "🍺" },
            { value: "Straight to the stadium", label: "Straight in", icon: "🏟️" },
          ]}
        />
        <ChoiceGroup
          label="Food budget"
          value={budget}
          onChange={setBudget}
          options={[
            { value: "$ — Budget-friendly", label: "$", hint: "Budget", icon: "🌭" },
            { value: "$$ — Mid-range", label: "$$", hint: "Mid-range", icon: "🍕" },
            { value: "$$$ — Treat ourselves", label: "$$$", hint: "Treat yourself", icon: "🥩" },
          ]}
        />
        {error && <InlineAlert tone="error">{error}</InlineAlert>}
        <Button type="submit" size="lg" loading={savingDefaults} loadingText="Saving…" icon={<Save size={18} aria-hidden="true" />}>Save defaults</Button>
      </motion.form>
    </div>}
  </AppShell>;
}
