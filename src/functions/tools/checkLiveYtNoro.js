const fs = require('fs');
const { google } = require('googleapis');
const { EmbedBuilder } = require('discord.js');
require('dotenv').config();

const youtube = google.youtube({ version: 'v3', auth: process.env.NORO_API_KEY });
const channelId = 'UCsPsZrQySVRR6so8j5HMqRw'; // Replace with your YouTube channel ID
const checkInterval = 60 * 1000; // 5 seconds

module.exports = async (client) => {
  async function checkLiveStatus() {
    try {
      const response = await youtube.search.list({
        part: 'snippet',
        channelId: channelId,
        type: 'video',
        eventType: 'live',
      });

      const liveVideos = response.data.items;
      if (liveVideos.length > 0) {
        const videoId = liveVideos[0].id.videoId;
        const publishedAt = liveVideos[0].snippet.publishedAt;

        // Load the existing data from the JSON file
        let liveStatus = {};
        if (fs.existsSync(`${__dirname}/../../json/live_status_yt_noro.json`)) {
          const rawContent = fs.readFileSync(`${__dirname}/../../json/live_status_yt_noro.json`);
          liveStatus = JSON.parse(rawContent);
        }

        // Check if the video is already announced as live
        if (!liveStatus[videoId] || liveStatus[videoId] !== publishedAt) {
          // Send notification
          await sendLiveNotification(videoId);

          // Log the video ID and publish date in the JSON file
          liveStatus[videoId] = publishedAt;
          fs.writeFileSync(`${__dirname}/../../json/live_status_yt_noro.json`, JSON.stringify(liveStatus, null, 2));

          console.log(`New live stream detected! Video ID: ${videoId}`);
        }
      }
    } catch (err) {
      console.error('Error checking live status:', err);
    }
  }

  async function sendLiveNotification(videoId) {
    const liveEmbed = new EmbedBuilder()
      .setTitle('🔴 Noro is now live on YouTube!')
      .setDescription(`Watch the stream [here](https://www.youtube.com/watch?v=${videoId}).`)
      .setColor('#ff0000') // You can customize the color
      .setTimestamp();

    // Replace DISCORD_TEXT_CHANNEL_ID with the actual ID of your Discord text channel
    const guild = await client.guilds.fetch('691793566556487731').catch(console.error);
    if (!guild) return;

    const channel = await guild.channels.fetch('1133622008303849554').catch(console.error);
    if (channel) {
      await channel.send({ content: '@everyone <@&1054980965736398858> Noro is now live on Youtube!', embeds: [liveEmbed], allowedMentions: { roles: ["1054980965736398858"] } });
    }
  }

  setInterval(checkLiveStatus, checkInterval); // Start checking for live status at the specified interval
};
