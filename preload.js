// 预加载脚本可以在渲染进程和主进程之间安全地传递数据
const { ipcRenderer } = require('electron');
const path = require('path');
const fs = require('fs');

// 配置
const CONFIG = {
  // 音频路径（默认路径和备用路径）
  audioPath: path.join(process.env.USERPROFILE || process.env.HOME, 'Documents', 'didtask', '提示音乐.mp3'),
  defaultAudioPath: path.join(__dirname, 'notification.mp3')
};

// 检查并创建音频路径
function ensureAudioPath() {
  const audioDir = path.dirname(CONFIG.audioPath);
  try {
    if (!fs.existsSync(audioDir)) {
      fs.mkdirSync(audioDir, { recursive: true });
    }
  } catch (err) {
    console.error('创建目录失败:', err);
  }
}

// 确保音频文件路径存在
ensureAudioPath();

// 公开给渲染进程的API
window.electronAPI = {
  getAudioPath: () => {
    // 首选用户指定的路径，如果不存在则使用默认路径
    return fs.existsSync(CONFIG.audioPath) ? CONFIG.audioPath : CONFIG.defaultAudioPath;
  }
};

window.addEventListener('DOMContentLoaded', () => {
  // 将当前系统时间注入到渲染进程
  const updateClock = () => {
    const now = new Date();
    // 格式化时间，确保显示时、分、秒
    const timeString = now.toLocaleTimeString('zh-CN', {
      hour: '2-digit', 
      minute: '2-digit',
      second: '2-digit',
      hour12: false  // 使用24小时制
    });
    // 格式化日期，确保显示年、月、日、星期
    const dateString = now.toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      weekday: 'long'
    });

    if (document.getElementById('current-time')) {
      document.getElementById('current-time').innerText = timeString;
    }
    if (document.getElementById('current-date')) {
      document.getElementById('current-date').innerText = dateString;
    }
  };
  
  // 立即更新一次时间
  updateClock();
  
  // 每秒更新一次时间
  setInterval(updateClock, 1000);
}); 