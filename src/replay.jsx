import { audio } from "./audio.js";
function mountReplayUI(replayData, onClose) {
  const root = document.getElementById("replay-root");
  const gameCanvas = document.getElementById("gameCanvas");
  const uiLayer = document.getElementById("ui-layer");
  if (!root || !gameCanvas || !replayData) return;
  if (uiLayer) {
    uiLayer.style.display = "none";
  }
  root.innerHTML = "";
  root.style.pointerEvents = "auto";
  const container = document.createElement("div");
  container.style.position = "absolute";
  container.style.inset = "0";
  container.style.display = "flex";
  container.style.flexDirection = "column";
  container.style.pointerEvents = "none";
  container.style.background = "rgba(0,0,0,0.4)";
  const closeBtn = document.createElement("button");
  closeBtn.textContent = "\u2715";
  closeBtn.style.position = "absolute";
  closeBtn.style.top = "12px";
  closeBtn.style.right = "12px";
  closeBtn.style.width = "32px";
  closeBtn.style.height = "32px";
  closeBtn.style.borderRadius = "50%";
  closeBtn.style.border = "1px solid #00f3ff";
  closeBtn.style.background = "rgba(0,0,0,0.7)";
  closeBtn.style.color = "#00f3ff";
  closeBtn.style.fontFamily = "Orbitron, sans-serif";
  closeBtn.style.fontSize = "16px";
  closeBtn.style.cursor = "pointer";
  closeBtn.style.display = "flex";
  closeBtn.style.alignItems = "center";
  closeBtn.style.justifyContent = "center";
  closeBtn.style.pointerEvents = "auto";
  container.appendChild(closeBtn);
  const controls = document.createElement("div");
  controls.style.position = "absolute";
  controls.style.bottom = "16px";
  controls.style.right = "16px";
  controls.style.display = "flex";
  controls.style.justifyContent = "flex-end";
  controls.style.alignItems = "center";
  controls.style.gap = "12px";
  controls.style.pointerEvents = "auto";
  const styleButton = (btn) => {
    btn.style.padding = "10px 18px";
    btn.style.fontFamily = "Orbitron, sans-serif";
    btn.style.fontSize = "12px";
    btn.style.borderRadius = "4px";
    btn.style.border = "1px solid #00f3ff";
    btn.style.background = "rgba(0,0,0,0.6)";
    btn.style.color = "#00f3ff";
    btn.style.cursor = "pointer";
  };
  const downloadBtn = document.createElement("button");
  downloadBtn.textContent = "DOWNLOAD CLIP";
  styleButton(downloadBtn);
  controls.appendChild(downloadBtn);
  container.appendChild(controls);
  root.appendChild(container);
  const canvas = gameCanvas;
  const ctx = canvas.getContext("2d");
  const nodes = replayData.nodes || [];
  const frames = replayData.frames || [];
  const duration = replayData.duration || (frames.length > 0 ? frames[frames.length - 1].t : 0);
  let playing = true;
  let startTime = null;
  let lastFrameIndex = 0;
  let rafId = null;
  function drawFrame(frame) {
    const width = canvas.width;
    const height = canvas.height;
    ctx.fillStyle = "#050510";
    ctx.fillRect(0, 0, width, height);
    ctx.save();
    ctx.translate(0, -frame.cameraY);
    for (const node of nodes) {
      ctx.beginPath();
      ctx.arc(node.x, node.y, node.radius, 0, Math.PI * 2);
      if (node.type === "rare") {
        ctx.fillStyle = "#0ff";
        ctx.shadowColor = "#0ff";
      } else if (node.type === "start") {
        ctx.fillStyle = "#fff";
        ctx.shadowColor = "#fff";
      } else {
        ctx.fillStyle = "#f0f";
        ctx.shadowColor = "#f0f";
      }
      ctx.shadowBlur = 15;
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.beginPath();
      ctx.arc(node.x, node.y, node.radius * 0.5, 0, Math.PI * 2);
      ctx.fillStyle = "#fff";
      ctx.fill();
    }
    const player = frame.player;
    if (player) {
      ctx.save();
      ctx.translate(player.x, player.y);
      ctx.rotate(player.angle || 0);
      ctx.beginPath();
      ctx.moveTo(10, 0);
      ctx.lineTo(-10, 7);
      ctx.lineTo(-10, -7);
      ctx.closePath();
      ctx.fillStyle = "#00ff66";
      ctx.shadowColor = "#00ff66";
      ctx.shadowBlur = 20;
      ctx.fill();
      ctx.shadowBlur = 0;
      if (player.state === "dash") {
        ctx.strokeStyle = "rgba(0, 255, 100, 0.5)";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(-10, 0);
        ctx.lineTo(-40, 0);
        ctx.stroke();
      }
      ctx.restore();
    }
    ctx.restore();
  }
  function step(timestamp) {
    if (!playing || frames.length === 0) return;
    if (startTime === null) startTime = timestamp;
    const elapsed = (timestamp - startTime) / 1e3;
    let t = elapsed;
    const total = duration || (frames[frames.length - 1]?.t || 0);
    if (total > 0 && t > total) {
      startTime = timestamp;
      lastFrameIndex = 0;
      t = 0;
    }
    while (lastFrameIndex < frames.length - 1 && frames[lastFrameIndex + 1].t <= t) {
      lastFrameIndex++;
    }
    const frame = frames[lastFrameIndex] || frames[frames.length - 1];
    if (frame) drawFrame(frame);
    rafId = requestAnimationFrame(step);
  }
  if (frames.length > 0) {
    rafId = requestAnimationFrame(step);
  } else {
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    downloadBtn.disabled = true;
    downloadBtn.style.opacity = "0.4";
    downloadBtn.style.cursor = "default";
  }
  function cleanup() {
    playing = false;
    if (rafId !== null) cancelAnimationFrame(rafId);
    root.innerHTML = "";
    root.style.pointerEvents = "none";
    if (uiLayer) {
      uiLayer.style.display = "";
    }
    if (onClose) onClose();
  }
  closeBtn.addEventListener("click", () => {
    cleanup();
  });
  let recording = false;
  downloadBtn.addEventListener("click", async () => {
    if (recording) return;
    const total = duration || (frames[frames.length - 1]?.t || 0);
    if (!total || total <= 0) return;
    recording = true;
    try {
      await audio.init();
      const stream = canvas.captureStream(60);
      const audioStream = audio.getStream();
      if (audioStream) {
        audioStream.getAudioTracks().forEach((track) => {
          stream.addTrack(track);
        });
      }
      const chunks = [];
      const mimeType = MediaRecorder.isTypeSupported("video/webm;codecs=vp9") ? "video/webm;codecs=vp9" : "video/webm";
      const recorder = new MediaRecorder(stream, { mimeType });
      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunks.push(e.data);
      };
      recorder.onstop = () => {
        const blob = new Blob(chunks, { type: "video/webm" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "neon-spire-replay.webm";
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        recording = false;
      };
      startTime = performance.now();
      lastFrameIndex = 0;
      recorder.start();
      setTimeout(() => {
        recorder.stop();
      }, total * 1e3 + 250);
    } catch (err) {
      console.error("Replay recording failed:", err);
      recording = false;
    }
  });
  const handleResize = () => {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  };
  window.addEventListener("resize", handleResize);
  const observer = new MutationObserver(() => {
    if (!root.classList.contains("active")) {
      observer.disconnect();
      window.removeEventListener("resize", handleResize);
      cleanup();
    }
  });
  observer.observe(root, { attributes: true, attributeFilter: ["class"] });
}
export {
  mountReplayUI
};
