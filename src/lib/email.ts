import { Resend } from 'resend';
import { NewsSummary } from './openai';

const resend = new Resend(process.env.RESEND_API_KEY);


export async function sendNewsDigest(
  email: string,
  summaries: NewsSummary[],
  isPaid: boolean = false
): Promise<{ success: boolean; error?: string; details?: unknown }> {
  try {
    if (!process.env.RESEND_API_KEY) {
      const errorMsg = 'RESEND_API_KEY is not configured';
      console.error(`[Email] ${errorMsg}`);
      return { success: false, error: errorMsg };
    }

    const html = generateEmailHTML(email, summaries, isPaid);

    const { data, error } = await resend.emails.send({
      from: 'SnipIt <nofluff@newsletter.snipit.news>', // Using custom domain
      to: [email],
      subject: `Your SnipIt Daily Digest - ${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`,
      html,
    });

    if (error) {
      const errorDetails = typeof error === 'object' ? JSON.stringify(error, null, 2) : error;
      console.error(`[Email] Failed to send to ${email}:`, errorDetails);
      return { 
        success: false, 
        error: `Resend API error: ${typeof error === 'object' && 'message' in error ? error.message : String(error)}`,
        details: error 
      };
    }

    console.log(`[Email] Successfully sent to ${email}`, data?.id ? `(ID: ${data.id})` : '');
    return { success: true, details: data };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;
    console.error(`[Email] Exception sending to ${email}:`, errorMessage, errorStack);
    return { 
      success: false, 
      error: errorMessage,
      details: error 
    };
  }
}

