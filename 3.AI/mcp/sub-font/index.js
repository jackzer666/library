import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { exec } from "child_process";
import { promisify } from "util";
import path from "path";

const execPromise = promisify(exec);

// 创建 MCP 服务实例
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

/**
 * 定义工具列表
 */
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "sub-font",
        description: "提取字体文件的子集。AI 会自动从上下文中提取需要保留的文字。",
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
});

/**
 * 处理工具调用逻辑
 */
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  if (request.params.name === "sub-font") {
    const { inputPath, text, outputName = "subset.otf" } = request.params.arguments;
    
    // 获取输出文件的绝对路径（默认放在原始文件同级目录）
    const outputPath = path.join(path.dirname(inputPath), outputName);

    try {
      // 执行 fonttools 命令
      // --text 参数直接接收字符串，处理方便
      const command = `fonttools subset "${inputPath}" --text="${text.replace(/"/g, '\\"')}" --output-file="${outputPath}"`;
      
      await execPromise(command);

      return {
        content: [
          {
            type: "text",
            text: `✅ 字体子集生成成功！\n文件路径: ${outputPath}\n包含文字: ${text}`,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `❌ 出错了: ${error.message}`,
          },
        ],
        isError: true,
      };
    }
  }

  throw new Error("Tool not found");
});

/**
 * 启动服务
 */
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Font Subsetter MCP Server running on stdio");
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});