import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { toast } from "sonner";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign In — Rune Forge" },
      { name: "description", content: "Create an account or sign in to save Elden Ring builds and unlock the AI build rater." },
    ],
  }),
  component: AuthPage,
});

interface SavedBuild { id: string; name: string; page: string; created_at: string }

function AuthPage() {
  const nav = useNavigate();
  const [email, setEmail] = useState<string | null>(null);
  const [builds, setBuilds] = useState<SavedBuild[]>([]);
  const [loading, setLoading] = useState(false);

  // Form state
  const [mode, setMode] = useState<"signup" | "signin">("signup");
  const [formEmail, setFormEmail] = useState("");
  const [formPassword, setFormPassword] = useState("");

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setEmail(data.session?.user.email ?? null));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setEmail(s?.user.email ?? null));
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!email) { setBuilds([]); return; }
    supabase.from("saved_builds").select("id,name,page,created_at").order("created_at", { ascending: false }).then(({ data }) => {
      setBuilds((data ?? []) as SavedBuild[]);
    });
  }, [email]);

  const signInGoogle = async () => {
    setLoading(true);
    const result = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin + "/auth" });
    if (result.error) toast.error(result.error.message);
    setLoading(false);
  };

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formEmail || !formPassword) {
      toast.error("Enter an email and password.");
      return;
    }
    setLoading(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email: formEmail,
          password: formPassword,
          options: { emailRedirectTo: window.location.origin + "/auth" },
        });
        if (error) {
          toast.error(error.message);
        } else {
          toast.success("Account created. You're signed in.");
          setFormPassword("");
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: formEmail,
          password: formPassword,
        });
        if (error) {
          if (/invalid/i.test(error.message)) {
            toast.error("No matching account. Create one first, then sign in.");
          } else {
            toast.error(error.message);
          }
        } else {
          toast.success("Signed in.");
          setFormPassword("");
        }
      }
    } finally {
      setLoading(false);
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    nav({ to: "/auth" });
  };
  const del = async (id: string) => {
    await supabase.from("saved_builds").delete().eq("id", id);
    setBuilds(builds.filter((b) => b.id !== id));
  };

  return (
    <main className="min-h-screen pt-32 pb-20 px-6">
      <div className="max-w-2xl mx-auto">
        <p className="text-gold uppercase tracking-[0.4em] text-xs mb-3 font-display text-center">Tarnished Login</p>
        <h1 className="text-5xl font-display font-bold text-white text-center">{email ? "Welcome back" : mode === "signup" ? "Create Account" : "Sign In"}</h1>
        <p className="text-muted-foreground text-center mt-3">
          {email
            ? email
            : mode === "signup"
              ? "Create an account to save builds and unlock the AI rating perk."
              : "Sign in to your account. New here? Create an account first."}
        </p>

        <div className="mt-10 rounded-xl border border-gold bg-panel panel-glow p-8">
          {!email ? (
            <>
              {/* Mode toggle */}
              <div className="grid grid-cols-2 rounded-md border border-gold/60 overflow-hidden mb-6">
                <button
                  type="button"
                  onClick={() => setMode("signup")}
                  className={`py-2 text-sm font-medium transition ${mode === "signup" ? "bg-[color:var(--gold)] text-black" : "text-white/80 hover:bg-white/5"}`}
                >
                  Create Account
                </button>
                <button
                  type="button"
                  onClick={() => setMode("signin")}
                  className={`py-2 text-sm font-medium transition ${mode === "signin" ? "bg-[color:var(--gold)] text-black" : "text-white/80 hover:bg-white/5"}`}
                >
                  Sign In
                </button>
              </div>

              <form onSubmit={handleEmailSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs uppercase tracking-widest text-gold mb-2">Email</label>
                  <input
                    type="email"
                    autoComplete="email"
                    value={formEmail}
                    onChange={(e) => setFormEmail(e.target.value)}
                    required
                    className="w-full px-4 py-3 rounded-md bg-background border border-gold/40 text-white focus:border-gold focus:outline-none"
                    placeholder="e.g rune.forge@gmail.com"
                  />
                </div>
                <div>
                  <label className="block text-xs uppercase tracking-widest text-gold mb-2">Password</label>
                  <input
                    type="password"
                    autoComplete={mode === "signup" ? "new-password" : "current-password"}
                    value={formPassword}
                    onChange={(e) => setFormPassword(e.target.value)}
                    required
                    minLength={6}
                    className="w-full px-4 py-3 rounded-md bg-background border border-gold/40 text-white focus:border-gold focus:outline-none"
                    placeholder="••••••••"
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full px-6 py-3 rounded-md bg-[color:var(--gold)] text-black font-medium hover:brightness-110 transition disabled:opacity-60"
                >
                  {loading ? "Working…" : mode === "signup" ? "Create Account" : "Sign In"}
                </button>
              </form>

              <div className="flex items-center gap-3 my-6">
                <div className="h-px flex-1 bg-gold/30" />
                <span className="text-xs uppercase tracking-widest text-muted-foreground">or</span>
                <div className="h-px flex-1 bg-gold/30" />
              </div>

              <button
                onClick={signInGoogle}
                disabled={loading}
                className="w-full px-6 py-3 rounded-md border border-gold text-gold hover:bg-white/5 transition disabled:opacity-60"
              >
                Continue with Google
              </button>
            </>
          ) : (
            <>
              <div className="flex justify-between items-center mb-4">
                <h2 className="font-display text-gold-glow text-xl">Your saved builds</h2>
                <button onClick={signOut} className="text-sm text-muted-foreground hover:text-gold">Sign out</button>
              </div>
              {builds.length === 0 ? (
                <p className="text-sm text-muted-foreground">No builds yet. Save one from any calculator page.</p>
              ) : (
                <ul className="divide-y divide-border">
                  {builds.map((b) => (
                    <li key={b.id} className="flex items-center justify-between py-3">
                      <div>
                        <p className="font-medium">{b.name}</p>
                        <p className="text-xs text-muted-foreground">{b.page} · {new Date(b.created_at).toLocaleDateString()}</p>
                      </div>
                      <button onClick={() => del(b.id)} className="text-xs text-destructive hover:underline">Delete</button>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </div>
      </div>
    </main>
  );
}
