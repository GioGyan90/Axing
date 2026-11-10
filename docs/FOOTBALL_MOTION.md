# Axing 足球动作接入

2026-11-10。保留 Axing 原来的方块身体、导入头部、球场、键盘和触摸操作。动作来自用户指定的 [3D_AItool](https://github.com/GioGyan90/3D_AItool)，固定源码版本 `0434ddfaee268531cf6141b8cbf19c6d64c2decf`。该工具仓库未被修改。

## 动作资产与生成方式

使用 `experiments/prompt2rig/public/lab/motion-plan.js` 的实际 `planToTake → retargetTake`，以及其 `Rig / Track / trackToClip`，将聊天编排的 motion-plan v1 方案烘焙并重定向到 Axing 的向下手臂、双段四肢和原有长度。输出为真实的 Three.js AnimationClip，由游戏运行时的 AnimationMixer 采样；没有只修改字幕或搬入一个未接入的 JSON。

| 动作 | 方案时长 | 关键接触时刻 |
| --- | --- | --- |
| 右脚射门 | 1.30 s | 0.52 s |
| 左侧横扑、右侧横扑 | 各 1.60 s | 0.57 s |
| 高球双拳解围 | 1.25 s | 0.45 s |
| 中路低球封堵 | 1.20 s | 0.45 s |

这是程序编排的关键帧动作，经指定工具烘焙与重定向；不是视频动捕，也未调用 fal、GVHMR 或收费生成服务。

- `tools/football-plans.mjs`：可编辑的动作方案和关键时刻。
- `tools/build-football-motions.mjs`：调用指定工具编译。
- `scripts/game/motions/football.motion-plans.json`：可返回动作实验室的完整方案。
- `scripts/game/motions/football-clips.js`：预烘焙的五段动画，约 149 KB，无新的游戏运行时网络依赖。
- `scripts/game/football-rig.js`：匹配游戏尺寸的动作骨架。
- `scripts/game/football-motion.js`：AnimationMixer、刚性零件同步、支撑脚固定、短程触球 IK 和实际网格接地。

源方案用标准 T-pose、左 +X、上 +Y、前 +Z。目标人物用既有向下手臂；源角度未直接抄到目标关节。四肢仍是原游戏的方块零件，没有换成工具里的少年。补了随髋部旋转的小型短裤连接块，覆盖旧身体和大腿根部在横扑时露出的空隙。

## 游戏行为

Space 蓄力仍保留。释放后播放 0.68 秒挥腿与恢复，在方案的触球标记执行一次射门。蓄力力量和瞄准在释放时保留；短暂固定支撑脚，近球接触阶段校正踢球脚，随摆后恢复跑动。出脚期间禁止重复蓄力和带球重新吸附；重新开球清除未来触球事件。踢门将的原有玩法保留。

门将先预测球到自身前方接触平面的时间，再连续完成下蹲、蹬地、伸手、落地、起身。左右横扑镜像，中央低球下蹲封堵，高球双拳解围。预测使用原有重力、反弹与阻尼；修正旧扇形视野朝向与场地相反的问题。预测只选择动画，不会立即改变球速。

实际手套 / 胸部接触才解围并回调成功，使用球与双手相对运动的扫掠距离，降低低帧率漏判。扑不到的球继续飞行。门将等级、移动和出击参数保留；原先缩放整个身体的危险球姿态改成真实的关节姿势。被踢倒会取消正在执行的扑救。

## 复现

把两个仓库放在同级目录，Node.js 18+：

```sh
git clone https://github.com/GioGyan90/Axing.git
git clone https://github.com/GioGyan90/3D_AItool.git
git -C 3D_AItool checkout 0434ddfaee268531cf6141b8cbf19c6d64c2decf
cd Axing
npm run build:motions
npm test
```

不需要 npm install。非同级目录可用 `PROMPT2RIG_ROOT=/absolute/path/3D_AItool` 指定依赖位置，构建脚本的第一个参数也需要传入同一路径。生成后同时提交源码方案、方案 JSON 和 Clip 文件。动作 ID 必须有不同 `uuid`，否则旧版 AnimationMixer 会把多个片段缓存成同一个动作。

测试也支持 `AXING_THREE_ROOT=/absolute/path/three-package npm test`，直接使用该 npm 包里的 `build/three.module.js` 和 `examples/jsm`。本轮同时使用工具自带 r169，以及游戏使用的 three@0.160.0 验证。

## 验证范围

25 项自动检查通过：五段动画的有限数值、单位四元数和相邻帧连续性；镜像横扑；准备至恢复的接地；支撑脚水平固定；触球鞋位置；延迟、单次事件、力量保存和重开取消；三级门将的左 / 右 / 高 / 中路球；不可达球；30 / 60 FPS 与 1.02 米头部包围盒；髋部覆盖大腿关节。

`motion-review.html` 直接复用原人物、游戏动画、球运动和门将碰撞代码，提供六个视角、逐时刻查看和五种实际触球测试。浏览器已查看正面、侧面、背面、四分之三、斜前俯视、斜后俯视；发现并修复横扑髋部缝隙、落地收臂抬高身体以及兼容渲染器未检查父节点可见性的问题。左 / 右低球、高球、中路低球、射门五个浏览器测试均实际回调成功。

当前测试浏览器禁止创建 WebGL 上下文。视觉检查使用指定工具的 Canvas CPU 兼容渲染器，读取同一 Three.js 模型、骨架与相机；它只用于独立检查页。小游戏保留原 WebGL 渲染。**没有宣称完成 WebGL/GPU 画面、阴影、移动端真机或游戏整体帧率验收。** 球与手 / 脚的接触采用刚性近似，不是全身物理模拟；手套 / 手掌沿用方块形体，不含独立手指。

复用的兼容渲染器、LICENSE 和 NOTICE 位于 `scripts/vendor/prompt2rig/`；本次仅复制其兼容预览代码，未引入上游 HQ 模型、角色素材或远程服务。
