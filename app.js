

// 应用状态
const state = {
    timers: [],
    nextTimerId: 1,
    currentCategory: 'meat',
    customFoodCounter: 1,
    foodAddCounts: {},        // 记录每个食材（baseName）被添加的总次数
    myFoods: [],              // 用户自定义食材库 [{name, time}]
    selectedCustomTime: 60    // "我的食材"面板中当前选中的时长
};

// DOM 元素
const elements = {
    timersContainer: document.getElementById('timers-container'),
    emptyState: document.getElementById('empty-state'),
    pauseAllBtn: document.getElementById('pause-all-btn'),
    deleteAllBtn: document.getElementById('delete-all-btn'),
    foodGrid: document.getElementById('food-grid'),
    toast: document.getElementById('toast'),
    flashOverlay: document.getElementById('flash-overlay'),
    myFoodsPanel: document.getElementById('my-foods-panel'),
    customFoodNameInput: document.getElementById('custom-food-name'),
    customTimeChips: document.getElementById('custom-time-chips'),
    addCustomFoodBtn: document.getElementById('add-custom-food-btn'),
    quickNameOverlay: document.getElementById('quick-name-overlay'),
    quickNameInput: document.getElementById('quick-name-input'),
    quickNameHint: document.getElementById('quick-name-hint'),
    quickNameCancel: document.getElementById('quick-name-cancel'),
    quickNameConfirm: document.getElementById('quick-name-confirm')
};

// 初始化
function init() {
    loadTimers();
    renderTimers();
    elements.myFoodsPanel.style.display = 'none'; // 默认隐藏，切到"我的食材"时显示
    updateCustomTimeChips();
    renderFoods('meat');
    setupEventListeners();
    setupMyFoodsPanel();

    // 页面隐藏时回到前台后：重同步到点提醒 + 恢复被节流暂停的刷新
    document.addEventListener('visibilitychange', () => {
        if (!document.hidden) {
            unlockAudio();
            resyncRunningTimers();
            state.timers.forEach(timer => {
                if (timer.isRunning && timer.endAt !== null && !timer.timer) {
                    startSingleTimer(timer.id);
                }
            });
        }
    });

    // 关闭/刷新前保存状态（pagehide 比 beforeunload 更可靠，移动端也能触发）
    window.addEventListener('pagehide', saveTimers);
    window.addEventListener('beforeunload', saveTimers);
}

// ---------- 持久化（localStorage）----------
const STORAGE_KEY = 'hotpot-timer-state-v2';

function saveTimers() {
    try {
        const data = state.timers.map(t => ({
            id: t.id,
            food: t.food,
            totalTime: t.totalTime,
            remainingTime: t.remainingTime,
            isRunning: t.isRunning,
            endAt: t.endAt
        }));
        localStorage.setItem(STORAGE_KEY, JSON.stringify({
            timers: data,
            nextTimerId: state.nextTimerId,
            customFoodCounter: state.customFoodCounter,
            foodAddCounts: state.foodAddCounts,
            myFoods: state.myFoods
        }));
    } catch (e) { /* 存储不可用（隐私模式等）时静默 */ }
}

function loadTimers() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return;
        const saved = JSON.parse(raw);
        if (!Array.isArray(saved.timers)) return;

        state.nextTimerId = saved.nextTimerId || 1;
        state.customFoodCounter = saved.customFoodCounter || 1;
        state.foodAddCounts = saved.foodAddCounts || {};
        state.myFoods = Array.isArray(saved.myFoods) ? saved.myFoods : [];

        const now = Date.now();
        state.timers = saved.timers.map(t => {
            const timer = {
                id: t.id,
                food: t.food,
                totalTime: t.totalTime,
                remainingTime: Math.max(0, t.remainingTime),
                isRunning: false,
                endAt: null,
                timer: null
            };
            // 刷新前正在运行的：按时间戳续算剩余；期间到点的直接标记完成
            if (t.isRunning && t.endAt) {
                const remainingMs = Math.max(0, t.endAt - now);
                timer.remainingTime = Math.ceil(remainingMs / 1000);
                timer.isRunning = remainingMs > 0;
            }
            return timer;
        });

        // 恢复后自动继续运行（未完成的）
        state.timers.forEach(t => {
            if (t.isRunning && t.remainingTime > 0) {
                startSingleTimer(t.id);
            }
        });
    } catch (e) { /* 数据损坏时忽略，从空状态开始 */ }
}

