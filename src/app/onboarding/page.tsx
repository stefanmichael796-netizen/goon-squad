"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

export default function OnboardingPage() {
  const [step, setStep] = useState<"profile" | "club">("profile");
  const [displayName, setDisplayName] = useState("");
  const [clubAction, setClubAction] = useState<"create" | "join">("create");
  const [clubName, setClubName] = useState("");
  const [clubDescription, setClubDescription] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [checkingProfile, setCheckingProfile] = useState(true);
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    async function checkState() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push("/login");
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("display_name")
        .eq("id", user.id)
        .single();

      if (profile?.display_name) {
        setDisplayName(profile.display_name);
        const { data: membership } = await supabase
          .from("club_members")
          .select("club_id")
          .eq("user_id", user.id)
          .limit(1)
          .single();

        if (membership) {
          router.push("/club");
          return;
        }
        setStep("club");
      }
      setCheckingProfile(false);
    }
    checkState();
  }, [supabase, router]);

  async function handleProfileSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { error: updateError } = await supabase
      .from("profiles")
      .update({ display_name: displayName })
      .eq("id", user.id);

    if (updateError) {
      setError(updateError.message);
      setLoading(false);
      return;
    }

    setLoading(false);
    setStep("club");
  }

  async function handleClubSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/club", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          clubAction === "create"
            ? { action: "create", name: clubName, description: clubDescription }
            : { action: "join", inviteCode }
        ),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Something went wrong");
        setLoading(false);
        return;
      }

      router.push("/club");
      router.refresh();
    } catch {
      setError("Something went wrong");
      setLoading(false);
    }
  }

  if (checkingProfile) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <div className="w-6 h-6 border-2 border-coral border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex flex-col flex-1 items-center justify-center px-6">
      <div className="max-w-sm w-full space-y-8 animate-fade-in">
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-serif font-bold text-[var(--foreground)]">
            {step === "profile" ? "Set up your profile" : "Join a book club"}
          </h1>
          <p className="text-[var(--muted)]">
            {step === "profile"
              ? "What should we call you?"
              : "Every reader needs a crew."}
          </p>
        </div>

        {step === "profile" && (
          <form onSubmit={handleProfileSubmit} className="space-y-4">
            <div>
              <label htmlFor="displayName" className="block text-sm font-medium text-[var(--foreground)] mb-1">
                Display name
              </label>
              <input
                id="displayName"
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                required
                className="w-full px-3 py-2.5 rounded-lg bg-[var(--surface)] border border-[var(--border)] text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-coral/50"
              />
            </div>

            {error && <p className="text-sm text-red-500">{error}</p>}

            <button
              type="submit"
              disabled={loading || !displayName.trim()}
              className="w-full py-3 rounded-lg bg-coral text-white font-medium transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {loading ? "Saving..." : "Continue"}
            </button>
          </form>
        )}

        {step === "club" && (
          <div className="space-y-6">
            <div className="flex gap-2">
              <button
                onClick={() => setClubAction("create")}
                className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                  clubAction === "create"
                    ? "bg-coral text-white"
                    : "bg-[var(--surface)] border border-[var(--border)] text-[var(--foreground)]"
                }`}
              >
                Create a club
              </button>
              <button
                onClick={() => setClubAction("join")}
                className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                  clubAction === "join"
                    ? "bg-coral text-white"
                    : "bg-[var(--surface)] border border-[var(--border)] text-[var(--foreground)]"
                }`}
              >
                Join a club
              </button>
            </div>

            <form onSubmit={handleClubSubmit} className="space-y-4">
              {clubAction === "create" ? (
                <>
                  <div>
                    <label htmlFor="clubName" className="block text-sm font-medium text-[var(--foreground)] mb-1">
                      Club name
                    </label>
                    <input
                      id="clubName"
                      type="text"
                      value={clubName}
                      onChange={(e) => setClubName(e.target.value)}
                      required
                      placeholder="The Slow Readers"
                      className="w-full px-3 py-2.5 rounded-lg bg-[var(--surface)] border border-[var(--border)] text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-coral/50"
                    />
                  </div>
                  <div>
                    <label htmlFor="clubDesc" className="block text-sm font-medium text-[var(--foreground)] mb-1">
                      Description
                    </label>
                    <textarea
                      id="clubDesc"
                      value={clubDescription}
                      onChange={(e) => setClubDescription(e.target.value)}
                      placeholder="Optional"
                      rows={2}
                      className="w-full px-3 py-2.5 rounded-lg bg-[var(--surface)] border border-[var(--border)] text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-coral/50 resize-none"
                    />
                  </div>
                </>
              ) : (
                <div>
                  <label htmlFor="inviteCode" className="block text-sm font-medium text-[var(--foreground)] mb-1">
                    Invite code
                  </label>
                  <input
                    id="inviteCode"
                    type="text"
                    value={inviteCode}
                    onChange={(e) => setInviteCode(e.target.value)}
                    required
                    placeholder="ABC123"
                    maxLength={6}
                    className="w-full px-3 py-2.5 rounded-lg bg-[var(--surface)] border border-[var(--border)] text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-coral/50 uppercase tracking-widest text-center text-lg"
                  />
                </div>
              )}

              {error && <p className="text-sm text-red-500">{error}</p>}

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 rounded-lg bg-coral text-white font-medium transition-opacity hover:opacity-90 disabled:opacity-50"
              >
                {loading
                  ? "Setting up..."
                  : clubAction === "create"
                  ? "Create club"
                  : "Join club"}
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
