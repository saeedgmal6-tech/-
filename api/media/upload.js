import { handleUpload } from "@vercel/blob/client";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }
  try {
    const jsonResponse = await handleUpload({
      body: req.body,
      request: req,
      onBeforeGenerateToken: async (pathname, clientPayload) => {
        let payload = {};
        try { payload = JSON.parse(clientPayload || "{}"); } catch {}
        const isAudio = payload.mediaType === "audio";
        return {
          allowedContentTypes: isAudio
            ? ["audio/mpeg", "audio/mp4", "audio/x-m4a", "audio/aac", "audio/wav", "audio/x-wav", "audio/ogg", "audio/webm"]
            : ["video/mp4", "video/webm", "video/quicktime"],
          maximumSizeInBytes: isAudio ? 25 * 1024 * 1024 : 35 * 1024 * 1024,
          addRandomSuffix: true
        };
      },
      onUploadCompleted: async () => {}
    });
    return res.status(200).json(jsonResponse);
  } catch (error) {
    console.error("Vercel Blob media upload failed:", error?.message || error);
    return res.status(400).json({ error: "تعذر رفع الملف. تأكد من نوعه وحجمه وحاول مرة أخرى." });
  }
}
