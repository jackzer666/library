import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { execFile } from "child_process";
import { promisify } from "util";
import path from "path";

// 将回调风格的 execFile 包装成 Promise，方便在 async/await 中使用。
const execFilePromise = promisify(execFile);

const server = new Server(
  {
    name: "sub-font",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

const handleListTools = async () => {
  return {
    tools: [
      {
        name: "sub-font",
        description: "提取字体文件子集，仅保留指定文字。",
        inputSchema: {
          type: "object",
          properties: {
            inputPath: {
              type: "string",
              description: "原始字体文件的绝对路径 (如 /Users/me/font.otf)",
            },
            text: {
              type: "string",
              description: "需要包含在子集中的文字内容",
            },
            outputName: {
              type: "string",
              description: "输出文件名，默认为 subset.otf",
              default: "subset.otf",
            },
          },
          required: ["inputPath", "text"],
        },
      },
    ],
  };
};

// 统一处理并校验工具入参，避免在业务流程中重复判断。
const normalizeArgs = (args = {}) => {
  const inputPath =
    typeof args.inputPath === "string" ? args.inputPath.trim() : "";
  const text = typeof args.text === "string" ? args.text : "";
  const outputName =
    typeof args.outputName === "string" && args.outputName.trim()
      ? args.outputName.trim()
      : "subset.otf";

  if (!inputPath) {
    throw new Error("参数 inputPath 不能为空");
  }

  if (!text) {
    throw new Error("参数 text 不能为空");
  }

  return { inputPath, text, outputName };
};

// 统一成功返回结构，便于调用方稳定解析结果。
const buildSuccessResult = (outputPath, text) => {
  return {
    content: [
      {
        type: "text",
        text: `字体子集生成成功\n文件路径: ${outputPath}\n包含文字: ${text}`,
      },
    ],
  };
};

// 统一错误返回结构，并兼容 Error 与非 Error 异常对象。
const buildErrorResult = (error) => {
  const message = error instanceof Error ? error.message : String(error);
  return {
    content: [
      {
        type: "text",
        text: `字体子集生成失败: ${message}`,
      },
    ],
    isError: true,
  };
};

const handleCallTool = async (request) => {
  // 仅处理当前服务声明的 sub-font 工具。
  if (request.params.name === "sub-font") {
    try {
      const { inputPath, text, outputName } = normalizeArgs(request.params.arguments);
      // 默认将输出文件落在源字体同级目录，便于定位产物。
      const outputPath = path.join(path.dirname(inputPath), outputName);

      // 调用 fonttools subset 生成仅包含指定文字的字体文件。
      await execFilePromise("fonttools", [
        "subset",
        inputPath,
        `--text=${text}`,
        `--output-file=${outputPath}`,
      ]);

      return buildSuccessResult(outputPath, text);
    } catch (error) {
      return buildErrorResult(error);
    }
  }

  throw new Error("Tool not found");
};

server.setRequestHandler(ListToolsRequestSchema, handleListTools);
server.setRequestHandler(CallToolRequestSchema, handleCallTool);

// 通过 stdio 与 MCP Host 通信，适配本地工具链调用。
const main = async () => {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Font Subsetter MCP Server running on stdio");
};

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});