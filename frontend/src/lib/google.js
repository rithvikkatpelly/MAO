// Loads Google Identity Services once, on demand (only the sign-in page needs it).
let scriptPromise = null;

export function loadGoogleIdentity() {
  scriptPromise ??= new Promise((resolve, reject) => {
    if (window.google?.accounts?.id) return resolve(window.google);
    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.onload = () => resolve(window.google);
    script.onerror = () => {
      scriptPromise = null;
      reject(new Error("Could not load Google sign-in. Check your connection or ad blocker."));
    };
    document.head.appendChild(script);
  });
  return scriptPromise;
}

// Only same-site paths are allowed as post-sign-in destinations.
export function safeNext(raw) {
  return raw && raw.startsWith("/") && !raw.startsWith("//") ? raw : "/app";
}
