/**
 * Grabs a single still frame from a live screen-share MediaStream (obtained
 * via getDisplayMedia) as a PNG blob, by briefly rendering it to a hidden
 * video element and drawing that frame to a canvas.
 */
export async function captureFrameFromStream(stream: MediaStream): Promise<Blob | null> {
  const track = stream.getVideoTracks()[0];
  if (!track || track.readyState !== "live") return null;

  const video = document.createElement("video");
  video.muted = true;
  video.playsInline = true;
  video.srcObject = stream;

  await new Promise<void>((resolve) => {
    video.onloadedmetadata = () => resolve();
  });
  await video.play().catch(() => {});
  // Give the decoder a moment to render an actual frame before capturing it.
  await new Promise((resolve) => setTimeout(resolve, 150));

  const canvas = document.createElement("canvas");
  canvas.width = video.videoWidth || 1280;
  canvas.height = video.videoHeight || 720;
  const ctx = canvas.getContext("2d");

  video.pause();
  video.srcObject = null;

  if (!ctx) return null;
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

  return new Promise((resolve) => canvas.toBlob((blob) => resolve(blob), "image/png"));
}
