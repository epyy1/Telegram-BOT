const { Telegraf } = require("telegraf");
const { exec } = require("child_process");
const fs = require("fs");
const path = require("path");
const axios = require("axios");

require("dotenv").config();
const BOT_TOKEN = process.env.BOT_TOKEN;
const bot = new Telegraf(BOT_TOKEN);

const platforms = {
  youtube: ["youtube.com", "youtu.be"],
  tiktok: ["tiktok.com"],
  instagram: ["instagram.com"],
  x: ["x.com", "twitter.com"],
};

function detectPlatform(url) {
  for (const [platform, domains] of Object.entries(platforms)) {
    if (domains.some((domain) => url.includes(domain))) {
      return platform;
    }
  }
  return null;
}

async function downloadVideo(url) {
  try {
    const timestamp = Date.now();
    const outputPath = path.join(__dirname, "downloads", `${timestamp}.mp4`);

    if (!fs.existsSync(path.join(__dirname, "downloads"))) {
      fs.mkdirSync(path.join(__dirname, "downloads"));
    }

    const command = `yt-dlp -f "best[ext=mp4]" -o "${outputPath}" --no-warnings "${url}"`;

    return new Promise((resolve, reject) => {
      exec(command, (error, stdout, stderr) => {
        if (error) {
          console.error(`Error downloading video: ${error}`);
          reject(error);
          return;
        }

        resolve(outputPath);
      });
    });
  } catch (error) {
    console.error(`Womp Womp: ${error}`);
    throw error;
  }
}

function checkFileSize(filePath) {
  try {
    const stats = fs.statSync(filePath);
    const fileSizeInBytes = stats.size;
    const fileSizeInMegabytes = fileSizeInBytes / (1024 * 1024);

    return fileSizeInMegabytes <= 50;
  } catch (error) {
    console.error(`Error checking file size: ${error}`);
    throw error;
  }
}

async function compressVideo(inputPath) {
  try {
    const outputPath = inputPath.replace(".mp4", "_compressed.mp4");

    const ffmpeg = require("fluent-ffmpeg");
    return new Promise((resolve, reject) => {
      ffmpeg(inputPath)
        .output(outputPath)
        .videoCodec("libx264")
        .audioCodec("aac")
        .outputOptions("-preset fast")
        .on("end", () => {
          fs.unlinkSync(inputPath);
          resolve(outputPath);
        })
        .on("error", (err) => {
          console.error("Error compressing video:", err);
          reject(err);
        })
        .run();
    });
  } catch (error) {
    console.error(`Error compressing video: ${error}`);
    throw error;
  }
}

bot.start((ctx) => {
  ctx.reply("Well just  put your link into this bot");
});

bot.on("text", async (ctx) => {
  const url = ctx.message.text;
  const platform = detectPlatform(url);

  if (!platform) {
    ctx.reply(
      "Unsupported platform. Please provide a YouTube, TikTok, Instagram, or X URL"
    );
    return;
  }

  try {
    const processingMsg = await ctx.reply("fucking wait ");

    const videoPath = await downloadVideo(url);

    if (!checkFileSize(videoPath)) {
      await ctx.telegram.editMessageText(
        ctx.chat.id,
        processingMsg.message_id,
        null,
        " Video is too large bigger than your dick !"
      );

      const compressedPath = await compressVideo(videoPath);

      await ctx.telegram.sendVideo(
        ctx.chat.id,
        { source: fs.createReadStream(compressedPath) },
        { reply_to_message_id: ctx.message.message_id }
      );

      fs.unlinkSync(compressedPath);
    } else {
      await ctx.telegram.sendVideo(
        ctx.chat.id,
        { source: fs.createReadStream(videoPath) },
        { reply_to_message_id: ctx.message.message_id }
      );

      fs.unlinkSync(videoPath);
    }
    await ctx.telegram.deleteMessage(ctx.chat.id, processingMsg.message_id);
  } catch (error) {
    console.error("Error:", error);
    ctx.reply("Error processing your request. Please try again.");
  }
});

bot.catch((err, ctx) => {
  console.error(`Error for ${ctx.updateType}:`, err);
  ctx.reply("An error occurred while processing your request.");
});

bot.launch().then(() => {
  console.log("Bot is running...");
});

process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));