// ---------- 系统通知（兜底提醒）----------
function requestNotificationPermission() {
    if ('Notification' in window && Notification.permission === 'default') {
        Notification.requestPermission().catch(() => {});
    }
}

function showSystemNotification(message) {
    if ('Notification' in window && Notification.permission === 'granted') {
        try {
            new Notification('🔥 火锅计时器', { body: message });
        } catch (e) { /* 某些平台（如 iOS Safari）不支持时忽略 */ }
    }
}

// ---------- 工具函数 ----------
function escapeHtml(str) {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

// 渲染所有计时器
function renderTimers() {
    const existingTimers = elements.timersContainer.querySelectorAll('.timer-card');
    existingTimers.forEach(t => t.remove());

    if (state.timers.length === 0) {
        elements.emptyState.style.display = 'block';
        updateGlobalButtons();
        return;
    }

    elements.emptyState.style.display = 'none';

    state.timers.forEach(timer => {
        const card = createTimerCard(timer);
        elements.timersContainer.appendChild(card);
    });

    updateGlobalButtons();
}

// 创建计时器卡片（纯文字版本，无右上角X按钮，按钮顺序：暂停/继续 + 删除）
function createTimerCard(timer) {
    const card = document.createElement('div');
    card.className = 'timer-card';
    card.dataset.timerId = timer.id;

    // 注意：按钮点击由 timers-container 上的事件委托统一处理，这里不再单独绑定
    card.innerHTML = `
        <div class="timer-card-header">
            <h3 class="timer-food-name">${escapeHtml(timer.food.name)}</h3>
        </div>
        <div class="timer-card-body">
            <div class="timer-info">
                <div class="timer-time">${formatTime(timer.remainingTime)}</div>
            </div>
            <div class="timer-card-controls">
                <button class="btn-toggle btn-small" data-id="${timer.id}">${timer.isRunning ? '暂停' : (timer.remainingTime <= 0 ? '加一份' : '继续')}</button>
                <button class="btn-delete btn-small" data-id="${timer.id}">删除</button>
            </div>
        </div>
        <div class="timer-desc">${escapeHtml(timer.food.desc || '')}</div>
    `;

    return card;
}

// 更新单个计时器显示
function updateTimerDisplay(timer) {
    const card = document.querySelector(`.timer-card[data-timer-id="${timer.id}"]`);
    if (!card) return;

    const timeDisplay = card.querySelector('.timer-time');
    timeDisplay.textContent = formatTime(timer.remainingTime);

    const toggleBtn = card.querySelector('.btn-toggle');
    if (timer.remainingTime <= 0) {
        toggleBtn.textContent = '加一份';
        card.classList.add('completed');
    } else {
        toggleBtn.textContent = timer.isRunning ? '暂停' : '继续';
        if (timer.isRunning) {
            card.classList.add('running');
        } else {
            card.classList.remove('running');
        }
        card.classList.remove('completed');
    }
}

// 开始单个计时器（基于目标结束时间戳，避免 setInterval 累积漂移）
function startSingleTimer(timerId) {
    const timer = state.timers.find(t => t.id === timerId);
    if (!timer || timer.remainingTime <= 0) return;

    timer.isRunning = true;
    timer.endAt = Date.now() + timer.remainingTime * 1000;
    updateTimerDisplay(timer);

    // 每 250ms 刷新一次显示，剩余时间按时间戳精确计算
    if (!timer.timer) {
        timer.timer = setInterval(() => tickTimer(timer), 250);
    }
    saveTimers();
    updateGlobalButtons();
}

// 单个计时器的每次刷新
function tickTimer(timer) {
    const remainingMs = Math.max(0, timer.endAt - Date.now());
    // 向上取整：刚启动时显示完整时长，归零即结束
    timer.remainingTime = Math.ceil(remainingMs / 1000);

    updateTimerDisplay(timer);

    if (remainingMs <= 0) {
        pauseSingleTimer(timer.id);
        notifyTimerDone(timer);
    }
}

// 计时完成提醒：声音 + 震动 + 系统通知（兜底）+ toast + 全屏闪光
function notifyTimerDone(timer) {
    playNotificationSound();
    if (navigator.vibrate) {
        navigator.vibrate([200, 100, 200]);
    }
    showToast(`${timer.food.name} 时间到！`);
    showSystemNotification(`${timer.food.name} 时间到！`);
    triggerFlash();
    saveTimers();
}

// 全屏闪光提醒（闪 3 次后自动熄灭）
function triggerFlash() {
    const overlay = elements.flashOverlay;
    if (!overlay) return;
    overlay.classList.remove('flashing');
    // 强制重排，确保连续触发时动画能重新播放
    void overlay.offsetWidth;
    overlay.classList.add('flashing');
    setTimeout(() => overlay.classList.remove('flashing'), 1600);
}

// 页面隐藏时 setInterval 会被浏览器节流，回到前台立即重同步；
// 期间到点的计时器补发提醒（此时用户交互已解锁音频）
function resyncRunningTimers() {
    let anyDone = false;
    state.timers.forEach(timer => {
        if (timer.isRunning && timer.endAt !== null) {
            const remainingMs = Math.max(0, timer.endAt - Date.now());
            timer.remainingTime = Math.ceil(remainingMs / 1000);
            updateTimerDisplay(timer);

            if (remainingMs <= 0) {
                anyDone = true;
                pauseSingleTimer(timer.id);
                notifyTimerDone(timer);
            }
        }
    });
    if (anyDone || state.timers.some(t => t.isRunning)) {
        updateGlobalButtons();
    }
}

// 暂停单个计时器
function pauseSingleTimer(timerId) {
    const timer = state.timers.find(t => t.id === timerId);
    if (!timer || !timer.isRunning) return;

    // 先按时间戳结算剩余时间，再停止刷新
    if (timer.endAt !== null) {
        timer.remainingTime = Math.max(0, Math.ceil((timer.endAt - Date.now()) / 1000));
    }
    timer.isRunning = false;
    timer.endAt = null;
    clearInterval(timer.timer);
    timer.timer = null;
    updateTimerDisplay(timer);
    saveTimers();
    updateGlobalButtons();
}

// 移除计时器（silent 为 true 时不弹提示，供批量操作内部调用）
function removeTimer(timerId, silent) {
    const index = state.timers.findIndex(t => t.id === timerId);
    if (index === -1) return;

    const timer = state.timers[index];
    clearInterval(timer.timer);

    state.timers.splice(index, 1);

    // 食材名可能含引号等特殊字符，用属性选择器需转义，改用遍历匹配
    document.querySelectorAll('.food-card').forEach(card => {
        if (card.dataset.name === timer.food.name) {
            card.classList.remove('selected');
        }
    });

    renderTimers();
    saveTimers();
    if (!silent) {
        showToast(`已删除 ${timer.food.name}`);
    }
}

// 加一份（重置计时器）
function resetTimer(timerId) {
    const timer = state.timers.find(t => t.id === timerId);
    if (!timer) return;

    // 如果正在运行，先停止
    if (timer.isRunning) {
        pauseSingleTimer(timerId);
    }

    // 重置时间
    timer.remainingTime = timer.totalTime;

    renderTimers();
    saveTimers();
    showToast(`已重置: ${timer.food.name}`);

    // 自动开始计时
    startSingleTimer(timerId);
}

// 更新全局按钮状态
function updateGlobalButtons() {
    const hasTimers = state.timers.length > 0;
    const anyRunning = state.timers.some(t => t.isRunning);
    const allPaused = state.timers.length > 0 && state.timers.every(t => !t.isRunning && t.remainingTime > 0);

    // 如果有计时器在运行，显示"全部暂停"
    // 如果所有计时器都暂停了（且未完成），显示"全部恢复"
    if (anyRunning) {
        elements.pauseAllBtn.textContent = '全部暂停';
        elements.pauseAllBtn.disabled = false;
    } else if (allPaused) {
        elements.pauseAllBtn.textContent = '全部恢复';
        elements.pauseAllBtn.disabled = false;
    } else {
        elements.pauseAllBtn.textContent = '全部暂停';
        elements.pauseAllBtn.disabled = true;
    }

    elements.deleteAllBtn.disabled = !hasTimers;
}

// 全部暂停/恢复切换
function toggleAllTimers() {
    const anyRunning = state.timers.some(t => t.isRunning);

    if (anyRunning) {
        // 如果有运行的，全部暂停
        state.timers.forEach(timer => {
            if (timer.isRunning) {
                pauseSingleTimer(timer.id);
            }
        });
        showToast('已全部暂停');
    } else {
        // 如果都暂停了，全部恢复
        state.timers.forEach(timer => {
            if (!timer.isRunning && timer.remainingTime > 0) {
                startSingleTimer(timer.id);
            }
        });
        showToast('已全部恢复');
    }
}

// 全部删除
function deleteAllTimers() {
    if (state.timers.length === 0) return;

    // 二次确认
    const confirmed = confirm('确定要删除所有计时器吗？此操作不可撤销。');
    if (!confirmed) return;

    state.timers.forEach(timer => {
        if (timer.isRunning) {
            clearInterval(timer.timer);
        }
    });
    state.timers = [];
    state.customFoodCounter = 1; // 重置自定义食材计数
    renderTimers();
    saveTimers();
    showToast('已删除所有计时器');
}

// 渲染食材列表（myfoods 为自定义食材库）
function renderFoods(category) {
    const isMyFoods = category === 'myfoods';
    const foods = isMyFoods ? state.myFoods : (foodDatabase[category] || []);
    elements.foodGrid.innerHTML = '';

    // "我的食材"为空时的占位提示
    if (isMyFoods && foods.length === 0) {
        const empty = document.createElement('div');
        empty.className = 'my-foods-empty';
        empty.textContent = '还没有自定义食材，在上方添加吧';
        elements.foodGrid.appendChild(empty);
        return;
    }

    foods.forEach(food => {
        const card = document.createElement('div');
        card.className = 'food-card' + (isMyFoods ? ' food-card-custom' : '');
        card.dataset.name = food.name;
        card.dataset.time = food.time;

        // 统计该食材当前在计时列表中的份数（基于baseName）
        const count = state.timers.filter(t => t.food.baseName === food.name).length;
        if (count > 0) {
            card.classList.add('selected');
        }

        card.innerHTML = `
            ${count > 1 ? `<div class="food-count-badge">${count}</div>` : ''}
            <div class="food-name">${escapeHtml(food.name)}</div>
            <div class="food-time">时长: <span>${formatTime(food.time)}</span></div>
            ${isMyFoods ? '<button class="food-remove-btn" title="删除该食材">✕</button>' : ''}
        `;

        if (isMyFoods) {
            // 点卡片 = 直接开始计时；点 ✕ = 从我的食材库移除
            card.addEventListener('click', () => selectFood(food));
            card.querySelector('.food-remove-btn').addEventListener('click', (e) => {
                e.stopPropagation();
                removeMyFood(food.name);
            });
        } else {
            card.addEventListener('click', () => selectFood(food));
        }
        elements.foodGrid.appendChild(card);
    });
}

// ---------- 我的食材（自定义食材库）----------
function addMyFood(name, seconds) {
    const trimmed = name.trim();
    if (!trimmed) {
        showToast('请输入食材名称');
        return false;
    }

    // 同名则更新时长
    const existing = state.myFoods.find(f => f.name === trimmed);
    if (existing) {
        existing.time = seconds;
    } else {
        state.myFoods.push({ name: trimmed, time: seconds });
    }

    saveTimers();
    renderFoods('myfoods');
    showToast(`已添加食材: ${trimmed} (${formatTime(seconds)})`);
    return true;
}

function removeMyFood(name) {
    state.myFoods = state.myFoods.filter(f => f.name !== name);
    saveTimers();
    renderFoods('myfoods');
    showToast(`已移除: ${name}`);
}

// 更新"我的食材"面板的时长选中态
function updateCustomTimeChips() {
    elements.customTimeChips.querySelectorAll('.time-chip').forEach(chip => {
        chip.classList.toggle('active', parseInt(chip.dataset.time) === state.selectedCustomTime);
    });
}

function setupMyFoodsPanel() {
    // 时长选择 chips
    elements.customTimeChips.addEventListener('click', (e) => {
        const chip = e.target.closest('.time-chip');
        if (!chip) return;
        state.selectedCustomTime = parseInt(chip.dataset.time);
        updateCustomTimeChips();
    });

    // 添加按钮
    elements.addCustomFoodBtn.addEventListener('click', () => {
        const name = elements.customFoodNameInput.value;
        if (addMyFood(name, state.selectedCustomTime)) {
            elements.customFoodNameInput.value = '';
        }
    });

    // 回车快捷添加
    elements.customFoodNameInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            elements.addCustomFoodBtn.click();
        }
    });
}

