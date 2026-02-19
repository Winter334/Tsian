/**
 * 联机设置页面
 *
 * 配置联机服务器地址
 */

import { Button, Card, Input } from "@/components/ui";
import {
  getEnvironmentName,
  getMultiplayerConfig,
  isDevelopment,
  saveCustomServerSettings,
  validateServerUrl,
  type CustomServerSettings,
} from "@/config/multiplayer";
import { useToast } from "@/hooks";
import { ArrowLeft, Check, Globe, RefreshCw, Server } from "lucide-react";
import { useEffect, useState } from "react";

interface MultiplayerSettingsProps {
  onBack: () => void;
}

export function MultiplayerSettings({ onBack }: MultiplayerSettingsProps) {
  const { toast } = useToast();
  const [useCustomServer, setUseCustomServer] = useState(false);
  const [customApiUrl, setCustomApiUrl] = useState("");
  const [customWsUrl, setCustomWsUrl] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  // 加载当前配置
  useEffect(() => {
    const config = getMultiplayerConfig();
    setUseCustomServer(config.useCustomServer);
    if (config.useCustomServer) {
      setCustomApiUrl(config.apiUrl);
      setCustomWsUrl(config.wsUrl);
    }
  }, []);

  // 获取默认配置用于显示
  const defaultConfig = getMultiplayerConfig();
  const envName = getEnvironmentName();

  // 保存设置
  const handleSave = () => {
    if (useCustomServer) {
      // 验证 URL 格式
      if (!validateServerUrl(customApiUrl, "api")) {
        toast("error", "API 地址格式错误", "请输入有效的 HTTP/HTTPS 地址");
        return;
      }
      if (!validateServerUrl(customWsUrl, "ws")) {
        toast("error", "WebSocket 地址格式错误", "请输入有效的 WS/WSS 地址");
        return;
      }
    }

    setIsSaving(true);

    const settings: CustomServerSettings = {
      useCustomServer,
      customApiUrl,
      customWsUrl,
    };

    saveCustomServerSettings(settings);

    setTimeout(() => {
      setIsSaving(false);
      toast("success", "设置已保存", "联机服务器配置已更新");
    }, 300);
  };

  // 重置为默认
  const handleReset = () => {
    setUseCustomServer(false);
    setCustomApiUrl("");
    setCustomWsUrl("");

    saveCustomServerSettings({
      useCustomServer: false,
      customApiUrl: "",
      customWsUrl: "",
    });

    toast("success", "已重置", "已恢复为默认服务器配置");
  };

  return (
    <div className="space-y-6">
      {/* 返回按钮 */}
      <Button variant="ghost" size="sm" onClick={onBack} className="-ml-2">
        <ArrowLeft className="w-4 h-4 mr-2" />
        返回
      </Button>

      {/* 当前状态 - 使用 Card outlined 变体 */}
      <Card variant="outlined" hover={false} className="p-4">
        <div className="flex items-center gap-2 mb-2">
          <Globe className="w-4 h-4 text-primary" />
          <span className="text-sm font-medium">当前环境</span>
        </div>
        <p className="text-sm text-muted-foreground">{envName}</p>
        {!useCustomServer && (
          <div className="mt-2 text-xs text-muted-foreground space-y-1">
            <p>API: {defaultConfig.apiUrl}</p>
            <p>WebSocket: {defaultConfig.wsUrl}</p>
          </div>
        )}
      </Card>

      {/* 自定义服务器开关 */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Server className="w-4 h-4" />
            <span className="text-sm font-medium">使用自定义服务器</span>
          </div>
          <button
            onClick={() => setUseCustomServer(!useCustomServer)}
            className={`
              relative w-11 h-6 rounded-full transition-colors
              ${useCustomServer ? "bg-primary" : "bg-muted"}
            `}
          >
            <div
              className={`
                absolute top-1 w-4 h-4 rounded-full bg-white transition-transform
                ${useCustomServer ? "translate-x-6" : "translate-x-1"}
              `}
            />
          </button>
        </div>

        {/* 自定义服务器配置 */}
        {useCustomServer && (
          <div className="space-y-4 pl-6 border-l-2 border-primary/30">
            <div>
              <label className="block text-sm font-medium mb-2">API 地址</label>
              <Input
                value={customApiUrl}
                onChange={(e) => setCustomApiUrl(e.target.value)}
                placeholder="http://localhost:3000/api"
              />
              <p className="text-xs text-muted-foreground mt-1">
                HTTP/HTTPS 协议的 API 端点
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">
                WebSocket 地址
              </label>
              <Input
                value={customWsUrl}
                onChange={(e) => setCustomWsUrl(e.target.value)}
                placeholder="ws://localhost:1234"
              />
              <p className="text-xs text-muted-foreground mt-1">
                WS/WSS 协议的 WebSocket 端点
              </p>
            </div>
          </div>
        )}
      </div>

      {/* 操作按钮 */}
      <div className="flex gap-2">
        <Button onClick={handleSave} disabled={isSaving} className="flex-1">
          {isSaving ? (
            <>
              <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
              保存中...
            </>
          ) : (
            <>
              <Check className="w-4 h-4 mr-2" />
              保存设置
            </>
          )}
        </Button>
        <Button variant="outline" onClick={handleReset}>
          重置
        </Button>
      </div>

      {/* 提示信息 */}
      <div className="text-xs text-muted-foreground space-y-1">
        <p>• 修改服务器配置后，需要重新创建或加入房间</p>
        <p>• 自定义服务器需要运行兼容的 Hocuspocus 服务</p>
        {isDevelopment() && (
          <p className="text-yellow-500">
            • 开发环境默认使用本地服务器 (localhost)
          </p>
        )}
      </div>
    </div>
  );
}
