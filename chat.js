// api/chat.js
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: { message: 'GEMINI_API_KEY environment variable is missing.' } });
  }

  // Debug: log request shape only — never the API key, never full message text.
  const contentsCount = Array.isArray(req.body?.contents) ? req.body.contents.length : 0;
  console.log('[Nikki] Incoming request, contents entries:', contentsCount);

  // Bound Gemini's reply length so a single response can't blow up output-token
  // usage. This only caps length; it does not shorten normal answers, which the
  // system prompt already keeps under ~120 words. Existing generationConfig
  // fields from the frontend (if ever added) take precedence over this default.
  const geminiPayload = {
    ...req.body,
    generationConfig: {
      maxOutputTokens: 1024,
      ...(req.body?.generationConfig || {}),
    },
  };

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(geminiPayload),
      }
    );

    const data = await response.json();

    // Safe, non-sensitive usage logging for development visibility.
    // Never logs the API key, request/response text, or any user content.
    if (data && data.usageMetadata) {
      console.log('[Nikki] Prompt tokens:', data.usageMetadata.promptTokenCount);
      console.log('[Nikki] Output tokens:', data.usageMetadata.candidatesTokenCount);
      console.log('[Nikki] Total tokens:', data.usageMetadata.totalTokenCount);
    } else {
      console.log('[Nikki] Response status:', response.status, '— no usageMetadata present in this response.');
    }

    // usageMetadata (if present) is already part of `data` and is forwarded to
    // the frontend as-is, same as before — nothing is stripped or added here.
    return res.status(response.status).json(data);
  } catch (error) {
    console.error('[Nikki] Upstream request failed:', error.message);
    return res.status(500).json({ error: { message: error.message || 'Internal Server Error' } });
  }
}
