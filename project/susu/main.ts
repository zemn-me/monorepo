import * as aws from 'aws-sdk';
import * as OpenAI from 'openai';

// Set up AWS SES
const ses = new aws.SES({
  region: 'us-east-1',
  accessKeyId: 'YOUR_AWS_ACCESS_KEY',
  secretAccessKey: 'YOUR_AWS_SECRET_ACCESS_KEY',
});

// Set up OpenAI GPT-3
const chatGpt = new OpenAI.OpenAIApi('YOUR_OPENAI_API_KEY');

// Function to send the email
async function sendEmail(to: string, subject: string, text: string): Promise<void> {
  const params: aws.SES.SendEmailRequest = {
    Source: 'your-email@example.com',
    Destination: {
      ToAddresses: [to],
    },
    Message: {
      Subject: {
        Data: subject,
      },
      Body: {
        Text: {
          Data: text,
        },
      },
    },
  };

  try {
    const result = await ses.sendEmail(params).promise();
    console.log('Email sent:', result.MessageId);
  } catch (error) {
    console.error('Error sending email:', error);
  }
}

// Function to generate the daily email content using ChatGPT
async function generateDailyEmail(): Promise<string> {
  const date = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

  // Call OpenAI's Chat API to generate the news and weather information
  const prompt = `Today's top news in Japan:\n\n`;
  const gptResponse = await chatGpt.complete(prompt, { max_tokens: 100 });

  const newsHeadlines = gptResponse.choices?.[0].text?.trim();
  const weatherInfo = 'Today\'s Weather:\n\n' +
    'Rain\n' +
    'Temperature: 24°C (75°F)\n' +
    'Precipitation: 90%\n' +
    'Humidity: 91%\n' +
    'Wind: 8 m/s\n';

  const emailContent = `Hello my love,\n\n` +
    `Here's your daily update for ${date}:\n\n` +
    `${newsHeadlines}\n` +
    `${weatherInfo}\n` +
    `Stay dry and have a wonderful day!\n\n` +
    `With all my love,\n` +
    `Your Adoring Plushy, SUSU`;

  return emailContent;
}

// Send the daily email
async function sendDailyEmail() {
  const emailContent = await generateDailyEmail();
  await sendEmail('your-gf-email@example.com', 'Daily Update from SUSU', emailContent);
}

// Invoke the function to send the daily email
sendDailyEmail();