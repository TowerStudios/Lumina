// 将 resources/runtime/win32 下的 VC++ 运行时库同步到 node_modules/electron/dist
// 确保 wx_key.dll 等 native 依赖在 dev 模式下能找到所需的 MSVC 运行时库
// 参考 WeFlow 的同名脚本
//
// 同时创建 weflow.exe 硬链接并修改 path.txt：
// wcdb_api.dll 的 InitProtection 通过 GetModuleFileNameA 检查进程名，
// 期望 weflow.exe / wechatdataanalysis.exe。开发环境默认运行 electron.exe，
// 导致 InitProtection 返回 -1006，wcdb_init 失败，wcdbOpenAccount 返回 -1005。
// 创建 weflow.exe 硬链接并让 electron 包使用它，即可通过进程名校验。
const fs = require('node:fs');
const path = require('node:path');

const runtimeNames = [
  'msvcp140.dll',
  'msvcp140_1.dll',
  'vcruntime140.dll',
  'vcruntime140_1.dll',
];

function copyIfDifferent(sourcePath, targetPath) {
  const source = fs.statSync(sourcePath);
  const targetExists = fs.existsSync(targetPath);

  if (targetExists) {
    const target = fs.statSync(targetPath);
    if (target.size === source.size && target.mtimeMs >= source.mtimeMs) {
      return false;
    }
  }

  fs.copyFileSync(sourcePath, targetPath);
  return true;
}

/**
 * 在 electron/dist 目录下创建 weflow.exe 硬链接（指向 electron.exe），
 * 并修改 path.txt 让 electron 包使用 weflow.exe 启动。
 * 这样 GetModuleFileNameA 返回的路径包含 weflow.exe，通过 DLL 进程名校验。
 */
function prepareWeflowExe(electronDir) {
  const electronExe = path.join(electronDir, 'electron.exe');
  const weflowExe = path.join(electronDir, 'weflow.exe');
  const pathTxt = path.join(electronDir, '..', 'path.txt');

  if (!fs.existsSync(electronExe)) {
    return false;
  }

  // 创建/更新 weflow.exe 硬链接
  try {
    if (fs.existsSync(weflowExe)) {
      // 检查是否已指向同一文件（硬链接共享 inode）
      const electronStat = fs.statSync(electronExe);
      const weflowStat = fs.statSync(weflowExe);
      if (electronStat.ino !== weflowStat.ino || electronStat.size !== weflowStat.size) {
        fs.unlinkSync(weflowExe);
        fs.linkSync(electronExe, weflowExe);
      }
    } else {
      fs.linkSync(electronExe, weflowExe);
    }
  } catch (e) {
    // 硬链接失败（可能跨卷），回退到复制
    try {
      if (fs.existsSync(weflowExe)) {
        fs.unlinkSync(weflowExe);
      }
      fs.copyFileSync(electronExe, weflowExe);
    } catch (copyErr) {
      console.warn('[prepare-electron-runtime] 创建 weflow.exe 失败:', copyErr.message);
      return false;
    }
  }

  // 修改 path.txt 指向 weflow.exe
  try {
    const currentContent = fs.existsSync(pathTxt)
      ? fs.readFileSync(pathTxt, 'utf-8').trim()
      : '';
    if (currentContent !== 'weflow.exe') {
      fs.writeFileSync(pathTxt, 'weflow.exe', 'utf-8');
      console.log('[prepare-electron-runtime] path.txt 已更新为 weflow.exe');
    }
  } catch (e) {
    console.warn('[prepare-electron-runtime] 修改 path.txt 失败:', e.message);
    return false;
  }

  return true;
}

function main() {
  if (process.platform !== 'win32') {
    return;
  }

  const projectRoot = path.resolve(__dirname, '..');
  const sourceDir = path.join(projectRoot, 'resources', 'runtime', 'win32');
  const targetDir = path.join(projectRoot, 'node_modules', 'electron', 'dist');

  if (!fs.existsSync(targetDir)) {
    return;
  }

  // 1. 同步 VC++ 运行时库
  let copiedCount = 0;
  if (fs.existsSync(sourceDir)) {
    for (const name of runtimeNames) {
      const sourcePath = path.join(sourceDir, name);
      const targetPath = path.join(targetDir, name);
      if (!fs.existsSync(sourcePath)) {
        continue;
      }
      if (copyIfDifferent(sourcePath, targetPath)) {
        copiedCount += 1;
      }
    }
    if (copiedCount > 0) {
      console.log(`[prepare-electron-runtime] synced ${copiedCount} runtime DLL(s) to ${targetDir}`);
    }
  }

  // 2. 创建 weflow.exe 硬链接，通过 DLL 进程名校验
  if (prepareWeflowExe(targetDir)) {
    console.log('[prepare-electron-runtime] weflow.exe 已就绪');
  }
}

main();
