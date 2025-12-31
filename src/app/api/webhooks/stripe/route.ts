import { NextRequest, NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe';
import { getSupabaseAdmin } from '@/lib/supabase';
import Stripe from 'stripe';

export async function POST(request: NextRequest) {
  const body = await request.text();
  const signature = request.headers.get('stripe-signature');

  if (!signature) {
    return NextResponse.json({ error: 'No signature' }, { status: 400 });
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!,
      300 // tolerance in seconds (default: 300)
    );
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    console.error('Webhook signature verification failed:', errorMessage);
    return NextResponse.json(
      { error: `Webhook Error: ${errorMessage}` },
      { status: 400 }
    );
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        const userId = session.metadata?.userId;

        if (!userId) {
          console.error('No userId in session metadata');
          break;
        }

        // Update user to paid tier
        const { error: userError } = await getSupabaseAdmin()
          .from('users')
          .update({ subscription_tier: 'paid' } as never)
          .eq('id', userId);

        if (userError) {
          console.error('Error updating user tier:', userError);
        }

        break;
      }

      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription;
        const customerId = subscription.customer as string;

        // Get user by Stripe customer ID
        const { data: user, error: userError } = await getSupabaseAdmin()
          .from('users')
          .select('id')
          .eq('stripe_customer_id', customerId)
          .single<{ id: string }>();

        if (userError || !user) {
          console.error('Error finding user by customer ID:', userError);
          break;
        }

        // Update or create subscription metadata
        // Type assertion needed because Stripe types may not include all properties
        const subscriptionData = subscription as Stripe.Subscription & { current_period_end?: number };
        const { error: subError } = await getSupabaseAdmin()
          .from('subscription_metadata')
          .upsert(
            {
              user_id: user.id,
              stripe_subscription_id: subscription.id,
              status: subscription.status,
              current_period_end: subscriptionData.current_period_end
                ? new Date(subscriptionData.current_period_end * 1000).toISOString()
                : new Date().toISOString(),
            } as never,
            {
              onConflict: 'stripe_subscription_id',
            }
          );

        if (subError) {
          console.error('Error updating subscription metadata:', subError);
        }

        // Update user tier based on subscription status
        const isActive = subscription.status === 'active';
        const { error: tierError } = await getSupabaseAdmin()
          .from('users')
          .update({ subscription_tier: isActive ? 'paid' : 'free' } as never)
          .eq('id', user.id);

        if (tierError) {
          console.error('Error updating user tier:', tierError);
        }

        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        const customerId = subscription.customer as string;

        // Get user by Stripe customer ID
        const { data: user, error: userError } = await getSupabaseAdmin()
          .from('users')
          .select('id')
          .eq('stripe_customer_id', customerId)
          .single<{ id: string }>();

        if (userError || !user) {
          console.error('Error finding user by customer ID:', userError);
          break;
        }

        // Update subscription metadata
        const { error: subError } = await getSupabaseAdmin()
          .from('subscription_metadata')
          .update({
            status: 'canceled',
          } as never)
          .eq('stripe_subscription_id', subscription.id);

        if (subError) {
          console.error('Error updating subscription metadata:', subError);
        }

        // Downgrade user to free tier
        const { error: tierError } = await getSupabaseAdmin()
          .from('users')
          .update({ subscription_tier: 'free' } as never)
          .eq('id', user.id);

        if (tierError) {
          console.error('Error downgrading user tier:', tierError);
        }

        break;
      }

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('Error processing webhook:', error);
    return NextResponse.json(
      { error: 'Webhook processing failed' },
      { status: 500 }
    );
  }
}
