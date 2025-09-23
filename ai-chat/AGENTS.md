# Repository Guidelines

## 项目结构与模块分布

核心源码位于 `src/`。页面骨架放在 `views/`，可复用 UI 在 `components/`，Pinia 状态驻留 `stores/`，数据与缓存访问集中于 `repositories/`，外部模型调用封装在 `services/`，公共类型声明保存在 `types/`，纯函数工具进入 `utils/`。`public/` 存放静态资源，`dist/` 为 Vite 输出，端到端样式与主题可在 `src/style.css` 或组件内局部覆盖。单元测试与 `tests/setupTests.ts` 启动脚本位于 `tests/`。`src/auto-imports.d.ts`、`src/components.d.ts` 由插件生成，请勿手改，必要时运行 `npm run dev` 重新生成。

## 构建、测试与开发命令

推荐使用 Node 20，保证与 GitHub Actions 一致。`npm install` 准备本地环境，自动化流水线使用 `npm ci` 确保锁定依赖。`npm run dev` 启动 Vite 热更新并监听别名。`npm run build` 先执行 `vue-tsc -b` 校验类型，再产出压缩构建。`npm run preview` 用于本地验收生产包。`npm run lint` 跑 ESLint，`npm run format` 调用 Prettier，`npm run test:unit` 单次执行 Vitest，`npm run test:watch` 适合 TDD 循环。若在 CI 中拆分任务，可按 lint -> test -> build 顺序以快速失败；需调试覆盖率时加入 `npx vitest run --coverage` 步骤。

## 代码风格与命名约定

TypeScript 处于 strict 模式，统一通过 `@/` 引入共享逻辑。遵循 ESLint + Prettier 输出：两个空格、尾随逗号、脚本内单引号；Vue 模板可保留属性换行以提升可读性。组件命名使用 PascalCase（例如 `ConversationSidebar`），非展示性逻辑以 `useXXX` 形式落地为组合式函数。Pinia 模块采用 `*Store` 后缀并保持单一职责，跨模块常量集中在 `src/types` 或 `src/utils` 以避免重复。提交前执行 `npm run lint` 与 `npm run format`，保证 diff 聚焦业务变化。

## 测试规范

Vitest 运行在 jsdom 环境，`tests/setupTests.ts` 为 crypto 与 clipboard 提供 polyfill。测试文件可放在 `tests/**` 或源码旁边，只需以 `.spec.ts` 结尾。对 axios 请求进行 stub 以避免真实网络调用。新增功能需覆盖 Pinia action 的成功和失败路径，以及服务层的异常处理。关键路径建议附带快照或数据驱动用例，复杂逻辑可添加 table-driven 测试。若组件涉及 slot 或异步渲染，请结合 `flushPromises` 与 `await nextTick()` 驱动断言。需要共享覆盖率时使用 `npx vitest run --coverage` 并粘贴摘要。

## 提交与拉取请求要求npm run test:unit

当前仓库无可参考历史记录，请遵循 [Conventional Commits](https://www.conventionalcommits.org/)（例：`feat: add conversation pinning`）。主题分支可按 `feature/<摘要>` 或 `fix/<摘要>` 命名。PR 需包含概述、风险评估、UI 变更的截图或录屏、执行过的命令（lint/test/build），并关联相关 issue。提交评审前确认 GitHub Actions 的 lint、test:unit、build 阶段全部通过，并在描述中标注已验证的浏览器或节点版本，便于回归。

## 安全与配置提示

任何 API 密钥禁止入库；配置存储会在运行期读取并写入浏览器 `localStorage`。如需新增环境变量或代理，请在 PR 中记录并同步 `.gitignore`。扩展服务客户端时，敏感数据必须在日志中脱敏，调试开关集中在配置 store。推荐在 README 或内部知识库登记受信主机、回调端口及节流策略，使部署团队能快速对齐安全基线。

## 架构与协作建议

聊天能力通过 `services/llmFactory.ts` 统一实例化不同模型客户端，扩展新供应商时请沿用工厂模式并在 `types/llm.ts` 中补齐类型，确保遵守开放封闭原则。前端状态驱动 UI，避免跨 store 直接互调，改用事件或组合式函数传递意图。多代理协作时，先在 Issue 里切分领域，标记所属视图、服务或 store，再提交 PR，减少职责重叠。若需要大规模重构，请附设计文档并在评审前组织同步，以维护项目连贯性。建议按照小批量提交的策略推进，每次聚焦一个可验证目标，便于回滚与审查。
