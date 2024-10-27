require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const path = require('path');
const sharp = require('sharp');

// Replace with your token from BotFather
const token = process.env.BOT_TOKEN; // Ensure to store your token securely

// Create a bot that uses 'polling' to fetch new updates
const bot = new TelegramBot(token, { polling: true });

// Your Telegram ID (admin)
const adminId = 715024870; // Replace with your Telegram ID

// Path to the original and processed cover images
const inputImagePath = path.join(__dirname, 'Cover.jpg');
const outputImagePath = path.join(__dirname, 'Cover_compressed.jpg');

// Function to compress the image
async function compressImage() {
    await sharp(inputImagePath)
        .resize({ width: 800 }) // Resize to a width of 800 pixels
        .jpeg({ quality: 80 }) // Convert to JPEG with 80% quality
        .toFile(outputImagePath);
    console.log('Image compressed successfully.');
}

// Store user data temporarily (in memory for simplicity)
const userData = {};

// Listen for any kind of message
bot.on('message', async (msg) => {
    const chatId = msg.chat.id;

    // Command handling (works at any stage)
    if (msg.text) {
        const text = msg.text.toLowerCase();

        if (text === '/start') {
            await compressImage();
            bot.sendPhoto(chatId, outputImagePath, {
                caption: 'This is a bot to buy the Album by Pastor Tizitawu Samuel. Please click the button below to buy it:',
                reply_markup: {
                    inline_keyboard: [
                        [
                            { text: 'Buy Album', callback_data: 'buy_album' }
                        ],
                    ],
                },
            });
            return;
        } else if (text === '/help') {
            return bot.sendMessage(chatId, 'This is a bot to buy Pastor Tizitaw Samuel album 8 songs. The followings are commands to use in this bot:\n/start - View album cover and buy options\n/help - Get help information\n/cancel - Cancel current operation\n/ping - Check if the bot works \n\nYou can contact us on @Tizitaw1 if you have any questions or problems');
        } else if (text === '/cancel') {
            delete userData[chatId];
            return bot.sendMessage(chatId, 'Operation canceled. You can start again by typing /start.');
        } else if (text === '/ping') {
            return bot.sendMessage(chatId, 'Bot is active!');
        }
    }

    // Check if the user is in a specific step of the process
    if (userData[chatId] && userData[chatId].step) {
        const currentStep = userData[chatId].step;

        if (currentStep === 'awaiting_name') {
            userData[chatId].name = msg.text; // Store user's name
            userData[chatId].step = 'awaiting_phone'; // Move to the next step

            // Send message to the user
            bot.sendMessage(chatId, 'Thank you, ' + msg.text + '! \nPlease enter your telegram phone number:\n\nType /cancel to cancel the current operation.');

        } else if (currentStep === 'awaiting_phone') {
            if (msg.text.toLowerCase() === '/cancel') {
                delete userData[chatId]; // Clear user data for this user
                return bot.sendMessage(chatId, 'Operation canceled. You can start again by typing /start.');
            }

            userData[chatId].phone = msg.text; // Store user's phone number
            userData[chatId].step = 'awaiting_payment_screenshot'; // Move to the next step

            // Send bank account details to the user
            bot.sendMessage(chatId, `Thank you! Please send 200 birr (200ETB) or 40 dollar (USD) to the following bank account:\n\nNigd bank \nAccount Name: Tekedem Samuel Kassa \nAccount Number: 1000369555007 \n\nFor those who live in USA(FirstBank)\nAccount: 4481297222 \nRouting: 107005047 \n\nPaypal payment \nPaypal number:333215284235 \nRouting: 031101279 \nPaypal link: (PayPal.Me/tizitawsamuel)\n\nAfter sending, please provide a screenshot of your payment.`);

        } else if (currentStep === 'awaiting_payment_screenshot') {
            if (msg.photo) {
                const fileId = msg.photo[msg.photo.length - 1].file_id; // Get the highest resolution photo
                const filePath = await bot.getFileLink(fileId);

                // Store the screenshot file ID
                userData[chatId].paymentScreenshot = fileId;

                // Notify the user that the information is being processed
                bot.sendMessage(chatId, 'Thank you for the screenshot! We will verify your payment and send you the download link shortly.');

                // Send all the collected information (name, phone, and payment screenshot) to the admin at once
                const { name, phone } = userData[chatId];
                const adminMessage = `User ${chatId} provided the following information:\n\nName: ${name}\nPhone: ${phone}`;

                // Send the admin message
                bot.sendMessage(adminId, adminMessage);

                // Send the payment screenshot with buttons
                bot.sendPhoto(adminId, fileId, {
                    caption: 'Payment screenshot from user ' + chatId,
                    reply_markup: {
                        inline_keyboard: [
                            [
                                { text: 'Send download link', callback_data: `send_link_${chatId}` },
                                { text: 'Not paid', callback_data: `not_paid_${chatId}` }
                            ]
                        ]
                    }
                });

            } else {
                bot.sendMessage(chatId, 'Please send a screenshot of your payment.');
            }
        }
    } else {
        // Default message if the user is not in any process
        if (msg.text && typeof msg.text === 'string') {
            bot.sendMessage(chatId, 'Hello! Please type /start to see the album cover and buttons.');
        } else {
            bot.sendMessage(chatId, 'Please send a text message. Type /start to begin.');
        }
    }
});

// Listen for button clicks
bot.on('callback_query', async (callbackQuery) => {
    const chatId = callbackQuery.message.chat.id;
    const data = callbackQuery.data;

    // Handle admin button clicks
    if (data.startsWith('send_link_')) {
        const userId = data.split('_')[2]; // Extract the user's chat ID
        // Send the download link to the user
        bot.sendMessage(userId, 'Payment verified! Here is your download link: [Download Album](https://t.me/+Yg3afiNSZqlhMTNh)', {
            parse_mode: 'Markdown',
        });
        bot.sendMessage(chatId, 'Download link sent to the user.');
        delete userData[userId]; // Clear user data after sending the link

    } else if (data.startsWith('not_paid_')) {
        const userId = data.split('_')[2]; // Extract the user's chat ID
        // Notify the user that the payment was not successful
        bot.sendMessage(userId, 'Unfortunately, we could not verify your payment. Please try again.\n\nYou can contact us on @Tizitaw1 if you have any questions');
        bot.sendMessage(chatId, 'User has been notified of payment failure.');
        delete userData[userId]; // Clear user data after notifying the user

    } else if (data === 'buy_album') {
        bot.sendMessage(chatId, 'Please provide your name:');
        userData[chatId] = { step: 'awaiting_name' }; // Set step for next response
    }

    // Acknowledge the callback query
    bot.answerCallbackQuery(callbackQuery.id);
});

// Error handling
bot.on('polling_error', (error) => {
    console.error(`Polling error: ${error.message}`);
});
