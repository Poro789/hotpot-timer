/* 后台 one-shot 计时 Worker：
 * 页面隐藏时主线程 rAF 停摆，由本 Worker 承载"最近到期时刻"的定时器。
 * Worker 端用墙钟计算 delay（主线程锚点已把 endAt 换算成绝对时刻）。
 */
let timerId = 0;

self.onmessage = (event) => {
  const data = event.data || {};
  if (data.type === 'arm') {
    if (timerId) clearTimeout(timerId);
    const delay = Math.max(0, data.delay || 0);
    timerId = setTimeout(() => {
      timerId = 0;
      self.postMessage({ type: 'fire', at: Date.now() });
    }, delay);
  } else if (data.type === 'disarm') {
    if (timerId) {
      clearTimeout(timerId);
      timerId = 0;
    }
  }
};
