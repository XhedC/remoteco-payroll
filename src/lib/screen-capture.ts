/**
 * Grabs a single still frame from a live screen-share MediaStream (obtained
 * via getDisplayMedia) as a PNG blob, by briefly rendering it to an
 * off-screen (but DOM-attached) video element and drawing that frame to a
 * canvas.
 */
export async function captureFrameFromStream(stream: MediaStream): Promise<Blob | null> {
  const track = stream.getVideoTracks()[0];
  if (!track || track.readyState !== "live") return null;

  const video = document.createElement("video");
  video.muted = true;
  video.playsInline = true;
  video.srcObject = stream;
  // The video must actually be attached to the document for some browsers
  // (notably Chrome) to decode real frames from a MediaStream — a detached
  // <video> can report "playing" and have correct dimensions while never
  // rendering any frame data, producing a fully transparent capture.
  video.style.position = "fixed";
  video.style.top = "-9999px";
  video.style.left = "-9999px";
  video.style.width = "1px";
  video.style.height = "1px";
  document.body.appendChild(video);

  try {
    await new Promise<void>((resolve) => {
      video.onloadedmetadata = () => resolve();
    });
    await video.play().catch(() => {});

    // Wait for an actual decoded frame (readyState >= HAVE_CURRENT_DATA)
    // instead of a fixed delay, which can fire before any frame is ready.
    if (video.readyState < 2) {
      await new Promise<void>((resolve) => {
        video.onloadeddata = () => resolve();
      });
    }
    // Small extra buffer so the frame is fully painted before capture.
    await new Promise((resolve) => setTimeout(resolve, 150));

    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    return new Promise((resolve) => canvas.toBlob((blob) => resolve(blob), "image/png"));
  } finally {
    video.pause();
    video.srcObject = null;
    video.remove();
  }
}
