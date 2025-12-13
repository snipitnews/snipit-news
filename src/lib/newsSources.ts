// Topic-specific news sources with priority levels
export const TOPIC_SOURCES: Record<string, string[]> = {
  // Sports
  nba: [
    'espn.com',
    'nba.com',
    'sports.yahoo.com',
    'bleacherreport.com',
    'theathletic.com',
  ],
  nfl: [
    'espn.com',
    'nfl.com',
    'sports.yahoo.com',
    'bleacherreport.com',
    'theathletic.com',
  ],
  soccer: [
    'espn.com',
    'theguardian.com',
    'goal.com',
    'skysports.com',
    'fifa.com',
  ],
  tennis: [
    'espn.com',
    'atptour.com',
    'wta.com',
    'tennis.com',
    'sports.yahoo.com',
  ],

  // Technology
  'artificial intelligence': [
    'wired.com',
    'technologyreview.com',
    'arstechnica.com',
    'techcrunch.com',
    'theverge.com',
  ],
  ai: [
    'wired.com',
    'technologyreview.com',
    'arstechnica.com',
    'techcrunch.com',
    'theverge.com',
  ],
  cybersecurity: [
    'wired.com',
    'krebsonsecurity.com',
    'darkreading.com',
    'zdnet.com',
    'thehackernews.com',
  ],
  'space exploration': [
    'nasa.gov',
    'space.com',
    'scientificamerican.com',
    'nature.com',
    'science.org',
  ],
  tech: [
    'techcrunch.com',
    'theverge.com',
    'wired.com',
    'arstechnica.com',
    'reuters.com',
  ],

  // Business and Finance
  'stock market': [
    'bloomberg.com',
    'wsj.com',
    'reuters.com',
    'cnbc.com',
    'ft.com',
  ],
  cryptocurrency: [
    'coindesk.com',
    'cointelegraph.com',
    'bloomberg.com',
    'wsj.com',
    'reuters.com',
  ],
  crypto: [
    'coindesk.com',
    'cointelegraph.com',
    'bloomberg.com',
    'wsj.com',
    'reuters.com',
  ],
  startups: [
    'techcrunch.com',
    'venturebeat.com',
    'bloomberg.com',
    'wsj.com',
    'reuters.com',
  ],
  business: ['bloomberg.com', 'wsj.com', 'reuters.com', 'cnbc.com', 'ft.com'],

  // Politics
  'us politics': [
    'politico.com',
    'reuters.com',
    'apnews.com',
    'washingtonpost.com',
    'nytimes.com',
  ],
  politics: [
    'politico.com',
    'reuters.com',
    'apnews.com',
    'washingtonpost.com',
    'nytimes.com',
  ],
  'global politics': [
    'reuters.com',
    'apnews.com',
    'bbc.com',
    'theguardian.com',
    'foreignpolicy.com',
  ],

  // Science
  'medical research': [
    'nature.com',
    'science.org',
    'scientificamerican.com',
    'statnews.com',
    'reuters.com',
  ],
  'climate change': [
    'nature.com',
    'science.org',
    'scientificamerican.com',
    'reuters.com',
    'theguardian.com',
  ],
  climate: [
    'nature.com',
    'science.org',
    'scientificamerican.com',
    'reuters.com',
    'theguardian.com',
  ],

  // Health and Wellness
  'mental health': [
    'reuters.com',
    'apnews.com',
    'statnews.com',
    'scientificamerican.com',
    'psychologytoday.com',
  ],
  fitness: [
    'reuters.com',
    'apnews.com',
    'menshealth.com',
    'womenshealthmag.com',
    'shape.com',
  ],

  // Entertainment
  movies: [
    'variety.com',
    'hollywoodreporter.com',
    'deadline.com',
    'indiewire.com',
    'reuters.com',
  ],
  music: [
    'billboard.com',
    'pitchfork.com',
    'rollingstone.com',
    'reuters.com',
    'apnews.com',
  ],

  // World News
  europe: [
    'reuters.com',
    'apnews.com',
    'bbc.com',
    'theguardian.com',
    'politico.eu',
  ],
  asia: [
    'reuters.com',
    'apnews.com',
    'scmp.com',
    'japantimes.co.jp',
    'straitstimes.com',
  ],
  'world news': [
    'reuters.com',
    'apnews.com',
    'bbc.com',
    'theguardian.com',
    'nytimes.com',
  ],

  // Environment
  'renewable energy': [
    'reuters.com',
    'bloomberg.com',
    'nature.com',
    'science.org',
    'scientificamerican.com',
  ],
  wildlife: [
    'nature.com',
    'science.org',
    'scientificamerican.com',
    'reuters.com',
    'nationalgeographic.com',
  ],

  // Food
  restaurants: [
    'eater.com',
    'grubstreet.com',
    'reuters.com',
    'apnews.com',
    'nytimes.com',
  ],
  'food trends': [
    'eater.com',
    'grubstreet.com',
    'reuters.com',
    'apnews.com',
    'nytimes.com',
  ],

  // Gaming
  'video games': [
    'polygon.com',
    'kotaku.com',
    'ign.com',
    'gamespot.com',
    'reuters.com',
  ],
  esports: ['espn.com', 'polygon.com', 'kotaku.com', 'ign.com', 'gamespot.com'],

  // Culture
  art: [
    'artnews.com',
    'artforum.com',
    'reuters.com',
    'apnews.com',
    'nytimes.com',
  ],
  literature: [
    'nytimes.com',
    'theguardian.com',
    'reuters.com',
    'apnews.com',
    'publishersweekly.com',
  ],
};

// Default sources to use when no topic-specific sources are found
export const DEFAULT_SOURCES = [
  'reuters.com',
  'apnews.com',
  'bloomberg.com',
  'wsj.com',
  'nytimes.com',
];

// Helper function to get sources for a topic
export function getSourcesForTopic(topic: string): string[] {
  // Convert topic to lowercase for matching
  const normalizedTopic = topic.toLowerCase().trim();

  // Find matching topic sources
  for (const [key, sources] of Object.entries(TOPIC_SOURCES)) {
    if (normalizedTopic.includes(key.toLowerCase())) {
      return sources;
    }
  }

  // Return default sources if no match found
  return DEFAULT_SOURCES;
}
