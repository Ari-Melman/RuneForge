import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Menu, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

const links = [
  { to: "/", label: "Home" },
  { to: "/light", label: "Light" },
  { to: "/medium", label: "Medium" },
  { to: "/heavy", label: "Heavy" },
] as const;

export function Nav() {
  const [email, setEmail] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setEmail(data.session?.user.email ?? null));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setEmail(s?.user.email ?? null));
    return () => sub.subscription.unsubscribe();
  }, []);

  return (
    <header className="fixed top-0 inset-x-0 z-50 backdrop-blur-md bg-background/60 border-b border-gold">
      <div className="max-w-7xl mx-auto flex items-center justify-between px-4 sm:px-6 h-16">
        <Link
          to="/"
          className="font-display font-semibold text-white text-[20px] sm:text-[24px]"
          style={{ letterSpacing: "-1.44px" }}
          onClick={() => setOpen(false)}
        >
          Rune Forge
        </Link>

        <nav className="hidden md:flex items-center gap-5 lg:gap-7 text-sm font-medium">
          {links.map((l) => (
            <Link
              key={l.to}
              to={l.to}
              className="text-white/85 hover:text-gold-glow transition-colors"
              activeProps={{ className: "text-gold-glow" }}
              activeOptions={{ exact: l.to === "/" }}
            >
              {l.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <Link
            to="/auth"
            className="text-xs sm:text-sm px-3 sm:px-4 py-2 rounded-md border border-gold text-gold hover:bg-[color:var(--gold)] hover:text-black transition-colors"
          >
            {email ? "Account" : "Sign In"}
          </Link>
          <button
            type="button"
            aria-label={open ? "Close menu" : "Open menu"}
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
            className="md:hidden inline-flex items-center justify-center w-10 h-10 rounded-md border border-gold text-gold"
          >
            {open ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>
      </div>

      {open && (
        <nav className="md:hidden border-t border-gold/60 bg-background/95 backdrop-blur-md">
          <ul className="flex flex-col px-4 py-3 gap-1 text-base font-medium">
            {links.map((l) => (
              <li key={l.to}>
                <Link
                  to={l.to}
                  onClick={() => setOpen(false)}
                  className="block px-2 py-3 rounded-md text-white/90 hover:text-gold-glow hover:bg-white/5 transition-colors"
                  activeProps={{ className: "text-gold-glow" }}
                  activeOptions={{ exact: l.to === "/" }}
                >
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      )}
    </header>
  );
}
