import { Resend } from 'resend';
import { NewsSummary } from './openai';

const resend = new Resend(process.env.RESEND_API_KEY);

export async function sendNewsDigest(
  email: string,
  summaries: NewsSummary[],
  isPaid: boolean = false
): Promise<boolean> {
  try {
    const html = generateEmailHTML(summaries, isPaid);

    const { data, error } = await resend.emails.send({
      from: 'SnipIt <noreply@resend.dev>', // Using Resend's free domain
      to: [email],
      subject: `Your SnipIt Daily Digest - ${new Date().toLocaleDateString()}`,
      html,
    });

    if (error) {
      console.error('Error sending email:', error);
      return false;
    }

    console.log('Email sent successfully:', data);
    return true;
  } catch (error) {
    console.error('Error sending email:', error);
    return false;
  }
}

function generateEmailHTML(summaries: NewsSummary[], isPaid: boolean): string {
  const formatClass = isPaid ? 'paragraph' : 'bullet';

  return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Your SnipIt Daily Digest</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
            background-color: #f8f9fa;
        }
        .header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 30px;
            text-align: center;
            border-radius: 10px 10px 0 0;
            margin-bottom: 0;
        }
        .header h1 {
            margin: 0;
            font-size: 28px;
            font-weight: 700;
        }
        .header p {
            margin: 10px 0 0 0;
            opacity: 0.9;
            font-size: 16px;
        }
        .content {
            background: white;
            padding: 30px;
            border-radius: 0 0 10px 10px;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        }
        .topic-section {
            margin-bottom: 30px;
            padding-bottom: 20px;
            border-bottom: 1px solid #e9ecef;
        }
        .topic-section:last-child {
            border-bottom: none;
            margin-bottom: 0;
        }
        .topic-title {
            font-size: 20px;
            font-weight: 600;
            color: #495057;
            margin-bottom: 15px;
            display: flex;
            align-items: center;
        }
        .topic-icon {
            width: 20px;
            height: 20px;
            margin-right: 10px;
            background: #667eea;
            border-radius: 50%;
        }
        .summary-item {
            margin-bottom: 15px;
            padding: 15px;
            background: #f8f9fa;
            border-radius: 8px;
            border-left: 4px solid #667eea;
        }
        .summary-item:last-child {
            margin-bottom: 0;
        }
        .article-title {
            font-size: 16px;
            font-weight: 600;
            color: #212529;
            margin-bottom: 8px;
        }
        .article-title a {
            color: #667eea;
            text-decoration: none;
        }
        .article-title a:hover {
            text-decoration: underline;
        }
        .article-summary {
            font-size: 14px;
            color: #6c757d;
            margin-bottom: 8px;
        }
        .article-meta {
            font-size: 12px;
            color: #adb5bd;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        .article-source {
            font-weight: 500;
        }
        .bullet-list {
            margin: 0;
            padding-left: 20px;
        }
        .bullet-list li {
            margin-bottom: 8px;
        }
        .footer {
            text-align: center;
            margin-top: 30px;
            padding-top: 20px;
            border-top: 1px solid #e9ecef;
            color: #6c757d;
            font-size: 14px;
        }
        .footer a {
            color: #667eea;
            text-decoration: none;
        }
        .tier-badge {
            display: inline-block;
            background: ${isPaid ? '#28a745' : '#6c757d'};
            color: white;
            padding: 4px 8px;
            border-radius: 4px;
            font-size: 12px;
            font-weight: 500;
            margin-left: 10px;
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>📰 SnipIt</h1>
        <p>Your personalized news digest for ${new Date().toLocaleDateString()}</p>
        <span class="tier-badge">${isPaid ? 'PRO' : 'FREE'}</span>
    </div>
    
    <div class="content">
        ${summaries
          .map(
            (topicSummary) => `
            <div class="topic-section">
                <div class="topic-title">
                    <div class="topic-icon"></div>
                    ${topicSummary.topic}
                </div>
                ${topicSummary.summaries
                  .map(
                    (article) => `
                    <div class="summary-item">
                        <div class="article-title">
                            <a href="${article.url}" target="_blank">${
                      article.title
                    }</a>
                        </div>
                        <div class="article-summary">
                            ${
                              isPaid
                                ? `<p>${article.summary}</p>`
                                : `<ul class="bullet-list"><li>${article.summary}</li></ul>`
                            }
                        </div>
                        <div class="article-meta">
                            <span class="article-source">${
                              article.source
                            }</span>
                            <span>Read more →</span>
                        </div>
                    </div>
                `
                  )
                  .join('')}
            </div>
        `
          )
          .join('')}
    </div>
    
    <div class="footer">
        <p>
            <a href="${
              process.env.NEXT_PUBLIC_APP_URL
            }/dashboard">Manage your topics</a> | 
            <a href="${
              process.env.NEXT_PUBLIC_APP_URL
            }/unsubscribe?email=${encodeURIComponent(email)}">Unsubscribe</a>
        </p>
        <p>© 2024 SnipIt. Stay informed, stay focused.</p>
    </div>
</body>
</html>
  `;
}
