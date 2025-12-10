import { state } from "./state.js";
function mountReplayUI(replayData, onClose) {
  const root = document.getElementById("replay-root");
  if (!root) return;
  root.innerHTML = "";
  const container = document.createElement("div");
  container.style.position = "absolute";
  container.style.inset = "0";
  container.style.display = "flex";
  container.style.flexDirection = "column";
  container.style.alignItems = "center";
  container.style.justifyContent = "center";
  container.style.background = "#000";
  container.style.pointerEvents = "auto";
  const header = document.createElement("div");
  header.textContent = "INSTANT REPLAY";
  header.style.position = "absolute";
  header.style.top = "16px";
  header.style.left = "0";
  header.style.right = "0";
  header.style.textAlign = "center";
  header.style.fontFamily = "Orbitron, sans-serif";
  header.style.fontSize = "18px";
  header.style.color = "#00f3ff";
  header.style.textShadow = "0 0 10px #00f3ff";
  container.appendChild(header);
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
  container.appendChild(closeBtn);
  const canvas = document.createElement("canvas");
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  canvas.style.width = "100%";
  canvas.style.height = "100%";
  canvas.style.maxHeight = "100%";
  container.appendChild(canvas);
  const controls = document.createElement("div");
  controls.style.position = "absolute";
  controls.style.bottom = "16px";
  controls.style.left = "0";
  controls.style.right = "0";
  controls.style.display = "flex";
  controls.style.justifyContent = "flex-end";
  controls.style.paddingRight = "16px";
  controls.style.gap = "12px";
  const btnStyle = (btn) => {
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
  btnStyle(downloadBtn);
  controls.appendChild(downloadBtn);
  container.appendChild(controls);
  root.appendChild(container);
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
    if (!playing) return;
    if (startTime === null) startTime = timestamp;
    const elapsed = (timestamp - startTime) / 1e3;
    let t = elapsed;
    if (t > duration && duration > 0) {
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
  rafId = requestAnimationFrame(step);
  function cleanup() {
    playing = false;
    if (rafId !== null) cancelAnimationFrame(rafId);
    root.innerHTML = "";
    if (onClose) onClose();
  }
  closeBtn.addEventListener("click", () => {
    cleanup();
  });
  let recording = false;
  downloadBtn.addEventListener("click", async () => {
    if (recording || !duration || duration <= 0) return;
    recording = true;
    try {
      const stream = canvas.captureStream(60);
      const chunks = [];
      const recorder = new MediaRecorder(stream, { mimeType: "video/webm; codecs=vp9" });
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
      }, duration * 1e3 + 200);
    } catch (err) {
      console.error("Recording failed:", err);
      recording = false;
    }
  });
  const handleResize = () => {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  };
  window.addEventListener("resize", handleResize);
  root.addEventListener("transitionend", () => {
    if (!root.classList.contains("active")) {
      cleanup();
      window.removeEventListener("resize", handleResize);
    }
  }, { once: true });
}
export {
  mountReplayUI
};
