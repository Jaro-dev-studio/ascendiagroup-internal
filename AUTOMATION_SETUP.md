# Jaro.dev Automation System Setup Guide

## Overview

This automation system provides a complete AI-powered solution for running Jaro.dev as a one-person operation. It ingests data from Slack, email, GitHub, and other sources, processes it through vector and relational databases, and provides intelligent automation workflows.

## Architecture

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Data Sources  │───▶│  Context Processor │───▶│ Vector Database │
│                 │    │                  │    │    (Qdrant)     │
│ • Slack         │    │ • Entity Extract │    └─────────────────┘
│ • Email         │    │ • Sentiment      │              │
│ • GitHub        │    │ • Summarization  │              ▼
│ • Linear        │    │ • Threading      │    ┌─────────────────┐
└─────────────────┘    └──────────────────┘    │ Unified Chat API│
                                              │                 │
┌─────────────────┐    ┌──────────────────┐    │ • Semantic      │
│ Automation      │◀───│  PostgreSQL      │◀───│   Search        │
│ Workflows       │    │                  │    │ • Code Analysis │
│                 │    │ • Projects       │    │ • Context Merge │
│ • Auto Response │    │ • Contexts       │    └─────────────────┘
│ • Task Creation │    │ • Decisions      │
│ • Escalation    │    │ • Requirements   │
└─────────────────┘    └──────────────────┘
```

## Prerequisites

1. **Node.js 18+** and **pnpm**
2. **PostgreSQL** database
3. **Qdrant** vector database
4. **OpenAI API** access
5. **Slack workspace** and bot token
6. **Gmail/IMAP** access for email processing
7. **GitHub** access tokens for repositories

## Installation Steps

### 1. Install Dependencies

```bash
pnpm install
```

### 2. Database Setup

```
# Run db push
npx prisma db push
```

#### Qdrant Vector Database
```bash
# Using Docker
docker run -p 6333:6333 qdrant/qdrant

# Or install locally
# Follow: https://qdrant.tech/documentation/quick-start/
```

### 3. Environment Configuration

Create `.env.local` with the following variables:

```env
# Database
POSTGRES_PRISMA_URL="postgresql://username:password@localhost:5432/jaro_dev_studio"
POSTGRES_URL_NON_POOLING="postgresql://username:password@localhost:5432/jaro_dev_studio"

# NextAuth
NEXTAUTH_SECRET="your-nextauth-secret"
NEXTAUTH_URL="http://localhost:3000"

# OpenAI
OPENAI_API_KEY="sk-your-openai-api-key"

# Qdrant Vector Database
QDRANT_URL="http://localhost:6333"
QDRANT_API_KEY="your-qdrant-api-key" # Optional for local

# Slack Integration
SLACK_BOT_TOKEN="xoxb-your-slack-bot-token"
SLACK_SIGNING_SECRET="your-slack-signing-secret"
DEFAULT_PROJECT_ID="your-default-project-id"

# Email Integration
EMAIL_IMAP_HOST="imap.gmail.com"
EMAIL_IMAP_PORT=993
EMAIL_IMAP_USER="your-email@gmail.com"
EMAIL_IMAP_PASSWORD="your-app-password"

# GitHub Integration
GITHUB_TOKEN="ghp_your-github-token"

# Automation
ESCALATION_EMAIL="admin@jaro.dev"
```

### 4. Slack Bot Setup

1. Go to [Slack API](https://api.slack.com/apps)
2. Create new app "Jaro.dev Automation"
3. Enable these scopes:
   - `channels:history`
   - `channels:read`
   - `chat:write`
   - `users:read`
   - `files:read`
4. Install app to workspace
5. Copy Bot Token and Signing Secret
6. Set up Event Subscriptions:
   - URL: `https://yourdomain.com/api/slack/events`
   - Events: `message.channels`, `message.groups`, `message.im`

### 5. Gmail Setup (for email processing)

1. Enable 2FA on Gmail account
2. Generate App Password
3. Use App Password in `EMAIL_IMAP_PASSWORD`

### 6. GitHub Setup

1. Create Personal Access Token
2. Grant these permissions:
   - `repo` (for private repos)
   - `public_repo` (for public repos)
   - `read:org`

### 7. Create First Project

```bash
# Start the application
pnpm dev

# Navigate to http://localhost:3000/dashboard/projects
# Create your first project
# Note the Project ID for configuration
```

## Usage

### 1. Data Ingestion

#### Slack Messages
- Real-time via webhooks (automatic)
- Historical sync: Use Slack integration methods

#### Email Processing
```typescript
import { createEmailIntegration } from '@/lib/integrations/email';

const emailIntegration = createEmailIntegration({
  imap: {
    host: 'imap.gmail.com',
    port: 993,
    tls: true,
    user: 'your-email@gmail.com',
    password: 'your-app-password',
  },
  projectId: 'your-project-id',
});

// Sync recent emails
await emailIntegration.syncEmails({ since: new Date('2024-01-01') });

// Start monitoring (optional)
await emailIntegration.startMonitoring(60000); // Check every minute
```

