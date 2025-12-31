import { NextRequest, NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe';
import { getSupabaseAdmin } from '@/lib/supabase';

export async function POST(request: NextRequest) {
  // Pro plan is coming soon - return a message instead of processing checkout
  return NextResponse.json(
    { 
      error: 'Pro plan is coming soon! Stay tuned for updates.',
      comingSoon: true 
    },
    { status: 503 }
  );
}

/* Disabled until Pro plan is ready
export async function POST_OLD(request: NextRequest) {
  try {
    const { userId, email } = await request.json();

    if (!userId || !email) {
      return NextResponse.json(
        { error: 'User ID and email are required' },
        { status: 400 }
      );
    }

    // Get or create Stripe customer
    let customerId: string;

    // Check if user already has a Stripe customer ID
    const { data: user, error: userError } = await getSupabaseAdmin()
      .from('users')
      .select('stripe_customer_id')
      .eq('id', userId)
      .single<{ stripe_customer_id: string | null }>();

    if (userError) {
      return NextResponse.json({ error: userError.message }, { status: 500 });
    }

    if (user.stripe_customer_id) {
      customerId = user.stripe_customer_id;
    } else {
      // Create new Stripe customer
      const customer = await stripe.customers.create({
        email,
        metadata: {
          userId,
        },
      });
      customerId = customer.id;

      // Update user with Stripe customer ID
      const { error: updateError } = await getSupabaseAdmin()
        .from('users')
        .update({ stripe_customer_id: customerId } as never)
        .eq('id', userId);

      if (updateError) {
        console.error(
          'Error updating user with Stripe customer ID:',
          updateError
        );
      }
    }

    // Create checkout session
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: 'SnipIt Pro',
              description:
                'Upgrade to SnipIt Pro for 10 topics and paragraph summaries',
            },
            unit_amount: 99, // $0.99 in cents
            recurring: {
              interval: 'month',
            },
          },
          quantity: 1,
        },
      ],
      mode: 'subscription',
      success_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard?upgraded=true`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard`,
      metadata: {
        userId,
      },
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error('Error creating checkout session:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
*/
