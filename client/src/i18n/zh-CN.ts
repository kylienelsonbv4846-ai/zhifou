/**
 * Chinese (Simplified) translations for ClassClicker
 */

export const zhCN = {
  // Common
  common: {
    loading: "加载中...",
    login: "登录",
    logout: "登出",
    save: "保存",
    cancel: "取消",
    delete: "删除",
    edit: "编辑",
    add: "添加",
    create: "创建",
    submit: "提交",
    download: "下载",
    upload: "上传",
    export: "导出",
    import: "导入",
    search: "搜索",
    filter: "筛选",
    sort: "排序",
    back: "返回",
    next: "下一步",
    previous: "上一步",
    confirm: "确认",
    close: "关闭",
    success: "成功",
    error: "错误",
    warning: "警告",
    info: "信息",
    yes: "是",
    no: "否",
    ok: "确定",
    name: "名称",
    description: "描述",
    status: "状态",
    action: "操作",
    createdAt: "创建时间",
    updatedAt: "更新时间",
  },

  // Home page
  home: {
    title: "课堂即时反馈系统",
    subtitle: "实时学生反馈收集和分析",
    downloadCards: "下载答题卡",
    downloadCardsDesc: "下载完整的答题卡集合（1-80）。这些卡片是通用的，可以在所有班级中使用。一次打印，永久使用。",
    downloadAllCards: "下载全部答题卡（1-80）",
    manageClasses: "管理班级",
    manageClassesDesc: "创建和管理您的班级，添加学生，组织您的教学。",
    questionLibrary: "题库",
    questionLibraryDesc: "创建和管理包含多选题、单选题和判断题的题目集合。",
    liveSessions: "直播课堂",
    liveSessionsDesc: "启动直播课堂会话并实时收集学生反馈。",
    getStarted: "开始使用",
  },

  // Classes page
  classes: {
    title: "班级管理",
    createClass: "创建班级",
    className: "班级名称",
    studentCount: "学生数",
    noClasses: "暂无班级",
    deleteConfirm: "确定要删除班级吗？",
    classCreated: "班级创建成功",
    classDeleted: "班级删除成功",
    classUpdated: "班级更新成功",
  },

  // Class detail page
  classDetail: {
    title: "班级详情",
    students: "学生",
    addStudent: "添加学生",
    studentName: "学生名称",
    studentId: "学号",
    importStudents: "导入学生",
    importFromFile: "从文件导入",
    deleteStudent: "删除学生",
    deleteStudentConfirm: "确定要删除该学生吗？",
    studentAdded: "学生添加成功",
    studentDeleted: "学生删除成功",
    studentUpdated: "学生更新成功",
    noStudents: "暂无学生",
  },

  // Question sets page
  questionSets: {
    title: "题库",
    createQuestionSet: "创建题目集",
    questionSetName: "题目集名称",
    questionCount: "题目数",
    noQuestionSets: "暂无题目集",
    deleteConfirm: "确定要删除题目集吗？",
    questionSetCreated: "题目集创建成功",
    questionSetDeleted: "题目集删除成功",
    questionSetUpdated: "题目集更新成功",
  },

  // Question detail page
  questionDetail: {
    title: "题目详情",
    questionText: "题目文本",
    questionType: "题目类型",
    multipleChoice: "多选题",
    singleChoice: "单选题",
    trueFalse: "判断题",
    options: "选项",
    correctAnswer: "正确答案",
    addOption: "添加选项",
    deleteQuestion: "删除题目",
    deleteQuestionConfirm: "确定要删除该题目吗？",
    questionCreated: "题目创建成功",
    questionDeleted: "题目删除成功",
    questionUpdated: "题目更新成功",
  },

  // Sessions page
  sessions: {
    title: "课堂会话",
    startSession: "启动会话",
    sessionName: "会话名称",
    questionSet: "题目集",
    class: "班级",
    status: "状态",
    active: "进行中",
    completed: "已完成",
    noSessions: "暂无会话",
    deleteConfirm: "确定要删除会话吗？",
    sessionCreated: "会话创建成功",
    sessionDeleted: "会话删除成功",
    sessionUpdated: "会话更新成功",
  },

  // Session play page
  sessionPlay: {
    title: "课堂进行中",
    currentQuestion: "当前题目",
    responses: "回答",
    correctRate: "正确率",
    endSession: "结束会话",
    nextQuestion: "下一题",
    previousQuestion: "上一题",
    sessionEnded: "会话已结束",
  },

  // Reports page
  reports: {
    title: "报告",
    studentReports: "学生报告",
    classReports: "班级报告",
    sessionReports: "会话报告",
    exportReport: "导出报告",
    noReports: "暂无报告",
  },

  // Student reports page
  studentReports: {
    title: "学生报告",
    selectStudent: "选择学生",
    selectClass: "选择班级",
    exportClassData: "导出班级数据",
    totalAnswered: "总答题数",
    totalCorrect: "正确数",
    correctRate: "正确率",
    sessionId: "会话ID",
    questionNumber: "题号",
    yourAnswer: "您的答案",
    correctAnswer: "正确答案",
    isCorrect: "是否正确",
    submittedTime: "提交时间",
    exportFailed: "导出失败",
    exportSuccess: "导出成功",
  },

  // Student detail page
  studentDetail: {
    title: "学生详情",
    studentName: "学生名称",
    studentId: "学号",
    class: "班级",
    totalAnswered: "总答题数",
    totalCorrect: "正确数",
    correctRate: "正确率",
    noData: "暂无数据",
  },

  // Now playing page
  nowPlaying: {
    title: "现在播放",
    currentQuestion: "当前题目",
    responses: "回答",
    correctRate: "正确率",
    totalResponses: "总回答数",
    correctResponses: "正确回答数",
  },

  // Download cards page
  downloadCards: {
    title: "下载答题卡",
    description: "下载完整的答题卡集合（1-80）。这些卡片是通用的，可以在所有班级中使用。",
    downloadAll: "下载全部（1-80）",
    downloadRange: "下载范围",
    from: "从",
    to: "到",
    download: "下载",
  },

  // Not found page
  notFound: {
    title: "页面未找到",
    message: "抱歉，您访问的页面不存在。",
    backHome: "返回首页",
  },

  // Error messages
  errors: {
    loadingFailed: "加载失败",
    saveFailed: "保存失败",
    deleteFailed: "删除失败",
    createFailed: "创建失败",
    updateFailed: "更新失败",
    exportFailed: "导出失败",
    importFailed: "导入失败",
    networkError: "网络错误",
    serverError: "服务器错误",
    invalidInput: "输入无效",
    requiredField: "此字段为必填项",
    pleaseSelectClass: "请选择班级",
    pleaseSelectStudent: "请选择学生",
    pleaseSelectQuestionSet: "请选择题目集",
  },

  // Success messages
  success: {
    saved: "保存成功",
    created: "创建成功",
    updated: "更新成功",
    deleted: "删除成功",
    exported: "导出成功",
    imported: "导入成功",
  },
};

export type TranslationKey = keyof typeof zhCN;