#### GitHub Repository Sync
```typescript
import { createGitHubIntegration } from '@/lib/integrations/github';

const github = createGitHubIntegration({
  token: 'your-github-token',
  owner: 'your-username',
  repo: 'your-repo',
  projectId: 'your-project-id',
});

// Sync repository metadata
await github.syncRepositoryData();

// Query codebase
const result = await github.queryCodebase('How does authentication work?');
```

### 2. Unified Chat API

```bash
# Query the AI brain
curl -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{
    "projectId": "your-project-id",
    "message": "What did the client say about the login feature?",
    "options": {
      "includeCode": true,
      "responseStyle": "detailed"
    }
  }'
```

### 3. Automation Workflows

The system includes built-in automation rules:

- **Auto-respond to questions** during business hours
- **Escalate urgent issues** to team leads
- **Create tasks** from feature requests
- **Schedule meetings** for complex discussions

#### Custom Automation Rules
```typescript
import { automationEngine } from '@/lib/automation-engine';

await automationEngine.addRule({
  id: 'custom-rule-1',
  projectId: 'your-project-id',
  name: 'Auto-create tasks from Slack',
  description: 'Create tasks when someone mentions "TODO" in Slack',
  enabled: true,
  priority: 1,
  triggers: [{
    type: 'keyword_mentioned',
    config: { keywords: ['TODO', 'task', 'implement'] }
  }],
  conditions: [{
    type: 'time_of_day',
    operator: 'in_range',
    value: [9, 17]
  }],
  actions: [{
    type: 'create_task',
    config: {
      title: 'Task from Slack: {context.content}',
      priority: 'MEDIUM',
      type: 'DEVELOPMENT'
    }
  }]
});
```

## API Endpoints

### Chat API
- `POST /api/chat` - Query the unified AI system

### Slack Integration
- `POST /api/slack/events` - Webhook for Slack events

### Project Management
- Standard CRUD operations for projects, tasks, requirements, etc.

## Monitoring and Analytics

### Vector Database Stats
```typescript
import { vectorDb } from '@/lib/vector-db';

const stats = await vectorDb.getCollectionInfo('your-project-id');
console.log(`Indexed contexts: ${stats.points_count}`);
```

### Context Analytics
```sql
-- Most active communication channels
SELECT source_type, COUNT(*) as message_count
FROM "Context"
WHERE project_id = 'your-project-id'
GROUP BY source_type
ORDER BY message_count DESC;

-- Sentiment analysis over time
SELECT DATE(timestamp) as date, sentiment, COUNT(*) as count
FROM "Context"
WHERE project_id = 'your-project-id'
GROUP BY DATE(timestamp), sentiment
ORDER BY date DESC;
```

## Troubleshooting

### Common Issues

1. **Vector database connection failed**
   - Ensure Qdrant is running on port 6333
   - Check QDRANT_URL in environment

2. **Slack events not received**
   - Verify webhook URL is accessible
   - Check Slack app permissions
   - Validate signing secret

3. **Email sync not working**
   - Confirm IMAP settings
   - Use App Password for Gmail
   - Check firewall/network access

4. **GitHub API rate limits**
   - Use authenticated requests
   - Implement caching for repository data
   - Consider GitHub Apps for higher limits

### Logs and Debugging

```bash
# Enable debug logging
DEBUG=automation:* pnpm dev

# Check specific components
DEBUG=vector-db,context-processor pnpm dev
```

## Security Considerations

1. **Environment Variables**: Never commit `.env` files
2. **API Keys**: Rotate regularly, use least-privilege access
3. **Database**: Enable row-level security for multi-tenant setups
4. **Webhooks**: Always verify signatures
5. **Vector Data**: Implement project-level isolation

## Performance Optimization

1. **Vector Search**: Use appropriate score thresholds
2. **Database**: Add indexes for common queries
3. **Caching**: Implement Redis for frequently accessed data
4. **Batch Processing**: Process contexts in batches during high volume

## Scaling Considerations

1. **Horizontal Scaling**: Use Redis for session storage
2. **Database**: Consider read replicas for analytics
3. **Vector Database**: Qdrant supports clustering
4. **Queue System**: Add Redis/Bull for background jobs

## Support

For issues and questions:
1. Check logs in `/logs` directory
2. Review database constraints and indexes
3. Monitor API rate limits
4. Contact: support@jaro.dev

---

**Next Steps:**
1. Complete the setup following this guide
2. Create your first project and sync data sources
3. Test the unified chat API with sample queries
4. Configure automation rules for your workflow
5. Monitor performance and adjust as needed
