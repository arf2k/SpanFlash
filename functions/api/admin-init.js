export async function onRequestPost(context) {
  const { request, env, cf } = context;
  const { turnstileToken, adminKey } = await request.json();

  // Log received data
  console.log('Received Admin Key:', adminKey);
  console.log('Expected Admin Key:', env.ADMIN_SECRET);

  const validationResult = await validateTurnstileToken(
    turnstileToken,
    env.TURNSTILE_SECRET_KEY,
    cf?.connectingIp
  );
  console.log("Turnstile validation result:", validationResult);

  const isHuman = validationResult.success;
  const validKey = adminKey === env.ADMIN_SECRET;
  console.log("Turnstile passed?", isHuman, "Key matched?", validKey);

  try {
    if (!isHuman || !validKey) {
      console.log("Failed authentication: Turnstile or Admin Key");
      return new Response("Unauthorized", { status: 403 });
    }

    const sessionToken = generateSessionToken();
    const sessionData = {
      token: sessionToken,
      isAdmin: true,
      createdAt: Date.now(),
      ip: cf?.connectingIp || null,
      expiresAt: Date.now() + 60 * 60 * 1000, // 1 hour
    };

    await storeSession(env, sessionToken, sessionData);
    console.log("Session created:", sessionData);

    return new Response(JSON.stringify({ token: sessionToken }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Admin-init crashed:", err);
    return new Response("Internal Error", { status: 500 });
  }
}