function generateEmailHTML(email: string, summaries: NewsSummary[], isPaid: boolean): string {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://snipit.news';

  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta content="text/html; charset=UTF-8" http-equiv="Content-Type">
    <meta name="x-apple-disable-message-reformatting">
    <title>Your SnipIt Daily Digest</title>
    <link rel="preload" href="https://res.cloudinary.com/dgqg2myag/image/upload/v1748666252/logo-white_gp5iuq.png">
    <link rel="preload" href="https://res.cloudinary.com/dgqg2myag/image/upload/v1748662022/snipit-logo_vzcwe5.png">
    <link rel="preload" href="https://res.cloudinary.com/dgqg2myag/image/upload/v1748662914/snipit-logo-black_fttbsx.png">
    <style>
      @font-face {
        font-family: 'Roboto';
        font-style: normal;
        font-weight: 400;
        mso-font-alt: 'sans-serif';
        src: url(https://fonts.googleapis.com/css2?family=Roboto:wght@400;700&display=swap) format('woff2');
      }
      @font-face {
        font-family: 'Raleway';
        font-style: normal;
        font-weight: 400;
        mso-font-alt: 'sans-serif';
        src: url(https://fonts.googleapis.com/css2?family=Raleway:wght@400;700&display=swap) format('woff2');
      }
      * {
        font-family: 'Roboto', 'Raleway', sans-serif;
      }
      /* Desktop styles - spread across full width */
      @media only screen and (min-width: 601px) {
        .container {
          max-width: 100% !important;
          width: 100% !important;
        }
        .content-wrapper {
          max-width: 1200px;
          margin: 0 auto;
          width: 100%;
        }
      }
      /* Responsive styles */
      @media only screen and (max-width: 600px) {
        .container {
          width: 100% !important;
          max-width: 100% !important;
        }
        .header-padding {
          padding-left: 20px !important;
          padding-right: 20px !important;
        }
        .content-padding {
          padding-left: 20px !important;
          padding-right: 20px !important;
        }
        .topic-padding {
          padding-left: 20px !important;
          padding-right: 20px !important;
          padding-top: 30px !important;
          padding-bottom: 30px !important;
          margin-bottom: 24px !important;
        }
        .header-height {
          height: auto !important;
          min-height: 80px !important;
          padding-top: 16px !important;
          padding-bottom: 16px !important;
        }
        .title-size {
          font-size: 32px !important;
        }
        .subtitle-size {
          font-size: 16px !important;
        }
        .topic-title-size {
          font-size: 28px !important;
        }
        .article-title-size {
          font-size: 18px !important;
        }
        .logo-size {
          height: 35px !important;
        }
        .bullet-logo-size {
          height: 22px !important;
        }
        .header-logo {
          width: 100% !important;
          text-align: left !important;
        }
        .header-text {
          width: 100% !important;
          text-align: left !important;
          margin-top: 10px !important;
        }
        .news-update {
          font-size: 18px !important;
        }
        }
    </style>
    <div style="display:none;overflow:hidden;line-height:1px;opacity:0;max-height:0;max-width:0">
      SnipIt News
    </div>
</head>
<body style="margin:0;padding:0;background-color:#ffffff">
    <table align="center" width="100%" border="0" cellpadding="0" cellspacing="0" role="presentation" style="max-width:100%;width:100%;margin:0 auto;background-color:#ffffff" class="container">
      <tbody>
        <tr>
          <td class="content-wrapper" style="max-width:1200px;margin:0 auto;width:100%">
            <!-- Header -->
            <table align="center" width="100%" border="0" cellpadding="0" cellspacing="0" role="presentation" style="background:#2d2d2d;color:#ffffff;margin:0;padding-top:24px;padding-bottom:24px" class="header-height header-padding">
              <tbody>
                <tr>
                  <td>
                    <table align="center" width="100%" border="0" cellpadding="0" cellspacing="0" role="presentation">
                      <tbody>
                        <tr>
                          <td style="text-align:center">
                            <img src="https://res.cloudinary.com/dgqg2myag/image/upload/v1748666252/logo-white_gp5iuq.png" alt="SnipIt" style="display:block;outline:none;border:none;text-decoration:none;height:41px;margin:0 auto" class="logo-size">
                          </td>
                        </tr>
                        <tr>
                          <td style="text-align:center">
                            <p style="font-size:25px;line-height:24px;text-align:center;letter-spacing:0px;text-transform:uppercase;opacity:1;margin-top:10px;margin-bottom:0;font-family:Roboto,sans-serif;color:#ffffff" class="news-update">
                              NEWS UPDATE
                            </p>
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </td>
                </tr>
              </tbody>
            </table>
            
            <!-- The Cut Section -->
            <table align="center" width="100%" border="0" cellpadding="0" cellspacing="0" role="presentation" style="font-family:Roboto,sans-serif;margin-bottom:46px;padding-left:51px;padding-right:51px" class="content-padding">
              <tbody>
                <tr>
                  <td>
                    <p style="font-size:40px;line-height:32px;text-align:left;letter-spacing:0px;color:#fe7e4c;opacity:1;font-weight:bold;margin-top:24px;margin-bottom:16px" class="title-size">
                      The Cut
                    </p>
                    <p style="font-size:18px;line-height:24px;color:#707070;font-weight:bold;margin-top:16px;margin-bottom:24px" class="subtitle-size">
                      Quick Bullet-Point Summary –
                      <span style="font-style:italic;font-weight:normal">Under 60 Seconds</span>
                    </p>
                  </td>
                </tr>
              </tbody>
            </table>
            
            ${summaries.map((topicSummary) => {
              const topicName = topicSummary.topic.charAt(0).toUpperCase() + topicSummary.topic.slice(1);
              
              // Handle case where no summaries are available
              if (!topicSummary.summaries || topicSummary.summaries.length === 0) {
                return `
            <!-- Topic Section: ${topicName} - No Updates -->
            <table align="center" width="100%" border="0" cellpadding="0" cellspacing="0" role="presentation" style="background-color:#fbfbfb;margin-bottom:30px;padding-top:43px;padding-left:51px;padding-right:51px;padding-bottom:45px" class="topic-padding">
              <tbody>
                <tr>
                  <td>
                    <!-- Topic Header -->
                    <table align="center" width="100%" border="0" cellpadding="0" cellspacing="0" role="presentation" style="margin-bottom:30px">
                      <tbody>
                        <tr>
                          <td>
                            <table align="center" width="100%" border="0" cellpadding="0" cellspacing="0" role="presentation">
                            <tbody>
                              <tr>
                                <td style="width:40px;vertical-align:middle">
                                  <img src="https://res.cloudinary.com/dgqg2myag/image/upload/v1748662022/snipit-logo_vzcwe5.png" alt="SnipIt" style="display:block;outline:none;border:none;text-decoration:none;height:41px" class="logo-size">
                                </td>
                                <td style="vertical-align:middle">
                                  <p style="font-size:35px;line-height:32px;font-family:Raleway,sans-serif;font-weight:bold;margin-top:16px;margin-bottom:16px;color:#000000" class="topic-title-size">
                                    ${topicName}
                                  </p>
                                </td>
                              </tr>
                            </tbody>
                          </table>
                          </td>
                        </tr>
                      </tbody>
                    </table>
                    
                    <!-- No Updates Message -->
                    <p style="font-size:16px;line-height:24px;color:#707070;font-style:italic;margin:0;padding:20px 0">
                      No notable updates for this topic in the past two weeks.
                    </p>
                  </td>
                </tr>
              </tbody>
            </table>
            `;
              }
              
              return `
            <!-- Topic Section: ${topicName} -->
            <table align="center" width="100%" border="0" cellpadding="0" cellspacing="0" role="presentation" style="background-color:#fbfbfb;margin-bottom:30px;padding-top:43px;padding-left:51px;padding-right:51px;padding-bottom:45px" class="topic-padding">
              <tbody>
                <tr>
                  <td>
                    <!-- Topic Header -->
                    <table align="center" width="100%" border="0" cellpadding="0" cellspacing="0" role="presentation" style="margin-bottom:30px">
                      <tbody>
                        <tr>
                          <td>
                            <table align="center" width="100%" border="0" cellpadding="0" cellspacing="0" role="presentation">
                            <tbody>
                              <tr>
                                <td style="width:40px;vertical-align:middle">
                                  <img src="https://res.cloudinary.com/dgqg2myag/image/upload/v1748662022/snipit-logo_vzcwe5.png" alt="SnipIt" style="display:block;outline:none;border:none;text-decoration:none;height:41px" class="logo-size">
                                </td>
                                <td style="vertical-align:middle">
                                  <p style="font-size:35px;line-height:32px;font-family:Raleway,sans-serif;font-weight:bold;margin-top:16px;margin-bottom:16px;color:#000000" class="topic-title-size">
                                    ${topicName}
                                  </p>
                                </td>
                              </tr>
                            </tbody>
                          </table>
                          </td>
                        </tr>
                      </tbody>
                    </table>
                    
                    <!-- Bullets (Template Style) -->
                    ${(() => {
                      if (isPaid) {
                        // Paid: paragraph format with article title
                        return topicSummary.summaries.map((article) => `
                    <table align="center" width="100%" border="0" cellpadding="0" cellspacing="0" role="presentation" style="margin-bottom:30px">
                      <tbody>
                        <tr>
                          <td style="width:42px;vertical-align:top;padding-top:4px">
                            <img src="https://res.cloudinary.com/dgqg2myag/image/upload/v1748662914/snipit-logo-black_fttbsx.png" alt="•" style="display:block;outline:none;border:none;text-decoration:none;height:27px;width:27px" class="bullet-logo-size">
                          </td>
                          <td style="font-family:Raleway,sans-serif;vertical-align:top">
                            <a href="${article.url}" style="color:#fe7e4c;text-decoration-line:none;font-weight:bold;font-size:22px;margin-top:0;margin-bottom:12px;display:block;line-height:28px" target="_blank" class="article-title-size">${article.title}</a>
                            <p style="font-size:16px;line-height:22px;margin:0;letter-spacing:0;font-weight:500;margin-top:0;margin-bottom:0;margin-left:0;margin-right:0;color:#000000">${article.summary}</p>
                          </td>
                        </tr>
                      </tbody>
                    </table>
                    `).join('');
                      } else {
                        // Free: Group articles by title/URL to avoid duplicate titles
                        // Group summaries by title to combine bullets from the same article
                        const groupedArticles = new Map<string, typeof topicSummary.summaries>();
                        
                        topicSummary.summaries.forEach((article) => {
                          // Use title as the key to group articles
                          const key = article.title;
                          
                          if (!groupedArticles.has(key)) {
                            groupedArticles.set(key, []);
                          }
                          groupedArticles.get(key)!.push(article);
                        });
                        
                        // Render each unique article with all its bullets grouped together
                        return Array.from(groupedArticles.entries()).map(([title, articles]) => {
                          // Use the first article's data (they should all have the same title/url)
                          const firstArticle = articles[0];
                          
                          // Collect all bullets from all articles with this title
                          const allBullets: string[] = [];
                          articles.forEach((article) => {
                            if (article.bullets && Array.isArray(article.bullets) && article.bullets.length > 0) {
                              allBullets.push(...article.bullets);
                            } else if (article.summary) {
                              allBullets.push(article.summary.trim());
                            }
                          });
                          
                          if (allBullets.length === 0) {
                            return '';
                          }
                          
                          // Show title once, then all bullets below it with visual bullet points
                          return `
                    <table align="center" width="100%" border="0" cellpadding="0" cellspacing="0" role="presentation" style="margin-bottom:24px">
                      <tbody>
                        <tr>
                          <td style="width:32px;vertical-align:top;padding-top:4px">
                            <img src="https://res.cloudinary.com/dgqg2myag/image/upload/v1748662914/snipit-logo-black_fttbsx.png" alt="•" style="display:block;outline:none;border:none;text-decoration:none;height:20px;width:20px" />
                          </td>
                          <td style="font-family:Raleway,sans-serif;vertical-align:top">
                            <a href="${firstArticle.url}" style="color:#fe7e4c;text-decoration-line:none;font-weight:bold;font-size:18px;margin-top:0;margin-bottom:6px;display:block;line-height:24px" target="_blank">${title}</a>
                            ${allBullets.map((bullet) => {
                              const cleanBullet = bullet.replace(/^[•\-\*]\s*/, '').trim();
                              if (!cleanBullet || cleanBullet.length === 0) {
                                return '';
                              }
                              // Render each bullet with a visual bullet point
                              return `
                            <table align="left" width="100%" border="0" cellpadding="0" cellspacing="0" role="presentation" style="margin-bottom:8px">
                              <tbody>
                                <tr>
                                  <td style="width:20px;vertical-align:top;padding-top:4px">
                                    <span style="color:#000000;font-size:16px;line-height:22px;">•</span>
                                  </td>
                                  <td style="vertical-align:top;padding-top:0">
                                    <p style="font-size:16px;line-height:22px;margin:0;letter-spacing:0;font-weight:400;color:#000000;word-wrap:break-word;overflow-wrap:break-word;">${cleanBullet}</p>
                                  </td>
                                </tr>
                              </tbody>
                            </table>`;
                            }).join('')}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                    `;
                        }).join('');
                      }
                    })()}
                  </td>
                </tr>
              </tbody>
            </table>
            `;
            }).join('')}
            
            <!-- Footer -->
            <table align="center" width="100%" border="0" cellpadding="0" cellspacing="0" role="presentation" style="background:#2d2d2d;min-height:111px">
              <tbody>
                <tr>
                  <td style="text-align:center;padding:20px">
                    <img src="https://res.cloudinary.com/dgqg2myag/image/upload/v1748666252/logo-white_gp5iuq.png" alt="SnipIt" style="display:block;outline:none;border:none;text-decoration:none;width:100px;max-width:100%;margin:0 auto">
                    <p style="color:#999;font-size:11px;margin-top:10px;font-family:Roboto,sans-serif;line-height:18px">
                      You're receiving this email because you're subscribed to SnipIt News for your selected topics.
                      <br />
                      To manage your preferences or unsubscribe at any time, visit
                      <a href="${appUrl}/dashboard" style="color:#cccccc;text-decoration:none"> your dashboard</a>
                      or
                      <a href="${appUrl}/unsubscribe?email=${encodeURIComponent(email)}" style="color:#cccccc;text-decoration:none">unsubscribe here</a>.
                    </p>
                    <p style="color:#777;font-size:10px;margin-top:8px;font-family:Roboto,sans-serif">© 2024 SnipIt. Stay informed, stay focused.</p>
                  </td>
                </tr>
              </tbody>
            </table>
          </td>
        </tr>
      </tbody>
    </table>
</body>
</html>`;
}
