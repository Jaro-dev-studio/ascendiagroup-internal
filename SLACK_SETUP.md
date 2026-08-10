# 🚀 Slack Integration Setup Guide

## Step 4: Environment Variables

Create a `.env.local` file in your project root with these values:

```env
# Slack Integration
SLACK_BOT_TOKEN="xoxb-your-slack-bot-token-here"
SLACK_SIGNING_SECRET="your-slack-signing-secret-here"

# Database (required)
POSTGRES_PRISMA_URL="postgresql://username:password@localhost:5432/jaro_dev_studio"
POSTGRES_URL_NON_POOLING="postgresql://username:password@localhost:5432/jaro_dev_studio"

# OpenAI (required)
OPENAI_API_KEY="sk-your-openai-api-key-here"

# Qdrant Vector Database (required)
QDRANT_URL="http://localhost:6333"
QDRANT_API_KEY="" # Optional for local development

# NextAuth (required)
NEXTAUTH_SECRET="your-nextauth-secret-here"
NEXTAUTH_URL="http://localhost:3000"
```

## Step 5: Set Up Event Subscriptions

1. In your Slack app dashboard, go to **"Event Subscriptions"**
2. Toggle **"Enable Events"** to ON
3. Set **Request URL** to: `https://studio.jaro.dev/api/slack/events`
   - For local development: Use ngrok or similar tunneling service
4. Under **"Subscribe to bot events"**, add:
   ```
   message.channels    - Messages in public channels
   message.groups      - Messages in private channels  
   message.im          - Direct messages
   message.mpim        - Group messages
   ```
5. Click **"Save Changes"**

## Step 6: For Local Development (Using ngrok)

If testing locally, you'll need to expose your local server:

```bash
# Install ngrok if you haven't
npm install -g ngrok

# In one terminal, start your Next.js app
pnpm dev

# In another terminal, expose port 3000
ngrok http 3000
```

Use the ngrok HTTPS URL for your Slack webhook: `https://abc123.ngrok.io/api/slack/events`

## Step 7: Set Up Channel Mappings

1. Start your application: `pnpm dev`
2. Go to: `http://localhost:3000/dashboard/projects`
3. Create your projects (one for each client)
4. Copy the Project IDs from the URLs
5. Update channel mappings in `app/api/slack/events/route.ts`:

```javascript
const channelMappings = {
  "C1234567890": "project-abc123",  // #client-acme → Acme Corp project
  "C0987654321": "project-def456",  // #client-startup → Startup X project
};
```

### Finding Channel IDs

To get Slack channel IDs:
1. Open Slack in browser
2. Navigate to the channel
3. Copy the ID from URL: `https://app.slack.com/client/T.../C1234567890`
4. Or right-click channel → "Copy link" → extract ID

## Step 8: Test the Integration

1. Restart your application after setting up channel mappings
2. Send a message in a **mapped** Slack channel where your bot is added
3. Check your application logs for processing messages
4. For **unmapped** channels, you'll see warning logs with channel IDs
5. Verify data is being stored in your database for mapped channels

## Troubleshooting

### Bot Not Receiving Messages
- Ensure bot is added to the channel: `/invite @your-bot-name`
- Check Event Subscriptions are properly configured
- Verify webhook URL is accessible

### Signature Verification Fails
- Double-check your Signing Secret
- Ensure timestamp is within 5 minutes
- Verify webhook URL is correct

### Database Errors
- Ensure PostgreSQL is running
- Run migrations: `npx prisma migrate dev`
- Check database connection string

### Missing Dependencies
```bash
# Install any missing packages
pnpm install @slack/web-api @qdrant/js-client-rest compromise natural
```

## What Happens Next

Once configured, your Slack integration will:

1. **Receive all messages** from channels where the bot is added
2. **Process context** with AI (entity extraction, sentiment analysis)
3. **Store in vector database** for semantic search
4. **Trigger automation rules** (auto-responses, task creation)
5. **Enable unified chat** queries across all project data

## Testing the System

Try these in Slack after setup:

1. **Ask a question**: "How does authentication work?"
2. **Request a feature**: "Can we add dark mode?"
3. **Report an issue**: "The login page is broken"

The system should automatically process these and potentially respond or create tasks based on your automation rules.

## Next Steps

After Slack is working:
1. Set up email integration
2. Configure GitHub repositories
3. Customize automation rules
4. Test the unified chat API

Your AI brain is now connected to Slack! 🧠✨
