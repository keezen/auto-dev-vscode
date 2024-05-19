import * as vscode from "vscode";
// for Dependency Injection with InversifyJS
import "reflect-metadata";
import Parser from "web-tree-sitter";

import { registerCommands } from "./commands/commands";
import { AutoDevWebviewViewProvider } from "./editor/webview/AutoDevWebviewViewProvider";
import { VSCodeAction } from "./editor/editor-api/VSCodeAction";
import { RecentlyDocumentManager } from "./editor/document/RecentlyDocumentManager";
import { DiffManager } from "./editor/diff/DiffManager";
import { AutoDevExtension } from "./AutoDevExtension";
import { removeExtensionContext, setExtensionContext } from './context';
import { channel } from "./channel";
import {
	registerAutoDevProviders,
	registerCodeLensProviders,
	registerQuickFixProvider,
	registerRenameAction,
	registerWebViewProvider
} from "./editor/providers/ProviderUtils";
import { AutoDevStatusManager } from "./editor/editor-api/AutoDevStatusManager";
import { BuildToolObserver } from "./toolchain-context/buildtool/BuildToolObserver";
import { TreeSitterFileManager } from "./editor/cache/TreeSitterFileManager";
import { SettingService } from "./settings/SettingService";
import { LocalEmbeddingProvider } from "./code-search/embedding/LocalEmbeddingProvider";

(globalThis as any).self = globalThis;

/**
 * 激活插件函数
 *
 * @param context 插件上下文
 * @returns 无返回值
 */
export async function activate(context: vscode.ExtensionContext) {
	// 设置扩展上下文
	setExtensionContext(context);

	// 创建侧边栏视图提供者
	const sidebar = new AutoDevWebviewViewProvider(context);

	// 创建 VSCode 动作对象
	const action = new VSCodeAction();

	// 创建最近文档管理器
	const documentManager = new RecentlyDocumentManager();

	// 创建差异管理器
	const diffManager = new DiffManager();

	// 创建 AutoDev 扩展对象
	const extension = new AutoDevExtension(
		sidebar, action, documentManager, diffManager, context,
	);

	// 初始化解析器
	Parser.init().then(async () => {
		// 注册代码透镜提供者
		registerCodeLensProviders(extension);

		// 注册 AutoDev 提供者
		registerAutoDevProviders(extension);

		// 注册快速修复提供者
		registerQuickFixProvider(extension);

		// 注册命令
		registerCommands(extension);

		// 如果设置服务中启用了重命名功能
		if (SettingService.instance().isEnableRename()) {
			// 注册重命名动作
			registerRenameAction(extension);
		}

		// 当配置发生更改时
		vscode.workspace.onDidChangeConfiguration(() => {
			if (SettingService.instance().isEnableRename()) {
				// 如果启用了重命名功能，则注册重命名动作（待优化）
				// todo: make it works better
				registerRenameAction(extension);
			} else {
				// 否则不做任何操作
			}
		});

		// 获取 TreeSitter 文件管理器实例
		TreeSitterFileManager.getInstance();

		// 启动构建工具观察者
		await new BuildToolObserver().startWatch();

		// 初始化本地嵌入提供者
		LocalEmbeddingProvider.getInstance().init(context.extensionPath);
	});

	// 注册 WebView 视图提供者
	registerWebViewProvider(extension);

	// 绑定文档更改事件
	documentManager.bindChanges();

	// 创建 AutoDev 状态管理器实例
	AutoDevStatusManager.instance.create();

	// 显示通道
	channel.show();
}

/**
 * 停用扩展上下文
 *
 * 该函数用于移除扩展上下文
 */
export function deactivate() {
	removeExtensionContext();
}
