const express = require("express")
require('dotenv').config()
const PORT = 8765
const app = express()
const cron = require('node-cron') // SCHEDULER
const fetch= require('node-fetch')
const { zonedTimeToUtc } = require('date-fns-tz');
// import fetch from "node-fetch"
app.use(express.json())

app.get("*", (req, res) => {
    res.send("hello its me there !")
})

const TelegramBot = require('node-telegram-bot-api');
const schedule = require('node-schedule');

// // Replace with your bot token
const BOT_TOKEN = process.env.BOT_TOKEN;

var BOT_OWNER_ID = ''; // Your unique Telegram user ID

// owner password
const OWNER_PASSWORD=process.env.OWNER_PASSWORD

// // Replace with your group chat ID
var GROUP_CHAT_ID = process.env.GROUP_CHAT_ID;

const bot = new TelegramBot(BOT_TOKEN, { polling: true });

// // Store user messages and schedule
let messageSchedule = {};

// checking if bot is added to a group 
bot.on('my_chat_member', (msg) => {
    const chat = msg.chat;
    const newStatus = msg.new_chat_member?.status; // Check the new status
  
    if (newStatus === 'member') {
      // Bot was added to a group
    //   console.log(`Bot added to a group: ${chat.title} (${chat.id})`);
  
      // Notify the admin or user
      if(BOT_OWNER_ID!=''){
        // console.log(BOT_OWNER_ID)
        bot.sendMessage(
            BOT_OWNER_ID,
            `The bot was added to a new group:\n\nGroup Name: ${chat.title}\nGroup ID: ${chat.id}`
          );
      }
    }
  });

// // Listen for user messages
bot.on('message', async (msg) => {

        const chatId = msg.chat.id;
        const text = msg.text;

        if(text?.startsWith("/password")){
            const parts = text.split(' ')
            if(parts[1]===OWNER_PASSWORD){
                BOT_OWNER_ID=chatId
                bot.sendMessage(chatId, 'Now you are the owner')
            }
            else{
                bot.sendMessage(chatId, 'Invalid Password !\nUsage: /password <YourPasswordWithoutSpace>')
            }

            return
        }

        if (chatId !== BOT_OWNER_ID) {
            if(chatId?.toString().startsWith("-")){
                return
            }
            else if(text === '/start'){
                bot.sendMessage(chatId, `Hello there, use /help to see all commands !`)
                return
            }
            bot.sendMessage(chatId, 'Sorry, only the bot owner can use this command.');
            return;
        }

    if(chatId.toString().startsWith("-")){
        GROUP_CHAT_ID=msg.chat.id
        // console.log(chatId)
    }



    // console.log(`chat id : ${chatId}`)
    // console.log(`message text : ${text}`)
    // console.log(`group name : ${msg.chat.title}`)

    if(text === '/start'){
        bot.sendMessage(chatId, `Hello there, use /help to see all commands !`)
    }
    else if (text?.startsWith('/schedule')) {

        // bot.getChat(GROUP_CHAT_ID)
        //     .then((chat) => {
        //         console.log(`Group Name: ${chat.title}`);
        //     })
        //     .catch((error) => {
        //         console.error('Error fetching chat info:', error.message);
        //     });

        const parts = text.split(' ');

        if (parts.length < 3) {
            bot.sendMessage(chatId, 'Usage: /schedule <time> <message>\nExample: /schedule 14:30 Hello Group!');
            return;
        }

        const time = parts[1]; // e.g., "14:30"
        const userMessage = parts.slice(2).join(' '); // Rest is the message

        // Validate time format (HH:mm)
        const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;
        if (!timeRegex.test(time)) {
            bot.sendMessage(chatId, 'Invalid time format. Use HH:mm (24-hour format).');
            return;
        }

        const [hours, minutes] = time.split(':').map(Number);

        // Schedule the message
        const localNow = new Date();
        const now = new Date(localNow.toISOString());
        const userLocalScheduledTime = new Date(
            now.getFullYear(),
            now.getMonth(),
            now.getDate(),
            hours,
            minutes
        );

        const scheduleTime = zonedTimeToUtc(userLocalScheduledTime, 'Asia/Kolkata');

        if (scheduleTime <= now) {
            scheduleTime.setDate(scheduleTime.getDate() + 1);
            bot.sendMessage(chatId, `Scheduled Time : ${scheduleTime}\nTime Now : ${now}`);
            return;
        }

        // Schedule the job
        const job = schedule.scheduleJob(scheduleTime, () => {
            bot.sendMessage(GROUP_CHAT_ID, userMessage);
        });
        const uniqueJobID = job.name.slice(17, -1)
        messageSchedule[uniqueJobID] = job;
        // console.log(job.name)
        // console.log(uniqueJobID)
        // console.log(messageSchedule)

        bot.sendMessage(chatId, `Message Scheduled Successfully\nJob ID : ${uniqueJobID} \nTime: ${time}\nMessage : "${userMessage}"`);
    }
    else if (text === '/cancelall') {
        // console.log("cancell all called")

        Object.keys(messageSchedule).forEach((jobId) => {
            // console.log(jobId)
            messageSchedule[jobId].cancel();
            delete messageSchedule[jobId];
        })
        bot.sendMessage(chatId, "Cancel : Successful")
    }
    else if (text?.startsWith('/cancel')) {
        const parts = text.split(' ');

        if (parts.length < 2) {
            bot.sendMessage(chatId, 'Usage: /cancel <job_id>');
            return;
        }

        const jobId = parts[1];

        if (messageSchedule[jobId]) {
            messageSchedule[jobId].cancel();
            delete messageSchedule[jobId];
            bot.sendMessage(chatId, `Job with ID ${jobId} has been canceled.`);
        } else {
            bot.sendMessage(chatId, `No job found with ID ${jobId}.`);
        }
    }
    else if (text === '/greetme') {
        // console.log("we reached here")
        bot.sendMessage(chatId, "hi i am aj bot created by one and only ajay !")
    }
    else if(text==='/help'){
        bot.sendMessage(chatId, `All Commands are - \n/schedule\n/cancelall\n/cancel\n/password\n/help`)
    }
    else if(text?.startsWith("/groupid")){
        const parts = text.split(' ')
        process.env.GROUP_CHAT_ID=parts[1]
        // console.log(process.env.GROUP_CHAT_ID)
    }
    else if(text?.startsWith("/")){
        bot.sendMessage(chatId, `It is not valid a command.\nUse /help command to see all valid commands.`)
    }
});

// MAKING SCHEDULED TASK TO PROTECT SERVER FROM SLEEPING--------------------------

cron.schedule('*/14 * * * *', ()=>{
    fetch(process.env.SERVER_AWAKE_URL, {method: 'POST'}).then((r1)=>{
      console.log("server awake")
    })
  })
  
// ------------------------------------------------------------------


app.listen(PORT, () => {
    console.log(`Server running at port : ${PORT}`)
})