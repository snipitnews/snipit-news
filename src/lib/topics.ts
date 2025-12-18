export interface MainTopic {
  name: string;
  subtopics: string[];
}

export const TOPICS: MainTopic[] = [
  {
    name: 'Sports',
    subtopics: [
      'NBA',
      'NFL',
      'MLB',
      'NHL',
      'Soccer',
      'La Liga',
      'Ligue 1',
      'EPL',
      'Tennis',
      'Golf',
      'Esports',
      'Motorsports',
      'Athlete Spotlights',
      'Recovery and Injury Prevention',
    ],
  },
  {
    name: 'Politics',
    subtopics: [
      'U.S. Politics',
      'Global Politics',
      'Policy Updates',
      'Elections',
      'Legislative News',
      'International Law',
    ],
  },
  {
    name: 'Technology',
    subtopics: [
      'AI',
      'Startups',
      'Gadgets',
      'Big Tech',
      'Software Development',
      'Blockchain Technology',
      'Space Exploration',
      'Cybersecurity',
      'Emerging Tech Trends',
    ],
  },
  {
    name: 'Business and Finance',
    subtopics: [
      'Stock Market',
      'Startups',
      'Corporate News',
      'Personal Finance Tips',
      'Investments',
      'Cryptocurrency',
      'Bitcoin',
      'Ethereum',
      'NFTs',
      'Economic Policies',
      'Inflation Trends',
      'Job Market',
      'Venture Capital',
      'Business Models',
    ],
  },
  {
    name: 'Science',
    subtopics: [
      'Space Exploration',
      'Medical Research',
      'Environmental Science',
      'Astronomy',
      'NASA Missions',
      'Scientific Discoveries',
    ],
  },
  {
    name: 'Health and Wellness',
    subtopics: [
      'Fitness',
      'Nutrition',
      'Mental Health',
      'Public Health Policies',
      'Therapy Tips',
      'Mindfulness',
      'Coping Mechanisms',
      'Stress Management',
    ],
  },
  {
    name: 'Entertainment',
    subtopics: [
      'Movies',
      'TV Shows',
      'Celebrities',
      'Streaming Platforms',
      'Music',
      'Genres',
      'Albums',
      'Concerts',
      'Podcasts',
      'Reviews',
      'Trends',
      'Stand-Up Comedy',
      'Memes',
    ],
  },
  {
    name: 'Lifestyle and Luxury',
    subtopics: [
      'High-End Fashion',
      'Wellness',
      'Home Decor',
      'Travel',
      'Exclusive Destinations',
      'Fine Dining',
      'Watches',
      'Skincare',
      'Sustainable Living',
    ],
  },
  {
    name: 'Education',
    subtopics: [
      'Higher Education',
      'Online Learning',
      'Trends in Education',
      'EdTech Innovations',
      'Virtual Reality in Education',
    ],
  },
  {
    name: 'World News',
    subtopics: [
      'Regional News',
      'Europe',
      'Asia',
      'Africa',
      'Global Events',
      'Conflict Zones',
      'International Relations',
    ],
  },
  {
    name: 'Environment',
    subtopics: [
      'Climate Change',
      'Renewable Energy',
      'Wildlife Conservation',
      'Marine Conservation',
      'Eco-Tourism',
      'Sustainable Agriculture',
    ],
  },
  {
    name: 'Food',
    subtopics: [
      'Recipes',
      'Restaurant Reviews',
      'Food Trends',
      'Fine Dining',
    ],
  },
  {
    name: 'Gaming',
    subtopics: [
      'Esports',
      'Game Releases',
      'Console Updates',
      'PC Gaming',
    ],
  },
  {
    name: 'Culture',
    subtopics: [
      'Art',
      'Painting',
      'Graphic Design',
      'Sculpture',
      'Architecture',
      'History',
      'Literature',
      'Cultural Festivals',
      'Military History',
      'Pop Culture Analysis',
    ],
  },
  {
    name: 'Parenting and Family',
    subtopics: [
      'Parenting Tips',
      'Child Development',
      'Work-Life Balance',
      'Family Health',
      'Teen Trends',
    ],
  },
  {
    name: 'Automotive',
    subtopics: [
      'Electric Vehicles',
      'Car Reviews',
      'Auto Industry News',
      'Drones in Transportation',
    ],
  },
  {
    name: 'Career and Professional Development',
    subtopics: [
      'Resume Tips',
      'Networking',
      'Industry Trends',
      'Remote Work',
      'Career Growth Strategies',
      'Work Culture',
    ],
  },
  {
    name: 'Military and Defense',
    subtopics: [
      'Global Conflicts',
      'Weapons Technology',
      'Defense Strategies',
      'Cybersecurity in Warfare',
    ],
  },
  {
    name: 'Adventure and Outdoor Activities',
    subtopics: [
      'Hiking',
      'Camping',
      'National Parks',
      'Extreme Sports',
    ],
  },
  {
    name: 'Personal Development',
    subtopics: [
      'Productivity',
      'Time Management',
      'Goal Setting',
      'Emotional Intelligence',
    ],
  },
  {
    name: 'Legal and Policy',
    subtopics: [
      'Landmark Cases',
      'Legal Advice',
      'Intellectual Property',
      'Legislative Updates',
    ],
  },
  {
    name: 'Shopping and Deals',
    subtopics: [
      'E-Commerce',
      'Seasonal Sales',
      'Product Reviews',
      'Discount Alerts',
    ],
  },
  {
    name: 'Festivals and Events',
    subtopics: [
      'Music Festivals',
      'Cultural Celebrations',
      'Conferences',
      'Local Fairs',
    ],
  },
  {
    name: 'Pets and Animals',
    subtopics: [
      'Pet Care',
      'Wildlife',
      'Animal Behavior',
      'Animal Rescue',
    ],
  },
];

// Helper function to get all subtopics as a flat list
export function getAllSubtopics(): string[] {
  return TOPICS.flatMap((topic) => topic.subtopics);
}

// Helper function to search topics
export function searchTopics(query: string): { mainTopic: string; subtopic: string }[] {
  const lowerQuery = query.toLowerCase();
  const results: { mainTopic: string; subtopic: string }[] = [];

  TOPICS.forEach((topic) => {
    // Check if main topic matches
    if (topic.name.toLowerCase().includes(lowerQuery)) {
      topic.subtopics.forEach((subtopic) => {
        results.push({ mainTopic: topic.name, subtopic });
      });
    } else {
      // Check if subtopic matches
      topic.subtopics.forEach((subtopic) => {
        if (subtopic.toLowerCase().includes(lowerQuery)) {
          results.push({ mainTopic: topic.name, subtopic });
        }
      });
    }
  });

  return results;
}

