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
  Object.assign(closeBtn.style, {
    position: "absolute",
    top: "12px",
    right: "12px",
    width: "32px",
    height: "32px",
    borderRadius: "50%",
    border: "1px solid #00f3ff",
    background: "rgba(0,0,0,0.7)",
    color: "#00f3ff",
    fontFamily: "Orbitron, sans-serif",
    fontSize: "16px",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    pointerEvents: "auto"
  });
  container.appendChild(closeBtn);
  const controls = document.createElement("div");
  Object.assign(controls.style, {
    position: "absolute",
    bottom: "16px",
    right: "16px",
    display: "flex",
    justifyContent: "flex-end",
    alignItems: "center",
    gap: "12px",
    pointerEvents: "auto"
  });
  const downloadBtn = document.createElement("button");
  downloadBtn.textContent = "DOWNLOAD CLIP";
  Object.assign(downloadBtn.style, {
    padding: "10px 18px",
    fontFamily: "Orbitron, sans-serif",
    fontSize: "12px",
    borderRadius: "4px",
    border: "1px solid #00f3ff",
    background: "rgba(0,0,0,0.6)",
    color: "#00f3ff",
    cursor: "pointer"
  });
  controls.appendChild(downloadBtn);
  container.appendChild(controls);
  const progressContainer = document.createElement("div");
  Object.assign(progressContainer.style, {
    position: "absolute",
    top: "50%",
    left: "50%",
    transform: "translate(-50%, -50%)",
    width: "300px",
    background: "rgba(0,0,0,0.9)",
    border: "2px solid #00f3ff",
    padding: "20px",
    display: "none",
    flexDirection: "column",
    gap: "10px",
    zIndex: "50",
    pointerEvents: "none"
  });
  const progressLabel = document.createElement("div");
  progressLabel.textContent = "RENDERING CLIP...";
  progressLabel.style.color = "#00f3ff";
  progressLabel.style.textAlign = "center";
  progressLabel.style.fontFamily = "Orbitron, sans-serif";
  const progressBar = document.createElement("div");
  Object.assign(progressBar.style, {
    width: "100%",
    height: "10px",
    background: "#333"
  });
  const progressFill = document.createElement("div");
  Object.assign(progressFill.style, {
    width: "0%",
    height: "100%",
    background: "#00f3ff",
    transition: "width 0.1s linear"
  });
  progressBar.appendChild(progressFill);
  progressContainer.appendChild(progressLabel);
  progressContainer.appendChild(progressBar);
  root.appendChild(progressContainer);
  root.appendChild(container);
  const canvas = gameCanvas;
  const ctx = canvas.getContext("2d");
  const nodes = replayData.nodes || [];
  const frames = replayData.frames || [];
  const totalDuration = replayData.duration || (frames.length > 0 ? frames[frames.length - 1].t : 0);
  let isPlaying = true;
  let isRecording = false;
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
  function processEvents(fromIndex, toIndex) {
    for (let i = fromIndex + 1; i <= toIndex; i++) {
      const f = frames[i];
      if (f && f.events) {
        f.events.forEach((e) => {
          audio.play(e.type);
        });
      }
    }
  }
  function loop(timestamp) {
    if (!isPlaying || isRecording || frames.length === 0) return;
    if (startTime === null) startTime = timestamp;
    let elapsed = (timestamp - startTime) / 1e3;
    if (totalDuration > 0 && elapsed > totalDuration + 1) {
      startTime = timestamp;
      lastFrameIndex = 0;
      elapsed = 0;
    }
    let newFrameIndex = lastFrameIndex;
    while (newFrameIndex < frames.length - 1 && frames[newFrameIndex + 1].t <= elapsed) {
      newFrameIndex++;
    }
    processEvents(lastFrameIndex, newFrameIndex);
    lastFrameIndex = newFrameIndex;
    const frame = frames[lastFrameIndex] || frames[frames.length - 1];
    if (frame) drawFrame(frame);
    rafId = requestAnimationFrame(loop);
  }
  if (frames.length > 0) {
    rafId = requestAnimationFrame(loop);
  }
  downloadBtn.addEventListener("click", async () => {
    if (isRecording || frames.length === 0) return;
    isRecording = true;
    downloadBtn.disabled = true;
    downloadBtn.style.opacity = "0.5";
    progressContainer.style.display = "flex";
    if (rafId) cancelAnimationFrame(rafId);
    try {
      let recordStep = function() {
        if (!isRecording) return;
        const now = performance.now();
        const t = (now - recStartTime) / 1e3;
        const pct = Math.min(100, t / totalDuration * 100);
        progressFill.style.width = `${pct}%`;
        let newIndex = recIndex;
        while (newIndex < frames.length - 1 && frames[newIndex + 1].t <= t) {
          newIndex++;
        }
        processEvents(recIndex, newIndex);
        recIndex = newIndex;
        const frame = frames[recIndex] || frames[frames.length - 1];
        if (frame) drawFrame(frame);
        if (t >= totalDuration + 0.5) {
          recorder.stop();
        } else {
          requestAnimationFrame(recordStep);
        }
      };
      await audio.init();
      const audioStream = audio.getStream();
      const canvasStream = canvas.captureStream(60);
      if (audioStream) {
        audioStream.getAudioTracks().forEach((track) => canvasStream.addTrack(track));
      }
      const mimeType = MediaRecorder.isTypeSupported("video/webm;codecs=vp9") ? "video/webm;codecs=vp9" : "video/webm";
      const recorder = new MediaRecorder(canvasStream, { mimeType, videoBitsPerSecond: 5e6 });
      const chunks = [];
      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunks.push(e.data);
      };
      recorder.onstop = () => {
        const blob = new Blob(chunks, { type: "video/webm" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.style.display = "none";
        a.href = url;
        a.download = `neon_spire_${Date.now()}.webm`;
        document.body.appendChild(a);
        a.click();
        setTimeout(() => {
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
        }, 100);
        isRecording = false;
        downloadBtn.disabled = false;
        downloadBtn.style.opacity = "1";
        progressContainer.style.display = "none";
        startTime = null;
        lastFrameIndex = 0;
        isPlaying = true;
        rafId = requestAnimationFrame(loop);
      };
      recorder.start();
      let recStartTime = performance.now();
      let recIndex = 0;
      recordStep();
    } catch (err) {
      console.error("Recording error:", err);
      isRecording = false;
      progressContainer.style.display = "none";
      downloadBtn.disabled = false;
      rafId = requestAnimationFrame(loop);
    }
  });
  function cleanup() {
    isPlaying = false;
    isRecording = false;
    if (rafId) cancelAnimationFrame(rafId);
    root.innerHTML = "";
    root.style.pointerEvents = "none";
    if (uiLayer) uiLayer.style.display = "";
    window.removeEventListener("resize", handleResize);
    if (onClose) onClose();
  }
  closeBtn.addEventListener("click", cleanup);
  const handleResize = () => {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  };
  window.addEventListener("resize", handleResize);
  const observer = new MutationObserver(() => {
    if (!root.classList.contains("active")) {
      observer.disconnect();
      cleanup();
    }
  });
  observer.observe(root, { attributes: true, attributeFilter: ["class"] });
}
export {
  mountReplayUI
};
