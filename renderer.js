// 任务数据存储
const taskData = {
  dailyTasks: {},
  countdownTasks: [],
  repeatTasks: {
    weekly: [],
    monthly: [],
    yearly: []
  }
};

// DOM元素
const elements = {
  taskInput: document.getElementById('task-input'),
  addTaskBtn: document.getElementById('add-task'),
  invertSelectionBtn: document.getElementById('invert-selection'),
  deleteSelectedBtn: document.getElementById('delete-selected'),
  editSelectedBtn: document.getElementById('edit-selected'),
  upcomingTask: document.getElementById('upcoming-task'),
  countdownTaskList: document.getElementById('countdown-task-list'),
  dailyTaskList: document.getElementById('daily-task-list'),
  todayRepeatTaskList: document.getElementById('today-repeat-task-list'),
  weeklyTaskList: document.getElementById('weekly-task-list'),
  monthlyTaskList: document.getElementById('monthly-task-list'),
  yearlyTaskList: document.getElementById('yearly-task-list')
};

// 工具函数
function formatDate(date) {
  return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`;
}

function formatTime(date) {
  return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
}

function getDayOfWeek(date) {
  const days = ['日', '一', '二', '三', '四', '五', '六'];
  return days[date.getDay()];
}

function formatDateKey(date) {
  return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
}

// 替换原有的parseTaskInput函数为新的智能解析函数
function parseTaskInput(input) {
  // 分割多个任务（如果有多个任务用逗号、分号或换行分隔）
  const taskSegments = input.split(/[,;，；\n]+/).filter(segment => segment.trim().length > 0);
  
  // 解析结果存储
  const results = {
    success: [], // 成功解析的任务
    failed: []   // 解析失败的任务
  };
  
  // 处理每个任务片段
  taskSegments.forEach(taskSegment => {
    const result = parseTaskSegment(taskSegment.trim());
    if (result.success) {
      results.success.push(result.task);
    } else {
      results.failed.push({
        text: taskSegment,
        error: result.error
      });
    }
  });
  
  return results;
}

// 解析单个任务片段
function parseTaskSegment(text) {
  try {
    // 提取任务内容（默认为整个文本，后续会根据解析结果修改）
    let taskContent = text;
    
    // 任务类型判断
    let isRepeat = false;
    let repeatType = null;
    let isCountdown = false;
    
    // 时间相关变量
    let startDate = new Date();
    let endDate = null;
    let duration = 0; // 持续时间（分钟）
    
    // 1. 先检查是否是倒计时任务
    const countdownIndicators = [
      /倒计时/, /countdown/i, /\d+\s*(秒|分钟|小时|天)后/, /\d+\s*(s|m|h|d)后/,
      /还剩\s*\d+/, /截止/, /deadline/i, /期限/, /现在开始/, /立即/, /即刻/
    ];
    
    isCountdown = countdownIndicators.some(pattern => pattern.test(text));
    
    // 2. 检查是否是重复任务
    const repeatIndicators = {
      day: [/每天/, /每日/, /daily/i, /工作日每天/, /周一至周五每天/],
      week: [/每周/, /每星期/, /weekly/i, /下周/, /next week/i],
      month: [/每月/, /每个月/, /monthly/i],
      year: [/每年/, /yearly/i, /年度/]
    };
    
    for (const [type, patterns] of Object.entries(repeatIndicators)) {
      if (patterns.some(pattern => pattern.test(text))) {
        isRepeat = true;
        repeatType = type;
        break;
      }
    }
    
    // 3. 解析时间表达式
    // 3.1 提取绝对时间点（如"上午9点"、"下午3:15"等）
    let absoluteTimeMatch = text.match(/([上下午晚早])\s*(\d{1,2})[:：]?(\d{0,2})/);
    if (absoluteTimeMatch) {
      const [_, period, hour, minute] = absoluteTimeMatch;
      let hours = parseInt(hour, 10);
      const minutes = minute ? parseInt(minute, 10) : 0;
      
      // 调整时间（上午/下午/晚上）
      if ((period === '下' || period === '晚') && hours < 12) {
        hours += 12;
      } else if (period === '上' || period === '早') {
        if (hours === 12) hours = 0;
      }
      
      startDate.setHours(hours, minutes, 0, 0);
      taskContent = taskContent.replace(absoluteTimeMatch[0], '');
    }
    
    // 3.2 提取精确时间格式（如"19:55"、"3:30"等）
    let exactTimeMatch = text.match(/(\d{1,2})[:：](\d{1,2})(?:\s*[至\-\~到]?\s*(\d{1,2})[:：](\d{1,2}))?/);
    if (exactTimeMatch) {
      const [_, startHour, startMinute, endHour, endMinute] = exactTimeMatch;
      let hours = parseInt(startHour, 10);
      
      // 自动调整上下午（简单规则：如果小于等于12且没有明确指定上下午，当前时间之后的认为是当天，否则是明天）
      if (hours <= 12 && !absoluteTimeMatch) {
        const now = new Date();
        const todayWithTime = new Date();
        todayWithTime.setHours(hours, parseInt(startMinute, 10), 0, 0);
        
        if (todayWithTime < now) {
          // 如果设置的时间已经过了今天的这个时间点，就认为是明天
          startDate.setDate(startDate.getDate() + 1);
        }
      }
      
      startDate.setHours(hours, parseInt(startMinute, 10), 0, 0);
      
      // 如果有结束时间
      if (endHour && endMinute) {
        let endHours = parseInt(endHour, 10);
        // 处理跨天情况（如果结束时间小于开始时间，认为是第二天）
        endDate = new Date(startDate);
        if (endHours < hours) {
          endDate.setDate(endDate.getDate() + 1);
        }
        endDate.setHours(endHours, parseInt(endMinute, 10), 0, 0);
        
        // 计算任务持续时间（分钟）
        duration = Math.floor((endDate - startDate) / (1000 * 60));
      }
      
      taskContent = taskContent.replace(exactTimeMatch[0], '');
    }
    
    // 3.3 提取相对时间（如"3小时后"、"30分钟后"等）
    let relativeTimeMatch = text.match(/(\d+)\s*(秒钟?|分钟?|小时|钟头|天|周|月|刻钟|s|m|h|d|min)/);
    if (relativeTimeMatch) {
      const [_, amount, unit] = relativeTimeMatch;
      const numAmount = parseInt(amount, 10);
      
      // 将相对时间转换为毫秒
      let msToAdd = 0;
      if (unit.includes('秒') || unit === 's') {
        msToAdd = numAmount * 1000;
      } else if (unit.includes('分') || unit === 'm' || unit === 'min') {
        msToAdd = numAmount * 60 * 1000;
      } else if (unit.includes('小时') || unit.includes('钟头') || unit === 'h') {
        msToAdd = numAmount * 60 * 60 * 1000;
      } else if (unit.includes('天') || unit === 'd') {
        msToAdd = numAmount * 24 * 60 * 60 * 1000;
      } else if (unit.includes('周')) {
        msToAdd = numAmount * 7 * 24 * 60 * 60 * 1000;
      } else if (unit.includes('月')) {
        // 简化处理，一个月按30天计算
        msToAdd = numAmount * 30 * 24 * 60 * 60 * 1000;
      } else if (unit.includes('刻钟')) {
        // 一刻钟为15分钟
        msToAdd = numAmount * 15 * 60 * 1000;
      }
      
      // 更新开始时间
      startDate = new Date(startDate.getTime() + msToAdd);
      taskContent = taskContent.replace(relativeTimeMatch[0], '');
      
      // 对于"xx后开始xx分钟"的形式
      let durationMatch = text.match(/开始\s*(\d+)\s*(分钟?|小时|钟头|min|h)/);
      if (durationMatch) {
        const [_, durationAmount, durationUnit] = durationMatch;
        const numDuration = parseInt(durationAmount, 10);
        
        if (durationUnit.includes('分') || durationUnit === 'min') {
          duration = numDuration;
        } else if (durationUnit.includes('小时') || durationUnit.includes('钟头') || durationUnit === 'h') {
          duration = numDuration * 60;
        }
        
        endDate = new Date(startDate.getTime() + duration * 60 * 1000);
        taskContent = taskContent.replace(durationMatch[0], '');
      }
    }
    
    // 3.4 处理特殊日期（如"明天"、"下周一"等）
    let specialDateMatch = text.match(/(今天|明天|后天|下周[一二三四五六日天]|下下周[一二三四五六日天])/);
    if (specialDateMatch) {
      const dateExpr = specialDateMatch[1];
      
      if (dateExpr === '今天') {
        // 今天不需要调整日期
      } else if (dateExpr === '明天') {
        startDate.setDate(startDate.getDate() + 1);
      } else if (dateExpr === '后天') {
        startDate.setDate(startDate.getDate() + 2);
      } else if (dateExpr.startsWith('下周')) {
        // 当前天数
        const today = startDate.getDay(); // 0-6，0是周日
        const targetDay = getWeekdayNumber(dateExpr.substring(2));
        let daysToAdd = targetDay - today;
        if (daysToAdd <= 0) daysToAdd += 7; // 确保是下周
        startDate.setDate(startDate.getDate() + daysToAdd + 7);
      } else if (dateExpr.startsWith('下下周')) {
        const today = startDate.getDay();
        const targetDay = getWeekdayNumber(dateExpr.substring(4));
        let daysToAdd = targetDay - today;
        if (daysToAdd <= 0) daysToAdd += 7;
        startDate.setDate(startDate.getDate() + daysToAdd + 14); // 下下周是当前日期+2周+调整天数
      }
      
      taskContent = taskContent.replace(specialDateMatch[0], '');
    }
    
    // 如果有持续时间但没有结束时间，计算结束时间
    if (duration > 0 && !endDate) {
      endDate = new Date(startDate.getTime() + duration * 60 * 1000);
    }
    
    // 清理任务内容（去除解析后剩余的时间相关词汇）
    taskContent = taskContent
      .replace(/倒计时|countdown|截止|deadline|期限|后开始|立即开始|立刻开始|现在开始|即刻开始/gi, '')
      .replace(/每[天日周月年]|daily|weekly|monthly|yearly/gi, '')
      .replace(/(上午|下午|晚上|早上|早晨)/g, '')
      .trim();
    
    // 整理结果
    const task = {
      content: taskContent,
      date: startDate,
      endDate: endDate,
      isRepeat: isRepeat,
      repeatType: repeatType,
      isCountdown: isCountdown,
      tags: []
    };
    
    return {
      success: true,
      task: task
    };
  } catch (error) {
    return {
      success: false,
      error: '无法解析任务：' + error.message,
      text: text
    };
  }
}

// 辅助函数：获取星期几对应的数字（0-6，0代表周日）
function getWeekdayNumber(weekday) {
  const weekdayMap = {
    '日': 0, '天': 0, '一': 1, '二': 2, '三': 3, '四': 4, '五': 5, '六': 6,
    'sun': 0, 'mon': 1, 'tue': 2, 'wed': 3, 'thu': 4, 'fri': 5, 'sat': 6
  };
  return weekdayMap[weekday.toLowerCase()] || 0;
}

// 修改createTask函数，处理新的解析结果结构
function createTask(parseResults) {
  // 检查是否有解析失败的项
  if (parseResults.failed && parseResults.failed.length > 0) {
    showParseErrors(parseResults.failed);
    return false; // 有错误项，返回失败
  }
  
  // 创建每个成功解析的任务
  parseResults.success.forEach(taskInfo => {
    addTaskToSystem(taskInfo);
  });
  
  // 保存数据并更新界面
  saveTaskData();
  renderAllTasks();
  updateUpcomingTask();
  return true; // 返回成功
}

// 显示解析错误
function showParseErrors(failedItems) {
  let errorMessage = '以下任务解析失败：\n\n';
  failedItems.forEach(item => {
    errorMessage += `• "${item.text}": ${item.error}\n`;
  });
  alert(errorMessage);
}

// 新增函数：将任务添加到系统
function addTaskToSystem(taskInfo) {
  const { content, date, endDate, isRepeat, repeatType, isCountdown, tags } = taskInfo;
  const now = new Date();
  
  // 创建任务对象
  const task = {
    id: Date.now().toString() + Math.floor(Math.random() * 1000),
    content,
    date,
    endDate,
    createDate: now,
    completed: false,
    tags: tags || []
  };
  
  // 根据任务类型进行归档
  if (isRepeat) {
    // 重复任务
    switch (repeatType) {
      case 'day':
        // 每日重复任务
        taskData.repeatTasks.daily = taskData.repeatTasks.daily || [];
        taskData.repeatTasks.daily.push({...task, repeatType: 'day'});
        break;
      case 'week':
        // 每周重复任务
        taskData.repeatTasks.weekly.push({...task, repeatType: 'week', weekDay: date.getDay()});
        break;
      case 'month':
        // 每月重复任务
        taskData.repeatTasks.monthly.push({...task, repeatType: 'month', monthDay: date.getDate()});
        break;
      case 'year':
        // 每年重复任务
        taskData.repeatTasks.yearly.push({
          ...task, 
          repeatType: 'year', 
          yearMonth: date.getMonth(), 
          yearDay: date.getDate()
        });
        break;
    }
  } else if (isCountdown || (date > now && !endDate)) {
    // 倒计时任务（明确指定为倒计时或者是将来的单点时间任务）
    taskData.countdownTasks.push(task);
  } else {
    // 每日任务（非倒计时且可能有持续时间）
    const dateKey = formatDateKey(date);
    const yearKey = date.getFullYear().toString();
    const monthKey = `${date.getFullYear()}-${date.getMonth() + 1}`;
    
    // 初始化年月日的嵌套结构（如果不存在）
    if (!taskData.dailyTasks[yearKey]) {
      taskData.dailyTasks[yearKey] = {};
    }
    
    if (!taskData.dailyTasks[yearKey][monthKey]) {
      taskData.dailyTasks[yearKey][monthKey] = {};
    }
    
    if (!taskData.dailyTasks[yearKey][monthKey][dateKey]) {
      taskData.dailyTasks[yearKey][monthKey][dateKey] = [];
    }
    
    // 带有持续时间的任务
    if (endDate) {
      task.duration = Math.floor((endDate - date) / (1000 * 60)); // 持续时间（分钟）
    }
    
    // 添加任务到对应日期
    taskData.dailyTasks[yearKey][monthKey][dateKey].push(task);
  }
}

// 渲染所有任务
function renderAllTasks() {
  renderCountdownTasks();
  renderDailyTasks();
  renderRepeatTasks();
}

// 渲染倒计时任务
function renderCountdownTasks() {
  elements.countdownTaskList.innerHTML = '';
  
  // 按照时间排序
  const sortedTasks = [...taskData.countdownTasks].sort((a, b) => a.date - b.date);
  
  sortedTasks.forEach(task => {
    const now = new Date();
    const timeDiff = task.date - now;
    const days = Math.floor(timeDiff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((timeDiff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((timeDiff % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((timeDiff % (1000 * 60)) / 1000);
    
    // 调整倒计时显示格式，根据剩余时间的长短显示不同精度
    let countdownText = '';
    if (days > 0) {
      countdownText = `${days}天${hours}小时`;
    } else if (hours > 0) {
      countdownText = `${hours}小时${minutes}分钟`;
    } else if (minutes > 0) {
      countdownText = `${minutes}分钟${seconds}秒`;
    } else {
      countdownText = `${seconds}秒`;
    }
    
    const taskDate = formatDate(task.date);
    const taskTime = formatTime(task.date);
    
    const taskElement = document.createElement('div');
    taskElement.classList.add('task-item');
    taskElement.dataset.id = task.id;
    taskElement.innerHTML = `
      <div class="task-time">
        <div>${taskDate}</div>
        <div>${taskTime}</div>
        <div>剩余: ${countdownText}</div>
      </div>
      <div class="task-content">${task.content}</div>
      <input type="checkbox" class="task-checkbox" data-id="${task.id}">
    `;
    
    elements.countdownTaskList.appendChild(taskElement);
  });
}

// 渲染每日任务
function renderDailyTasks() {
  elements.dailyTaskList.innerHTML = '';
  
  // 遍历年
  Object.keys(taskData.dailyTasks).sort().forEach(yearKey => {
    const yearContainer = document.createElement('div');
    yearContainer.classList.add('year-container');
    yearContainer.dataset.year = yearKey;
    
    // 创建年标签
    const yearHeader = document.createElement('div');
    yearHeader.classList.add('year-header');
    yearHeader.innerHTML = `
      <div>
        <span class="collapse-icon">▼</span>
        ${yearKey}年
      </div>
      <input type="checkbox" class="year-checkbox" data-year="${yearKey}">
    `;
    
    // 点击年标签收起/展开
    yearHeader.querySelector('.collapse-icon').addEventListener('click', () => {
      yearContainer.classList.toggle('collapsed');
    });
    
    yearContainer.appendChild(yearHeader);
    
    // 创建年任务容器
    const yearTasksContainer = document.createElement('div');
    yearTasksContainer.classList.add('year-tasks');
    yearContainer.appendChild(yearTasksContainer);
    
    // 遍历月
    Object.keys(taskData.dailyTasks[yearKey]).sort().forEach(monthKey => {
      const [year, month] = monthKey.split('-');
      
      const monthContainer = document.createElement('div');
      monthContainer.classList.add('month-container');
      monthContainer.dataset.month = monthKey;
      
      // 创建月标签
      const monthHeader = document.createElement('div');
      monthHeader.classList.add('month-header');
      monthHeader.innerHTML = `
        <div>
          <span class="collapse-icon">▼</span>
          ${month}月
        </div>
        <input type="checkbox" class="month-checkbox" data-month="${monthKey}">
      `;
      
      // 点击月标签收起/展开
      monthHeader.querySelector('.collapse-icon').addEventListener('click', () => {
        monthContainer.classList.toggle('collapsed');
      });
      
      monthContainer.appendChild(monthHeader);
      
      // 创建月任务容器
      const monthTasksContainer = document.createElement('div');
      monthTasksContainer.classList.add('month-tasks');
      monthContainer.appendChild(monthTasksContainer);
      
      // 遍历日
      Object.keys(taskData.dailyTasks[yearKey][monthKey]).sort().forEach(dateKey => {
        const date = new Date(dateKey.replace(/-/g, '/'));
        const dayOfWeek = getDayOfWeek(date);
        
        const dayContainer = document.createElement('div');
        dayContainer.classList.add('day-container');
        dayContainer.dataset.date = dateKey;
        
        // 创建日标签
        const dayHeader = document.createElement('div');
        dayHeader.classList.add('day-header');
        dayHeader.innerHTML = `
          <div>
            <span class="collapse-icon">▼</span>
            ${date.getDate()}日 星期${dayOfWeek}
          </div>
          <input type="checkbox" class="day-checkbox" data-date="${dateKey}">
        `;
        
        // 点击日标签收起/展开
        dayHeader.querySelector('.collapse-icon').addEventListener('click', () => {
          dayContainer.classList.toggle('collapsed');
        });
        
        dayContainer.appendChild(dayHeader);
        
        // 创建日任务容器
        const dayTasksContainer = document.createElement('div');
        dayTasksContainer.classList.add('day-tasks');
        dayContainer.appendChild(dayTasksContainer);
        
        // 遍历日任务
        taskData.dailyTasks[yearKey][monthKey][dateKey].forEach(task => {
          const taskElement = document.createElement('div');
          taskElement.classList.add('task-item');
          if (task.completed) {
            taskElement.classList.add('completed');
          }
          
          // 检查是否是最近的任务
          const now = new Date();
          const taskDate = new Date(task.date);
          if (taskDate >= now && (taskDate - now) < 24 * 60 * 60 * 1000) {
            taskElement.classList.add('nearest');
          }
          
          taskElement.dataset.id = task.id;
          
          // 显示时间，如果有持续时间则显示时间段
          let timeDisplay = '';
          if (task.endDate) {
            const endTime = formatTime(task.endDate);
            timeDisplay = `${formatTime(task.date)} - ${endTime}`;
          } else {
            timeDisplay = formatTime(task.date);
          }
          
          taskElement.innerHTML = `
            <div class="task-time">${timeDisplay}</div>
            <div class="task-content">${task.content}</div>
            <input type="checkbox" class="task-checkbox" data-id="${task.id}">
          `;
          
          // 点击任务标记为完成
          taskElement.addEventListener('click', (e) => {
            if (!e.target.classList.contains('task-checkbox')) {
              toggleTaskCompletion(task.id);
            }
          });
          
          dayTasksContainer.appendChild(taskElement);
        });
        
        monthTasksContainer.appendChild(dayContainer);
      });
      
      yearTasksContainer.appendChild(monthContainer);
    });
    
    elements.dailyTaskList.appendChild(yearContainer);
  });
}

// 渲染重复任务
function renderRepeatTasks() {
  // 清空容器
  elements.todayRepeatTaskList.innerHTML = '';
  elements.weeklyTaskList.innerHTML = '';
  elements.monthlyTaskList.innerHTML = '';
  elements.yearlyTaskList.innerHTML = '';
  
  const now = new Date();
  const todayWeekDay = now.getDay();
  const todayMonthDay = now.getDate();
  const todayYearMonth = now.getMonth();
  const todayYearDay = now.getDate();
  
  // 渲染今日重复任务
  // 每周重复任务
  taskData.repeatTasks.weekly.forEach(task => {
    if (task.weekDay === todayWeekDay) {
      renderTodayRepeatTask(task, '周');
    }
    renderWeeklyTask(task);
  });
  
  // 每月重复任务
  taskData.repeatTasks.monthly.forEach(task => {
    if (task.monthDay === todayMonthDay) {
      renderTodayRepeatTask(task, '月');
    }
    renderMonthlyTask(task);
  });
  
  // 每年重复任务
  taskData.repeatTasks.yearly.forEach(task => {
    if (task.yearMonth === todayYearMonth && task.yearDay === todayYearDay) {
      renderTodayRepeatTask(task, '年');
    }
    renderYearlyTask(task);
  });
  
  // 如果有每日重复任务
  if (taskData.repeatTasks.daily) {
    taskData.repeatTasks.daily.forEach(task => {
      renderTodayRepeatTask(task, '日');
    });
  }
}

// 渲染今日重复任务
function renderTodayRepeatTask(task, type) {
  const taskElement = document.createElement('div');
  taskElement.classList.add('task-item');
  if (task.completed) {
    taskElement.classList.add('completed');
  }
  
  taskElement.dataset.id = task.id;
  taskElement.innerHTML = `
    <div class="task-time">${formatTime(task.date)}</div>
    <div class="task-content">
      ${task.content}
      <span class="repeat-indicator">${type}</span>
    </div>
    <input type="checkbox" class="task-checkbox" data-id="${task.id}">
  `;
  
  // 点击任务标记为完成
  taskElement.addEventListener('click', (e) => {
    if (!e.target.classList.contains('task-checkbox')) {
      toggleTaskCompletion(task.id);
    }
  });
  
  elements.todayRepeatTaskList.appendChild(taskElement);
}

// 渲染每周重复任务
function renderWeeklyTask(task) {
  const dayNames = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
  const taskElement = document.createElement('div');
  taskElement.classList.add('task-item');
  
  taskElement.dataset.id = task.id;
  taskElement.innerHTML = `
    <div class="task-time">${formatTime(task.date)}</div>
    <div class="task-content">
      ${task.content} (${dayNames[task.weekDay]})
    </div>
    <input type="checkbox" class="task-checkbox" data-id="${task.id}">
  `;
  
  elements.weeklyTaskList.appendChild(taskElement);
}

// 渲染每月重复任务
function renderMonthlyTask(task) {
  const taskElement = document.createElement('div');
  taskElement.classList.add('task-item');
  
  taskElement.dataset.id = task.id;
  taskElement.innerHTML = `
    <div class="task-time">${formatTime(task.date)}</div>
    <div class="task-content">
      ${task.content} (每月${task.monthDay}日)
    </div>
    <input type="checkbox" class="task-checkbox" data-id="${task.id}">
  `;
  
  elements.monthlyTaskList.appendChild(taskElement);
}

// 渲染每年重复任务
function renderYearlyTask(task) {
  const taskElement = document.createElement('div');
  taskElement.classList.add('task-item');
  
  taskElement.dataset.id = task.id;
  taskElement.innerHTML = `
    <div class="task-time">${formatTime(task.date)}</div>
    <div class="task-content">
      ${task.content} (每年${task.yearMonth + 1}月${task.yearDay}日)
    </div>
    <input type="checkbox" class="task-checkbox" data-id="${task.id}">
  `;
  
  elements.yearlyTaskList.appendChild(taskElement);
}

// 标记任务完成状态切换
function toggleTaskCompletion(taskId) {
  const now = new Date(); // 记录当前时间，用于记录完成时间
  
  // 在每日任务中查找
  let found = false;
  Object.keys(taskData.dailyTasks).forEach(yearKey => {
    Object.keys(taskData.dailyTasks[yearKey]).forEach(monthKey => {
      Object.keys(taskData.dailyTasks[yearKey][monthKey]).forEach(dateKey => {
        const taskIndex = taskData.dailyTasks[yearKey][monthKey][dateKey].findIndex(task => task.id === taskId);
        if (taskIndex !== -1) {
          // 切换完成状态
          const newState = !taskData.dailyTasks[yearKey][monthKey][dateKey][taskIndex].completed;
          taskData.dailyTasks[yearKey][monthKey][dateKey][taskIndex].completed = newState;
          
          // 记录完成时间或清除完成时间
          if (newState) {
            taskData.dailyTasks[yearKey][monthKey][dateKey][taskIndex].completedDate = now;
          } else {
            taskData.dailyTasks[yearKey][monthKey][dateKey][taskIndex].completedDate = null;
          }
          
          found = true;
        }
      });
    });
  });
  
  // 在重复任务中查找
  if (!found) {
    // 查找每周重复任务
    const weeklyIndex = taskData.repeatTasks.weekly.findIndex(task => task.id === taskId);
    if (weeklyIndex !== -1) {
      // 切换完成状态
      const newState = !taskData.repeatTasks.weekly[weeklyIndex].completed;
      taskData.repeatTasks.weekly[weeklyIndex].completed = newState;
      
      // 记录或清除完成时间
      if (newState) {
        taskData.repeatTasks.weekly[weeklyIndex].lastCompletedDate = now;
      } else {
        taskData.repeatTasks.weekly[weeklyIndex].lastCompletedDate = null;
      }
      
      found = true;
    }
    
    // 查找每月重复任务
    if (!found) {
      const monthlyIndex = taskData.repeatTasks.monthly.findIndex(task => task.id === taskId);
      if (monthlyIndex !== -1) {
        // 切换完成状态
        const newState = !taskData.repeatTasks.monthly[monthlyIndex].completed;
        taskData.repeatTasks.monthly[monthlyIndex].completed = newState;
        
        // 记录或清除完成时间
        if (newState) {
          taskData.repeatTasks.monthly[monthlyIndex].lastCompletedDate = now;
        } else {
          taskData.repeatTasks.monthly[monthlyIndex].lastCompletedDate = null;
        }
        
        found = true;
      }
    }
    
    // 查找每年重复任务
    if (!found) {
      const yearlyIndex = taskData.repeatTasks.yearly.findIndex(task => task.id === taskId);
      if (yearlyIndex !== -1) {
        // 切换完成状态
        const newState = !taskData.repeatTasks.yearly[yearlyIndex].completed;
        taskData.repeatTasks.yearly[yearlyIndex].completed = newState;
        
        // 记录或清除完成时间
        if (newState) {
          taskData.repeatTasks.yearly[yearlyIndex].lastCompletedDate = now;
        } else {
          taskData.repeatTasks.yearly[yearlyIndex].lastCompletedDate = null;
        }
        
        found = true;
      }
    }
    
    // 查找每日重复任务
    if (!found && taskData.repeatTasks.daily) {
      const dailyIndex = taskData.repeatTasks.daily.findIndex(task => task.id === taskId);
      if (dailyIndex !== -1) {
        // 切换完成状态
        const newState = !taskData.repeatTasks.daily[dailyIndex].completed;
        taskData.repeatTasks.daily[dailyIndex].completed = newState;
        
        // 记录或清除完成时间
        if (newState) {
          taskData.repeatTasks.daily[dailyIndex].lastCompletedDate = now;
        } else {
          taskData.repeatTasks.daily[dailyIndex].lastCompletedDate = null;
        }
      }
    }
  }
  
  // 保存数据并重新渲染
  saveTaskData();
  renderAllTasks();
}

// 更新临近任务显示
function updateUpcomingTask() {
  const now = new Date();
  let closestTask = null;
  let minTimeDiff = Infinity;
  let taskType = '';
  
  // 检查所有倒计时任务
  taskData.countdownTasks.forEach(task => {
    const timeDiff = task.date - now;
    if (timeDiff > 0 && timeDiff < minTimeDiff) {
      minTimeDiff = timeDiff;
      closestTask = task;
      taskType = '倒计时任务';
    }
  });
  
  // 检查所有每日任务
  Object.keys(taskData.dailyTasks).forEach(yearKey => {
    Object.keys(taskData.dailyTasks[yearKey]).forEach(monthKey => {
      Object.keys(taskData.dailyTasks[yearKey][monthKey]).forEach(dateKey => {
        taskData.dailyTasks[yearKey][monthKey][dateKey].forEach(task => {
          if (!task.completed) {
            const timeDiff = task.date - now;
            if (timeDiff > 0 && timeDiff < minTimeDiff) {
              minTimeDiff = timeDiff;
              closestTask = task;
              taskType = '每日任务';
            }
          }
        });
      });
    });
  });
  
  // 检查所有重复任务
  // 每日重复任务
  if (taskData.repeatTasks.daily) {
    taskData.repeatTasks.daily.forEach(task => {
      if (!task.completed) {
        // 根据今天的日期和任务的时间计算下一次执行时间
        const nextTime = new Date(now);
        nextTime.setHours(task.date.getHours(), task.date.getMinutes(), 0, 0);
        if (nextTime < now) {  // 如果今天的该时间已过
          nextTime.setDate(nextTime.getDate() + 1);  // 设置为明天
        }
        
        const timeDiff = nextTime - now;
        if (timeDiff > 0 && timeDiff < minTimeDiff) {
          minTimeDiff = timeDiff;
          closestTask = { ...task, date: nextTime };
          taskType = '每日重复任务';
        }
      }
    });
  }
  
  // 每周重复任务
  taskData.repeatTasks.weekly.forEach(task => {
    if (!task.completed) {
      // 计算距离下一个该星期几的天数
      const today = now.getDay(); // 0-6
      const targetDay = task.weekDay; // 0-6
      let daysUntilTarget = (targetDay - today + 7) % 7;
      if (daysUntilTarget === 0) {
        // 如果今天就是目标日，检查时间是否已过
        const todayTargetTime = new Date(now);
        todayTargetTime.setHours(task.date.getHours(), task.date.getMinutes(), 0, 0);
        if (todayTargetTime > now) {
          daysUntilTarget = 0; // 今天的目标时间还没到
        } else {
          daysUntilTarget = 7; // 今天的目标时间已过，等到下周
        }
      }
      
      // 计算下次执行时间
      const nextTime = new Date(now);
      nextTime.setDate(nextTime.getDate() + daysUntilTarget);
      nextTime.setHours(task.date.getHours(), task.date.getMinutes(), 0, 0);
      
      const timeDiff = nextTime - now;
      if (timeDiff > 0 && timeDiff < minTimeDiff) {
        minTimeDiff = timeDiff;
        closestTask = { ...task, date: nextTime };
        taskType = '每周重复任务';
      }
    }
  });
  
  // 每月重复任务
  taskData.repeatTasks.monthly.forEach(task => {
    if (!task.completed) {
      // 计算下次执行时间
      const nextTime = new Date(now);
      nextTime.setDate(task.monthDay);
      nextTime.setHours(task.date.getHours(), task.date.getMinutes(), 0, 0);
      
      // 如果本月的日期已过，调整到下个月
      if (nextTime < now) {
        nextTime.setMonth(nextTime.getMonth() + 1);
      }
      
      const timeDiff = nextTime - now;
      if (timeDiff > 0 && timeDiff < minTimeDiff) {
        minTimeDiff = timeDiff;
        closestTask = { ...task, date: nextTime };
        taskType = '每月重复任务';
      }
    }
  });
  
  // 每年重复任务
  taskData.repeatTasks.yearly.forEach(task => {
    if (!task.completed) {
      // 计算下次执行时间
      const nextTime = new Date(now);
      nextTime.setMonth(task.yearMonth);
      nextTime.setDate(task.yearDay);
      nextTime.setHours(task.date.getHours(), task.date.getMinutes(), 0, 0);
      
      // 如果今年的日期已过，调整到明年
      if (nextTime < now) {
        nextTime.setFullYear(nextTime.getFullYear() + 1);
      }
      
      const timeDiff = nextTime - now;
      if (timeDiff > 0 && timeDiff < minTimeDiff) {
        minTimeDiff = timeDiff;
        closestTask = { ...task, date: nextTime };
        taskType = '每年重复任务';
      }
    }
  });
  
  // 更新界面显示
  if (closestTask) {
    // 格式化时间
    const taskDate = formatDate(closestTask.date);
    const taskTime = formatTime(closestTask.date);
    
    // 计算并格式化倒计时
    let countdownText = '';
    const days = Math.floor(minTimeDiff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((minTimeDiff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((minTimeDiff % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((minTimeDiff % (1000 * 60)) / 1000);
    
    if (days > 0) {
      countdownText = `${days}天${hours}小时后`;
    } else if (hours > 0) {
      countdownText = `${hours}小时${minutes}分钟后`;
    } else if (minutes > 0) {
      countdownText = `${minutes}分钟${seconds}秒后`;
    } else {
      countdownText = `${seconds}秒后`;
    }
    
    // 设置临近任务提示文本
    elements.upcomingTask.innerHTML = `
      <span class="upcoming-time">${taskTime}</span>
      <span class="upcoming-content">${closestTask.content}</span>
      <span class="upcoming-countdown">${countdownText}</span>
      <span class="upcoming-type">${taskType}</span>
    `;
    elements.upcomingTask.classList.add('has-task');
  } else {
    elements.upcomingTask.innerHTML = '临近任务: 无';
    elements.upcomingTask.classList.remove('has-task');
  }
}

// 保存任务数据到本地存储
function saveTaskData() {
  localStorage.setItem('taskData', JSON.stringify(taskData));
}

// 从本地存储加载任务数据
function loadTaskData() {
  const savedData = localStorage.getItem('taskData');
  if (savedData) {
    const parsedData = JSON.parse(savedData);
    
    // 将字符串日期转换为Date对象
    if (parsedData.countdownTasks) {
      parsedData.countdownTasks.forEach(task => {
        task.date = new Date(task.date);
        task.createDate = new Date(task.createDate);
      });
    }
    
    // 处理每日任务中的日期
    if (parsedData.dailyTasks) {
      Object.keys(parsedData.dailyTasks).forEach(yearKey => {
        Object.keys(parsedData.dailyTasks[yearKey]).forEach(monthKey => {
          Object.keys(parsedData.dailyTasks[yearKey][monthKey]).forEach(dateKey => {
            parsedData.dailyTasks[yearKey][monthKey][dateKey].forEach(task => {
              task.date = new Date(task.date);
              task.createDate = new Date(task.createDate);
            });
          });
        });
      });
    }
    
    // 处理重复任务中的日期
    ['weekly', 'monthly', 'yearly', 'daily'].forEach(repeatType => {
      if (parsedData.repeatTasks && parsedData.repeatTasks[repeatType]) {
        parsedData.repeatTasks[repeatType].forEach(task => {
          task.date = new Date(task.date);
          task.createDate = new Date(task.createDate);
        });
      }
    });
    
    Object.assign(taskData, parsedData);
  }
}

// 音乐播放功能
function playAlarmSound() {
  try {
    // 获取音频文件路径（优先使用用户指定的路径）
    const audioPath = window.electronAPI ? window.electronAPI.getAudioPath() : 'notification.mp3';
    
    // 创建音频元素
    const audio = new Audio(audioPath);
    audio.volume = 0.8;
    
    // 播放音频
    const playPromise = audio.play();
    
    // 处理播放可能的错误
    if (playPromise !== undefined) {
      playPromise.catch(error => {
        console.error('播放提示音失败，尝试使用系统提示音:', error);
        // 备用方案：使用浏览器内置提示音
        const systemAudio = new Audio("data:audio/wav;base64,UklGRl9vT19XQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YU");
        systemAudio.volume = 0.8;
        systemAudio.play();
      });
    }
  } catch (error) {
    console.error('播放提示音失败:', error);
  }
}

// 倒计时到期检查
function checkCountdownDeadlines() {
  const now = new Date();
  let tasksExpired = []; // 存储所有到期的任务
  
  // 检查倒计时任务
  taskData.countdownTasks = taskData.countdownTasks.filter(task => {
    const taskTime = new Date(task.date);
    // 如果任务已到期
    if (taskTime <= now) {
      tasksExpired.push(task); // 添加到到期任务列表
      return false; // 从列表中移除
    }
    return true;
  });
  
  // 如果有到期任务，播放声音并显示通知
  if (tasksExpired.length > 0) {
    // 播放提示音
    playAlarmSound();
    
    // 显示通知
    const notificationTitle = tasksExpired.length === 1 
      ? '倒计时任务到期' 
      : `${tasksExpired.length}个倒计时任务到期`;
    
    // 创建通知内容
    let notificationBody = '';
    if (tasksExpired.length === 1) {
      notificationBody = tasksExpired[0].content;
    } else {
      // 最多显示3个任务，剩余的用"等"表示
      const taskToShow = tasksExpired.slice(0, 3);
      notificationBody = taskToShow.map(task => task.content).join('、');
      if (tasksExpired.length > 3) {
        notificationBody += `等${tasksExpired.length}个任务`;
      }
    }
    
    // 显示系统通知
    try {
      // 检查通知权限
      if (Notification.permission === 'granted') {
        new Notification(notificationTitle, {
          body: notificationBody,
          icon: 'icon.png',
          silent: true // 不使用系统声音，我们自己控制声音
        });
      } else if (Notification.permission !== 'denied') {
        // 请求通知权限
        Notification.requestPermission().then(permission => {
          if (permission === 'granted') {
            new Notification(notificationTitle, {
              body: notificationBody,
              icon: 'icon.png',
              silent: true
            });
          }
        });
      }
    } catch (error) {
      console.error('无法显示系统通知:', error);
    }
    
    // 更新页面显示
    saveTaskData();
    renderAllTasks();
    updateUpcomingTask();
    
    // 在页面上显示临时提示
    showTemporaryAlert(notificationTitle, notificationBody);
  }
}

// 显示临时提示框
function showTemporaryAlert(title, message) {
  // 创建提示元素
  const alertDiv = document.createElement('div');
  alertDiv.classList.add('temp-alert');
  alertDiv.innerHTML = `
    <div class="temp-alert-title">${title}</div>
    <div class="temp-alert-message">${message}</div>
  `;
  
  // 添加到页面
  document.body.appendChild(alertDiv);
  
  // 添加动画类
  setTimeout(() => alertDiv.classList.add('show'), 10);
  
  // 设置自动关闭
  setTimeout(() => {
    alertDiv.classList.remove('show');
    setTimeout(() => alertDiv.remove(), 500); // 等待淡出动画完成后删除元素
  }, 5000);
}

// 重置重复任务完成状态
function resetRepeatTasks() {
  const now = new Date();
  const todayKey = formatDateKey(now);
  
  // 检查并重置每日重复任务
  if (taskData.repeatTasks.daily) {
    taskData.repeatTasks.daily.forEach(task => {
      // 如果任务已完成，检查是否需要重置
      if (task.completed) {
        // 获取上次完成日期，如果没有则设为初始日期
        const lastCompletedDate = task.lastCompletedDate ? new Date(task.lastCompletedDate) : new Date(0);
        const lastCompletedKey = formatDateKey(lastCompletedDate);
        
        // 如果上次完成不是今天，则重置状态
        if (lastCompletedKey !== todayKey) {
          task.completed = false;
          task.lastCompletedDate = null;
        }
      }
    });
  }
  
  // 检查并重置每周重复任务
  taskData.repeatTasks.weekly.forEach(task => {
    if (task.completed) {
      // 获取上次完成日期
      const lastCompletedDate = task.lastCompletedDate ? new Date(task.lastCompletedDate) : new Date(0);
      
      // 计算上次完成日期是哪一周
      const lastCompletedWeekStart = new Date(lastCompletedDate);
      const lastCompletedDayOfWeek = lastCompletedDate.getDay(); // 0-6 (周日-周六)
      // 设置为上周的周日
      lastCompletedWeekStart.setDate(lastCompletedDate.getDate() - lastCompletedDayOfWeek);
      
      // 计算当前是哪一周
      const currentWeekStart = new Date(now);
      const currentDayOfWeek = now.getDay();
      // 设置为本周的周日
      currentWeekStart.setDate(now.getDate() - currentDayOfWeek);
      
      // 如果上次完成的周与当前周不同，且今天是该任务设定的星期几，则重置状态
      if (formatDateKey(lastCompletedWeekStart) !== formatDateKey(currentWeekStart) && 
          now.getDay() === task.weekDay) {
        task.completed = false;
        task.lastCompletedDate = null;
      }
    }
  });
  
  // 检查并重置每月重复任务
  taskData.repeatTasks.monthly.forEach(task => {
    if (task.completed) {
      // 获取上次完成日期
      const lastCompletedDate = task.lastCompletedDate ? new Date(task.lastCompletedDate) : new Date(0);
      
      // 如果上次完成不是本月，且今天是该任务设定的日期，则重置状态
      if ((lastCompletedDate.getMonth() !== now.getMonth() || 
           lastCompletedDate.getFullYear() !== now.getFullYear()) && 
          now.getDate() === task.monthDay) {
        task.completed = false;
        task.lastCompletedDate = null;
      }
    }
  });
  
  // 检查并重置每年重复任务
  taskData.repeatTasks.yearly.forEach(task => {
    if (task.completed) {
      // 获取上次完成日期
      const lastCompletedDate = task.lastCompletedDate ? new Date(task.lastCompletedDate) : new Date(0);
      
      // 如果上次完成不是本年，且今天是该任务设定的月和日，则重置状态
      if (lastCompletedDate.getFullYear() !== now.getFullYear() && 
          now.getMonth() === task.yearMonth && 
          now.getDate() === task.yearDay) {
        task.completed = false;
        task.lastCompletedDate = null;
      }
    }
  });
  
  // 保存更改
  saveTaskData();
}

// 删除选中的任务
function deleteSelectedTasks() {
  const selectedCheckboxes = document.querySelectorAll('.task-checkbox:checked');
  const selectedIds = Array.from(selectedCheckboxes).map(checkbox => checkbox.dataset.id);
  
  if (selectedIds.length === 0) {
    alert('请先选择要删除的任务');
    return;
  }
  
  if (confirm(`确定要删除选中的 ${selectedIds.length} 个任务吗？`)) {
    // 从倒计时任务中删除
    taskData.countdownTasks = taskData.countdownTasks.filter(task => !selectedIds.includes(task.id));
    
    // 从每日任务中删除
    Object.keys(taskData.dailyTasks).forEach(yearKey => {
      Object.keys(taskData.dailyTasks[yearKey]).forEach(monthKey => {
        Object.keys(taskData.dailyTasks[yearKey][monthKey]).forEach(dateKey => {
          taskData.dailyTasks[yearKey][monthKey][dateKey] = 
            taskData.dailyTasks[yearKey][monthKey][dateKey].filter(task => !selectedIds.includes(task.id));
          
          // 如果日期中没有任务了，删除该日期
          if (taskData.dailyTasks[yearKey][monthKey][dateKey].length === 0) {
            delete taskData.dailyTasks[yearKey][monthKey][dateKey];
          }
        });
        
        // 如果月份中没有日期了，删除该月份
        if (Object.keys(taskData.dailyTasks[yearKey][monthKey]).length === 0) {
          delete taskData.dailyTasks[yearKey][monthKey];
        }
      });
      
      // 如果年份中没有月份了，删除该年份
      if (Object.keys(taskData.dailyTasks[yearKey]).length === 0) {
        delete taskData.dailyTasks[yearKey];
      }
    });
    
    // 从重复任务中删除
    ['weekly', 'monthly', 'yearly', 'daily'].forEach(repeatType => {
      if (taskData.repeatTasks[repeatType]) {
        taskData.repeatTasks[repeatType] = 
          taskData.repeatTasks[repeatType].filter(task => !selectedIds.includes(task.id));
      }
    });
    
    // 保存并刷新界面
    saveTaskData();
    renderAllTasks();
    updateUpcomingTask();
  }
}

// 反选功能
function invertSelection() {
  const allCheckboxes = document.querySelectorAll('.task-checkbox');
  allCheckboxes.forEach(checkbox => {
    checkbox.checked = !checkbox.checked;
  });
}

// 重编辑选中任务
function editSelectedTasks() {
  const selectedCheckboxes = document.querySelectorAll('.task-checkbox:checked');
  if (selectedCheckboxes.length === 0) {
    alert('请选择至少一个任务进行编辑');
    return;
  }
  
  // 收集所有选中的任务
  const selectedTasks = [];
  let taskFoundCount = 0;
  
  // 函数用于将找到的任务添加到编辑列表
  const addTaskToEdit = (task) => {
    if (task) {
      selectedTasks.push({
        id: task.id,
        content: task.content,
        date: new Date(task.date),
        endDate: task.endDate ? new Date(task.endDate) : null,
        isRepeat: task.repeatType ? true : false,
        repeatType: task.repeatType,
        tags: task.tags || []
      });
      taskFoundCount++;
    }
  };
  
  // 获取所有选中的任务ID
  const selectedIds = Array.from(selectedCheckboxes).map(checkbox => checkbox.dataset.id);
  
  // 在倒计时任务中查找
  taskData.countdownTasks.forEach(task => {
    if (selectedIds.includes(task.id)) {
      addTaskToEdit(task);
    }
  });
  
  // 在每日任务中查找
  Object.keys(taskData.dailyTasks).forEach(yearKey => {
    Object.keys(taskData.dailyTasks[yearKey]).forEach(monthKey => {
      Object.keys(taskData.dailyTasks[yearKey][monthKey]).forEach(dateKey => {
        taskData.dailyTasks[yearKey][monthKey][dateKey].forEach(task => {
          if (selectedIds.includes(task.id)) {
            addTaskToEdit(task);
          }
        });
      });
    });
  });
  
  // 在重复任务中查找
  ['weekly', 'monthly', 'yearly', 'daily'].forEach(repeatType => {
    if (taskData.repeatTasks[repeatType]) {
      taskData.repeatTasks[repeatType].forEach(task => {
        if (selectedIds.includes(task.id)) {
          addTaskToEdit(task);
        }
      });
    }
  });
  
  // 如果找到了任务，则转换为编辑格式并放入输入框
  if (selectedTasks.length > 0) {
    // 将任务转换为文本格式
    const taskTexts = selectedTasks.map(task => {
      let taskText = task.content;
      
      // 添加日期和时间
      if (task.date) {
        const dateStr = `${task.date.getFullYear()}-${task.date.getMonth() + 1}-${task.date.getDate()}`;
        const timeStr = `${task.date.getHours().toString().padStart(2, '0')}:${task.date.getMinutes().toString().padStart(2, '0')}`;
        
        if (task.endDate) {
          // 如果有结束时间，添加时间段
          const endTimeStr = `${task.endDate.getHours().toString().padStart(2, '0')}:${task.endDate.getMinutes().toString().padStart(2, '0')}`;
          taskText += ` ${timeStr}-${endTimeStr}`;
        } else {
          // 否则只添加开始时间
          taskText += ` ${dateStr} ${timeStr}`;
        }
      }
      
      // 添加重复类型
      if (task.isRepeat && task.repeatType) {
        const repeatTypeMap = {
          'day': '每天',
          'week': '每周',
          'month': '每月',
          'year': '每年'
        };
        taskText += ` ${repeatTypeMap[task.repeatType]}`;
      }
      
      // 添加标签
      if (task.tags && task.tags.length > 0) {
        taskText += ` #${task.tags.join(',')}`;
      }
      
      return taskText;
    });
    
    // 将所有任务文本合并，放入输入框
    elements.taskInput.value = taskTexts.join('; ');
    
    // 删除已编辑的任务
    deleteSelectedTasks();
  } else {
    alert('无法找到选中的任务');
  }
}

