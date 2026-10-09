const { spawnSync, spawn } = require("child_process");
const fs = require("fs");
const path = require("path");

const ROOT_DIR = "/home/container";
const APP_DIR = path.join(ROOT_DIR, "uptime-kuma");
const DATA_DIR = path.join(ROOT_DIR, "kuma-data");
const DONE_FILE = path.join(APP_DIR, ".pterodactyl-setup-done");

const VERSION = process.env.KUMA_VERSION || "2.5.5";
const PORT = process.env.SERVER_PORT || process.env.PORT || "3000";

// 512M 环境优化
const INSTALL_HEAP = process.env.INSTALL_HEAP || "384";
const RUN_HEAP = process.env.RUN_HEAP || "500";

process.env.HOME = ROOT_DIR;
process.env.DATA_DIR = DATA_DIR;
process.env.UPTIME_KUMA_PORT = PORT;
process.env.PORT = PORT;

process.env.npm_config_cache = "/tmp/.npm-cache";
process.env.npm_config_tmp = "/tmp";
process.env.npm_config_jobs = "1";
process.env.npm_config_audit = "false";
process.env.npm_config_fund = "false";
process.env.npm_config_update_notifier = "false";

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function run(cmd, args, cwd, extraEnv = {}) {
  console.log(`\n> ${cmd} ${args.join(" ")}`);
  const result = spawnSync(cmd, args, {
    cwd,
    stdio: "inherit",
    env: {
      ...process.env,
      ...extraEnv,
    },
  });

  if (result.status !== 0) {
    throw new Error(`命令失败: ${cmd} ${args.join(" ")}`);
  }
}

function isInstalled() {
  return (
    fs.existsSync(DONE_FILE) &&
    fs.existsSync(path.join(APP_DIR, "server", "server.js")) &&
    fs.existsSync(path.join(APP_DIR, "node_modules"))
  );
}

function install() {
  ensureDir(ROOT_DIR);
  ensureDir(DATA_DIR);
  ensureDir("/tmp/.npm-cache");

  if (fs.existsSync(APP_DIR)) {
    console.log("检测到旧的 uptime-kuma 程序目录，正在删除...");
    fs.rmSync(APP_DIR, { recursive: true, force: true });
  }

  console.log(`正在克隆 Uptime Kuma ${VERSION}...`);
  run("git", [
    "clone",
    "--branch",
    VERSION,
    "--depth=1",
    "https://github.com/louislam/uptime-kuma.git",
    APP_DIR,
  ], ROOT_DIR);

  console.log("正在安装依赖（低内存模式）...");
  run("npm", [
    "install",
    "--omit=dev",
    "--no-audit",
    "--no-fund",
    "--prefer-offline",
    "--foreground-scripts",
  ], APP_DIR, {
    NODE_OPTIONS: `--max-old-space-size=${INSTALL_HEAP}`,
  });

  console.log("正在下载前端构建文件...");
  run("npm", ["run", "download-dist"], APP_DIR, {
    NODE_OPTIONS: `--max-old-space-size=${INSTALL_HEAP}`,
  });

  fs.writeFileSync(DONE_FILE, `${VERSION}\n`);
  console.log("安装完成。");
}

function start() {
  console.log(`启动 Uptime Kuma，端口: ${PORT}`);
  console.log(`数据目录: ${DATA_DIR}`);

  const child = spawn("node", ["server/server.js"], {
    cwd: APP_DIR,
    stdio: "inherit",
    env: {
      ...process.env,
      NODE_OPTIONS: `--max-old-space-size=${RUN_HEAP}`,
    },
  });

  process.on("SIGTERM", () => child.kill("SIGTERM"));
  process.on("SIGINT", () => child.kill("SIGINT"));

  child.on("exit", (code, signal) => {
    console.error(`Uptime Kuma 已退出: code=${code}, signal=${signal}`);
    process.exit(code || 1);
  });
}

(async () => {
  try {
    if (!isInstalled()) {
      install();
    } else {
      console.log("Uptime Kuma 已安装，跳过安装步骤。");
    }

    start();
  } catch (err) {
    console.error("\n安装或启动失败：");
    console.error(err.message);
    process.exit(1);
  }
})();