// 获取食材的下一个显示名称（带序号，如 "毛肚x2"）
function nextFoodDisplayName(baseName) {
    const newCount = (state.foodAddCounts[baseName] || 0) + 1;
    state.foodAddCounts[baseName] = newCount;
    return newCount > 1 ? `${baseName}x${newCount}` : baseName;
}

// 选择食材（自动开始计时）
function selectFood(food) {
    const displayName = nextFoodDisplayName(food.name);

    // 添加新计时器并自动开始
    const timer = createTimerObject({
        baseName: food.name,
        name: displayName,
        time: food.time,
        desc: food.desc || ''
    });

    state.timers.push(timer);
    renderTimers();
    renderFoods(state.currentCategory);
    saveTimers();

    // 自动开始计时
    startSingleTimer(timer.id);

    showToast(`已添加: ${displayName} (${formatTime(food.time)})`);
}

// 格式化时间显示
function formatTime(seconds) {
    if (seconds < 60) {
        return `${seconds}秒`;
    } else {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}分${secs}秒`;
    }
}

// 快捷时长选择（弹出页面内弹层输入食材名，替代系统 prompt）
function selectQuickTime(seconds) {
    // 默认值显示为"自定义食材X"，并先递增计数器
    const defaultName = `自定义食材${state.customFoodCounter}`;
    state.customFoodCounter++;

    openQuickNameDialog(defaultName, seconds);
}

// 打开快速计时名称输入弹层
function openQuickNameDialog(defaultName, seconds) {
    elements.quickNameHint.innerHTML = `时长 <span>${formatTime(seconds)}</span> · 留空将使用「${escapeHtml(defaultName)}」`;
    elements.quickNameInput.value = defaultName;
    elements.quickNameOverlay.hidden = false;
    // 下一帧再加 open 类，保证过渡动画播放
    requestAnimationFrame(() => {
        elements.quickNameOverlay.classList.add('open');
        elements.quickNameInput.focus();
        elements.quickNameInput.select();
    });

    elements.quickNameConfirm.onclick = () => {
        const name = elements.quickNameInput.value;
        closeQuickNameDialog();
        // 用户留空则使用默认编号名称；输入其他名称则按原样添加
        addCustomFoodTimer(name.trim() || defaultName, seconds);
    };

    elements.quickNameCancel.onclick = () => {
        closeQuickNameDialog();
        showToast('已取消');
    };

    elements.quickNameInput.onkeydown = (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            elements.quickNameConfirm.click();
        } else if (e.key === 'Escape') {
            e.preventDefault();
            elements.quickNameCancel.click();
        }
    };
}

// 关闭快速计时名称输入弹层
function closeQuickNameDialog() {
    elements.quickNameOverlay.classList.remove('open');
    elements.quickNameInput.onkeydown = null;
    // 等淡出动画结束后再隐藏
    setTimeout(() => {
        if (!elements.quickNameOverlay.classList.contains('open')) {
            elements.quickNameOverlay.hidden = true;
        }
    }, 220);
}

// 创建计时器对象（基于时间戳的剩余时间模型）
function createTimerObject(food) {
    return {
        id: state.nextTimerId++,
        food,
        remainingTime: food.time,
        totalTime: food.time,
        isRunning: false,
        endAt: null,       // 运行中的目标结束时间戳（ms）
        timer: null        // 刷新用的 interval id
    };
}

// 添加自定义食材计时器（通用函数）
function addCustomFoodTimer(name, seconds) {
    // 检查是否已存在同名且时长相等的计时器（必须在删除同名旧计时器之前判断，
    // 否则刚删掉的那个永远匹配不到，"切换状态"逻辑形同虚设）
    const existingTimer = state.timers.find(t => t.food.name === name && t.totalTime === seconds);
    if (existingTimer) {
        // 如果已存在，切换状态
        if (existingTimer.isRunning) {
            pauseSingleTimer(existingTimer.id);
        } else if (existingTimer.remainingTime <= 0) {
            resetTimer(existingTimer.id);
        } else {
            startSingleTimer(existingTimer.id);
        }
        saveTimers();
        return;
    }

    // 移除同名的其他计时器（基于baseName，先收集再删除，避免遍历中改数组）
    const toRemove = state.timers.filter(t => t.food.baseName === name).map(t => t.id);
    toRemove.forEach(id => removeTimer(id, true));

    const displayName = nextFoodDisplayName(name);

    // 生成带时长的备注
    const timeDesc = seconds < 60 ? `${seconds}秒` : `${Math.floor(seconds / 60)}分钟`;
    const quickFood = {
        baseName: name,
        name: displayName,
        time: seconds,
        desc: `自定义时长${timeDesc}`,
        custom: true
    };

    const timer = createTimerObject(quickFood);

    state.timers.push(timer);
    renderTimers();
    renderFoods(state.currentCategory);
    saveTimers();

    // 自动开始计时
    startSingleTimer(timer.id);

    showToast(`已添加: ${displayName} (${formatTime(seconds)})`);
}

// 显示提示（队列化：多条提示依次展示，后一条不会覆盖前一条）
let toastQueue = [];
let toastShowing = false;

function showToast(message) {
    toastQueue.push(message);
    if (!toastShowing) {
        processToastQueue();
    }
}

function processToastQueue() {
    const message = toastQueue.shift();
    if (message === undefined) {
        toastShowing = false;
        return;
    }

    toastShowing = true;
    elements.toast.textContent = message;
    elements.toast.classList.add('show');

    setTimeout(() => {
        elements.toast.classList.remove('show');
        // 稍等淡出动画后再显示下一条
        setTimeout(processToastQueue, 350);
    }, 2000);
}

// 复用同一个 AudioContext，避免反复创建导致超出浏览器上限（声音静默失效）
let sharedAudioContext = null;

// 首次用户手势时解锁音频（移动端自动播放策略要求 AudioContext 必须由交互激活）
function unlockAudio() {
    try {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (!sharedAudioContext) {
            sharedAudioContext = new AudioCtx();
        }
        if (sharedAudioContext.state === 'suspended') {
            sharedAudioContext.resume();
        }
    } catch (e) { /* 音频不可用时静默 */ }
}

// 播放提示音（一声）
function playNotificationSound() {
    try {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (!sharedAudioContext) {
            sharedAudioContext = new AudioCtx();
        }
        // 浏览器自动播放策略可能使上下文处于 suspended，需先恢复
        if (sharedAudioContext.state === 'suspended') {
            sharedAudioContext.resume();
        }

        const audioContext = sharedAudioContext;
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);

        oscillator.frequency.value = 800;
        oscillator.type = 'sine';

        gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);

        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + 0.5);
    } catch (e) {
        console.log('Audio not supported');
    }
}

// 设置事件监听器
function setupEventListeners() {
    // 全局控制按钮
    elements.pauseAllBtn.addEventListener('click', toggleAllTimers);
    elements.deleteAllBtn.addEventListener('click', deleteAllTimers);

    // 分类标签
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            switchCategory(btn.dataset.category);
        });
    });

    // 快捷时长按钮：直接输入名称并计时（常用一次性食材；固定食材建议加到"我的食材"）
    document.querySelectorAll('.quick-time-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            selectQuickTime(parseInt(btn.dataset.time));
        });
    });

    // 计时器卡片按钮统一用事件委托（卡片会频繁重建，避免每次重绑监听器）
    elements.timersContainer.addEventListener('click', (e) => {
        const toggleBtn = e.target.closest('.btn-toggle');
        if (toggleBtn) {
            const id = parseInt(toggleBtn.dataset.id);
            const timer = state.timers.find(t => t.id === id);
            if (!timer) return;
            if (timer.isRunning) {
                pauseSingleTimer(id);
            } else if (timer.remainingTime <= 0) {
                resetTimer(id);
            } else {
                startSingleTimer(id);
            }
            return;
        }

        const deleteBtn = e.target.closest('.btn-delete');
        if (deleteBtn) {
            removeTimer(parseInt(deleteBtn.dataset.id));
        }
    });

    // 首次交互解锁音频 + 请求通知权限（兜底提醒）
    document.addEventListener('pointerdown', () => {
        unlockAudio();
        requestNotificationPermission();
    }, { passive: true });

    // 点击弹层遮罩空白处 = 取消
    elements.quickNameOverlay.addEventListener('click', (e) => {
        if (e.target === elements.quickNameOverlay) {
            elements.quickNameCancel.click();
        }
    });
}



// 切换分类
function switchCategory(category) {
    state.currentCategory = category;

    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('active');
        if (btn.dataset.category === category) {
            btn.classList.add('active');
        }
    });

    // 添加面板只在"我的食材"页显示
    elements.myFoodsPanel.style.display = category === 'myfoods' ? 'block' : 'none';

    renderFoods(category);
}

document.addEventListener('DOMContentLoaded', init);
