/* 
 * 用户认证模块
 * 使用 localStorage 存储用户数据
 * 如需同步到 GitHub，可调用 syncToGitHub 方法
 */

const USER_STORAGE_KEY = 'zl9_user_data';
const GITHUB_DATA_PATH = 'user-data/'; // GitHub 仓库中的子文件夹路径

// 用户数据结构
class UserData {
    constructor(username, password) {
        this.username = username;
        this.password = password; // 实际应用中应该加密
        this.createdAt = new Date().toISOString();
        this.lastLogin = new Date().toISOString();
    }
}

// 认证管理器
class AuthManager {
    constructor() {
        this.currentUser = null;
        this.init();
    }

    init() {
        // 检查是否有已登录的用户
        const savedUser = localStorage.getItem(USER_STORAGE_KEY);
        if (savedUser) {
            try {
                this.currentUser = JSON.parse(savedUser);
            } catch (e) {
                console.error('解析用户数据失败', e);
            }
        }
    }

    // 检查用户是否已注册
    isRegistered() {
        return this.currentUser !== null;
    }

    // 检查用户是否已登录
    isLoggedIn() {
        return this.currentUser !== null;
    }

    // 获取当前用户名
    getUsername() {
        return this.currentUser ? this.currentUser.username : null;
    }

    // 注册用户
    register(username, password) {
        if (!username || !password) {
            return { success: false, message: '用户名和密码不能为空' };
        }

        if (username.length < 3) {
            return { success: false, message: '用户名至少 3 个字符' };
        }

        if (password.length < 6) {
            return { success: false, message: '密码至少 6 个字符' };
        }

        // 检查是否已存在用户
        const existingUser = localStorage.getItem(USER_STORAGE_KEY);
        if (existingUser) {
            return { success: false, message: '用户已存在，请直接登录' };
        }

        const userData = new UserData(username, password);
        localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(userData));
        this.currentUser = userData;

        // 可选：同步到 GitHub
        // this.syncToGitHub(userData);

        return { success: true, message: '注册成功' };
    }

    // 登录
    login(username, password) {
        if (!username || !password) {
            return { success: false, message: '用户名和密码不能为空' };
        }

        const savedUser = localStorage.getItem(USER_STORAGE_KEY);
        if (!savedUser) {
            return { success: false, message: '用户不存在，请先注册' };
        }

        try {
            const userData = JSON.parse(savedUser);
            if (userData.username === username && userData.password === password) {
                userData.lastLogin = new Date().toISOString();
                localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(userData));
                this.currentUser = userData;
                return { success: true, message: '登录成功' };
            } else {
                return { success: false, message: '用户名或密码错误' };
            }
        } catch (e) {
            return { success: false, message: '登录失败，请重试' };
        }
    }

    // 登出
    logout() {
        this.currentUser = null;
        // 注意：这里不清除 localStorage，以便下次自动登录
        // 如果需要清除：localStorage.removeItem(USER_STORAGE_KEY);
        return { success: true, message: '已退出登录' };
    }

    // 清除所有用户数据（用于重置）
    clearUserData() {
        localStorage.removeItem(USER_STORAGE_KEY);
        this.currentUser = null;
        return { success: true, message: '用户数据已清除' };
    }

    // 同步数据到 GitHub（需要用户配置 GitHub Token）
    async syncToGitHub(userData, options = {}) {
        const { token, owner, repo, branch = 'main' } = options;
        
        if (!token || !owner || !repo) {
            console.warn('缺少 GitHub 配置信息');
            return { success: false, message: '需要配置 GitHub Token、所有者和仓库名' };
        }

        try {
            const filePath = `${GITHUB_DATA_PATH}${userData.username}.json`;
            const content = btoa(unescape(encodeURIComponent(JSON.stringify(userData, null, 2))));

            // 先检查文件是否存在
            let sha = null;
            try {
                const getFileResponse = await fetch(
                    `https://api.github.com/repos/${owner}/${repo}/contents/${filePath}`,
                    {
                        headers: {
                            'Authorization': `token ${token}`,
                            'Accept': 'application/vnd.github.v3+json'
                        }
                    }
                );
                
                if (getFileResponse.ok) {
                    const fileData = await getFileResponse.json();
                    sha = fileData.sha;
                }
            } catch (e) {
                // 文件不存在，继续创建
            }

            // 创建或更新文件
            const body = {
                message: `Update user data for ${userData.username}`,
                content: content,
                branch: branch
            };

            if (sha) {
                body.sha = sha;
            }

            const response = await fetch(
                `https://api.github.com/repos/${owner}/${repo}/contents/${filePath}`,
                {
                    method: 'PUT',
                    headers: {
                        'Authorization': `token ${token}`,
                        'Accept': 'application/vnd.github.v3+json',
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(body)
                }
            );

            if (response.ok) {
                return { success: true, message: '数据已同步到 GitHub' };
            } else {
                const error = await response.json();
                return { success: false, message: `GitHub API 错误：${error.message}` };
            }
        } catch (e) {
            return { success: false, message: `同步失败：${e.message}` };
        }
    }

    // 从 GitHub 加载用户数据
    async loadFromGitHub(username, options = {}) {
        const { token, owner, repo, branch = 'main' } = options;
        
        if (!token || !owner || !repo) {
            return { success: false, message: '需要配置 GitHub Token、所有者和仓库名' };
        }

        try {
            const filePath = `${GITHUB_DATA_PATH}${username}.json`;
            const response = await fetch(
                `https://api.github.com/repos/${owner}/${repo}/contents/${filePath}`,
                {
                    headers: {
                        'Authorization': `token ${token}`,
                        'Accept': 'application/vnd.github.v3+json'
                    }
                }
            );

            if (response.ok) {
                const data = await response.json();
                const content = JSON.parse(decodeURIComponent(escape(atob(data.content))));
                return { success: true, data: content };
            } else {
                return { success: false, message: '用户在 GitHub 上不存在' };
            }
        } catch (e) {
            return { success: false, message: `加载失败：${e.message}` };
        }
    }
}

// 导出单例
export const authManager = new AuthManager();
window.authManager = authManager;
