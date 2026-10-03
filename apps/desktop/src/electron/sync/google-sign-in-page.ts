/** The browser token model runs on the loopback page, with no app secret. */
export function createGoogleSignInPage(
  clientId: string,
  state: string,
  nonce: string,
) {
  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8">
    <title>Lunarscribe sign-in</title>
  </head>
  <body>
    <h1>Connect Google Drive to Lunarscribe</h1>
    <p id="message">Sign in to sync your saved markdown and drawings.</p>
    <button id="signin" disabled>Loading Google sign-in…</button>
    <script nonce="${nonce}">
      function finish(tokenResponse) {
        fetch("/oauth/google-drive/token", {
          method: "POST",
          headers: {"Content-Type": "application/json"},
          body: JSON.stringify({...tokenResponse, state: ${JSON.stringify(state)}})
        })
          .then(response => {
            document.getElementById("message").textContent = response.ok
              ? "Return to Lunarscribe. You can close this browser tab."
              : "Sign-in failed. Return to Lunarscribe and try again.";
            document.getElementById("signin").disabled = true;
          })
          .catch(() => {
            document.getElementById("message").textContent = "Return to Lunarscribe to check sign-in.";
          });
      }

      function start() {
        const client = google.accounts.oauth2.initTokenClient({
          client_id: ${JSON.stringify(clientId.trim())},
          scope: "https://www.googleapis.com/auth/drive.file",
          callback: finish,
          error_callback: () => finish({error: "Sign-in cancelled"})
        });
        const button = document.getElementById("signin");
        button.disabled = false;
        button.textContent = "Sign in with Google";
        button.onclick = () => client.requestAccessToken({prompt: "select_account"});
      }

      const library = document.createElement("script");
      library.src = "https://accounts.google.com/gsi/client";
      library.onload = start;
      library.onerror = () => finish({error: "Google sign-in could not load"});
      document.head.appendChild(library);
    </script>
  </body>
</html>`;
}