// 初始化事件绑定
function initEvents() {
  // 添加任务按钮点击事件
  elements.addTaskBtn.addEventListener('click', () => {
    const taskInput = elements.taskInput.value.trim();
    if (taskInput) {
      const parseResults = parseTaskInput(taskInput);
      const success = createTask(parseResults);
      if (success) {
        elements.taskInput.value = '';
      } else {
        // 解析出错但保留用户输入，只高亮错误部分
        highlightInputErrors(parseResults.failed);
      }
    }
  });
  
  // 输入框回车事件
  elements.taskInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      const taskInput = elements.taskInput.value.trim();
      if (taskInput) {
        const parseResults = parseTaskInput(taskInput);
        const success = createTask(parseResults);
        if (success) {
          elements.taskInput.value = '';
        } else {
          // 解析出错但保留用户输入，只高亮错误部分
          highlightInputErrors(parseResults.failed);
        }
      }
    }
  });
  
  // 删除选中任务按钮点击事件
  elements.deleteSelectedBtn.addEventListener('click', deleteSelectedTasks);
  
  // 反选按钮点击事件
  elements.invertSelectionBtn.addEventListener('click', invertSelection);
  
  // 编辑选中任务按钮点击事件
  elements.editSelectedBtn.addEventListener('click', editSelectedTasks);
  
  // 全选年/月/日事件委托
  elements.dailyTaskList.addEventListener('change', (e) => {
    if (e.target.classList.contains('year-checkbox')) {
      const yearKey = e.target.dataset.year;
      const yearContainer = document.querySelector(`.year-container[data-year="${yearKey}"]`);
      const checkboxes = yearContainer.querySelectorAll('.task-checkbox');
      checkboxes.forEach(checkbox => {
        checkbox.checked = e.target.checked;
      });
    } else if (e.target.classList.contains('month-checkbox')) {
      const monthKey = e.target.dataset.month;
      const monthContainer = document.querySelector(`.month-container[data-month="${monthKey}"]`);
      const checkboxes = monthContainer.querySelectorAll('.task-checkbox');
      checkboxes.forEach(checkbox => {
        checkbox.checked = e.target.checked;
      });
    } else if (e.target.classList.contains('day-checkbox')) {
      const dateKey = e.target.dataset.date;
      const dayContainer = document.querySelector(`.day-container[data-date="${dateKey}"]`);
      const checkboxes = dayContainer.querySelectorAll('.task-checkbox');
      checkboxes.forEach(checkbox => {
        checkbox.checked = e.target.checked;
      });
    }
  });
}

