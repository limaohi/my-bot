const { spawn } = require("node:child_process");

const port = "10030";
const child = spawn(process.execPath, ["server/server.js", `--port=${port}`], {
    cwd: __dirname,
    stdio: "inherit",
    env: {
        ...process.env,
        UPTIME_KUMA_PORT: port,
    },
});

child.on("error", (error) => {
    console.error("无法启动 Uptime Kuma:", error.message);
    process.exit(1);
});

child.on("exit", (code, signal) => {
    if (signal) console.error(`Uptime Kuma 被信号 ${signal} 终止。`);
    process.exit(code ?? 1);
});

["SIGINT", "SIGTERM"].forEach((signal) => {
    process.on(signal, () => child.kill(signal));
});