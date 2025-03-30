import CryptoJS from "crypto-js";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { message } = req.body;
  const API_KEY = process.env.XF_API_KEY; // 从 Vercel 环境变量读取
  const APP_ID = process.env.XF_APP_ID;

  // 1. 生成 WebSocket URL（讯飞鉴权逻辑）
  const host = "spark-api.xf-yun.com";
  const path = "/v2.1/chat";
  const date = new Date().toUTCString();
  const signature = CryptoJS.enc.Base64.stringify(
    CryptoJS.HmacSHA256(`host: ${host}\ndate: ${date}\nGET ${path} HTTP/1.1`, API_KEY)
  );
  const authorization = btoa(
    `api_key="${API_KEY}", algorithm="hmac-sha256", headers="host date request-line", signature="${signature}"`
  );

  // 2. 返回 WebSocket URL 给前端
  res.json({
    url: `wss://${host}${path}?authorization=${authorization}&date=${encodeURIComponent(date)}&host=${host}`,
  });
}