// 高亮输入错误
function highlightInputErrors(failedItems) {
  // 为了简单起见，我们只是暂时将输入框设置为红色边框，然后1秒后恢复
  const inputBox = elements.taskInput;
  const originalBorder = inputBox.style.border;
  
  inputBox.style.border = '2px solid red';
  
  setTimeout(() => {
    inputBox.style.border = originalBorder;
  }, 1000);
}

// 初始化应用
function initApp() {
  // 请求通知权限
  if (Notification.permission !== 'granted' && Notification.permission !== 'denied') {
    Notification.requestPermission();
  }
  
  // 加载任务数据
  loadTaskData();
  
  // 检查重复任务状态重置
  resetRepeatTasks();
  
  // 渲染任务
  renderAllTasks();
  
  // 更新临近任务
  updateUpcomingTask();
  
  // 初始化事件绑定
  initEvents();
  
  // 更频繁地检查倒计时任务（每15秒检查一次）
  setInterval(checkCountdownDeadlines, 15000);
  
  // 每分钟更新临近任务显示
  setInterval(updateUpcomingTask, 60000);
  
  // 每天午夜重置重复任务状态
  const now = new Date();
  const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 0);
  const timeToMidnight = midnight - now;
  
  // 设置第一次午夜重置的定时器
  setTimeout(() => {
    resetRepeatTasks();
    // 之后每24小时运行一次
    setInterval(resetRepeatTasks, 24 * 60 * 60 * 1000);
  }, timeToMidnight);
}

// 当DOM加载完成后初始化应用
document.addEventListener('DOMContentLoaded', initApp); 