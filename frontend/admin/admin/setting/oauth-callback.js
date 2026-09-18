(async function handleGoogleOAuthCallback() {
  const params = new URLSearchParams(window.location.search);
  const code = params.get('code');
  const state = params.get('state');
  const error = params.get('error');

  function notifyOpener(message) {
    window.opener?.postMessage(message, window.location.origin);
  }

  if (error) {
    notifyOpener({ type: 'GOOGLE_AUTH_ERROR', error });
    window.close();
    return;
  }

  if (!code || !state) {
    notifyOpener({ type: 'GOOGLE_AUTH_ERROR', error: 'Invalid OAuth callback' });
    window.close();
    return;
  }

  try {
    const response = await fetch('/auth/google/exchange', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code, state })
    });

    const data = await response.json();

    if (response.ok && data.success) {
      // Only display information is stored here; OAuth tokens are HttpOnly.
      localStorage.setItem('google_user', JSON.stringify(data.user));
      localStorage.setItem('google_connected', 'true');
      notifyOpener({ type: 'GOOGLE_AUTH_SUCCESS', user: data.user });
    } else {
      notifyOpener({ type: 'GOOGLE_AUTH_ERROR', error: data.error || 'Google connection failed' });
    }
  } catch (callbackError) {
    notifyOpener({ type: 'GOOGLE_AUTH_ERROR', error: callbackError.message });
  } finally {
    window.close();
  }
})();
