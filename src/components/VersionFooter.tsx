"use client";

const webVersion = process.env.NEXT_PUBLIC_APP_VERSION ?? "0.0.0";
const webBuildNumber = process.env.NEXT_PUBLIC_BUILD_NUMBER ?? "dev";
const webGitSha = process.env.NEXT_PUBLIC_GIT_SHA ?? "unknown";

export default function VersionFooter() {
  return (
    // Deliberately quiet: no border, no panel — just a whisper of build info.
    <footer className="px-4 py-6">
      <div className="mx-auto max-w-5xl text-center text-[11px] leading-snug text-muted-foreground/60">
        <span className="font-mono">
          web v{webVersion} (build {webBuildNumber} · {webGitSha})
        </span>
      </div>
    </footer>
  );
}
