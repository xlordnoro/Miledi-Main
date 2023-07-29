const fs = require('fs');
const https = require('https');
const { EmbedBuilder } = require('discord.js');
require('dotenv').config();
const cron = require("node-cron");

const twitchClientId = process.env.TWITCH_CLIENT_ID;
const twitchClientSecret = process.env.TWITCH_CLIENT_SECRET;
let twitchAccessToken = process.env.TWITCH_ACCESS_TOKEN;
let accessTokenExpiry = 0;
const twitchRefreshToken = process.env.TWITCH_REFRESH_TOKEN;
const twitchUserId = process.env.TWITCH_USER_ID;
const tokenRefreshInterval = 60 * 24 * 60 * 1000; // 60 days in milliseconds

module.exports = async (client) => {
  async function refreshToken() {
    // Check if the access token is expired
    if (Date.now() > accessTokenExpiry) {
      // Refresh the access token using the refresh token
      const data = JSON.stringify({
        grant_type: 'refresh_token',
        refresh_token: twitchRefreshToken,
        client_id: twitchClientId,
        client_secret: twitchClientSecret,
      });

      const options = {
        hostname: 'id.twitch.tv',
        port: 443,
        path: '/oauth2/token',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': data.length,
        },
      };

      const req = https.request(options, (res) => {
        let body = '';
        res.on('data', (chunk) => {
          body += chunk;
        });
        res.on('end', () => {
          const tokenData = JSON.parse(body);
          twitchAccessToken = tokenData.access_token;
          accessTokenExpiry = Date.now() + tokenData.expires_in * 1000;
          console.log('Twitch API Access Token has been refreshed.');
        });
      });

      req.on('error', (error) => {
        console.error('Error refreshing Twitch API access token:', error);
      });

      req.write(data);
      req.end();
    }
  }

  // Call refreshToken every 60 days (tokenRefreshInterval)
  setInterval(refreshToken, tokenRefreshInterval);

  async function checkLiveStatus() {
    try {
      const options = {
        headers: {
          'Client-ID': twitchClientId, // Replace with your Twitch Client ID
          'Authorization': `Bearer ${twitchAccessToken}`,
        },
      };

      https.get(`https://api.twitch.tv/helix/streams?user_id=${twitchUserId}`, options, (response) => {
        let data = '';
        response.on('data', (chunk) => {
          data += chunk;
        });

        response.on('end', async () => {
          try {
            const liveStreams = JSON.parse(data).data;

            // Check if liveStreams is not empty
            if (liveStreams && liveStreams.length > 0) {
              const videoId = liveStreams[0].id;
              const publishedAt = liveStreams[0].started_at;

              // Load the existing data from the JSON file
              let liveStatus = {};
              if (fs.existsSync(`${__dirname}/../../json/live_status_twitch_noro.json`)) {
                const rawContent = fs.readFileSync(`${__dirname}/../../json/live_status_twitch_noro.json`);
                liveStatus = JSON.parse(rawContent);
              }

              // Check if the video is already announced as live
              if (!liveStatus[videoId] || liveStatus[videoId] !== publishedAt) {
                // Send notification
                await sendLiveNotification(videoId);

                // Log the video ID and publish date in the JSON file
                liveStatus[videoId] = publishedAt;
                fs.writeFileSync(`${__dirname}/../../json/live_status_twitch_noro.json`, JSON.stringify(liveStatus, null, 2));

                console.log(`New live stream detected! Video ID: ${videoId}`);
              }
            }
          } catch (error) {
            console.error('Error parsing Twitch API response:', error);
          }
        });
      });
    } catch (err) {
      console.error('Error checking live status:', err);
    }
  }

  async function sendLiveNotification(videoId) {
    const liveEmbed = new EmbedBuilder()
      .setTitle('🔴 Noro is now live on Twitch!')
      .setDescription(`Watch the stream [here](https://www.twitch.tv/videos/${videoId}).`)
      .setColor('#ff0000') // You can customize the color
      .setTimestamp();

    // Replace DISCORD_TEXT_CHANNEL_ID with the actual ID of your Discord text channel
    const guild = await client.guilds.fetch('691793566556487731').catch(console.error);
    if (!guild) return;

    const channel = await guild.channels.fetch('1069474383720099930').catch(console.error);
    if (channel) {
      await channel.send({ content: '@everyone <@&1054980965736398858> Noro is now live on Twitch!', embeds: [liveEmbed], allowedMentions: { roles: ["1054980965736398858"] } });
    }
  }

  // Schedule the checkLiveStatus function to run on every hour
  cron.schedule("0 * * * *", () => {
    checkLiveStatus();
  });
};