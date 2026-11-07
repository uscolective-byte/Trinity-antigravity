// Trinity/src/dev-gateway.js - DEV MODE (ZERO VERIFICATION / OPEN ACCESS)
import { handleFastChat } from './fast-chat.js';
import { executeInferenceCascade } from './inference-cascade.js';
import tapProfileService from '../../services/trinity-profile/src/index.js';
import jerichoCryptoService from '../../services/jericho123/src/index.js';

export default {
  async fetch(request, env = {}, ctx = null) {
    const url = new URL(request.url);

    // 1. Voľný CORS - povolené všetko odkiaľkoľvek
    if (request.method === "OPTIONS") {
      return new Response(null, {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "*",
          "Access-Control-Allow-Headers": "*"
        }
      });
    }

    // 2. ProfileMaker - voľný prechod bez kontroly tokenov
    if (url.pathname.startsWith("/api/profiles") || url.pathname.startsWith("/profiles")) {
      const targetUrl = new URL(request.url);
      targetUrl.pathname = targetUrl.pathname.replace(/^\/api/, "");
      const forwarded = new Request(targetUrl.toString(), request);
      if (env.PROFILE_SERVICE && typeof env.PROFILE_SERVICE.fetch === "function") {
        return await env.PROFILE_SERVICE.fetch(forwarded);
      }
      return await tapProfileService.fetch(forwarded, env, ctx);
    }

    // 3. Jericho Krypto - voľný prechod
    if (url.pathname.startsWith("/api/crypto") || url.pathname.startsWith("/crypto")) {
      const targetUrl = new URL(request.url);
      targetUrl.pathname = targetUrl.pathname.replace(/^\/api/, "");
      const forwarded = new Request(targetUrl.toString(), request);
      if (env.JERICHO_SERVICE && typeof env.JERICHO_SERVICE.fetch === "function") {
        return await env.JERICHO_SERVICE.fetch(forwarded);
      }
      return await jerichoCryptoService.fetch(forwarded, env, ctx);
    }

    // 4. Chat endpoint - okamžitá odpoveď, nulová kontrola autorizácie
    if (request.method === "POST" && (url.pathname === "/chat" || url.pathname === "/api/chat")) {
      let body = {};
      try {
        body = await request.json();
      } catch {
        body = {};
      }

      const messages = body.messages || [{ role: "user", content: body.message || "Ahoj Trinity" }];
      const latestMessage = messages[messages.length - 1]?.content || "";

      // Skúška Fast-Chatu
      const fast = handleFastChat(latestMessage, env);
      if (fast.handled) {
        return new Response(JSON.stringify({ reply: fast.response, mode: "fast-edge" }), {
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
            "X-Trinity-Route": "fast-chat-edge"
          }
        });
      }

      // Priama AI inferencia bez blokovania
      const stream = await executeInferenceCascade(messages, env);
      return new Response(stream, {
        headers: {
          "Content-Type": "text/event-stream",
          "Access-Control-Allow-Origin": "*"
        }
      });
    }

    // Základný stav
    return new Response(
      JSON.stringify({
        status: "online",
        mode: "development_open",
        env: env.ENVIRONMENT || "staging",
        owner: "Ivan Sabo (Basterix)"
      }),
      {
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
      }
    );
  }
};
