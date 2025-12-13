// Quick test script to verify environment setup
const requiredEnvVars = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
  'NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY',
  'STRIPE_SECRET_KEY',
  'STRIPE_WEBHOOK_SECRET',
  'OPENAI_API_KEY',
  'NEWS_API_KEY',
  'RESEND_API_KEY',
  'NEXT_PUBLIC_APP_URL',
  'CRON_SECRET',
];

console.log('🔍 Checking environment variables...\n');

let allPresent = true;
requiredEnvVars.forEach((envVar) => {
  if (
    process.env[envVar] &&
    process.env[envVar] !== `your_${envVar.toLowerCase()}_here`
  ) {
    console.log(`✅ ${envVar}`);
  } else {
    console.log(`❌ ${envVar} - Not configured`);
    allPresent = false;
  }
});

console.log('\n' + '='.repeat(50));

if (allPresent) {
  console.log('🎉 All environment variables are configured!');
  console.log('\nNext steps:');
  console.log('1. Set up your Supabase database with the provided schema');
  console.log('2. Configure your Stripe products and webhooks');
  console.log('3. Test the application with: npm run dev');
  console.log('4. Deploy to Vercel when ready!');
} else {
  console.log(
    '⚠️  Please configure the missing environment variables in .env.local'
  );
  console.log('\nSee README.md for detailed setup instructions.');
}

console.log('\n📚 Documentation: README.md');
console.log('🚀 Ready to launch SnipIt!');
